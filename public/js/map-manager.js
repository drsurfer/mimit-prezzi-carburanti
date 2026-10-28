/**
 * map-manager.js
 * Gestore unificato per Google Maps e Leaflet:
 * - Marker "a goccia" (teardrop pin) PNG reali per ciascun brand (con fallback neutro)
 * - Logo PNG del brand nel popup accanto al nome
 * - Animazione cerchi concentrici sottili (glow ripple) ad alta visibilità ad ogni livello di zoom
 * - Nessuna scrollbar nel popup
 * - Supporto Dark Mode (Chiaro / Scuro / Sistema)
 */

const GOOGLE_MAPS_DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#4b6878" }] },
  { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#4b6878" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#023e58" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#283d6a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2c6675" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#255663" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] }
];

// Overlay personalizzato Google Maps per il distributore più economico
// Utilizza panes.floatPane per essere SEMPRE visibile sopra qualsiasi cluster o marker
function createCheapestOverlayClass() {
  if (typeof google === 'undefined' || !google.maps || !google.maps.OverlayView) return null;

  class CheapestOverlay extends google.maps.OverlayView {
    constructor() {
      super();
      this.div = null;
      this.station = null;
      this.fuelType = 'benzina';
    }

    onAdd() {
      this.div = document.createElement('div');
      this.div.className = `cheapest-glow-beacon ${this.fuelType}`;
      this.div.innerHTML = `
        <div class="beacon-pulse-ring ring-1"></div>
        <div class="beacon-pulse-ring ring-2"></div>
        <div class="beacon-pulse-ring ring-3"></div>
        <div class="beacon-pulse-ring ring-4"></div>
        <div class="beacon-center-glow">★</div>
      `;
      // Attacca a overlayLayer (inferiore a markerPane e floatPane) in modo che
      // il popup informativo rimanga SEMPRE al di sopra delle onde luminose (glowing)
      const panes = this.getPanes();
      const targetPane = panes.overlayLayer || panes.markerPane;
      targetPane.appendChild(this.div);
    }

    draw() {
      if (!this.div) return;
      if (!this.station || !this.station.latitudine || !this.station.longitudine || this.fuelType === 'none') {
        this.div.style.display = 'none';
        return;
      }
      const projection = this.getProjection();
      if (!projection) return;

      const latLng = new google.maps.LatLng(this.station.latitudine, this.station.longitudine);
      const pos = projection.fromLatLngToDivPixel(latLng);
      if (pos) {
        this.div.style.left = pos.x + 'px';
        this.div.style.top = (pos.y - 23) + 'px';
        this.div.style.display = 'block';
        this.div.style.zIndex = '10'; // Z-index contenuto per rimanere sotto ai popup
      }
    }

    setStation(station, fuelType = 'benzina') {
      this.station = station;
      this.fuelType = fuelType;
      if (!station || fuelType === 'none') {
        if (this.div) this.div.style.display = 'none';
        return;
      }
      if (this.div) {
        this.div.className = `cheapest-glow-beacon ${fuelType}`;
        this.draw();
      }
    }

    onRemove() {
      if (this.div && this.div.parentNode) {
        this.div.parentNode.removeChild(this.div);
        this.div = null;
      }
    }
  }

  return CheapestOverlay;
}

class MapManager {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = Object.assign({
      center: [41.9028, 12.4964],
      zoom: 6,
      provider: 'google',
      clustering: true,
      onBoundsChanged: null,
      onMarkerClick: null
    }, options);

    this.currentProvider = this.options.provider;
    this.isDarkMode = false;
    this.useClustering = this.options.clustering;
    this.hidePoi = (this.options.hidePoi !== undefined) ? Boolean(this.options.hidePoi) : true;

    // Riferimenti Leaflet
    this.leafletMap = null;
    this.leafletCluster = null;
    this.leafletTileLayer = null;
    this.leafletCheapestMarker = null;

    // Riferimenti Google Maps
    this.googleMap = null;
    this.googleCluster = null;
    this.googleMarkers = [];
    this.googleInfoWindow = null;
    this.googleCheapestOverlay = null;

