@echo off
chcp 65001 > nul
echo ======================================================================
echo   MIMIT CARBURANTI - ACQUISIZIONE E AGGIORNAMENTO DATI ITALIA
echo ======================================================================
echo.

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRORE] Python non e' installato o non e' presente nel PATH.
    echo Installa Python 3 da https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [1/2] Verifica script ETL...
if not exist "%~dp0etl.py" (
    echo [ERRORE] File etl.py non trovato in %~dp0
    pause
    exit /b 1
)

echo [2/2] Download e combinazione dati MIMIT in SQLite...
echo.
python "%~dp0etl.py"

if %errorlevel% equ 0 (
    echo.
    echo ======================================================================
    echo   AGGIORNAMENTO COMPLETATO CON SUCCESSO!
    echo   Database generato: %~dp0carburanti.db
    echo ======================================================================
) else (
    echo.
    echo [ERRORE] Si e' verificato un errore durante l'acquisizione dei dati.
)

echo.
echo Premi un tasto per uscire dalla console...
pause > nul
