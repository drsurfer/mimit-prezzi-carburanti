"""
etl.py - Download e caricamento compatto dei dati MIMIT Carburanti in SQLite
Ottimizzato per la massima compattezza del database e prestazioni client-side.
"""
import os
import sys
import time
import csv
import io
import sqlite3
import urllib.request
import json
from datetime import datetime

URL_ANAGRAFICA = "https://www.mimit.gov.it/images/exportCSV/anagrafica_impianti_attivi.csv"
URL_PREZZI = "https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv"
DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "carburanti.db")
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

def download_file(url, target_path, max_retries=3):
    print(f"Scaricamento da {url}...")
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
        "Connection": "keep-alive"
    }

    # 1. Prova prima con curl (molto più robusto sui runner Linux/Ubuntu per TLS, redirect e WAF)
    try:
        import subprocess
        res = subprocess.run(
            [
                "curl", "-sSL",
                "--connect-timeout", "30",
                "--max-time", "120",
                "--retry", "3",
                "--retry-delay", "3",
                "-H", f"User-Agent: {headers['User-Agent']}",
                "-H", f"Accept: {headers['Accept']}",
                "-H", f"Accept-Language: {headers['Accept-Language']}",
                url,
                "-o", target_path
            ],
            capture_output=True,
            timeout=130
        )
        if res.returncode == 0 and os.path.exists(target_path) and os.path.getsize(target_path) > 1024:
            mb = os.path.getsize(target_path) / (1024 * 1024)
            print(f"Completato (tramite curl): {mb:.2f} MB -> {target_path}")
            return target_path
    except Exception:
        pass

    # 2. Fallback su urllib con tentativi multipli e timeout esteso
    last_err = None
    for attempt in range(1, max_retries + 1):
        try:
            req = urllib.request.Request(url, headers=headers)
            t0 = time.time()
            with urllib.request.urlopen(req, timeout=90) as response, open(target_path, "wb") as out_file:
                chunk_size = 64 * 1024
                total_bytes = 0
                while True:
                    chunk = response.read(chunk_size)
                    if not chunk:
                        break
                    out_file.write(chunk)
                    total_bytes += len(chunk)
            elapsed = time.time() - t0
            mb = total_bytes / (1024 * 1024)
            print(f"Completato (tentativo {attempt}): {mb:.2f} MB in {elapsed:.2f}s -> {target_path}")
            return target_path
        except Exception as err:
            last_err = err
            print(f"Tentativo {attempt}/{max_retries} fallito ({err})...")
            if attempt < max_retries:
                time.sleep(4)

    raise last_err

def parse_float_safe(val):
    if not val:
        return None
    try:
        return float(val.replace(",", ".").strip())
    except ValueError:
        return None