    this.stations = [];
    this.activeStationId = null;
    this.cheapestStation = null;
    this.debounceTimer = null;
  }

  init() {
    const promise = (this.currentProvider === 'google')
      ? this.initGoogleMaps()
      : this.initLeaflet();

    return promise.then(() => {
      if (this.stations && this.stations.length > 0) {
        this.renderStations(this.stations);
      }
    });
  }

  setTheme(effectiveTheme) {
    this.isDarkMode = (effectiveTheme === 'dark');

    if (this.currentProvider === 'google' && this.googleMap) {
      this.applyGoogleMapsStyles();
    } else if (this.currentProvider === 'leaflet' && this.leafletMap) {
      this.updateLeafletTiles();
    }
  }

  setClustering(enabled) {
    this.useClustering = Boolean(enabled);
    this.renderStations(this.stations);
  }

  setHidePoi(enabled) {
    this.hidePoi = Boolean(enabled);
    this.applyGoogleMapsStyles();
  }

  applyGoogleMapsStyles() {
    if (this.currentProvider !== 'google' || !this.googleMap) return;
    let baseStyles = this.isDarkMode ? [...GOOGLE_MAPS_DARK_STYLE] : [];
    if (this.hidePoi) {
      baseStyles.push({
        featureType: "poi",
        stylers: [{ visibility: "off" }]
      });
    }
    this.googleMap.setOptions({ styles: baseStyles });
  }

  // ==========================================
  // GOOGLE MAPS
  // ==========================================
  initGoogleMaps(apiKey) {
    this.cleanupMaps();
    const key = apiKey || localStorage.getItem('google_maps_api_key');
    if (!key) {
      return Promise.reject(new Error('Nessuna chiave Google Maps API inserita.'));
    }

    return this.loadGoogleMapsScript(key).then(() => {
      const container = document.getElementById(this.containerId);
      container.innerHTML = '';

      this.googleMap = new google.maps.Map(container, {
        center: { lat: this.options.center[0], lng: this.options.center[1] },
        zoom: this.options.zoom,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: false,
        styles: []
      });

      this.applyGoogleMapsStyles();

      this.googleInfoWindow = new google.maps.InfoWindow({
        maxWidth: 310
      });

      // Crea l'overlay per il distributore più economico
      const CheapestClass = createCheapestOverlayClass();
      if (CheapestClass) {
        this.googleCheapestOverlay = new CheapestClass();
        this.googleCheapestOverlay.setMap(this.googleMap);
      }

      // Marker Clusterer
      if (window.markerClusterer && window.markerClusterer.MarkerClusterer) {
        this.googleCluster = new markerClusterer.MarkerClusterer({
          map: this.googleMap,
          algorithmOptions: { maxZoom: 13 }
        });
      }

      // Aggiorna l'overlay e i bounds continuamente al movimento e cambio zoom
      this.googleMap.addListener('idle', () => {
        this.triggerBoundsChanged();
        if (this.googleCheapestOverlay) this.googleCheapestOverlay.draw();
      });

      this.googleMap.addListener('zoom_changed', () => {
        if (this.googleCheapestOverlay) this.googleCheapestOverlay.draw();
      });

      this.googleMap.addListener('drag', () => {
        if (this.googleCheapestOverlay) this.googleCheapestOverlay.draw();
      });

      this.currentProvider = 'google';
      if (this.stations && this.stations.length > 0) {
        this.renderGoogleMarkers(this.stations);
      }
    });
  }

  loadGoogleMapsScript(key) {
    if (window.google && window.google.maps) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const existingScript = document.getElementById('google-maps-script');
      if (existingScript) existingScript.remove();

      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=__googleMapsInitCallback`;
      script.async = true;
      script.defer = true;

      window.__googleMapsInitCallback = () => resolve();
      script.onerror = () => reject(new Error('Impossibile caricare Google Maps API.'));
      document.head.appendChild(script);
    });
  }

  // ==========================================
  // LEAFLET
  // ==========================================
  initLeaflet() {
    this.cleanupMaps();
    const container = document.getElementById(this.containerId);
    container.innerHTML = '';

    this.leafletMap = L.map(this.containerId, {
      center: this.options.center,
      zoom: this.options.zoom,
      zoomControl: true,
      preferCanvas: true
    });

    this.updateLeafletTiles();

    this.leafletCluster = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 100,
      chunkDelay: 50,
      maxClusterRadius: 45,
      disableClusteringAtZoom: 13,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true
    });

    this.leafletMap.addLayer(this.leafletCluster);

    this.leafletMap.on('moveend', () => {
      this.triggerBoundsChanged();
    });

    this.currentProvider = 'leaflet';
    if (this.stations && this.stations.length > 0) {
      this.renderLeafletMarkers(this.stations);
    }
    return Promise.resolve();
  }

  updateLeafletTiles() {
    if (!this.leafletMap) return;
    if (this.leafletTileLayer) {
      return; // I tile ufficiali OpenStreetMap rimangono sempre attivi: la modalità scura è gestita via CSS senza API key
    }

    // Tile ufficiali OpenStreetMap: 100% gratuiti, liberi e senza alcuna API key o watermark
    this.leafletTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors | Dati: MIMIT'
    });

    this.leafletTileLayer.addTo(this.leafletMap);
  }

  // ==========================================
  // PULIZIA E SWITCH
  // ==========================================
  cleanupMaps() {
    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = null;
      this.leafletCluster = null;
      this.leafletTileLayer = null;
      this.leafletCheapestMarker = null;
    }
    if (this.googleCheapestOverlay) {
      this.googleCheapestOverlay.setMap(null);
      this.googleCheapestOverlay = null;
    }
    if (this.googleCluster) {
      this.googleCluster.clearMarkers();
      this.googleCluster = null;
    }
    for (let i = 0; i < this.googleMarkers.length; i++) {
      this.googleMarkers[i].setMap(null);
    }
    this.googleMarkers = [];
    this.googleMap = null;
    const container = document.getElementById(this.containerId);
    if (container) container.innerHTML = '';
  }

  switchProvider(provider, apiKey) {
    if (provider === 'google') {
      return this.initGoogleMaps(apiKey).then(() => {
        this.currentProvider = 'google';
        this.renderStations(this.stations);
        if (this.cheapestStation) this.highlightCheapestStation(this.cheapestStation);
      });
    } else {
      this.currentProvider = 'leaflet';
      return this.initLeaflet().then(() => {
        this.renderStations(this.stations);
        if (this.cheapestStation) this.highlightCheapestStation(this.cheapestStation);
      });
    }
  }

  getBounds() {
    if (this.currentProvider === 'google' && this.googleMap) {
      const bounds = this.googleMap.getBounds();
      if (!bounds) return null;
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      return {
        north: ne.lat(),
        south: sw.lat(),
        east: ne.lng(),
        west: sw.lng()
      };
    } else if (this.leafletMap) {
      const bounds = this.leafletMap.getBounds();
      return {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      };
    }
    return null;
  }

  setView(lat, lng, zoom = 14) {
    if (this.currentProvider === 'google' && this.googleMap) {
      this.googleMap.setCenter({ lat, lng });
      this.googleMap.setZoom(zoom);
      // Apri automaticamente il popup del marker corrispondente
      this.openMarkerPopupAt(lat, lng);
    } else if (this.leafletMap) {
      this.leafletMap.setView([lat, lng], zoom);
      this.openMarkerPopupAt(lat, lng);
    }
  }

  openMarkerPopupAt(lat, lng) {
    const station = this.stations.find(s => Math.abs(s.latitudine - lat) < 0.0001 && Math.abs(s.longitudine - lng) < 0.0001);
    if (!station) return;

    if (this.currentProvider === 'google' && this.googleMap) {
      const marker = this.googleMarkers.find(m => {
        const pos = m.getPosition();
        return pos && Math.abs(pos.lat() - lat) < 0.0001 && Math.abs(pos.lng() - lng) < 0.0001;
      });
      if (marker && this.googleInfoWindow) {
        const html = this.generatePopupContent(station);
        this.googleInfoWindow.setContent(html);
        this.googleInfoWindow.open(this.googleMap, marker);
      }
    }
  }

  invalidateSize() {
    if (this.currentProvider === 'google' && this.googleMap && typeof google !== 'undefined') {
      google.maps.event.trigger(this.googleMap, 'resize');
      if (this.googleCheapestOverlay) this.googleCheapestOverlay.draw();
    } else if (this.leafletMap) {
      this.leafletMap.invalidateSize();
    }
  }

  triggerBoundsChanged() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      if (typeof this.options.onBoundsChanged === 'function') {
        const bounds = this.getBounds();
        if (bounds) this.options.onBoundsChanged(bounds);
      }
    }, 120);
  }

  // ==========================================
  // RENDERING DEI DISTRIBUTORI CON MARKER PNG
  // ==========================================
  renderStations(stations) {
    this.stations = stations || [];

    if (this.currentProvider === 'google' && this.googleMap) {
      this.renderGoogleMarkers(this.stations);
    } else if (this.leafletMap && this.leafletCluster) {
      this.renderLeafletMarkers(this.stations);
    }
  }

  renderGoogleMarkers(stations) {
    if (this.googleCluster) {
      this.googleCluster.clearMarkers();
    }
    for (let i = 0; i < this.googleMarkers.length; i++) {
      this.googleMarkers[i].setMap(null);
    }
    this.googleMarkers = [];

    for (let i = 0; i < stations.length; i++) {
      const s = stations[i];
      if (!s.latitudine || !s.longitudine) continue;

      const pinUrl = window.BrandLogos 
        ? window.BrandLogos.getMarkerIconUrl(s.bandiera) 
        : 'img/markers/marker_neutral.png';

      const marker = new google.maps.Marker({
        position: { lat: s.latitudine, lng: s.longitudine },
        title: s.nome || 'Distributore Carburanti',
        icon: {
          url: pinUrl,
          scaledSize: new google.maps.Size(34, 46),
          anchor: new google.maps.Point(17, 45)
        },
        zIndex: 10
      });

      marker.addListener('click', () => {
        this.activeStationId = s.id_impianto;
        const html = this.generatePopupContent(s);
        this.googleInfoWindow.setContent(html);
        this.googleInfoWindow.open(this.googleMap, marker);
        if (typeof this.options.onMarkerClick === 'function') {
          this.options.onMarkerClick(s);
        }
      });

      this.googleMarkers.push(marker);
    }

    if (this.useClustering && this.googleCluster) {
      this.googleCluster.addMarkers(this.googleMarkers);
    } else {
      for (let i = 0; i < this.googleMarkers.length; i++) {
        this.googleMarkers[i].setMap(this.googleMap);
      }
    }
  }

  renderLeafletMarkers(stations) {
    this.leafletCluster.clearLayers();
    const markers = [];

    for (let i = 0; i < stations.length; i++) {
      const s = stations[i];
      if (!s.latitudine || !s.longitudine) continue;

      const pinUrl = window.BrandLogos 
        ? window.BrandLogos.getMarkerIconUrl(s.bandiera) 
        : 'img/markers/marker_neutral.png';

      const icon = L.icon({
        iconUrl: pinUrl,
        iconSize: [34, 46],
        iconAnchor: [17, 45],
        popupAnchor: [0, -42]
      });

      const marker = L.marker([s.latitudine, s.longitudine], { icon: icon });
      const popupHtml = this.generatePopupContent(s);
      marker.bindPopup(popupHtml, { maxWidth: 300 });

      marker.on('click', () => {
        this.activeStationId = s.id_impianto;
        if (typeof this.options.onMarkerClick === 'function') {
          this.options.onMarkerClick(s);
        }
      });

      markers.push(marker);
    }

    if (this.useClustering) {
      this.leafletCluster.addLayers(markers);
    } else {
      markers.forEach(m => m.addTo(this.leafletMap));
    }
  }

  // ==========================================
  // EVIDENZIAZIONE DISTRIBUTORE PIÙ ECONOMICO (GLOW RIPPLE)
  // Supporta selezione: 'none' (disattivato), 'benzina' (verde), 'gasolio' (blu)
  // ==========================================
  highlightCheapestStation(station, fuelType = 'benzina') {
    this.cheapestStation = station;
    this.cheapestFuelType = fuelType;

    // Se nessuna stazione trovata o glowing disattivato dall'utente
    if (!station || fuelType === 'none') {
      if (this.currentProvider === 'google' && this.googleCheapestOverlay) {
        this.googleCheapestOverlay.setStation(null, 'none');
      }
      if (this.currentProvider === 'leaflet' && this.leafletMap) {
        if (this.leafletCheapestMarker) {
          this.leafletMap.removeLayer(this.leafletCheapestMarker);
          this.leafletCheapestMarker = null;
        }
      }
      return;
    }

    // In Google Maps: tramite OverlayView nativo su floatPane (z-index massimo)
    if (this.currentProvider === 'google' && this.googleCheapestOverlay) {
      this.googleCheapestOverlay.setStation(station, fuelType);
    }

    // In Leaflet: tramite marker divIcon dedicato con priorità assoluta
    if (this.currentProvider === 'leaflet' && this.leafletMap) {
      if (this.leafletCheapestMarker) {
        this.leafletMap.removeLayer(this.leafletCheapestMarker);
        this.leafletCheapestMarker = null;
      }

      if (station && station.latitudine && station.longitudine) {
        const pulseIcon = L.divIcon({
          className: `cheapest-glow-beacon ${fuelType}`,
          html: `
            <div class="beacon-pulse-ring ring-1"></div>
            <div class="beacon-pulse-ring ring-2"></div>
            <div class="beacon-pulse-ring ring-3"></div>
            <div class="beacon-pulse-ring ring-4"></div>
            <div class="beacon-center-glow">★</div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 23]
        });

        this.leafletCheapestMarker = L.marker([station.latitudine, station.longitudine], {
          icon: pulseIcon,
          pane: 'overlayPane', // overlayPane è z-index 400, al di sotto dei popup (z-index 700)
          zIndexOffset: 10
        }).addTo(this.leafletMap);
      }
    }
  }

  // ==========================================
  // GENERAZIONE POPUP (NESSUNA SCROLLBAR, ICONE MATERIAL MONOCROMATICHE)
  // ==========================================
  generatePopupContent(s) {
    const nome = s.nome || s.gestore || 'Distributore Carburanti';
    const bandiera = s.bandiera || 'Pompe Bianche';
    const indirizzo = s.indirizzo ? `${s.indirizzo}, ${s.comune || ''} (${s.provincia || ''})` : `${s.comune || ''} (${s.provincia || ''})`;
    const gestore = s.gestore || 'Non specificato';

    const brandLogoHtml = window.BrandLogos 
      ? window.BrandLogos.getBrandBadgeHtml(bandiera, 42) 
      : '<img src="img/logos/neutral.png" class="popup-brand-logo-img" alt="Logo" />';

    const brandInfo = window.BrandLogos 
      ? window.BrandLogos.getBrandInfo(bandiera) 
      : { primaryColor: '#0f766e' };

    const bSelf = s.prezzo_benzina_self ? `${Number(s.prezzo_benzina_self).toFixed(3)} €` : '<span class="price-val unavailable">N.D.</span>';
    const bServ = s.prezzo_benzina_servito ? `${Number(s.prezzo_benzina_servito).toFixed(3)} €` : '<span class="price-val unavailable">N.D.</span>';
    const gSelf = s.prezzo_gasolio_self ? `${Number(s.prezzo_gasolio_self).toFixed(3)} €` : '<span class="price-val unavailable">N.D.</span>';
    const gServ = s.prezzo_gasolio_servito ? `${Number(s.prezzo_gasolio_servito).toFixed(3)} €` : '<span class="price-val unavailable">N.D.</span>';

    let extraFuelsHtml = '';
    if (s.prezzo_gpl || s.prezzo_metano) {
      extraFuelsHtml = `<div style="display:flex; gap:6px; margin-bottom:6px; font-size:0.72rem;">`;
      if (s.prezzo_gpl) {
        extraFuelsHtml += `<div style="flex:1; background:rgba(217, 119, 6, 0.12); border:1px solid rgba(217,119,6,0.3); padding:3px 5px; border-radius:4px;"><b>GPL:</b> ${Number(s.prezzo_gpl).toFixed(3)} €</div>`;
      }
      if (s.prezzo_metano) {
        extraFuelsHtml += `<div style="flex:1; background:rgba(147, 51, 234, 0.12); border:1px solid rgba(147,51,234,0.3); padding:3px 5px; border-radius:4px;"><b>Metano:</b> ${Number(s.prezzo_metano).toFixed(3)} €</div>`;
      }
      extraFuelsHtml += `</div>`;
    }

    const dataAggiornamento = s.ultimo_aggiornamento ? `Aggiornato: ${s.ultimo_aggiornamento}` : 'Rilevazione MIMIT';

    let defaultHtml = `
      <div class="station-popup">
        <div class="popup-header-row">
          ${brandLogoHtml}
          <div class="popup-header-info">
            <span class="brand-badge" style="background:${brandInfo.primaryColor}">${bandiera}</span>
            <h4 class="popup-title">${nome}</h4>
            <p class="popup-address">${indirizzo}</p>
            <p class="popup-gestore"><small>Gestore: ${gestore}</small></p>
          </div>
        </div>

        <div class="prices-grid">
          <div class="price-card benzina">
            <div class="fuel-name" style="color:var(--accent-benzina);">
              <svg class="icon-material" viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                <path d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33a2.5 2.5 0 002.5 2.5c.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM12 10H6V5h6v5zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
              </svg>
              <span>Benzina</span>
            </div>
            <div class="price-row">
              <span class="mode-label">Self:</span>
              <span class="price-val">${bSelf}</span>
            </div>
            <div class="price-row">
              <span class="mode-label">Servito:</span>
              <span class="price-val">${bServ}</span>
            </div>
          </div>
          <div class="price-card gasolio">
            <div class="fuel-name" style="color:var(--accent-gasolio);">
              <svg class="icon-material" viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                <path d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33a2.5 2.5 0 002.5 2.5c.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM12 10H6V5h6v5zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
              </svg>
              <span>Gasolio</span>
            </div>
            <div class="price-row">
              <span class="mode-label">Self:</span>
              <span class="price-val">${gSelf}</span>
            </div>
            <div class="price-row">
              <span class="mode-label">Servito:</span>
              <span class="price-val">${gServ}</span>
            </div>
          </div>
        </div>

        ${extraFuelsHtml}

        <div class="popup-footer">
          <div class="update-time">
            <svg class="icon-material" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style="vertical-align:-1px; margin-right:3px;">
              <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
            </svg>
            <span>${dataAggiornamento}</span>
          </div>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${s.latitudine},${s.longitudine}" 
             target="_blank" rel="noopener noreferrer" class="popup-directions-link" title="Apri indicazioni stradali in Google Maps">
            <svg class="directions-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M22.41 10.59l-9-9c-.79-.79-2.05-.79-2.83 0l-9 9c-.79.79-.79 2.05 0 2.83l9 9c.79.79 2.05.79 2.83 0l9-9c.78-.79.78-2.05 0-2.83zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z"/>
            </svg>
            <span>Indicazioni</span>
          </a>
        </div>
      </div>
    `;

    if (window.CustomizationHooks && typeof window.CustomizationHooks.enhancePopupHtml === 'function') {
      defaultHtml = window.CustomizationHooks.enhancePopupHtml(s, defaultHtml);
    }

    return defaultHtml;
  }
}

window.MapManager = MapManager;
