# MIMIT Carburanti - Prezzi Benzina e Gasolio in Italia

Applicazione web interattiva, moderna e leggera per la consultazione geografica e tabellare dei prezzi dei carburanti (Benzina, Gasolio, GPL, Metano) presso tutti i distributori attivi in Italia.

L'applicazione è progettata per funzionare sia in locale sia come **Web App statica serverless ospitata gratuitamente su GitHub Pages**, con aggiornamento automatico giornaliero dei dati.

---

## 📌 Sorgente dei Dati

Tutti i dati relativi agli impianti di distribuzione, alle loro coordinate geografiche e ai prezzi di vendita provengono esclusivamente dagli **Open Data ufficiali rilasciati quotidianamente dal Ministero delle Imprese e del Made in Italy (MIMIT)** attraverso il portale *Osservaprezzi Carburanti*, ai sensi dell'art. 51 della Legge 23 luglio 2009, n. 99 e del Decreto Ministeriale 15 ottobre 2010 e successive modifiche.

---

## ✨ Funzionalità Principali

- 🗺️ **Doppio Motore Cartografico**:
  - **OpenStreetMap (Leaflet)**: 100% gratuito, libero e attivo di default senza richiedere alcuna API key.
  - **Google Maps**: supporto opzionale inserendo la propria API key per viste satellitari e traffico in tempo reale.
- 🌟 **Glowing Distributore Più Conveniente**:
  - Onde concentriche pulsanti ad alta visibilità che evidenziano ad ogni livello di zoom l'impianto con il prezzo più basso nell'area visualizzata.
  - Possibilità di scegliere dalle impostazioni il carburante di riferimento: **Nessuno**, **Benzina** (verde) o **Gasolio** (blu).
- 📊 **Vista Tabellare (Spreadsheet)**:
  - Finestra a foglio di calcolo con i dati essenziali di tutti i distributori dell'area visibile (nome, marchio, comune, prezzi self e servito).
  - Ordinamento immediato ascendente e discendente su ogni colonna.
  - Paginazione fluida trasparente e ricerca testuale istantanea con pulsante per centrare la mappa sulla stazione desiderata.
- 🔍 **Filtri Dinamici**:
  - Per carburante: **Benzina**, **Gasolio**, **GPL**, **Metano**.
  - Per servizio: **Self Service** o **Servito**.
  - Per compagnia: Eni, IP, Q8, Esso, Tamoil, Pompe Bianche / No Logo, ecc.
  - Cursore per impostare un tetto massimo di prezzo al litro.
- 🌓 **Interfaccia e Dark Mode**:
  - Supporto per tema Chiaro, Scuro o sincronizzato con il Sistema operativo.
  - Icone vettoriali monocromatiche in stile Material Design (zero emoji).
  - Barra laterale collassabile in una striscia "mini-rail" per massimizzare la visibilità della mappa.
- ⚡ **Architettura 100% Serverless**:
  - L'applicazione client-side si alimenta da dataset JSON statici compatti (`public/data/`), garantendo caricamenti istantanei senza bisogno di server backend attivi.

---

## ⚖️ Note Legali & Disclaimer

1. **Origine dei Dati e Pubblica Utilità**:  
   I dati sono rilasciati come Open Data dal MIMIT. Questa piattaforma si limita ad elaborarli per finalità di aggregazione, consultazione e visualizzazione di pubblica utilità.
2. **Proprietà di Marchi e Loghi**:  
   Tutti i marchi d'impresa, loghi, denominazioni sociali e insegne commerciali citati (inclusi Eni, IP, Q8, Esso, Tamoil, Repsol, Conad, ecc.) appartengono ai rispettivi e legittimi proprietari. Il loro utilizzo all'interno di questa applicazione ha natura esclusivamente descrittiva ed identificativa ai sensi dell'**art. 21 del D.Lgs. 10 febbraio 2005, n. 30** (Codice della Proprietà Industriale), senza alcun rapporto di affiliazione, agenzia o sponsorizzazione con le società titolari.
3. **Esclusione di Responsabilità**:  
   L'applicazione è un mero strumento indipendente di consultazione. Gli autori non assumono alcuna responsabilità per eventuali ritardi, imprecisioni o discordanze tra i prezzi visualizzati e quelli effettivamente praticati presso le stazioni di servizio (la cui responsabilità legale di veridicità e tempestività di comunicazione al MIMIT ricade unicamente sui singoli esercenti). Si invita a verificare sempre i prezzi esposti sui cartelli stradali e sulle colonnine prima di procedere al rifornimento.

---

## 🚀 Come Duplicare l'Installazione su GitHub (Fork)

Puoi pubblicare la tua copia personale dell'applicazione su **GitHub Pages** in modo completamente gratuito, con aggiornamento automatico giornaliero gestito da GitHub:

### Passo 1: Fork o Nuovo Repository
1. Fai il **Fork** di questo repository (pulsante *Fork* in alto a destra su GitHub), oppure scarica i file e caricali in un tuo nuovo repository su GitHub.

### Passo 2: Attivare GitHub Pages con GitHub Actions
1. Nel tuo repository su GitHub, vai su **Settings** > **Pages** (nel menu laterale sinistro).
2. Sotto la sezione **Build and deployment** > **Source**, seleziona:
   👉 **GitHub Actions** (anziché "Deploy from a branch").

### Passo 3: Fatto! Aggiornamento Automatico
- Il flusso di lavoro configurato in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) compilerà e pubblicherà automaticamente il sito.
- **Ogni mattina alle 08:30 (ora italiana)** GitHub avvierà in autonomia l'azione per scaricare i file freschi dal MIMIT e aggiornare il sito in 30 secondi.
- Puoi forzare l'aggiornamento in qualsiasi momento andando nel tab **Actions** di GitHub, selezionando il workflow e cliccando su **Run workflow**.

---

## 💻 Esecuzione in Locale

### Windows
- Fai doppio clic su `avvia_server.bat` per aprire il server locale e il browser su `http://localhost:8080`.
- Fai doppio clic su `aggiorna_dati.bat` per aggiornare manualmente i dati scaricando i nuovi CSV.

### Linux / Mac
Trovi gli script dedicati nella cartella [`linux/`](linux/README.md):
```bash
chmod +x linux/*.sh
./linux/avvia_server.sh
```

---

## 📄 Licenza

Questo progetto è rilasciato sotto licenza **Creative Commons Attribuzione - Non Commerciale 4.0 Internazionale (CC BY-NC 4.0)**.  
Sei libero di condividere, copiare e modificare il materiale per scopi personali, di ricerca e didattici, purché ne venga riconosciuta la paternità e **con divieto assoluto di utilizzo o rivendita per scopi commerciali o a fini di lucro**.
