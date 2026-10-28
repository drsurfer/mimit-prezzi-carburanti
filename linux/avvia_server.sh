#!/usr/bin/env bash
set -e

# Individua la cartella principale del progetto (cartella genitore di linux/)
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." >/dev/null 2>&1 && pwd)"
PORT="${PORT:-8080}"

PYTHON_CMD="python3"
if ! command -v python3 &> /dev/null; then
    PYTHON_CMD="python"
fi

# Se i dati non sono ancora stati estratti, esegue l'ETL iniziale
if [ ! -f "$PROJECT_DIR/carburanti.db" ] || [ ! -f "$PROJECT_DIR/public/data/stations.json" ]; then
    echo "[AVVISO] Dati non trovati. Eseguo prima l'acquisizione iniziale dal MIMIT..."
    $PYTHON_CMD "$PROJECT_DIR/etl.py"
fi

echo "======================================================================"
echo "  AVVIO SERVER MIMIT CARBURANTI - MAPPA ITALIA (LINUX)"
echo "  URL Locale: http://localhost:$PORT"
echo "  Per terminare: premi Ctrl+C"
echo "======================================================================"

$PYTHON_CMD "$PROJECT_DIR/server.py" "$PORT"
