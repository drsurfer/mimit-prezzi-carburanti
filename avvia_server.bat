@echo off
chcp 65001 > nul
echo ======================================================================
echo   AVVIO SERVER MIMIT CARBURANTI - MAPPA ITALIA
echo ======================================================================
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRORE] Python non e' installato o non e' presente nel PATH.
    pause
    exit /b 1
)

if not exist "%~dp0carburanti.db" (
    echo [AVVISO] Database carburanti.db non trovato. Eseguo prima l'aggiornamento dati...
    python "%~dp0etl.py"
)

set PORT=8080
echo Avvio del server su http://localhost:%PORT% ...
echo Apertura automatica del browser...
start http://localhost:%PORT%

python "%~dp0server.py" %PORT%

pause
