/**
 * brand-logos.js
 * Mappatura e gestione delle icone PNG ufficiali per i marchi petroliferi italiani
 * e per i marker "a goccia" ad alta visibilità.
 * Fallback automatico su immagine neutra quando il brand non è disponibile.
 */

const BrandLogos = (function() {
  const BRANDS = {
    eni: {
      key: 'eni',
      match: ['eni', 'agip', 'enistation'],
      name: 'Eni / Agip',
      primaryColor: '#ffd800'
    },
    ip: {
      key: 'ip',
      match: ['ip', 'api', 'italiana petroli', 'gruppo api'],
      name: 'IP Gruppo api',
      primaryColor: '#008836'
    },
    q8: {
      key: 'q8',
      match: ['q8', 'kuwait'],
      name: 'Q8',
      primaryColor: '#003399'
    },
    esso: {
      key: 'esso',
      match: ['esso'],
      name: 'Esso',
      primaryColor: '#e11b22'
    },
    tamoil: {
      key: 'tamoil',
      match: ['tamoil'],
      name: 'Tamoil',
      primaryColor: '#ea580c'
    },
    conad: {
      key: 'conad',
      match: ['conad'],
      name: 'Conad',
      primaryColor: '#dc2626'
    },
    repsol: {
      key: 'repsol',
      match: ['repsol'],
      name: 'Repsol',
      primaryColor: '#f97316'
    },
    beyfin: {
      key: 'beyfin',
      match: ['beyfin'],
      name: 'Beyfin',
      primaryColor: '#16a34a'
    },
    shell: {
      key: 'shell',
      match: ['shell'],
      name: 'Shell',
      primaryColor: '#ffd800'
    },
    europam: {
      key: 'europam',
      match: ['europam'],
      name: 'Europam',
      primaryColor: '#0066b2'
    },
    retitalia: {
      key: 'retitalia',
      match: ['retitalia'],
      name: 'Retitalia',
      primaryColor: '#0f265c'
    },
    energas: {
      key: 'energas',
      match: ['energas'],
      name: 'Energas',
      primaryColor: '#0096d6'
    },
    giap: {
      key: 'giap',
      match: ['giap'],
      name: 'Giap Petroli',
      primaryColor: '#ed1c24'
    },
    keropetrol: {
      key: 'keropetrol',
      match: ['keropetrol'],
      name: 'Keropetrol',
      primaryColor: '#e30613'
    },
    vega: {
      key: 'vega',
      match: ['vega'],
      name: 'Vega Carburanti',
      primaryColor: '#da291c'
    },
    costantin: {
      key: 'costantin',
      match: ['costantin'],
      name: 'Costantin',
      primaryColor: '#dc2626'
    },
    sanmarcopetroli: {
      key: 'sanmarcopetroli',
      match: ['san marco', 'sanmarcopetroli', 'smp'],
      name: 'San Marco Petroli',
      primaryColor: '#c21b26'
    },
    aquila: {
      key: 'aquila',
      match: ['aquila'],
      name: 'Aquila Energie',
      primaryColor: '#ee741e'
    },
    lukoil: {
      key: 'lukoil',
      match: ['lukoil'],
      name: 'Lukoil',
      primaryColor: '#ed1c24'
    },
    sarnioil: {
      key: 'sarnioil',
      match: ['sarni'],
      name: 'Sarni Oil',
      primaryColor: '#1073b9'
    },
    toil: {
      key: 'toil',
      match: ['toil'],
      name: 'Toil',
      primaryColor: '#0082c8'
    },
    loro: {
      key: 'loro',
      match: ['loro'],
      name: 'Loro',
      primaryColor: '#e12323'
    },
    enerpetroli: {
      key: 'enerpetroli',
      match: ['enerpetroli'],
      name: 'Enerpetroli',
      primaryColor: '#008040'
    },
    ego: {
      key: 'ego',
      match: ['ego'],
      name: 'Ego Petroli',
      primaryColor: '#e64614'
    },
    petrolgamma: {
      key: 'petrolgamma',
      match: ['petrol gamma', 'petrolgamma'],
      name: 'Petrol Gamma',
      primaryColor: '#1e78be'
    },
    siafuel: {
      key: 'siafuel',
      match: ['sia fuel', 'siafuel'],
      name: 'Sia Fuel',
      primaryColor: '#008cb4'
    },
    afpetroli: {
      key: 'afpetroli',
      match: ['af petroli', 'afpetroli'],
      name: 'AF Petroli',
      primaryColor: '#d21e1e'
    }
  };

  function getBrandKey(rawBrand) {
    if (!rawBrand) return 'neutral';
    const lower = rawBrand.toLowerCase().trim();

    for (const key in BRANDS) {
      const b = BRANDS[key];
      for (let i = 0; i < b.match.length; i++) {
        if (lower.includes(b.match[i])) {
          return key;
        }
      }
    }
    // Fallback immagine neutra per pompe bianche, no logo o marchi non censiti
    return 'neutral';
  }

  function getBrandInfo(rawBrand) {
    const key = getBrandKey(rawBrand);
    if (key !== 'neutral' && BRANDS[key]) {
      return BRANDS[key];
    }
    return {
      key: 'neutral',
      name: rawBrand || 'Distributore Carburanti',
      primaryColor: '#0f766e'
    };
  }

  // Restituisce il percorso della PNG del logo per popup e schede
  function getBrandLogoUrl(brand) {
    const key = getBrandKey(brand);
    return `img/logos/${key}.png`;
  }

  // Restituisce il percorso della PNG del marker a goccia (teardrop pin)
  function getMarkerIconUrl(brand) {
    const key = getBrandKey(brand);
    return `img/markers/marker_${key}.png`;
  }

  // Genera il tag HTML dell'immagine PNG con fallback neutro
  function getBrandBadgeHtml(brand, size = 44) {
    const key = getBrandKey(brand);
    const logoUrl = getBrandLogoUrl(brand);
    return `
      <div class="popup-brand-logo-container" style="width:${size}px; height:${size}px; min-width:${size}px;">
        <img src="${logoUrl}" 
             alt="${brand || 'Logo'}" 
             class="popup-brand-logo-img"
             onerror="this.onerror=null; this.src='img/logos/neutral.png';" />
      </div>
    `;
  }

  return {
    getBrandKey: getBrandKey,
    getBrandInfo: getBrandInfo,
    getBrandLogoUrl: getBrandLogoUrl,
    getMarkerIconUrl: getMarkerIconUrl,
    getBrandBadgeHtml: getBrandBadgeHtml
  };
})();

if (typeof window !== 'undefined') {
  window.BrandLogos = BrandLogos;
}
