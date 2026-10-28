/**
 * customization-hooks.js
 * Modulo dedicato per consentire e semplificare la futura implementazione
 * di funzioni personalizzate nella barra laterale sinistra.
 * 
 * Esempi di utilizzo:
 * - Aggiunta di nuovi filtri (es. raggio km, orario h24, autolavaggio, colonnine elettriche)
 * - Calcolo preventivo spesa / pieno carburante
 * - Salvataggio stazioni preferite
 * - Tracciamento percorso e stazioni lungo il tragitto
 */

const CustomizationHooks = (function() {
  // Registro dei plugin e hook registrati
  const hooks = {
    onStationsLoaded: [],
    filterStation: [],
    onPopupRender: [],
    customSidebarControls: []
  };

  // Stato delle personalizzazioni
  const state = {
    maxPriceFilter: null,
    radiusKm: null,
    sortBy: 'default', // 'default', 'cheapest_benzina', 'cheapest_gasolio', 'closest'
    userLocation: null,
    favorites: JSON.parse(localStorage.getItem('mimit_favorites') || '[]')
  };

  return {
    // Registrazione di un listener per il caricamento stazioni
    onStationsLoaded: function(callback) {
      if (typeof callback === 'function') {
        hooks.onStationsLoaded.push(callback);
      }
    },

    // Registrazione di una funzione di filtro personalizzata
    // Callback deve restituire boolean (true = mostra, false = nascondi)
    addStationFilter: function(callback) {
      if (typeof callback === 'function') {
        hooks.filterStation.push(callback);
      }
    },

    // Registrazione di un modifier per il popup
    onPopupRender: function(callback) {
      if (typeof callback === 'function') {
        hooks.onPopupRender.push(callback);
      }
    },

    // Esegue i filtri registrati su una stazione
    applyCustomFilters: function(station) {
      for (const filterFn of hooks.filterStation) {
        if (!filterFn(station, state)) {
          return false;
        }
      }
      return true;
    },

    // Notifica i plugin che le stazioni sono state aggiornate
    notifyStationsLoaded: function(stations) {
      hooks.onStationsLoaded.forEach(fn => fn(stations, state));
    },

    // Permette di modificare o arricchire l'HTML del popup
    enhancePopupHtml: function(station, defaultHtml) {
      let finalHtml = defaultHtml;
      hooks.onPopupRender.forEach(fn => {
        finalHtml = fn(station, finalHtml, state) || finalHtml;
      });
      return finalHtml;
    },

    // Gestione Preferiti
    isFavorite: function(stationId) {
      return state.favorites.includes(Number(stationId));
    },

    toggleFavorite: function(stationId) {
      const id = Number(stationId);
      const idx = state.favorites.indexOf(id);
      if (idx >= 0) {
        state.favorites.splice(idx, 1);
      } else {
        state.favorites.push(id);
      }
      localStorage.setItem('mimit_favorites', JSON.stringify(state.favorites));
      return this.isFavorite(id);
    },

    // Getter e Setter per lo stato
    getState: function() {
      return state;
    },

    setState: function(newState) {
      Object.assign(state, newState);
    }
  };
})();


