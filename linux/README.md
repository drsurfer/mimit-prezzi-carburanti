# Script e Configurazioni per Linux

Questa cartella contiene gli script per eseguire e gestire **MIMIT Carburanti** su ambienti Linux (server, desktop o Raspberry Pi).

## 1. Permessi di Esecuzione
Prima di avviare gli script bash, assicurati di aver concesso i permessi di esecuzione:
```bash
chmod +x linux/*.sh
```

## 2. Script Disponibili

### `linux/aggiorna_dati.sh`
Scarica i file CSV aggiornati dal portale ufficiale MIMIT, compila il database SQLite `carburanti.db` e rigenera i dataset statici JSON in `public/data/`.
```bash
./linux/aggiorna_dati.sh
```

### `linux/avvia_server.sh`
Avvia il server HTTP Python locale sulla porta specificata (default `8080`). Se i dati non sono ancora presenti, esegue prima `etl.py` in automatico.
```bash
./linux/avvia_server.sh

# Per cambiare la porta:
PORT=9000 ./linux/avvia_server.sh
```

## 3. Automazione Giornaliera con Crontab
Per aggiornare automaticamente i dati ogni mattina alle 08:30 sul tuo sistema Linux:
```bash
crontab -e
```
Aggiungi la riga:
```cron
30 8 * * * /percorso/del/progetto/linux/aggiorna_dati.sh > /dev/null 2>&1
```

## 4. Docker (Opzionale)
Dalla cartella principale del progetto puoi avviare l'applicazione in un container Docker isolato:
```bash
docker compose up -d
```
L'app sarà immediatamente raggiungibile su `http://localhost:8080`.
