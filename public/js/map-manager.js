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
    this.leafletUserMarker = null;

    // Riferimenti Google Maps
    this.googleMap = null;
    this.googleCluster = null;
    this.googleMarkers = [];
    this.googleInfoWindow = null;
    this.googleCheapestOverlay = null;
    this.googleUserMarker = null;

    this.stations = [];
    this.activeStationId = null;
    this.cheapestStation = null;
    this.userLocation = null;
    this.debounceTimer = null;
  }

  init() {
    this.showLoading('Inizializzazione mappa...', 'Preparazione motore cartografico');
    const promise = (this.currentProvider === 'google')
      ? this.initGoogleMaps()
      : this.initLeaflet();

    return promise.then(() => {
      if (this.stations && this.stations.length > 0) {
        this.renderStations(this.stations);
      } else {
        this.hideLoading();
      }
    });
  }

  setTheme(effectiveTheme) {
    this.isDarkMode = (effectiveTheme === 'dark');

    if (this.currentProvider === 'google' && this.googleMap) {
      this.applyGoogleMapsStyles();
      if (this.googleCluster && typeof this.googleCluster.render === 'function') {
        this.googleCluster.render();
      }
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

      // Renderer monocromatico e super leggero per i cluster:
      // - Colore unico coerente con la palette (chiaro o scuro)
      // - Zero calcoli statistici di media o cicli di clock sprecati
      const customClusterRenderer = {
        render: ({ count, position }) => {
          const isDark = Boolean(this.isDarkMode);
          const clusterColor = isDark ? '#3b82f6' : '#1e3a8a';
          const outerOpacity = isDark ? '0.35' : '0.25';
          const midOpacity = isDark ? '0.6' : '0.55';

          const svg = `<svg fill="${clusterColor}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="48" height="48">
            <circle cx="120" cy="120" opacity="${outerOpacity}" r="110" />
            <circle cx="120" cy="120" opacity="${midOpacity}" r="88" />
            <circle cx="120" cy="120" opacity="1" r="66" />
            <text x="50%" y="50%" style="fill:#ffffff; font-weight:700;" text-anchor="middle" font-size="44" dominant-baseline="central" font-family="system-ui, -apple-system, sans-serif">${count}</text>
          </svg>`;

          return new google.maps.Marker({
            position: position,
            zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
            title: `Cluster: ${count} distributori`,
            icon: {
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
              scaledSize: new google.maps.Size(48, 48),
              anchor: new google.maps.Point(24, 24)
            }
          });
        }
      };

      // Marker Clusterer ottimizzato per semplificare il rendering a zoom medio/basso
      if (window.markerClusterer && window.markerClusterer.MarkerClusterer) {
        this.googleCluster = new markerClusterer.MarkerClusterer({
          map: this.googleMap,
          renderer: customClusterRenderer,
          algorithmOptions: { maxZoom: 13, gridSize: 60 }
        });
      }

      // Sincronizza i bounds solo quando il movimento della mappa termina (idle),
      // evitando layout thrashing e violazioni di rendering durante il pan
      this.googleMap.addListener('idle', () => {
        this.triggerBoundsChanged();
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

    // Soppressione pulita dei notice informativi e di deprecazione di Google Maps
    if (!window._gmapsWarnFiltered) {
      window._gmapsWarnFiltered = true;
      const origWarn = console.warn;
      console.warn = function(...args) {
        if (args.length > 0 && typeof args[0] === 'string') {
          if (args[0].includes('google.maps.Marker is deprecated') || args[0].includes('styles property cannot be set')) {
            return;
          }
        }
        origWarn.apply(console, args);
      };
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
      if (this.leafletUserMarker) {
        this.leafletMap.removeLayer(this.leafletUserMarker);
        this.leafletUserMarker = null;
      }
      this.leafletMap.remove();
      this.leafletMap = null;
      this.leafletCluster = null;
      this.leafletTileLayer = null;
      this.leafletCheapestMarker = null;
    }
    if (this.googleUserMarker) {
      if (typeof this.googleUserMarker.setMap === 'function') {
        this.googleUserMarker.setMap(null);
      } else {
        this.googleUserMarker.map = null;
      }
      this.googleUserMarker = null;
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
      const m = this.googleMarkers[i];
      if (typeof m.setMap === 'function') {
        m.setMap(null);
      } else {
        m.map = null;
      }
    }
    this.googleMarkers = [];
    this.googleMap = null;
    const container = document.getElementById(this.containerId);
    if (container) container.innerHTML = '';
  }

  switchProvider(provider, apiKey) {
    this.showLoading('Cambio motore cartografico...', provider === 'google' ? 'Inizializzazione Google Maps' : 'Inizializzazione OpenStreetMap');
    if (provider === 'google') {
      return this.initGoogleMaps(apiKey).then(() => {
        this.currentProvider = 'google';
        this.renderStations(this.stations);
        if (this.cheapestStation) this.highlightCheapestStation(this.cheapestStation);
        if (this.userLocation) this.setUserLocation(this.userLocation.lat, this.userLocation.lng, this.userLocation.accuracy);
      });
    } else {
      this.currentProvider = 'leaflet';
      return this.initLeaflet().then(() => {
        this.renderStations(this.stations);
        if (this.cheapestStation) this.highlightCheapestStation(this.cheapestStation);
        if (this.userLocation) this.setUserLocation(this.userLocation.lat, this.userLocation.lng, this.userLocation.accuracy);
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

  setView(lat, lng, zoom = 14, openPopup = true) {
    if (this.currentProvider === 'google' && this.googleMap) {
      this.googleMap.setCenter({ lat, lng });
      this.googleMap.setZoom(zoom);
      if (openPopup) {
        this.openMarkerPopupAt(lat, lng);
      }
    } else if (this.leafletMap) {
      this.leafletMap.setView([lat, lng], zoom);
      if (openPopup) {
        this.openMarkerPopupAt(lat, lng);
      }
    }
  }

  /**
   * Mostra il marker GPS della posizione attuale dell'utente (punto blu stile Material)
   */
  setUserLocation(lat, lng, accuracy = 0) {
    this.userLocation = { lat, lng, accuracy };

    if (this.currentProvider === 'google' && this.googleMap) {
      if (!this.googleUserMarker) {
        this.googleUserMarker = new google.maps.Marker({
          position: { lat, lng },
          map: this.googleMap,
          title: "La tua posizione",
          zIndex: 999,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: "#2563eb",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3
          }
        });
      } else {
        this.googleUserMarker.setPosition({ lat, lng });
        this.googleUserMarker.setMap(this.googleMap);
      }
    } else if (this.leafletMap) {
      if (this.leafletUserMarker) {
        this.leafletMap.removeLayer(this.leafletUserMarker);
      }
      this.leafletUserMarker = L.circleMarker([lat, lng], {
        radius: 9,
        fillColor: "#2563eb",
        color: "#ffffff",
        weight: 3,
        opacity: 1,
        fillOpacity: 1,
        zIndexOffset: 1000
      }).bindTooltip("La tua posizione", { permanent: false, direction: 'top' });
      this.leafletUserMarker.addTo(this.leafletMap);
    }
  }

  /**
   * Rileva la geolocalizzazione del dispositivo e centra la mappa
   * a un livello di zoom che racchiude un'area di almeno 20 km di raggio (zoom 10).
   */
  centerOnUserLocation(zoom = 10) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocalizzazione non supportata dal browser"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const acc = pos.coords.accuracy || 50;
          this.setUserLocation(lat, lng, acc);
          this.setView(lat, lng, zoom, false);
          resolve({ lat, lng, accuracy: acc });
        },
        (err) => {
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 }
      );
    });
  }

  openMarkerPopupAt(lat, lng) {
    const station = this.stations.find(s => Math.abs(s.latitudine - lat) < 0.0001 && Math.abs(s.longitudine - lng) < 0.0001);
    if (!station) return;

    if (this.currentProvider === 'google' && this.googleMap) {
      const marker = this.googleMarkers.find(m => {
        const pos = m.position || (typeof m.getPosition === 'function' ? m.getPosition() : null);
        if (!pos) return false;
        const mLat = (typeof pos.lat === 'function') ? pos.lat() : pos.lat;
        const mLng = (typeof pos.lng === 'function') ? pos.lng() : pos.lng;
        return Math.abs(mLat - lat) < 0.0001 && Math.abs(mLng - lng) < 0.0001;
      });
      if (marker && this.googleInfoWindow) {
        const html = this.generatePopupContent(station);
        this.googleInfoWindow.setContent(html);
        if (typeof marker.setMap === 'function') {
          this.googleInfoWindow.open(this.googleMap, marker);
        } else {
          this.googleInfoWindow.open({
            anchor: marker,
            map: this.googleMap
          });
        }
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
    }, 200);
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
      const m = this.googleMarkers[i];
      if (typeof m.setMap === 'function') m.setMap(null);
      else m.map = null;
    }
    this.googleMarkers = [];

    if (!stations || stations.length === 0) {
      this.hideLoading();
      return;
    }

    // Creazione ottimizzata ad alta efficienza:
    // Google Maps Marker con optimized: true (layer Canvas GPU ultraveloce, senza DOM overhead)
    const markers = [];
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
        optimized: true, // Rendering Canvas ad altissime prestazioni per 20.000+ marker
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

      markers.push(marker);
    }

    this.googleMarkers = markers;

    // Aggiunta in un unico passaggio atomico al clusterer per calcolo KD-tree fulmineo
    if (this.useClustering && this.googleCluster) {
      this.googleCluster.addMarkers(markers);
    } else {
      for (let i = 0; i < markers.length; i++) {
        markers[i].setMap(this.googleMap);
      }
    }

    this.hideLoading();
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
    this.hideLoading();
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

    const safeTitle = (nome + ' (' + bandiera + ')').replace(/"/g, '&quot;');
    const shareText = `Prezzi ${bandiera} - ${nome}\n${indirizzo}\nBenzina Self: ${s.prezzo_benzina_self ? Number(s.prezzo_benzina_self).toFixed(3) + ' €' : 'N.D.'}\nGasolio Self: ${s.prezzo_gasolio_self ? Number(s.prezzo_gasolio_self).toFixed(3) + ' €' : 'N.D.'}`.replace(/"/g, '&quot;');

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
          <div class="popup-footer-left">
            <div class="popup-time-badge" title="${dataAggiornamento}" aria-label="${dataAggiornamento}">
              <svg class="icon-material" viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
              </svg>
            </div>
          </div>
          <div class="popup-footer-actions">
            <button class="popup-share-link" 
                    data-share-title="${safeTitle}" 
                    data-share-text="${shareText}" 
                    data-share-url="https://www.google.com/maps/search/?api=1&query=${s.latitudine},${s.longitudine}" 
                    title="Condividi prezzi e posizione">
              <svg class="icon-material" viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
              </svg>
              <span>Condividi</span>
            </button>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${s.latitudine},${s.longitudine}" 
               target="_blank" rel="noopener noreferrer" class="popup-directions-link" title="Apri indicazioni stradali in Google Maps">
              <svg class="directions-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M22.41 10.59l-9-9c-.79-.79-2.05-.79-2.83 0l-9 9c-.79.79-.79 2.05 0 2.83l9 9c.79.79 2.05.79 2.83 0l9-9c.78-.79.78-2.05 0-2.83zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z"/>
              </svg>
              <span>Indicazioni</span>
            </a>
          </div>
        </div>
      </div>
    `;

    if (window.CustomizationHooks && typeof window.CustomizationHooks.enhancePopupHtml === 'function') {
      defaultHtml = window.CustomizationHooks.enhancePopupHtml(s, defaultHtml);
    }

    return defaultHtml;
  }

  showLoading(text = 'Caricamento mappa...', subtext = 'Elaborazione distributori in corso') {
    const overlay = document.getElementById('map-loader');
    if (!overlay) return;
    const txt = document.getElementById('map-loader-text');
    const sub = document.getElementById('map-loader-subtext');
    if (txt) txt.textContent = text;
    if (sub) sub.textContent = subtext;
    overlay.classList.remove('hidden');
  }

  hideLoading() {
    const overlay = document.getElementById('map-loader');
    if (!overlay) return;
    overlay.classList.add('hidden');
  }
}

window.MapManager = MapManager;