def run_etl():
    os.makedirs(DATA_DIR, exist_ok=True)
    anagrafica_csv = os.path.join(DATA_DIR, "anagrafica_impianti_attivi.csv")
    prezzi_csv = os.path.join(DATA_DIR, "prezzo_alle_8.csv")

    t_start = time.time()
    print("=== AVVIO PROCEDURA ACQUISIZIONE DATI CARBURANTI MIMIT ===")
    
    # Se i file CSV esistono già e hanno meno di 12 ore, possono essere riusati in caso di offline
    try:
        download_file(URL_ANAGRAFICA, anagrafica_csv)
        download_file(URL_PREZZI, prezzi_csv)
    except Exception as e:
        if os.path.exists(anagrafica_csv) and os.path.exists(prezzi_csv):
            print(f"[AVVISO] Download fallito ({e}), utilizzo copie locali dei file CSV.")
        else:
            public_stations = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public", "data", "stations.json")
            if os.path.exists(public_stations) and os.path.getsize(public_stations) > 10000:
                print(f"[AVVISO] Download MIMIT non riuscito ({e}). I file JSON statici in public/data/ sono già presenti e validi: mantengo i dati esistenti.")
                return
            else:
                raise e

    print(f"\nConnessione al database SQLite: {DB_FILE}...")
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    try:
        # Configurazione PRAGMA per alte prestazioni e massima compattezza
        cursor.execute("PRAGMA synchronous = OFF")
        cursor.execute("PRAGMA journal_mode = MEMORY")
        cursor.execute("PRAGMA page_size = 4096")

        # In SQLite una vista non può essere eliminata con DROP TABLE (genera errore: use DROP VIEW)
        cursor.execute("DROP VIEW IF EXISTS distributori_completi")
        cursor.execute("DROP TABLE IF EXISTS distributori_completi")
        cursor.execute("DROP TABLE IF EXISTS distributori")
        cursor.execute("DROP TABLE IF EXISTS impianti")
        cursor.execute("DROP TABLE IF EXISTS prezzi")
        cursor.execute("DROP TABLE IF EXISTS metadata")

        # Tabelle temporanee in memoria per l'aggregazione rapida
        cursor.execute("""
            CREATE TEMP TABLE temp_impianti (
                id_impianto INTEGER PRIMARY KEY,
                gestore TEXT,
                bandiera TEXT,
                nome_impianto TEXT,
                indirizzo TEXT,
                comune TEXT,
                provincia TEXT,
                latitudine REAL,
                longitudine REAL
            )
        """)

        cursor.execute("""
            CREATE TEMP TABLE temp_prezzi (
                id_impianto INTEGER,
                desc_carburante TEXT,
                prezzo REAL,
                is_self INTEGER,
                dt_comu TEXT
            )
        """)
        cursor.execute("CREATE INDEX temp_idx_p ON temp_prezzi(id_impianto)")

        # 1. Parsing Anagrafica Impianti
        print("Elaborazione anagrafica impianti...")
        extraction_date = "Sconosciuta"
        impianti_rows = []

        with open(anagrafica_csv, "r", encoding="utf-8", errors="replace") as f:
            first_line = f.readline().strip()
            if "Estrazione del" in first_line:
                extraction_date = first_line.replace("Estrazione del", "").strip()

            reader = csv.DictReader(f, delimiter="|")
            for row in reader:
                try:
                    id_imp = int(row.get("idImpianto", 0))
                except ValueError:
                    continue

                lat = parse_float_safe(row.get("Latitudine", ""))
                lng = parse_float_safe(row.get("Longitudine", ""))

                # Coordinate valide per l'Italia
                if lat is not None and lng is not None:
                    if not (35.0 <= lat <= 48.0 and 6.0 <= lng <= 19.5):
                        continue
                    lat = round(lat, 6)
                    lng = round(lng, 6)
                else:
                    continue

                gestore = row.get("Gestore", "").strip()
                bandiera = row.get("Bandiera", "").strip()
                nome_impianto = row.get("Nome Impianto", "").strip()
                indirizzo = row.get("Indirizzo", "").strip()
                comune = row.get("Comune", "").strip()
                provincia = row.get("Provincia", "").strip()

                impianti_rows.append((id_imp, gestore, bandiera, nome_impianto, indirizzo, comune, provincia, lat, lng))

        cursor.executemany("INSERT INTO temp_impianti VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", impianti_rows)
        print(f"Inseriti {len(impianti_rows)} impianti con coordinate valide.")

        # 2. Parsing Prezzi
        print("Elaborazione prezzi...")
        prezzi_rows = []
        with open(prezzi_csv, "r", encoding="utf-8", errors="replace") as f:
            f.readline()
            reader = csv.DictReader(f, delimiter="|")
            for row in reader:
                try:
                    id_imp = int(row.get("idImpianto", 0))
                except ValueError:
                    continue
                desc = row.get("descCarburante", "").strip()
                prezzo = parse_float_safe(row.get("prezzo", ""))
                if prezzo is None or prezzo <= 0.5 or prezzo > 4.5:
                    continue
                is_self = 1 if str(row.get("isSelf", "0")).strip() == "1" else 0
                dt_comu = row.get("dtComu", "").strip()
                prezzi_rows.append((id_imp, desc, prezzo, is_self, dt_comu))

        cursor.executemany("INSERT INTO temp_prezzi VALUES (?, ?, ?, ?, ?)", prezzi_rows)
        print(f"Inserite {len(prezzi_rows)} rilevazioni di prezzo.")

        # 3. Creazione Tabella Definitiva Compatta
        print("Creazione tabella compatta 'distributori'...")
        cursor.execute("""
            CREATE TABLE distributori (
                id_impianto INTEGER PRIMARY KEY,
                nome TEXT,
                gestore TEXT,
                bandiera TEXT,
                indirizzo TEXT,
                comune TEXT,
                provincia TEXT,
                latitudine REAL,
                longitudine REAL,
                prezzo_benzina_self REAL,
                prezzo_benzina_servito REAL,
                prezzo_gasolio_self REAL,
                prezzo_gasolio_servito REAL,
                prezzo_gpl REAL,
                prezzo_metano REAL,
                prezzo_benzina_min REAL,
                prezzo_gasolio_min REAL,
                ultimo_aggiornamento TEXT
            )
        """)

        cursor.execute("""
            INSERT INTO distributori
            SELECT 
                i.id_impianto,
                CASE 
                    WHEN i.bandiera != '' AND i.bandiera != 'Pompe Bianche' AND i.bandiera != 'Altro' 
                        THEN i.bandiera || ' - ' || COALESCE(NULLIF(i.nome_impianto, ''), i.comune)
                    ELSE COALESCE(NULLIF(i.nome_impianto, ''), i.gestore, 'Distributore Carburanti')
                END AS nome,
                i.gestore,
                i.bandiera,
                i.indirizzo,
                i.comune,
                i.provincia,
                i.latitudine,
                i.longitudine,
                p_agg.b_self,
                p_agg.b_serv,
                p_agg.g_self,
                p_agg.g_serv,
                p_agg.gpl,
                p_agg.metano,
                COALESCE(p_agg.b_self, p_agg.b_serv) AS prezzo_benzina_min,
                COALESCE(p_agg.g_self, p_agg.g_serv) AS prezzo_gasolio_min,
                p_agg.max_dt
            FROM temp_impianti i
            LEFT JOIN (
                SELECT 
                    id_impianto,
                    MIN(CASE WHEN desc_carburante = 'Benzina' AND is_self = 1 THEN prezzo END) AS b_self,
                    MIN(CASE WHEN desc_carburante = 'Benzina' AND is_self = 0 THEN prezzo END) AS b_serv,
                    MIN(CASE WHEN desc_carburante = 'Gasolio' AND is_self = 1 THEN prezzo END) AS g_self,
                    MIN(CASE WHEN desc_carburante = 'Gasolio' AND is_self = 0 THEN prezzo END) AS g_serv,
                    MIN(CASE WHEN desc_carburante = 'GPL' THEN prezzo END) AS gpl,
                    MIN(CASE WHEN desc_carburante = 'Metano' THEN prezzo END) AS metano,
                    MAX(dt_comu) AS max_dt
                FROM temp_prezzi
                GROUP BY id_impianto
            ) p_agg ON i.id_impianto = p_agg.id_impianto
        """)

        # Indice per coordinate spaziali
        cursor.execute("CREATE INDEX idx_dist_coords ON distributori(latitudine, longitudine)")

        # Creazione vista compatibile 'distributori_completi' per retrocompatibilità
        cursor.execute("DROP VIEW IF EXISTS distributori_completi")
        cursor.execute("CREATE VIEW distributori_completi AS SELECT * FROM distributori")

        # Metadata
        cursor.execute("""
            CREATE TABLE metadata (
                chiave TEXT PRIMARY KEY,
                valore TEXT
            )
        """)

        now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        metadata = [
            ("data_estrazione", extraction_date),
            ("data_aggiornamento", now_iso),
            ("totale_impianti", str(len(impianti_rows))),
            ("totale_prezzi", str(len(prezzi_rows)))
        ]
        cursor.executemany("INSERT INTO metadata VALUES (?, ?)", metadata)
        conn.commit()

        # Esecuzione VACUUM finale per compattare fisicamente il file SQLite
        print("Compattazione database (VACUUM)...")
        cursor.execute("VACUUM")
        conn.commit()

        # ======================================================================
        # GENERAZIONE DATASET JSON STATICI PER GITHUB PAGES (public/data/)
        # ======================================================================
        export_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public", "data")
        os.makedirs(export_dir, exist_ok=True)
        print("\nGenerazione dataset JSON statici per GitHub Pages...")

        # 1. stations.json (anagrafica compatta e prezzi per tutti i distributori)
        cursor.execute("""
            SELECT id_impianto AS id, gestore, bandiera, nome,
                   indirizzo, comune, provincia, latitudine, longitudine,
                   prezzo_benzina_self, prezzo_benzina_servito,
                   prezzo_gasolio_self, prezzo_gasolio_servito,
                   prezzo_gpl, prezzo_metano,
                   prezzo_benzina_min, prezzo_gasolio_min,
                   ultimo_aggiornamento
            FROM distributori
        """)
        cols = [d[0] for d in cursor.description]
        stations = [dict(zip(cols, row)) for row in cursor.fetchall()]

        stations_file = os.path.join(export_dir, "stations.json")
        with open(stations_file, "w", encoding="utf-8") as f:
            json.dump(stations, f, ensure_ascii=False, separators=(",", ":"))
        print(f"  + {stations_file} ({os.path.getsize(stations_file)/(1024*1024):.2f} MB, {len(stations)} record)")

        # 2. brands.json (elenco compagnie e conteggi)
        cursor.execute("""
            SELECT bandiera, COUNT(*) AS count
            FROM distributori
            WHERE bandiera IS NOT NULL AND bandiera != ''
            GROUP BY bandiera
            ORDER BY count DESC
        """)
        brands = [{"bandiera": r[0], "count": r[1]} for r in cursor.fetchall()]
        brands_file = os.path.join(export_dir, "brands.json")
        with open(brands_file, "w", encoding="utf-8") as f:
            json.dump(brands, f, ensure_ascii=False, separators=(",", ":"))
        print(f"  + {brands_file} ({len(brands)} marchi)")

        # 3. status.json (metadati e statistiche per il footer/impostazioni)
        cursor.execute("SELECT AVG(prezzo_benzina_min), AVG(prezzo_gasolio_min), AVG(prezzo_gpl), AVG(prezzo_metano) FROM distributori")
        avg_row = cursor.fetchone()
        stats = {
            "media_benzina": round(avg_row[0], 3) if avg_row and avg_row[0] else None,
            "media_gasolio": round(avg_row[1], 3) if avg_row and avg_row[1] else None,
            "media_gpl": round(avg_row[2], 3) if avg_row and avg_row[2] else None,
            "media_metano": round(avg_row[3], 3) if avg_row and avg_row[3] else None
        }
        meta_dict = dict(metadata)
        status_data = {
            "ok": True,
            "metadata": meta_dict,
            "totale_distributori": len(stations),
            "statistiche": stats
        }
        status_file = os.path.join(export_dir, "status.json")
        with open(status_file, "w", encoding="utf-8") as f:
            json.dump(status_data, f, ensure_ascii=False, separators=(",", ":"))
        print(f"  + {status_file}")

        final_size_mb = os.path.getsize(DB_FILE) / (1024 * 1024)
        print(f"\nOperazione completata con successo in {time.time() - t_start:.2f}s!")
        print(f"Dimensione finale del database compatto: {final_size_mb:.2f} MB")
        print(f"Data estrazione MIMIT: {extraction_date}")
        print(f"Data aggiornamento: {now_iso}")

    finally:
        conn.close()

if __name__ == "__main__":
    run_etl()
