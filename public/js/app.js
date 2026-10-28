/**
 * app.js - Controller principale dell'applicazione MIMIT Carburanti
 * - Gestione mini-rail a striscia (56px) con hamburger button in alto
 * - Nessuna sovrapposizione con i controlli della mappa
 * - Selezione del prezzo di riferimento (Benzina o Gasolio) nelle Opzioni per il distributore Glowing
 * - Calcolo in tempo reale del distributore più economico della visualizzazione a qualsiasi livello di zoom
 * - 100% Client-Side Rendering ad alte prestazioni
 */

const App = (function() {
  let mapManager = null;
  let allStations = [];
  let filteredStations = [];
  let currentVisibleStations = [];
  let cheapestStation = null;

  let activeFilters = {
    fuel: 'tutti',
    service: 'tutti',
    brand: 'TUTTI',
    maxPrice: null,
    search: '',
    clustering: true,
    cheapestFuelTarget: 'benzina' // 'none', 'benzina', o 'gasolio' (impostabile nelle opzioni)
  };
  let currentThemeChoice = 'system';

  const dom = {};

  function init() {
    cacheDomElements();
    setupTheme();
    setupCheapestFuelChoice();
    setupDropdownMenu();
    setupSidebarToggle();
    setupSpreadsheetModal();
    setupLegalModal();
    setupEventListeners();
    setupMap();
    loadStatus();
    loadBrands();
    loadAllStations();
  }

  function cacheDomElements() {
    dom.sidebar = document.getElementById('sidebar');
    dom.toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    dom.miniRailExpandBtn = document.getElementById('mini-rail-expand-btn');
    dom.miniRailSettingsBtn = document.getElementById('mini-rail-settings-btn');
    dom.miniRailThemeBtn = document.getElementById('mini-rail-theme-btn');
    dom.miniRailTableBtn = document.getElementById('mini-rail-table-btn');
    dom.miniRailLegalBtn = document.getElementById('mini-rail-legal-btn');

    // Pulsante opzioni pulito e borderless posizionato in basso
    dom.btnSettingsBottom = document.getElementById('btn-settings-bottom');
    dom.btnSpreadsheet = document.getElementById('btn-spreadsheet');
    dom.btnLegal = document.getElementById('btn-legal');
    dom.settingsDropdownPanel = document.getElementById('settings-dropdown-panel');
    dom.themeButtons = document.querySelectorAll('[data-theme-btn]');
    dom.cheapestFuelButtons = document.querySelectorAll('.cheapest-fuel-btn');

    dom.searchInput = document.getElementById('search-input');
    dom.searchBtn = document.getElementById('search-btn');
    dom.brandSelect = document.getElementById('brand-select');
    dom.fuelButtons = document.querySelectorAll('.fuel-btn');
    dom.serviceButtons = document.querySelectorAll('.service-btn');
    dom.maxPriceInput = document.getElementById('max-price-input');
    dom.maxPriceVal = document.getElementById('max-price-val');
    dom.clusterToggle = document.getElementById('toggle-clustering');
    dom.toggleHidePoi = document.getElementById('toggle-hide-poi');
    dom.resetFiltersBtn = document.getElementById('reset-filters-btn');
    dom.countVisible = document.getElementById('count-visible');
    dom.avgBenzina = document.getElementById('avg-benzina');
    dom.avgGasolio = document.getElementById('avg-gasolio');

    dom.providerSelect = document.getElementById('provider-select');
    dom.btnConfigGmaps = document.getElementById('btn-config-gmaps');
    dom.btnRefreshData = document.getElementById('btn-refresh-data');
    dom.lastExtractionSpan = document.getElementById('last-extraction-date');
    dom.lastUpdateSpan = document.getElementById('last-update-date');
    dom.toastContainer = document.getElementById('toast-container');
    dom.gmapsModal = document.getElementById('gmaps-modal');
    dom.gmapsKeyInput = document.getElementById('gmaps-key-input');
    dom.btnSaveGmapsKey = document.getElementById('btn-save-gmaps-key');
    dom.btnCloseGmapsModal = document.getElementById('btn-close-gmaps-modal');

    // Modale Spreadsheet / Tabella
    dom.spreadsheetModal = document.getElementById('spreadsheet-modal');
    dom.btnCloseSpreadsheet = document.getElementById('btn-close-spreadsheet');
    dom.spreadsheetFilterInput = document.getElementById('spreadsheet-filter-input');
    dom.btnTableScopeVisible = document.getElementById('btn-table-scope-visible');
    dom.btnTableScopeAll = document.getElementById('btn-table-scope-all');
    dom.btnExportSpreadsheetCsv = document.getElementById('btn-export-spreadsheet-csv');
    dom.spreadsheetTbody = document.getElementById('spreadsheet-tbody');
    dom.spreadsheetCountLabel = document.getElementById('spreadsheet-count-label');
    dom.spreadsheetPaginationInfo = document.getElementById('spreadsheet-pagination-info');
    dom.spreadsheetPageIndicator = document.getElementById('spreadsheet-page-indicator');
    dom.btnPageFirst = document.getElementById('btn-page-first');
    dom.btnPagePrev = document.getElementById('btn-page-prev');
    dom.btnPageNext = document.getElementById('btn-page-next');
    dom.btnPageLast = document.getElementById('btn-page-last');

    // Modale Note Legali
    dom.legalModal = document.getElementById('legal-modal');
    dom.btnCloseLegal = document.getElementById('btn-close-legal');
    dom.btnDismissLegal = document.getElementById('btn-dismiss-legal');
  }

  // ==========================================
  // GESTIONE SIDEBAR A STRISCIA MINI-RAIL (56PX)
  // ==========================================
  function setupSidebarToggle() {
    // Collassa a strisciolina mini-rail
    if (dom.toggleSidebarBtn) {
      dom.toggleSidebarBtn.addEventListener('click', () => {
        setSidebarCollapsed(true);
      });
    }

    // Espandi con l'hamburger button della strisciolina
    if (dom.miniRailExpandBtn) {
      dom.miniRailExpandBtn.addEventListener('click', () => {
        setSidebarCollapsed(false);
      });
    }

    // Tasto opzioni da mini-rail
    if (dom.miniRailSettingsBtn) {
      dom.miniRailSettingsBtn.addEventListener('click', () => {
        setSidebarCollapsed(false);
        setTimeout(() => {
          if (dom.settingsDropdownPanel) {
            dom.settingsDropdownPanel.classList.add('open');
            if (dom.btnSettingsBottom) dom.btnSettingsBottom.classList.add('active');
          }
        }, 150);
      });
    }

    // Tasto tema rapido da mini-rail
    if (dom.miniRailThemeBtn) {
      dom.miniRailThemeBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        applyTheme(current === 'dark' ? 'light' : 'dark');
      });
    }
  }

  function setSidebarCollapsed(collapsed) {
    if (!dom.sidebar) return;
    dom.sidebar.classList.toggle('collapsed', collapsed);

    // Chiudi il pannello impostazioni se collassi
    if (collapsed && dom.settingsDropdownPanel) {
      dom.settingsDropdownPanel.classList.remove('open');
      if (dom.btnSettingsBottom) dom.btnSettingsBottom.classList.remove('active');
    }

    // Ricalcola la mappa per garantire zero distorsioni
    setTimeout(() => {
      if (mapManager) mapManager.invalidateSize();
    }, 280);
  }

  // ==========================================
  // MENU IMPOSTAZIONI (ANCORATO IN BASSO)
  // ==========================================
  function setupDropdownMenu() {
    if (!dom.settingsDropdownPanel) return;

    if (dom.btnSettingsBottom) {
      dom.btnSettingsBottom.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dom.settingsDropdownPanel.classList.toggle('open');
        dom.btnSettingsBottom.classList.toggle('active', isOpen);
      });
    }

    document.addEventListener('click', (e) => {
      const isInside = dom.settingsDropdownPanel.contains(e.target);
      const isBtn = dom.btnSettingsBottom && dom.btnSettingsBottom.contains(e.target);
      const isMiniRailBtn = dom.miniRailSettingsBtn && dom.miniRailSettingsBtn.contains(e.target);

      if (!isInside && !isBtn && !isMiniRailBtn) {
        dom.settingsDropdownPanel.classList.remove('open');
        if (dom.btnSettingsBottom) dom.btnSettingsBottom.classList.remove('active');
      }
    });
  }

  // ==========================================
  // SCELTA CARBURANTE PER IL GLOWING (OPZIONI: Nessuno / Benzina / Gasolio)
  // ==========================================
  function setupCheapestFuelChoice() {
    const saved = localStorage.getItem('cheapest_fuel_target') || 'benzina';
    activeFilters.cheapestFuelTarget = saved;

    if (dom.cheapestFuelButtons) {
      dom.cheapestFuelButtons.forEach(btn => {
        const isMatch = btn.dataset.cheapestFuel === saved;
        btn.classList.toggle('active', isMatch);

        btn.addEventListener('click', () => {
          dom.cheapestFuelButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          activeFilters.cheapestFuelTarget = btn.dataset.cheapestFuel;
          localStorage.setItem('cheapest_fuel_target', activeFilters.cheapestFuelTarget);
          
          const labelMap = {
            none: 'Nessuno (Disattivato)',
            benzina: 'Benzina',
            gasolio: 'Gasolio'
          };
          showToast(`Glowing impostato su: ${labelMap[activeFilters.cheapestFuelTarget] || activeFilters.cheapestFuelTarget}`);
          updateVisibleStatsAndCheapest(mapManager ? mapManager.getBounds() : null);
        });
      });
    }
  }

  // ==========================================
  // GESTIONE DARK MODE (Chiaro / Scuro / Sistema)
  // ==========================================
  function setupTheme() {
    currentThemeChoice = localStorage.getItem('app_theme') || 'system';
    applyTheme(currentThemeChoice);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (currentThemeChoice === 'system') {
        applyTheme('system');
      }
    });
  }

  function applyTheme(choice) {
    currentThemeChoice = choice;
    localStorage.setItem('app_theme', choice);

    let effectiveTheme = 'light';
    if (choice === 'dark') {
      effectiveTheme = 'dark';
    } else if (choice === 'light') {
      effectiveTheme = 'light';
    } else {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.documentElement.setAttribute('data-theme', effectiveTheme);

    if (dom.themeButtons) {
      dom.themeButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.themeBtn === choice);
      });
    }

    if (mapManager) {
      mapManager.setTheme(effectiveTheme);
    }
  }

  // ==========================================
  // SETUP MAPPA
  // ==========================================
  function setupMap() {
    const savedProvider = localStorage.getItem('map_provider') || 'google';
    if (dom.providerSelect) dom.providerSelect.value = savedProvider;

    const savedHidePoi = localStorage.getItem('hide_poi');
    const hidePoi = (savedHidePoi === null) ? true : (savedHidePoi === 'true');

    const effectiveTheme = document.documentElement.getAttribute('data-theme') || 'light';

    mapManager = new MapManager('map', {
      center: [41.9028, 12.4964],
      zoom: 6,
      provider: savedProvider,
      clustering: activeFilters.clustering,
      hidePoi: hidePoi,
      onBoundsChanged: (bounds) => {
        updateVisibleStatsAndCheapest(bounds);
      }
    });

    mapManager.isDarkMode = (effectiveTheme === 'dark');

    mapManager.init().then(() => {
      if (filteredStations && filteredStations.length > 0) {
        mapManager.renderStations(filteredStations);
        updateVisibleStatsAndCheapest(mapManager.getBounds());
      }
    }).catch(err => {
      console.warn('Google Maps non pronto:', err.message);
      showToast('Uso OpenStreetMap come motore mappa');
      if (dom.providerSelect) dom.providerSelect.value = 'leaflet';
      localStorage.setItem('map_provider', 'leaflet');
      mapManager.switchProvider('leaflet');
    });
  }

  function setupEventListeners() {
    if (dom.themeButtons) {
      dom.themeButtons.forEach(btn => {
        btn.addEventListener('click', () => applyTheme(btn.dataset.themeBtn));
      });
    }

    if (dom.searchInput) {
      dom.searchInput.addEventListener('input', () => {
        activeFilters.search = dom.searchInput.value.trim().toLowerCase();
        applyFiltersClientSide();
      });
    }
    if (dom.searchBtn) {
      dom.searchBtn.addEventListener('click', () => {
        activeFilters.search = dom.searchInput.value.trim().toLowerCase();
        applyFiltersClientSide();
      });
    }

    document.querySelectorAll('.city-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        const lat = parseFloat(e.target.dataset.lat);
        const lng = parseFloat(e.target.dataset.lng);
        const zoom = parseInt(e.target.dataset.zoom || '12', 10);
        if (!isNaN(lat) && !isNaN(lng)) {
          mapManager.setView(lat, lng, zoom);
          if (window.innerWidth <= 768) setSidebarCollapsed(true);
        }
      });
    });

    const btnLocate = document.getElementById('btn-locate');
    if (btnLocate) btnLocate.addEventListener('click', locateUser);

    dom.fuelButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        dom.fuelButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilters.fuel = btn.dataset.fuel;
        applyFiltersClientSide();
      });
    });

    dom.serviceButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        dom.serviceButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilters.service = btn.dataset.service;
        applyFiltersClientSide();
      });
    });

    if (dom.brandSelect) {
      dom.brandSelect.addEventListener('change', () => {
        activeFilters.brand = dom.brandSelect.value;
        applyFiltersClientSide();
      });
    }

    if (dom.maxPriceInput) {
      dom.maxPriceInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (val >= 2.50) {
          activeFilters.maxPrice = null;
          dom.maxPriceVal.textContent = 'Nessun limite';
        } else {
          activeFilters.maxPrice = val;
          dom.maxPriceVal.textContent = `≤ ${val.toFixed(2)} €/L`;
        }
        applyFiltersClientSide();
      });
    }

    if (dom.clusterToggle) {
      dom.clusterToggle.addEventListener('change', (e) => {
        activeFilters.clustering = e.target.checked;
        mapManager.setClustering(activeFilters.clustering);
      });
    }

    if (dom.toggleHidePoi) {
      const savedHidePoi = localStorage.getItem('hide_poi');
      dom.toggleHidePoi.checked = (savedHidePoi === null) ? true : (savedHidePoi === 'true');
      dom.toggleHidePoi.addEventListener('change', (e) => {
        const hide = e.target.checked;
        localStorage.setItem('hide_poi', hide);
        if (mapManager) {
          mapManager.setHidePoi(hide);
          showToast(hide ? 'Luoghi secondari (POI) nascosti' : 'Luoghi secondari (POI) mostrati');
        }
      });
    }

    if (dom.resetFiltersBtn) dom.resetFiltersBtn.addEventListener('click', resetFilters);

    if (dom.providerSelect) {
      dom.providerSelect.addEventListener('change', (e) => {
        const prov = e.target.value;
        if (prov === 'google') {
          const key = localStorage.getItem('google_maps_api_key');
          if (!key) {
            openGmapsModal();
            return;
          }
          switchMapProvider('google', key);
        } else {
          switchMapProvider('leaflet');
        }
      });
    }

    if (dom.btnConfigGmaps) dom.btnConfigGmaps.addEventListener('click', openGmapsModal);
    if (dom.btnCloseGmapsModal) dom.btnCloseGmapsModal.addEventListener('click', closeGmapsModal);
    if (dom.btnSaveGmapsKey) {
      dom.btnSaveGmapsKey.addEventListener('click', () => {
        const key = dom.gmapsKeyInput.value.trim();
        if (key) {
          localStorage.setItem('google_maps_api_key', key);
          closeGmapsModal();
          showToast('Chiave Google Maps salvata!');
          if (dom.providerSelect) dom.providerSelect.value = 'google';
          switchMapProvider('google', key);
        } else {
          alert('Inserisci una chiave valida.');
        }
      });
    }

    if (dom.btnRefreshData) dom.btnRefreshData.addEventListener('click', refreshMimitData);
  }

  function locateUser() {
    if (!navigator.geolocation) {
      showToast('Geolocalizzazione non supportata');
      return;
    }
    showToast('Rilevamento posizione...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        mapManager.setView(lat, lng, 14);
        showToast('Posizione trovata!');
      },
      (err) => {
        showToast('Impossibile rilevare la posizione: ' + err.message);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  // ==========================================
  // CARICAMENTO INIZIALE COMPATTO & RENDERING CLIENT-SIDE
  // ==========================================
  function loadAllStations() {
    showToast('Caricamento archivio distributori...');
    // Cerca prima il file statico JSON (ottimizzato per GitHub Pages), con fallback su API backend
    fetch('data/stations.json')
      .then(res => {
        if (!res.ok) throw new Error('File statico non trovato, provo endpoint API...');
        return res.json();
      })
      .catch(() => fetch('/api/stations?limit=35000').then(r => r.json()))
      .then(data => {
        allStations = data || [];
        showToast(`Caricati ${allStations.length.toLocaleString('it-IT')} distributori!`);
        applyFiltersClientSide();
      })
      .catch(err => {
        console.error('Errore nel caricamento distributori:', err);
        showToast('Errore di caricamento: ' + err.message);
      });
  }

  function applyFiltersClientSide() {
    if (!allStations || allStations.length === 0) return;

    let res = allStations;
    const fuel = activeFilters.fuel;
    const srv = activeFilters.service;

    if (fuel !== 'tutti' || srv !== 'tutti') {
      res = res.filter(s => {
        if (fuel === 'benzina') {
          if (srv === 'self') return s.prezzo_benzina_self != null;
          if (srv === 'servito') return s.prezzo_benzina_servito != null;
          return s.prezzo_benzina_min != null;
        } else if (fuel === 'gasolio') {
          if (srv === 'self') return s.prezzo_gasolio_self != null;
          if (srv === 'servito') return s.prezzo_gasolio_servito != null;
          return s.prezzo_gasolio_min != null;
        } else if (fuel === 'gpl') {
          return s.prezzo_gpl != null;
        } else if (fuel === 'metano') {
          return s.prezzo_metano != null;
        } else {
          if (srv === 'self') return s.prezzo_benzina_self != null || s.prezzo_gasolio_self != null;
          if (srv === 'servito') return s.prezzo_benzina_servito != null || s.prezzo_gasolio_servito != null;
          return true;
        }
      });
    }

    const b = activeFilters.brand;
    if (b && b !== 'TUTTI') {
      if (b === 'POMPE_BIANCHE') {
        res = res.filter(s => {
          const band = (s.bandiera || '').toLowerCase();
          return band.includes('bianche') || band.includes('no logo') || band === 'altro' || !s.bandiera;
        });
      } else {
        res = res.filter(s => s.bandiera === b);
      }
    }

    if (activeFilters.maxPrice != null) {
      const mp = activeFilters.maxPrice;
      res = res.filter(s => {
        const p = (activeFilters.fuel === 'gasolio') ? s.prezzo_gasolio_min : s.prezzo_benzina_min;
        return p != null && p <= mp;
      });
    }

    if (activeFilters.search) {
      const q = activeFilters.search;
      res = res.filter(s => {
        return (
          (s.comune && s.comune.toLowerCase().includes(q)) ||
          (s.provincia && s.provincia.toLowerCase().includes(q)) ||
          (s.nome && s.nome.toLowerCase().includes(q)) ||
          (s.gestore && s.gestore.toLowerCase().includes(q)) ||
          (s.indirizzo && s.indirizzo.toLowerCase().includes(q))
        );
      });
    }

    if (window.CustomizationHooks && typeof window.CustomizationHooks.applyCustomFilters === 'function') {
      res = res.filter(s => window.CustomizationHooks.applyCustomFilters(s));
      window.CustomizationHooks.notifyStationsLoaded(res);
    }

    filteredStations = res;
    mapManager.renderStations(filteredStations);
    updateVisibleStatsAndCheapest(mapManager.getBounds());
  }

  // ==========================================
  // DISTRIBUTORE PIÙ ECONOMICO & GLOW EFFECT AD OGNI ZOOM
  // ==========================================
  function updateVisibleStatsAndCheapest(bounds) {
    if (!filteredStations || filteredStations.length === 0) return;

    let visible = filteredStations;
    if (bounds) {
      visible = filteredStations.filter(s => {
        return s.latitudine >= bounds.south && s.latitudine <= bounds.north &&
               s.longitudine >= bounds.west && s.longitudine <= bounds.east;
      });
    }

    if (dom.countVisible) {
      dom.countVisible.textContent = visible.length.toLocaleString('it-IT');
    }

    currentVisibleStations = visible;
    if (dom.spreadsheetModal && dom.spreadsheetModal.style.display !== 'none' && spreadsheetState.scope === 'visible') {
      renderSpreadsheetTable();
    }

    // Calcolo medie carburanti dell'area visibile
    let benzinaSum = 0, benzinaCount = 0;
    let gasolioSum = 0, gasolioCount = 0;

    for (let i = 0; i < visible.length; i++) {
      const s = visible[i];
      const b = s.prezzo_benzina_self || s.prezzo_benzina_servito;
      if (b && b > 0.5 && b < 4.0) {
        benzinaSum += b;
        benzinaCount++;
      }
      const g = s.prezzo_gasolio_self || s.prezzo_gasolio_servito;
      if (g && g > 0.5 && g < 4.0) {
        gasolioSum += g;
        gasolioCount++;
      }
    }

    if (dom.avgBenzina) {
      dom.avgBenzina.textContent = benzinaCount > 0 ? (benzinaSum / benzinaCount).toFixed(3) + ' €' : '-';
    }
    if (dom.avgGasolio) {
      dom.avgGasolio.textContent = gasolioCount > 0 ? (gasolioSum / gasolioCount).toFixed(3) + ' €' : '-';
    }

    // Carburante di riferimento per il calcolo del più economico (opzioni: 'none', 'benzina', 'gasolio')
    const targetFuel = activeFilters.cheapestFuelTarget || 'benzina';

    // Se l'opzione è 'none' (Nessuno), disattiviamo il glowing beacon sulla mappa
    if (targetFuel === 'none') {
      cheapestStation = null;
      if (mapManager) {
        mapManager.highlightCheapestStation(null, 'none');
      }
      return;
    }

    let minPrice = Infinity;
    let bestStation = null;

    for (let i = 0; i < visible.length; i++) {
      const s = visible[i];
      let targetPrice = null;
      if (targetFuel === 'gasolio') {
        targetPrice = s.prezzo_gasolio_self || s.prezzo_gasolio_min;
      } else if (targetFuel === 'benzina') {
        targetPrice = s.prezzo_benzina_self || s.prezzo_benzina_min;
      }

      if (targetPrice && targetPrice > 0.5 && targetPrice < minPrice) {
        minPrice = targetPrice;
        bestStation = s;
        bestStation._bestPrice = targetPrice;
      }
    }

    cheapestStation = bestStation;
    if (cheapestStation && minPrice !== Infinity && mapManager) {
      // Attiva e aggiorna il glowing con il colore coerente al carburante (verde per benzina, blu per gasolio)
      mapManager.highlightCheapestStation(cheapestStation, targetFuel);
    } else if (mapManager) {
      mapManager.highlightCheapestStation(null, targetFuel);
    }
  }

  function loadStatus() {
    fetch('data/status.json')
      .then(res => {
        if (!res.ok) throw new Error('Fallback API');
        return res.json();
      })
      .catch(() => fetch('/api/status').then(r => r.json()))
      .then(data => {
        if (!data || !data.ok) return;
        const meta = data.metadata || {};
        if (dom.lastExtractionSpan) dom.lastExtractionSpan.textContent = meta.data_estrazione || '-';
        if (dom.lastUpdateSpan) dom.lastUpdateSpan.textContent = meta.data_aggiornamento || '-';
      })
      .catch(console.error);
  }

  function loadBrands() {
    fetch('data/brands.json')
      .then(res => {
        if (!res.ok) throw new Error('Fallback API');
        return res.json();
      })
      .catch(() => fetch('/api/brands').then(r => r.json()))
      .then(brands => {
        if (!dom.brandSelect) return;
        let html = '<option value="TUTTI">Tutte le compagnie (Tutte)</option>';
        html += '<option value="POMPE_BIANCHE">Pompe Bianche / No Logo</option>';
        (brands || []).forEach(b => {
          html += `<option value="${b.bandiera}">${b.bandiera} (${b.count})</option>`;
        });
        dom.brandSelect.innerHTML = html;
      })
      .catch(console.error);
  }

  function resetFilters() {
    activeFilters = {
      fuel: 'tutti',
      service: 'tutti',
      brand: 'TUTTI',
      maxPrice: null,
      search: '',
      clustering: true,
      cheapestFuelTarget: localStorage.getItem('cheapest_fuel_target') || 'benzina'
    };
    if (dom.searchInput) dom.searchInput.value = '';
    if (dom.brandSelect) dom.brandSelect.value = 'TUTTI';
    if (dom.maxPriceInput) {
      dom.maxPriceInput.value = 2.50;
      dom.maxPriceVal.textContent = 'Nessun limite';
    }
    if (dom.clusterToggle) dom.clusterToggle.checked = true;
    dom.fuelButtons.forEach(b => b.classList.toggle('active', b.dataset.fuel === 'tutti'));
    dom.serviceButtons.forEach(b => b.classList.toggle('active', b.dataset.service === 'tutti'));

    applyFiltersClientSide();
    showToast('Filtri ripristinati');
  }

  function switchMapProvider(prov, key) {
    mapManager.switchProvider(prov, key)
      .then(() => {
        localStorage.setItem('map_provider', prov);
        showToast(prov === 'google' ? 'Google Maps attivo!' : 'OpenStreetMap attivo!');
      })
      .catch(err => {
        showToast(err.message);
        if (dom.providerSelect) dom.providerSelect.value = 'leaflet';
        mapManager.switchProvider('leaflet');
      });
  }

  function openGmapsModal() {
    const savedKey = localStorage.getItem('google_maps_api_key') || '';
    if (dom.gmapsKeyInput) dom.gmapsKeyInput.value = savedKey;
    if (dom.gmapsModal) dom.gmapsModal.style.display = 'flex';
  }

  function closeGmapsModal() {
    if (dom.gmapsModal) dom.gmapsModal.style.display = 'none';
  }

  function refreshMimitData() {
    if (dom.btnRefreshData) dom.btnRefreshData.disabled = true;

    // Rileva se l'app è ospitata su GitHub Pages (o ambiente statico serverless)
    const isStaticHost = window.location.hostname.includes('github.io') || 
                         window.location.protocol === 'file:' || 
                         (!window.location.port && window.location.hostname !== 'localhost');

    if (isStaticHost) {
      showToast('Verifica nuovi dati in corso...');
      // Su GitHub Pages rilegge i file JSON con cache busting per caricare l'ultimo aggiornamento delle GitHub Actions
      fetch('data/status.json?_t=' + Date.now())
        .then(res => res.json())
        .then(status => {
          const date = (status.metadata && status.metadata.data_estrazione) || '';
          showToast(`Dati MIMIT aggiornati al ${date} (Aggiornamento automatico ogni mattina alle 08:30 via GitHub Actions)`);
          loadStatus();
          loadAllStations();
        })
        .catch(err => {
          showToast('Nessun nuovo dato disponibile al momento.');
        })
        .finally(() => {
          if (dom.btnRefreshData) dom.btnRefreshData.disabled = false;
        });
      return;
    }

    // Su server locale Python: avvia l'ETL in background
    showToast('Download dati MIMIT in corso...');
    fetch('/api/update', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        showToast(data.message || 'Aggiornamento avviato...');
        pollUpdateStatus();
      })
      .catch(err => {
        showToast('Errore: ' + err.message);
        if (dom.btnRefreshData) dom.btnRefreshData.disabled = false;
      });
  }

  function pollUpdateStatus() {
    const interval = setInterval(() => {
      fetch('/api/update/status')
        .then(res => res.json())
        .then(status => {
          if (!status.is_running) {
            clearInterval(interval);
            if (dom.btnRefreshData) dom.btnRefreshData.disabled = false;
            if (status.error) {
              showToast(status.message || 'Errore durante l\'aggiornamento dati MIMIT');
              return;
            }
            showToast(status.message || 'Dati MIMIT aggiornati con successo!');
            loadStatus();
            loadAllStations();
          }
        })
        .catch(() => {
          clearInterval(interval);
          if (dom.btnRefreshData) dom.btnRefreshData.disabled = false;
        });
    }, 2000);
  }

  // ==========================================
  // MODALE SPREADSHEET / TABELLA DISTRIBUTORI
  // ==========================================
  const SPREADSHEET_ALL_COLS = [
    'nome', 'bandiera', 'comune',
    'prezzo_benzina_self', 'prezzo_benzina_servito',
    'prezzo_gasolio_self', 'prezzo_gasolio_servito',
    'prezzo_gpl', 'prezzo_metano', 'actions'
  ];

  const spreadsheetState = {
    scope: 'visible', // 'visible' | 'all'
    search: '',
    sortCol: 'nome',
    sortDir: 'asc', // 'asc' | 'desc'
    page: 1,
    pageSize: 25,
    _totalPages: 1,
    visibleCols: new Set(SPREADSHEET_ALL_COLS)
  };

  function loadSpreadsheetColumnPreferences() {
    try {
      const saved = localStorage.getItem('pbm_spreadsheet_columns');
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr) && arr.length > 0) {
          spreadsheetState.visibleCols = new Set(arr);
        }
      }
    } catch (e) {
      console.warn('Errore lettura pbm_spreadsheet_columns:', e);
    }
  }

  function applySpreadsheetColumnVisibility() {
    const table = document.getElementById('spreadsheet-table');
    if (!table) return;

    SPREADSHEET_ALL_COLS.forEach(col => {
      const isVisible = spreadsheetState.visibleCols.has(col);
      table.classList.toggle(`hide-col-${col}`, !isVisible);
    });

    const checkboxes = document.querySelectorAll('#spreadsheet-cols-config input[data-col-target]');
    checkboxes.forEach(cb => {
      const col = cb.dataset.colTarget;
      cb.checked = spreadsheetState.visibleCols.has(col);
    });
  }

  function setupSpreadsheetColumnConfig() {
    loadSpreadsheetColumnPreferences();
    applySpreadsheetColumnVisibility();

    const container = document.getElementById('spreadsheet-cols-config');
    if (!container) return;

    container.addEventListener('change', (e) => {
      const cb = e.target.closest('input[data-col-target]');
      if (!cb) return;
      const col = cb.dataset.colTarget;
      if (cb.checked) {
        spreadsheetState.visibleCols.add(col);
      } else {
        if (spreadsheetState.visibleCols.size <= 1) {
          cb.checked = true;
          showToast('Almeno una colonna deve rimanere visibile');
          return;
        }
        spreadsheetState.visibleCols.delete(col);
      }
      try {
        localStorage.setItem('pbm_spreadsheet_columns', JSON.stringify([...spreadsheetState.visibleCols]));
      } catch (err) {
        console.warn('Errore salvataggio colonne:', err);
      }
      applySpreadsheetColumnVisibility();
    });
  }

  function setupColumnResizers() {
    if (!dom.spreadsheetModal) return;
    const resizers = dom.spreadsheetModal.querySelectorAll('.col-resizer');
    resizers.forEach(resizer => {
      // Ferma il click così non scatena l'ordinamento della colonna (sortable)
      resizer.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      resizer.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const th = resizer.parentElement;
        const startX = e.pageX;
        const startWidth = th.getBoundingClientRect().width;

        resizer.classList.add('is-resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const onMouseMove = (moveEvent) => {
          const diff = moveEvent.pageX - startX;
          const newWidth = Math.max(50, Math.round(startWidth + diff));
          th.style.width = `${newWidth}px`;
          th.style.minWidth = `${newWidth}px`;
        };

        const onMouseUp = () => {
          resizer.classList.remove('is-resizing');
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });
  }

  function setupSpreadsheetModal() {
    if (!dom.spreadsheetModal) return;

    setupSpreadsheetColumnConfig();
    setupColumnResizers();

    // Apertura da pulsante header o da mini-rail
    if (dom.btnSpreadsheet) {
      dom.btnSpreadsheet.addEventListener('click', () => openSpreadsheetModal());
    }
    if (dom.miniRailTableBtn) {
      dom.miniRailTableBtn.addEventListener('click', () => openSpreadsheetModal());
    }

    // Chiusura con X o click fuori
    if (dom.btnCloseSpreadsheet) {
      dom.btnCloseSpreadsheet.addEventListener('click', () => closeSpreadsheetModal());
    }
    dom.spreadsheetModal.addEventListener('click', (e) => {
      if (e.target === dom.spreadsheetModal) closeSpreadsheetModal();
    });

    // Filtro di ricerca testuale dinamico
    if (dom.spreadsheetFilterInput) {
      dom.spreadsheetFilterInput.addEventListener('input', () => {
        spreadsheetState.search = dom.spreadsheetFilterInput.value.trim().toLowerCase();
        spreadsheetState.page = 1;
        renderSpreadsheetTable();
      });
    }

    // Selezione ambito (Area Mappa vs Tutti i filtrati)
    if (dom.btnTableScopeVisible) {
      dom.btnTableScopeVisible.addEventListener('click', () => {
        spreadsheetState.scope = 'visible';
        spreadsheetState.page = 1;
        dom.btnTableScopeVisible.classList.add('active');
        if (dom.btnTableScopeAll) dom.btnTableScopeAll.classList.remove('active');
        renderSpreadsheetTable();
      });
    }
    if (dom.btnTableScopeAll) {
      dom.btnTableScopeAll.addEventListener('click', () => {
        spreadsheetState.scope = 'all';
        spreadsheetState.page = 1;
        dom.btnTableScopeAll.classList.add('active');
        if (dom.btnTableScopeVisible) dom.btnTableScopeVisible.classList.remove('active');
        renderSpreadsheetTable();
      });
    }

    // Ordinamento colonne al click sull'intestazione
    const headers = dom.spreadsheetModal.querySelectorAll('th.sortable');
    headers.forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (spreadsheetState.sortCol === col) {
          spreadsheetState.sortDir = (spreadsheetState.sortDir === 'asc') ? 'desc' : 'asc';
        } else {
          spreadsheetState.sortCol = col;
          spreadsheetState.sortDir = 'asc';
        }
        spreadsheetState.page = 1;
        renderSpreadsheetTable();
      });
    });

    // Paginazione trasparente
    if (dom.btnPageFirst) {
      dom.btnPageFirst.addEventListener('click', () => {
        spreadsheetState.page = 1;
        renderSpreadsheetTable();
      });
    }
    if (dom.btnPagePrev) {
      dom.btnPagePrev.addEventListener('click', () => {
        if (spreadsheetState.page > 1) {
          spreadsheetState.page--;
          renderSpreadsheetTable();
        }
      });
    }
    if (dom.btnPageNext) {
      dom.btnPageNext.addEventListener('click', () => {
        if (spreadsheetState.page < spreadsheetState._totalPages) {
          spreadsheetState.page++;
          renderSpreadsheetTable();
        }
      });
    }
    if (dom.btnPageLast) {
      dom.btnPageLast.addEventListener('click', () => {
        spreadsheetState.page = spreadsheetState._totalPages || 1;
        renderSpreadsheetTable();
      });
    }

    // Pulsante Esportazione Tabella in CSV/TXT con locale italiano (; e , decimale)
    if (dom.btnExportSpreadsheetCsv) {
      dom.btnExportSpreadsheetCsv.addEventListener('click', () => exportSpreadsheetCSV());
    }

    // Delegazione evento per il pulsante "Mappa" dentro le righe della tabella
    if (dom.spreadsheetTbody) {
      dom.spreadsheetTbody.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-map-focus');
        if (btn) {
          const lat = parseFloat(btn.dataset.lat);
          const lng = parseFloat(btn.dataset.lng);
          if (!isNaN(lat) && !isNaN(lng)) {
            closeSpreadsheetModal();
            if (mapManager) {
              mapManager.setView(lat, lng, 16);
            }
          }
        }
      });
    }
  }

  function openSpreadsheetModal() {
    if (!dom.spreadsheetModal) return;
    spreadsheetState.page = 1;
    dom.spreadsheetModal.style.display = 'flex';
    renderSpreadsheetTable();
  }

  function closeSpreadsheetModal() {
    if (!dom.spreadsheetModal) return;
    dom.spreadsheetModal.style.display = 'none';
  }

  /**
   * Restituisce il dataset ordinato e filtrato attualmente attivo nella tabella spreadsheet.
   */
  function getSpreadsheetCurrentData() {
    // 1. Dataset base: area attualmente visibile sulla mappa o tutti i distributori filtrati
    let data = (spreadsheetState.scope === 'visible' && currentVisibleStations.length > 0)
      ? [...currentVisibleStations]
      : [...filteredStations];

    // 2. Filtro di ricerca testuale
    if (spreadsheetState.search) {
      const q = spreadsheetState.search;
      data = data.filter(s => {
        const nome = (s.nome || '').toLowerCase();
        const bandiera = (s.bandiera || '').toLowerCase();
        const comune = (s.comune || '').toLowerCase();
        const indirizzo = (s.indirizzo || '').toLowerCase();
        return nome.includes(q) || bandiera.includes(q) || comune.includes(q) || indirizzo.includes(q);
      });
    }

    // 3. Ordinamento su colonna (numerico per prezzi, stringa per anagrafica)
    const col = spreadsheetState.sortCol;
    const isAsc = (spreadsheetState.sortDir === 'asc');
    const numericCols = [
      'prezzo_benzina_self', 'prezzo_benzina_servito',
      'prezzo_gasolio_self', 'prezzo_gasolio_servito',
      'prezzo_gpl', 'prezzo_metano'
    ];

    data.sort((a, b) => {
      let valA = a[col];
      let valB = b[col];

      if (numericCols.includes(col)) {
        valA = (valA !== null && valA !== undefined && valA > 0) ? Number(valA) : (isAsc ? Infinity : -Infinity);
        valB = (valB !== null && valB !== undefined && valB > 0) ? Number(valB) : (isAsc ? Infinity : -Infinity);
        return isAsc ? (valA - valB) : (valB - valA);
      } else {
        valA = (valA || '').toString().toLowerCase();
        valB = (valB || '').toString().toLowerCase();
        return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
    });

    return data;
  }

  /**
   * Esporta il dataset attuale della tabella in formato CSV / TXT italiano:
   * - Separatore di colonna: punto e virgola ';'
   * - Separatore decimale dei numeri: virgola ','
   * - Codifica UTF-8 con BOM (\uFEFF) per perfetta apertura nativa in Excel Windows e LibreOffice
   */
  function exportSpreadsheetCSV() {
    const data = getSpreadsheetCurrentData();
    if (!data || data.length === 0) {
      showToast('Nessun distributore da esportare nella tabella');
      return;
    }

    const colDefinitions = [
      { id: 'nome', title: 'Distributore', get: s => s.nome || '' },
      { id: 'bandiera', title: 'Marchio', get: s => s.bandiera || '' },
      { id: 'comune', title: 'Comune / Indirizzo', get: s => s.indirizzo ? `${s.comune || ''} - ${s.indirizzo}` : (s.comune || '') },
      { id: 'prezzo_benzina_self', title: 'Benzina Self (€/L)', get: s => (s.prezzo_benzina_self && s.prezzo_benzina_self > 0) ? Number(s.prezzo_benzina_self).toFixed(3).replace('.', ',') : '' },
      { id: 'prezzo_benzina_servito', title: 'Benzina Servito (€/L)', get: s => (s.prezzo_benzina_servito && s.prezzo_benzina_servito > 0) ? Number(s.prezzo_benzina_servito).toFixed(3).replace('.', ',') : '' },
      { id: 'prezzo_gasolio_self', title: 'Gasolio Self (€/L)', get: s => (s.prezzo_gasolio_self && s.prezzo_gasolio_self > 0) ? Number(s.prezzo_gasolio_self).toFixed(3).replace('.', ',') : '' },
      { id: 'prezzo_gasolio_servito', title: 'Gasolio Servito (€/L)', get: s => (s.prezzo_gasolio_servito && s.prezzo_gasolio_servito > 0) ? Number(s.prezzo_gasolio_servito).toFixed(3).replace('.', ',') : '' },
      { id: 'prezzo_gpl', title: 'GPL (€/L)', get: s => (s.prezzo_gpl && s.prezzo_gpl > 0) ? Number(s.prezzo_gpl).toFixed(3).replace('.', ',') : '' },
      { id: 'prezzo_metano', title: 'Metano (€/kg)', get: s => (s.prezzo_metano && s.prezzo_metano > 0) ? Number(s.prezzo_metano).toFixed(3).replace('.', ',') : '' },
      { id: 'latitudine', title: 'Latitudine', get: s => (s.latitudine) ? Number(s.latitudine).toFixed(6).replace('.', ',') : '' },
      { id: 'longitudine', title: 'Longitudine', get: s => (s.longitudine) ? Number(s.longitudine).toFixed(6).replace('.', ',') : '' }
    ];

    // Includi le colonne abilitate dall'utente (più le coordinate geografiche utili nel foglio)
    const activeCols = colDefinitions.filter(c => {
      if (c.id === 'latitudine' || c.id === 'longitudine') return true;
      return !spreadsheetState.visibleCols || spreadsheetState.visibleCols.has(c.id);
    });

    const escapeCsv = (val) => {
      const str = (val === null || val === undefined) ? '' : String(val);
      if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerRow = activeCols.map(c => escapeCsv(c.title)).join(';');
    const dataRows = data.map(station => {
      return activeCols.map(c => escapeCsv(c.get(station))).join(';');
    });

    // UTF-8 BOM (\uFEFF) per garantire apertura con accenti corretti in Excel su Windows
    const csvContent = '\uFEFF' + [headerRow, ...dataRows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const scopeStr = spreadsheetState.scope === 'visible' ? 'area_mappa' : 'tutti_filtrati';
    const filename = `distributori_${scopeStr}_${dateStr}.csv`;

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Esportati con successo ${data.length.toLocaleString('it-IT')} distributori in CSV`);
  }

  function renderSpreadsheetTable() {
    if (!dom.spreadsheetTbody) return;

    // Recupera il dataset filtrato e ordinato
    const data = getSpreadsheetCurrentData();

    // 4. Paginazione trasparente ad alte prestazioni
    const totalCount = data.length;
    const pageSize = spreadsheetState.pageSize;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    spreadsheetState._totalPages = totalPages;

    if (spreadsheetState.page > totalPages) spreadsheetState.page = totalPages;
    if (spreadsheetState.page < 1) spreadsheetState.page = 1;
    const page = spreadsheetState.page;

    const startIdx = (page - 1) * pageSize;
    const endIdx = Math.min(totalCount, startIdx + pageSize);
    const pageRows = data.slice(startIdx, endIdx);

    // 5. Aggiornamento contatori e bottoni paginazione
    if (dom.spreadsheetCountLabel) {
      const scopeLabel = (spreadsheetState.scope === 'visible') ? 'area mappa' : 'tutti i filtrati';
      dom.spreadsheetCountLabel.textContent = `${totalCount.toLocaleString('it-IT')} distributori (${scopeLabel})`;
    }

    if (dom.spreadsheetPaginationInfo) {
      dom.spreadsheetPaginationInfo.textContent = (totalCount === 0)
        ? 'Nessun distributore corrispondente'
        : `Mostrati ${startIdx + 1} - ${endIdx} di ${totalCount.toLocaleString('it-IT')} distributori`;
    }

    if (dom.spreadsheetPageIndicator) {
      dom.spreadsheetPageIndicator.textContent = `Pagina ${page} di ${totalPages}`;
    }

    if (dom.btnPageFirst) dom.btnPageFirst.disabled = (page <= 1);
    if (dom.btnPagePrev) dom.btnPagePrev.disabled = (page <= 1);
    if (dom.btnPageNext) dom.btnPageNext.disabled = (page >= totalPages);
    if (dom.btnPageLast) dom.btnPageLast.disabled = (page >= totalPages);

    // Aggiornamento freccia ordinamento sull'header
    const col = spreadsheetState.sortCol;
    const isAsc = (spreadsheetState.sortDir === 'asc');
    const headers = dom.spreadsheetModal.querySelectorAll('th.sortable');
    headers.forEach(th => {
      const ind = th.querySelector('.sort-indicator');
      if (ind) {
        if (th.dataset.sort === col) {
          ind.textContent = isAsc ? ' ▲' : ' ▼';
        } else {
          ind.textContent = '';
        }
      }
    });

    // 6. Generazione righe tabella
    const visibleColsCount = spreadsheetState.visibleCols ? spreadsheetState.visibleCols.size : 10;
    if (pageRows.length === 0) {
      dom.spreadsheetTbody.innerHTML = `
        <tr>
          <td colspan="${visibleColsCount || 10}" style="text-align:center; padding:32px; color:var(--text-muted);">
            Nessun distributore trovato corrispondente ai criteri selezionati.
          </td>
        </tr>
      `;
      return;
    }

    dom.spreadsheetTbody.innerHTML = pageRows.map(s => {
      const nome = s.nome || 'Distributore';
      const bandiera = s.bandiera || 'Pompe Bianche';
      const comuneIndirizzo = s.indirizzo ? `${s.comune || ''} - ${s.indirizzo}` : (s.comune || '-');
      const bSelf = (s.prezzo_benzina_self && s.prezzo_benzina_self > 0) ? `${Number(s.prezzo_benzina_self).toFixed(3)} €` : '-';
      const bServ = (s.prezzo_benzina_servito && s.prezzo_benzina_servito > 0) ? `${Number(s.prezzo_benzina_servito).toFixed(3)} €` : '-';
      const gSelf = (s.prezzo_gasolio_self && s.prezzo_gasolio_self > 0) ? `${Number(s.prezzo_gasolio_self).toFixed(3)} €` : '-';
      const gServ = (s.prezzo_gasolio_servito && s.prezzo_gasolio_servito > 0) ? `${Number(s.prezzo_gasolio_servito).toFixed(3)} €` : '-';
      const gpl = (s.prezzo_gpl && s.prezzo_gpl > 0) ? `${Number(s.prezzo_gpl).toFixed(3)} €` : '-';
      const metano = (s.prezzo_metano && s.prezzo_metano > 0) ? `${Number(s.prezzo_metano).toFixed(3)} €` : '-';

      return `
        <tr>
          <td data-col="nome" style="font-weight:600;" title="${nome}">${nome}</td>
          <td data-col="bandiera"><span class="brand-pill">${bandiera}</span></td>
          <td data-col="comune" title="${comuneIndirizzo}" style="max-width:220px; overflow:hidden; text-overflow:ellipsis;">${comuneIndirizzo}</td>
          <td data-col="prezzo_benzina_self" class="td-benzina">${bSelf}</td>
          <td data-col="prezzo_benzina_servito">${bServ}</td>
          <td data-col="prezzo_gasolio_self" class="td-gasolio">${gSelf}</td>
          <td data-col="prezzo_gasolio_servito">${gServ}</td>
          <td data-col="prezzo_gpl">${gpl}</td>
          <td data-col="prezzo_metano">${metano}</td>
          <td data-col="actions" style="text-align:center;">
            <button class="btn-map-focus" data-lat="${s.latitudine}" data-lng="${s.longitudine}" title="Centra ed evidenzia sulla mappa">
              <svg class="icon-material" viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5z"/>
              </svg>
              <span>Vedi</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ==========================================
  // MODALE NOTE LEGALI & DISCLAIMER OPEN DATA
  // ==========================================
  function setupLegalModal() {
    if (!dom.legalModal) return;

    if (dom.btnLegal) {
      dom.btnLegal.addEventListener('click', () => {
        dom.legalModal.style.display = 'flex';
      });
    }

    if (dom.miniRailLegalBtn) {
      dom.miniRailLegalBtn.addEventListener('click', () => {
        dom.legalModal.style.display = 'flex';
      });
    }

    if (dom.btnCloseLegal) {
      dom.btnCloseLegal.addEventListener('click', () => {
        dom.legalModal.style.display = 'none';
      });
    }

    if (dom.btnDismissLegal) {
      dom.btnDismissLegal.addEventListener('click', () => {
        dom.legalModal.style.display = 'none';
      });
    }

    dom.legalModal.addEventListener('click', (e) => {
      if (e.target === dom.legalModal) {
        dom.legalModal.style.display = 'none';
      }
    });
  }

  function showToast(msg) {
    if (!dom.toastContainer) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    dom.toastContainer.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  return {
    init: init,
    showToast: showToast,
    applyTheme: applyTheme,
    setSidebarCollapsed: setSidebarCollapsed
  };
})();

window.App = App;
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
