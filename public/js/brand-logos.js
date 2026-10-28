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
