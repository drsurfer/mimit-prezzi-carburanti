"""
server.py - Server HTTP e REST API per Carburanti MIMIT
Nessuna dipendenza esterna richiesta (utilizza solo la libreria standard Python 3).
Eseguibile sia in locale che su server / container Docker.
Ottimizzato per servire il dataset compatto e permettere il 100% del rendering client-side.
"""

import os
import sys
import json
import gzip
import sqlite3
import threading
import urllib.parse
from http import HTTPStatus
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(BASE_DIR, "carburanti.db")
PUBLIC_DIR = os.path.join(BASE_DIR, "public")

# Stato globale per aggiornamento ETL
ETL_LOCK = threading.Lock()
ETL_STATUS = {
    "is_running": False,
    "last_run": None,
    "error": None,
    "message": "Nessun aggiornamento in corso"
}

def get_db_connection():
    if not os.path.exists(DB_FILE):
        return None
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def trigger_background_etl():
    def _worker():
        global ETL_STATUS
        with ETL_LOCK:
            ETL_STATUS["is_running"] = True
            ETL_STATUS["error"] = None
            ETL_STATUS["message"] = "Download e aggiornamento dati MIMIT in corso..."
            try:
                import etl
                import importlib
                importlib.reload(etl)
                etl.run_etl()
                ETL_STATUS["message"] = "Aggiornamento completato con successo"
            except Exception as e:
                ETL_STATUS["error"] = str(e)
                ETL_STATUS["message"] = f"Errore durante l'aggiornamento: {e}"
            finally:
                from datetime import datetime
                ETL_STATUS["is_running"] = False
                ETL_STATUS["last_run"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    t = threading.Thread(target=_worker, daemon=True)
    t.start()

class CarburantiRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/")
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/api/status":
            self.handle_api_status()
        elif path == "/api/brands":
            self.handle_api_brands()
        elif path == "/api/stations" or path == "/api/stations/all":
            self.handle_api_stations(query)
        elif path.startswith("/api/stations/"):
            station_id = path.split("/")[-1]
            self.handle_api_single_station(station_id)
        elif path == "/api/export/geojson":
            self.handle_api_geojson(query)
        elif path == "/api/export/kml":
            self.handle_api_kml(query)
        elif path == "/api/update/status":
            self.handle_api_update_status()
        else:
            # File statico (public/index.html, immagini PNG, css, js, ecc.)
            super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/api/update":
            self.handle_api_update_trigger()
        else:
            self.send_error(HTTPStatus.NOT_FOUND, "Endpoint non trovato")

    def send_json_response(self, data, status_code=200):
        json_bytes = json.dumps(data, ensure_ascii=False).encode("utf-8")
        
        # Supporto compressione gzip se supportato dal browser
        accept_encoding = self.headers.get("Accept-Encoding", "")
        if "gzip" in accept_encoding and len(json_bytes) > 512:
            compressed = gzip.compress(json_bytes, compresslevel=6)
            self.send_response(status_code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Content-Length", str(len(compressed)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(compressed)
        else:
            self.send_response(status_code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(json_bytes)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(json_bytes)

    def handle_api_status(self):
        conn = get_db_connection()
        if not conn:
            self.send_json_response({"ok": False, "error": "Database non trovato. Esegui etl.py prima."}, 503)
            return

        try:
            cursor = conn.cursor()
            cursor.execute("SELECT chiave, valore FROM metadata")
            meta = {r["chiave"]: r["valore"] for r in cursor.fetchall()}

            cursor.execute("SELECT COUNT(*) FROM distributori")
            total_active = cursor.fetchone()[0]

            cursor.execute("""
                SELECT 
                    ROUND(AVG(prezzo_benzina_self), 3) as avg_benz_self,
                    ROUND(MIN(prezzo_benzina_self), 3) as min_benz_self,
                    ROUND(AVG(prezzo_gasolio_self), 3) as avg_gas_self,
                    ROUND(MIN(prezzo_gasolio_self), 3) as min_gas_self
                FROM distributori
                WHERE prezzo_benzina_self > 0.5 AND prezzo_gasolio_self > 0.5
            """)
            stats = dict(cursor.fetchone())

            res = {
                "ok": True,
                "metadata": meta,
                "totale_distributori": total_active,
                "statistiche": stats,
                "etl_status": ETL_STATUS
            }
            self.send_json_response(res)
        finally:
            conn.close()

    def handle_api_brands(self):
        conn = get_db_connection()
        if not conn:
            self.send_json_response([], 503)
            return
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT bandiera, COUNT(*) as count 
                FROM distributori 
                WHERE bandiera IS NOT NULL AND bandiera != ''
                GROUP BY bandiera 
                ORDER BY count DESC 
                LIMIT 40
            """)
            brands = [{"bandiera": r["bandiera"], "count": r["count"]} for r in cursor.fetchall()]
            self.send_json_response(brands)
        finally:
            conn.close()

    def handle_api_stations(self, query):
        conn = get_db_connection()
        if not conn:
            self.send_json_response([], 503)
            return

        try:
            cursor = conn.cursor()
            where_clauses = ["latitudine IS NOT NULL", "longitudine IS NOT NULL"]
            params = []

            # Bounding box se specificato
            north = query.get("north", [None])[0]
            south = query.get("south", [None])[0]
            east = query.get("east", [None])[0]
            west = query.get("west", [None])[0]

            if north and south and east and west:
                try:
                    n, s = float(north), float(south)
                    e, w = float(east), float(west)
                    where_clauses.append("latitudine BETWEEN ? AND ?")
                    params.extend([min(s, n), max(s, n)])
                    where_clauses.append("longitudine BETWEEN ? AND ?")
                    params.extend([min(w, e), max(w, e)])
                except ValueError:
                    pass

            # Brand filter
            brand = query.get("brand", [None])[0]
            if brand and brand != "TUTTI":
                if brand == "POMPE_BIANCHE":
                    where_clauses.append("(bandiera LIKE '%Bianche%' OR bandiera = 'Pompe Bianche' OR bandiera = 'No Logo' OR bandiera = 'Altro' OR bandiera IS NULL)")
                else:
                    where_clauses.append("bandiera = ?")
                    params.append(brand)

            # Fuel & Mode Filter
            fuel = query.get("fuel", ["tutti"])[0].lower()
            service = query.get("service", ["tutti"])[0].lower()

            if fuel == "benzina":
                if service == "self":
                    where_clauses.append("prezzo_benzina_self IS NOT NULL")
                elif service == "servito":
                    where_clauses.append("prezzo_benzina_servito IS NOT NULL")
                else:
                    where_clauses.append("prezzo_benzina_min IS NOT NULL")
            elif fuel == "gasolio":
                if service == "self":
                    where_clauses.append("prezzo_gasolio_self IS NOT NULL")
                elif service == "servito":
                    where_clauses.append("prezzo_gasolio_servito IS NOT NULL")
                else:
                    where_clauses.append("prezzo_gasolio_min IS NOT NULL")
            elif fuel == "gpl":
                where_clauses.append("prezzo_gpl IS NOT NULL")
            elif fuel == "metano":
                where_clauses.append("prezzo_metano IS NOT NULL")

            # Max price filter
            max_price = query.get("max_price", [None])[0]
            if max_price:
                try:
                    mp = float(max_price)
                    if fuel == "gasolio":
                        where_clauses.append("prezzo_gasolio_min <= ?")
                    else:
                        where_clauses.append("prezzo_benzina_min <= ?")
                    params.append(mp)
                except ValueError:
                    pass

            # Search text query
            search = query.get("search", [None])[0]
            if search and search.strip():
                s_term = f"%{search.strip()}%"
                where_clauses.append("(comune LIKE ? OR provincia LIKE ? OR nome LIKE ? OR gestore LIKE ? OR indirizzo LIKE ?)")
                params.extend([s_term, s_term, s_term, s_term, s_term])

            # Limit: 30000 per coprire tutti i distributori italiani senza troncamenti
            limit_str = query.get("limit", ["35000"])[0]
            try:
                limit = int(limit_str)
                if limit <= 0 or limit > 50000:
                    limit = 35000
            except ValueError:
                limit = 35000

            where_sql = " AND ".join(where_clauses)
            sql = f"""
                SELECT 
                    id_impianto, nome, gestore, bandiera,
                    indirizzo, comune, provincia, latitudine, longitudine,
                    prezzo_benzina_self, prezzo_benzina_servito,
                    prezzo_gasolio_self, prezzo_gasolio_servito,
                    prezzo_gpl, prezzo_metano,
                    prezzo_benzina_min, prezzo_gasolio_min,
                    ultimo_aggiornamento
                FROM distributori
                WHERE {where_sql}
                LIMIT ?
            """
            params.append(limit)
            cursor.execute(sql, params)
            rows = [dict(r) for r in cursor.fetchall()]

            self.send_json_response(rows)
        finally:
            conn.close()

    def handle_api_single_station(self, station_id):
        conn = get_db_connection()
        if not conn:
            self.send_json_response({"error": "Database non pronto"}, 503)
            return

        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM distributori WHERE id_impianto = ?", (station_id,))
            station = cursor.fetchone()
            if not station:
                self.send_json_response({"error": "Impianto non trovato"}, 404)
                return

            self.send_json_response(dict(station))
        finally:
            conn.close()

    def handle_api_geojson(self, query):
        conn = get_db_connection()
        if not conn:
            self.send_json_response({}, 503)
            return

        try:
            cursor = conn.cursor()
            where_clauses = ["latitudine IS NOT NULL", "longitudine IS NOT NULL"]
            params = []

            prov = query.get("provincia", [None])[0]
            if prov:
                where_clauses.append("provincia = ?")
                params.append(prov.upper())

            comune = query.get("comune", [None])[0]
            if comune:
                where_clauses.append("comune LIKE ?")
                params.append(f"%{comune}%")

            where_sql = " AND ".join(where_clauses)
            cursor.execute(f"""
                SELECT 
                    id_impianto, nome, gestore, bandiera,
                    indirizzo, comune, provincia, latitudine, longitudine,
                    prezzo_benzina_self, prezzo_benzina_servito,
                    prezzo_gasolio_self, prezzo_gasolio_servito,
                    prezzo_gpl, prezzo_metano,
                    prezzo_benzina_min, prezzo_gasolio_min,
                    ultimo_aggiornamento
                FROM distributori
                WHERE {where_sql}
            """, params)

            features = []
            for r in cursor.fetchall():
                features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [r["longitudine"], r["latitudine"]]
                    },
                    "properties": {
                        "id": r["id_impianto"],
                        "nome": r["nome"],
                        "gestore": r["gestore"],
                        "bandiera": r["bandiera"],
                        "indirizzo": f"{r['indirizzo']}, {r['comune']} ({r['provincia']})",
                        "prezzo_benzina_self": r["prezzo_benzina_self"],
                        "prezzo_benzina_servito": r["prezzo_benzina_servito"],
                        "prezzo_gasolio_self": r["prezzo_gasolio_self"],
                        "prezzo_gasolio_servito": r["prezzo_gasolio_servito"],
                        "prezzo_gpl": r["prezzo_gpl"],
                        "prezzo_metano": r["prezzo_metano"],
                        "ultimo_aggiornamento": r["ultimo_aggiornamento"]
                    }
                })

            geojson = {
                "type": "FeatureCollection",
                "features": features
            }
            self.send_json_response(geojson)
        finally:
            conn.close()

    def handle_api_kml(self, query):
        conn = get_db_connection()
        if not conn:
            self.send_error(503, "Database non disponibile")
            return

        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT 
                    id_impianto, nome, bandiera, indirizzo, comune, provincia,
                    latitudine, longitudine,
                    prezzo_benzina_self, prezzo_benzina_servito,
                    prezzo_gasolio_self, prezzo_gasolio_servito,
                    ultimo_aggiornamento
                FROM distributori
                WHERE latitudine IS NOT NULL AND longitudine IS NOT NULL
                LIMIT 5000
            """)
            rows = cursor.fetchall()

            kml_parts = [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<kml xmlns="http://www.opengis.net/kml/2.2">',
                '<Document>',
                '<name>Distributori Carburanti Italia (MIMIT)</name>',
                '<description>Prezzi Benzina e Gasolio praticati dai distributori italiani</description>'
            ]

            for r in rows:
                nome = (r["nome"] or "Distributore").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                indirizzo = f"{r['indirizzo']}, {r['comune']} ({r['provincia']})".replace("&", "&amp;")
                b_self = f"{r['prezzo_benzina_self']:.3f} €/L" if r['prezzo_benzina_self'] else "N.D."
                b_serv = f"{r['prezzo_benzina_servito']:.3f} €/L" if r['prezzo_benzina_servito'] else "N.D."
                g_self = f"{r['prezzo_gasolio_self']:.3f} €/L" if r['prezzo_gasolio_self'] else "N.D."
                g_serv = f"{r['prezzo_gasolio_servito']:.3f} €/L" if r['prezzo_gasolio_servito'] else "N.D."
                dt = r["ultimo_aggiornamento"] or ""

                desc = f"""<![CDATA[
                    <b>Indirizzo:</b> {indirizzo}<br/>
                    <b>Benzina:</b> Self: {b_self} | Servito: {b_serv}<br/>
                    <b>Gasolio:</b> Self: {g_self} | Servito: {g_serv}<br/>
                    <b>Aggiornato:</b> {dt}
                ]]>"""

                kml_parts.append(f"""
                <Placemark>
                    <name>{nome}</name>
                    <description>{desc}</description>
                    <Point>
                        <coordinates>{r['longitudine']},{r['latitudine']},0</coordinates>
                    </Point>
                </Placemark>
                """)

            kml_parts.append('</Document></kml>')
            kml_str = "\n".join(kml_parts)
            kml_bytes = kml_str.encode("utf-8")

            self.send_response(200)
            self.send_header("Content-Type", "application/vnd.google-earth.kml+xml; charset=utf-8")
            self.send_header("Content-Disposition", 'attachment; filename="distributori_carburanti.kml"')
            self.send_header("Content-Length", str(len(kml_bytes)))
            self.end_headers()
            self.wfile.write(kml_bytes)
        finally:
            conn.close()

    def handle_api_update_trigger(self):
        global ETL_STATUS
        if ETL_STATUS["is_running"]:
            self.send_json_response({"ok": False, "message": "Aggiornamento già in corso"}, 409)
            return
        trigger_background_etl()
        self.send_json_response({"ok": True, "message": "Aggiornamento dati MIMIT avviato in background"})

    def handle_api_update_status(self):
        self.send_json_response(ETL_STATUS)

def run_server(port=8080):
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    if not os.path.exists(DB_FILE):
        print(f"Database {DB_FILE} non trovato. Avvio prima estrazione ETL MIMIT...")
        try:
            import etl
            etl.main()
        except Exception as e:
            print(f"Attenzione: impossibile generare il database: {e}")

    server_address = ("", port)
    httpd = ThreadingHTTPServer(server_address, CarburantiRequestHandler)
    db_size_mb = (os.path.getsize(DB_FILE) / (1024 * 1024)) if os.path.exists(DB_FILE) else 0.0
    print(f"================================================================")
    print(f"  MIMIT CARBURANTI - SERVER ATTIVO")
    print(f"  URL Locale: http://localhost:{port}")
    print(f"  Database SQLite: {DB_FILE} ({db_size_mb:.2f} MB)")
    print(f"  Cartella Web: {PUBLIC_DIR}")
    print(f"================================================================")
    print(f"Premi CTRL+C per arrestare il server.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nArresto del server...")
        httpd.server_close()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    run_server(port)
