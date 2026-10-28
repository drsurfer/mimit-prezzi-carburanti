#!/usr/bin/env bash
set -e

# Individua la cartella principale del progetto (cartella genitore di linux/)
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." >/dev/null 2>&1 && pwd)"

echo "======================================================================"
echo "  MIMIT CARBURANTI - ACQUISIZIONE E AGGIORNAMENTO DATI (LINUX)"
echo "======================================================================"
echo ""

if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "[ERRORE] Python non trovato. Installa Python 3 tramite il package manager (es. sudo apt install python3)."
    exit 1
fi

PYTHON_CMD="python3"
if ! command -v python3 &> /dev/null; then
    PYTHON_CMD="python"
fi

echo "[1/2] Esecuzione ETL Python e generazione dataset statici..."
$PYTHON_CMD "$PROJECT_DIR/etl.py"

echo ""
echo "======================================================================"
echo "  AGGIORNAMENTO COMPLETATO CON SUCCESSO!"
echo "  Dataset generati in: $PROJECT_DIR/public/data/"
echo "  Database SQLite compatto: $PROJECT_DIR/carburanti.db"
echo "======================================================================"
