"""
test_suite.py - Verifica completa e automatizzata di tutti i componenti
"""
import http.server
import threading
import time
import urllib.request
import json
from server import CarburantiRequestHandler

def run_tests():
    port = 8095
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', port), CarburantiRequestHandler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    time.sleep(0.5)

    base = f'http://127.0.0.1:{port}'
    passed = 0
    total = 0

    def check(name, cond):
        nonlocal passed, total
        total += 1
        if cond:
            print(f" [PASS] {name}")
            passed += 1
        else:
            print(f" [FAIL] {name}")

    try:
        # 1. HTML index
        with urllib.request.urlopen(f"{base}/") as r:
            html = r.read().decode()
            check("GET / (HTML)", r.status == 200 and 'id="mini-rail"' in html and 'mini-rail-hamburger' in html and 'cheapest-fuel-btn' in html)
            check("Rimozione Calcolo Pieno", 'Calcola Spesa Pieno' not in html)
            check("Rimozione Sezione Personalizzazioni e Checkbox", 'customization-section' not in html and 'filter-favorites-only' not in html)
            check("Rimozione Badge MIMIT Carburanti Live", 'floating-status-badge' not in html and 'MIMIT Carburanti Live' not in html)
            check("Rimozione Sezione Distributore Economico in Sidebar", 'cheapest-station-card' not in html and 'btn-goto-cheapest' not in html)
            check("Selezione Glowing (Nessuno/Benzina/Gasolio)", 'data-cheapest-fuel="none"' in html and 'data-cheapest-fuel="benzina"' in html and 'data-cheapest-fuel="gasolio"' in html)
            check("Selezione Tema senza icone", '☀️' not in html and '🌙' not in html and '💻' not in html)
            check("Icone Material Style Monocromatiche", 'icon-material' in html)
            check("Opzione Nascondi Luoghi Secondari (POI)", 'id="toggle-hide-poi"' in html)
            check("Pulsante Impostazioni Borderless in Basso", 'id="btn-settings-bottom"' in html and 'sidebar-footer' in html)
            check("Sfumatura Fading in Fondo alla Sidebar", 'sidebar-fade-overlay' in html)
            check("Icona e Modale Spreadsheet Distributori", 'id="btn-spreadsheet"' in html and 'id="spreadsheet-modal"' in html and 'id="spreadsheet-table"' in html)
            check("Pulsante Esportazione CSV Tabella in Locale Italiano", 'id="btn-export-spreadsheet-csv"' in html and 'Esporta CSV' in html)
            check("Selezione Colonne Spreadsheet in Opzioni", 'id="spreadsheet-cols-config"' in html and 'data-col-target="prezzo_benzina_self"' in html)
            check("Header Spreadsheet con Maniglie Ridimensionamento", 'class="col-resizer"' in html and 'data-col="nome"' in html)
            check("Icona e Modale Note Legali & Disclaimer", 'id="btn-legal"' in html and 'id="legal-modal"' in html and 'Open Data' in html)
            check("Rimozione Sezione Esportazione Layer", 'btn-export-geojson' not in html and 'btn-export-kml' not in html)

        # 2. CSS con mini-rail, no scrollbar popup e scrollbar dark
        with urllib.request.urlopen(f"{base}/css/style.css") as r:
            css = r.read().decode()
            check("CSS Mini-rail 56px", '.mini-rail' in css and '--mini-rail-width: 56px' in css)
            check("CSS Contrasto Sfondo Finestra Opzioni rispetto a Sidebar", '--bg-dropdown: #f1f5f9' in css and '--border-dropdown' in css)
            check("CSS Finestra Spreadsheet Resizabile", 'resize: both' in css and '.spreadsheet-modal-card' in css)
            check("CSS Maniglie Colonna e Regole Hiding Colonne", '.col-resizer' in css and '#spreadsheet-table.hide-col-' in css)
            check("CSS No Popup Scrollbar", '.gm-style .gm-style-iw-d' in css and 'overflow: hidden !important' in css)
            check("CSS Popup Dimensioni Controllate", 'width: 304px !important' in css and 'max-width: 304px !important' in css)
            check("CSS Rimozione Gap Header Popup", '.gm-style-iw-chr' in css and 'height: 0 !important' in css)
            check("CSS Visibilita X in Dark Mode con pseudo-elementi", '.gm-style .gm-ui-hover-effect::before' in css and '[data-theme="dark"] .gm-style .gm-ui-hover-effect::before' in css)
            check("CSS Link Indicazioni Compatto", '.popup-directions-link' in css and '.directions-icon' in css)
            check("CSS Dark Scrollbar", 'color-scheme: dark' in css and '--scrollbar-thumb' in css)
            check("CSS Glow Ripple Concentrico Alta Visibilita", '.beacon-pulse-ring' in css and '#00e676' in css and 'ring-4' in css)
            check("CSS Glow Differenziato per Carburante (Verde Benzina, Blu Gasolio)", '.cheapest-glow-beacon.gasolio' in css and '#0091ff' in css)
            check("CSS Glow Beacon sotto ai Popup (Z-Index Contenuto)", '.cheapest-glow-beacon' in css and 'z-index: 10' in css)
            check("CSS Sidebar Footer e Fading Gradient", '.sidebar-fade-overlay' in css and '.sidebar-footer-btn' in css)
            check("CSS Modale Spreadsheet con Tabella e Paginazione", '.spreadsheet-modal-card' in css and '.spreadsheet-table' in css and '.spreadsheet-pagination' in css)
            check("CSS Pulsante Esportazione CSV", '.btn-export-csv' in css and '.spreadsheet-toolbar-right' in css)
            check("CSS Modale Note Legali", '.legal-modal-card' in css and '.legal-section' in css)
            check("CSS Icone Material Helper", '.icon-material' in css)

        # 3. JS scripts
        for js_file in ["brand-logos.js", "app.js", "map-manager.js", "customization-hooks.js"]:
            with urllib.request.urlopen(f"{base}/js/{js_file}") as r:
                js = r.read().decode()
                check(f"GET /js/{js_file}", r.status == 200 and len(js) > 500)
                if js_file == "map-manager.js":
                    check("map-manager.js supporta setHidePoi", 'setHidePoi' in js and 'featureType: "poi"' in js)
                    check("map-manager.js Glow Beacon sotto al Popup InfoWindow", 'overlayLayer' in js and 'overlayPane' in js)
                if js_file == "app.js":
                    check("app.js setupSpreadsheetModal e setupLegalModal", 'setupSpreadsheetModal' in js and 'setupLegalModal' in js)
                    check("app.js Gestione Paginazione e Ordinamento Spreadsheet", 'renderSpreadsheetTable' in js and 'spreadsheetState' in js)
                    check("app.js Ridimensionamento Colonne e Config Colonne Visibili", 'setupColumnResizers' in js and 'setupSpreadsheetColumnConfig' in js)
                    check("app.js Esportazione CSV Italiano (; e virgola decimale)", 'exportSpreadsheetCSV' in js and 'getSpreadsheetCurrentData' in js)

        # 4. Verifica PNG Loghi
        for logo in ["eni.png", "ip.png", "q8.png", "esso.png", "neutral.png"]:
            with urllib.request.urlopen(f"{base}/img/logos/{logo}") as r:
                data = r.read()
                check(f"PNG Logo /img/logos/{logo}", r.status == 200 and data[:4] == b'\x89PNG')

        # 5. Verifica PNG Marker a goccia
        for marker in ["marker_eni.png", "marker_q8.png", "marker_neutral.png"]:
            with urllib.request.urlopen(f"{base}/img/markers/{marker}") as r:
                data = r.read()
                check(f"PNG Marker /img/markers/{marker}", r.status == 200 and data[:4] == b'\x89PNG')

        # 6. Status API
        with urllib.request.urlopen(f"{base}/api/status") as r:
            data = json.loads(r.read().decode())
            check("/api/status", data.get("ok") is True and data.get("totale_distributori", 0) > 20000)

        # 7. Stations API full (dataset compatto)
        with urllib.request.urlopen(f"{base}/api/stations?limit=35000") as r:
            stations = json.loads(r.read().decode())
            check("/api/stations full dataset", len(stations) > 20000)

        # 8. File JSON statici per GitHub Pages
        with urllib.request.urlopen(f"{base}/data/stations.json") as r:
            st_static = json.loads(r.read().decode())
            check("File statico /data/stations.json per GitHub Pages", len(st_static) > 20000)

        with urllib.request.urlopen(f"{base}/data/status.json") as r:
            status_static = json.loads(r.read().decode())
            check("File statico /data/status.json per GitHub Pages", status_static.get("ok") is True)

        with urllib.request.urlopen(f"{base}/data/brands.json") as r:
            brands_static = json.loads(r.read().decode())
            check("File statico /data/brands.json per GitHub Pages", len(brands_static) > 20)

        print(f"\nRiepilogo test: {passed}/{total} passati con successo!")
        return passed == total
    finally:
        httpd.shutdown()

if __name__ == "__main__":
    success = run_tests()
    if not success:
        exit(1)
