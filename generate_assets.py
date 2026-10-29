"""
generate_assets.py
Genera icone PNG per i loghi delle compagnie petrolifere e marker "a goccia" (teardrop pin)
per Google Maps e Leaflet, utilizzando gli asset originali e le favicon ufficiali recuperate in icons_raw.
Utilizza supersampling 4x e ricampionamento Lanczos ad alta fedelta per preservare massima nitidezza.
"""
import os
import math
from PIL import Image, ImageDraw

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(BASE_DIR, "public", "img", "icons_raw")
LOGOS_DIR = os.path.join(BASE_DIR, "public", "img", "logos")
MARKERS_DIR = os.path.join(BASE_DIR, "public", "img", "markers")

os.makedirs(LOGOS_DIR, exist_ok=True)
os.makedirs(MARKERS_DIR, exist_ok=True)

# Definizioni e configurazioni per tutti i marchi presenti
BRAND_CONFIGS = {
    "eni": {
        "name": "Eni / Agip",
        "primary": (255, 216, 0),       # Giallo Eni
        "border": (217, 119, 6),
        "source": "eni.png",
        "favicon_source": "eni_favicon.png"
    },
    "ip": {
        "name": "IP Gruppo api",
        "primary": (0, 136, 54),        # Verde IP
        "border": (0, 95, 36),
        "source": "ip.png",
        "favicon_source": "ip_favicon.png"
    },
    "q8": {
        "name": "Q8",
        "primary": (0, 51, 153),        # Blu Q8
        "border": (0, 34, 102),
        "source": "q8.png",
        "favicon_source": "q8_favicon.png"
    },
    "esso": {
        "name": "Esso",
        "primary": (225, 27, 34),       # Rosso Esso
        "border": (153, 27, 27),
        "source": "esso.png",
        "favicon_source": "esso_favicon.png"
    },
    "tamoil": {
        "name": "Tamoil",
        "primary": (234, 88, 12),       # Arancione Tamoil
        "border": (194, 65, 12),
        "source": "tamoil.png",
        "favicon_source": "tamoil_favicon.png"
    },
    "conad": {
        "name": "Conad Carburanti",
        "primary": (220, 38, 38),       # Rosso Conad
        "border": (153, 27, 27),
        "source": "conad.png",
        "favicon_source": "conad_favicon.png"
    },
    "repsol": {
        "name": "Repsol",
        "primary": (249, 115, 22),      # Arancione Repsol
        "border": (194, 65, 12),
        "source": "repsol.png",
        "favicon_source": "repsol_favicon.png"
    },
    "beyfin": {
        "name": "Beyfin",
        "primary": (22, 163, 74),       # Verde Beyfin
        "border": (21, 128, 61),
        "source": "beyfin_favicon.png",
        "favicon_source": "beyfin_favicon.png"
    },
    "neutral": {
        "name": "Pompe Bianche / No Logo",
        "primary": (15, 118, 110),      # Ottanio neutro
        "border": (17, 94, 89),
        "source": "neutral.png",
        "favicon_source": None
    },
    "shell": {
        "name": "Shell",
        "primary": (255, 216, 0),       # Giallo Shell
        "border": (220, 38, 38),
        "source": "shell.png",
        "favicon_source": "shell_favicon.png"
    },
    "europam": {
        "name": "Europam",
        "primary": (0, 102, 178),       # Blu Europam
        "border": (0, 68, 120),
        "source": "europam_favicon.png",
        "favicon_source": "europam_favicon.png"
    },
    "retitalia": {
        "name": "Retitalia",
        "primary": (15, 38, 92),        # Blu scuro Retitalia
        "border": (200, 30, 30),
        "source": "retitalia_favicon.png",
        "favicon_source": "retitalia_favicon.png"
    },
    "energas": {
        "name": "Energas",
        "primary": (0, 150, 214),       # Celeste Energas
        "border": (0, 100, 160),
        "source": "energas.png",
        "favicon_source": "energas_favicon.png"
    },
    "giap": {
        "name": "Giap Petroli",
        "primary": (237, 28, 36),       # Rosso Giap
        "border": (0, 140, 68),
        "source": "giap.png",
        "favicon_source": "giap_favicon.png"
    },
    "keropetrol": {
        "name": "Keropetrol",
        "primary": (227, 6, 19),        # Rosso Keropetrol
        "border": (160, 4, 13),
        "source": "keropetrol.png",
        "favicon_source": None
    },
    "vega": {
        "name": "Vega Carburanti",
        "primary": (218, 41, 28),       # Rosso Vega
        "border": (20, 50, 120),
        "source": "vega_favicon.png",
        "favicon_source": "vega_favicon.png"
    },
    "costantin": {
        "name": "Costantin",
        "primary": (220, 38, 38),       # Rosso Costantin
        "border": (153, 27, 27),
        "source": "costantin.png",
        "favicon_source": "costantin_favicon.png"
    },
    "sanmarcopetroli": {
        "name": "San Marco Petroli",
        "primary": (194, 27, 38),       # Rosso veneziano
        "border": (138, 19, 27),
        "source": "sanmarcopetroli.png",
        "favicon_source": None
    },
    "aquila": {
        "name": "Aquila Energie",
        "primary": (238, 116, 30),      # Arancio Aquila
        "border": (175, 75, 10),
        "source": "aquila.png",
        "favicon_source": "aquila_favicon.png"
    },
    "lukoil": {
        "name": "Lukoil",
        "primary": (237, 28, 36),       # Rosso Lukoil
        "border": (150, 15, 20),
        "source": "lukoil.png",
        "favicon_source": None
    },
    "sarnioil": {
        "name": "Sarni Oil",
        "primary": (16, 115, 185),      # Blu Sarni
        "border": (10, 80, 140),
        "source": "sarnioil.png",
        "favicon_source": None
    },
    "toil": {
        "name": "Toil",
        "primary": (0, 130, 200),
        "border": (0, 90, 150),
        "source": "toil.png",
        "favicon_source": None
    },
    "loro": {
        "name": "Loro",
        "primary": (225, 35, 35),
        "border": (150, 20, 20),
        "source": "loro.png",
        "favicon_source": None
    },
    "enerpetroli": {
        "name": "Enerpetroli",
        "primary": (0, 128, 64),
        "border": (0, 85, 40),
        "source": "enerpetroli.png",
        "favicon_source": None
    },
    "ego": {
        "name": "Ego Petroli",
        "primary": (230, 70, 20),
        "border": (160, 40, 10),
        "source": "ego.png",
        "favicon_source": None
    },
    "petrolgamma": {
        "name": "Petrol Gamma",
        "primary": (30, 120, 190),
        "border": (20, 80, 140),
        "source": "petrolgamma.png",
        "favicon_source": None
    },
    "siafuel": {
        "name": "Sia Fuel",
        "primary": (0, 140, 180),
        "border": (0, 95, 125),
        "source": "siafuel.png",
        "favicon_source": None
    },
    "afpetroli": {
        "name": "AF Petroli",
        "primary": (210, 30, 30),
        "border": (140, 20, 20),
        "source": "afpetroli.png",
        "favicon_source": None
    }
}

def load_brand_image(brand_key, prefer_favicon=False):
    """Carica l'immagine sorgente ottimale per il brand, ritagliando i bordi vuoti"""
    cfg = BRAND_CONFIGS.get(brand_key, {})
    filename = None
    if prefer_favicon and cfg.get("favicon_source"):
        cand = os.path.join(RAW_DIR, cfg["favicon_source"])
        if os.path.exists(cand):
            filename = cand

    if not filename and cfg.get("source"):
        cand = os.path.join(RAW_DIR, cfg["source"])
        if os.path.exists(cand):
            filename = cand

    if not filename:
        cand = os.path.join(RAW_DIR, f"{brand_key}.png")
        if os.path.exists(cand):
            filename = cand
        else:
            filename = os.path.join(RAW_DIR, "neutral.png")

    try:
        im = Image.open(filename).convert("RGBA")
        bbox = im.getbbox()
        if bbox:
            im = im.crop(bbox)
        return im
    except Exception as e:
        print(f"Errore caricamento asset per {brand_key}: {e}")
        return Image.new("RGBA", (100, 100), (0, 0, 0, 0))

def fit_image_proportionally(im, max_w, max_h):
    """Ridimensiona preservando l'aspect ratio con filtro Lanczos"""
    src_w, src_h = im.size
    if src_w == 0 or src_h == 0:
        return im
    scale = min(max_w / src_w, max_h / src_h)
    new_w = max(1, int(round(src_w * scale)))
    new_h = max(1, int(round(src_h * scale)))
    return im.resize((new_w, new_h), Image.Resampling.LANCZOS)

def generate_logo_png(key, cfg):
    """
    Genera un logo PNG 128x128 moderno e pulito (con supersampling 4x).
    Inserisce il logo ufficiale al centro di una card con angoli arrotondati.
    """
    scale = 4
    size = 128 * scale
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    margin = 8 * scale
    radius_card = 22 * scale
    card_rect = [margin, margin, size - margin, size - margin]

    # Ombra leggera della card
    shadow_offset = 2 * scale
    draw.rounded_rectangle(
        [margin, margin + shadow_offset, size - margin, size - margin + shadow_offset],
        radius=radius_card,
        fill=(0, 0, 0, 20)
    )

    # Sfondo card bianco con bordo colorato del brand
    border_color = cfg.get("border", (200, 200, 200))
    draw.rounded_rectangle(
        card_rect,
        radius=radius_card,
        fill=(255, 255, 255, 255),
        outline=border_color,
        width=3 * scale
    )

    # Carica il logo sorgente
    brand_im = load_brand_image(key, prefer_favicon=False)

    # Spazio utile interno alla card
    inner_w = (size - margin * 2) * 0.76
    inner_h = (size - margin * 2) * 0.76
    fitted = fit_image_proportionally(brand_im, inner_w, inner_h)

    # Incolla al centro
    paste_x = int(round((size - fitted.width) / 2))
    paste_y = int(round((size - fitted.height) / 2))
    canvas.alpha_composite(fitted, (paste_x, paste_y))

    # Ridimensiona a 128x128 con Lanczos
    final_img = canvas.resize((128, 128), Image.Resampling.LANCZOS)
    target_path = os.path.join(LOGOS_DIR, f"{key}.png")
    final_img.save(target_path, "PNG", optimize=True)
    print(f"  [OK] Logo: {key}.png (128x128)")

def generate_marker_png(key, cfg):
    """
    Genera un marker a goccia (teardrop pin) 36x48 px con supersampling 4x.
    All'interno del badge circolare viene posizionata l'icona / favicon ufficiale.
    """
    scale = 4
    w = 36 * scale
    h = 48 * scale
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pin_color = cfg.get("primary", (15, 118, 110))
    border_color = cfg.get("border", (17, 94, 89))

    # Coordinate del pin a goccia
    head_cx = 18 * scale
    head_cy = 18 * scale
    head_r = 16 * scale
    tip_x = 18 * scale
    tip_y = 46 * scale

    # Ombra sfumata alla base della punta
    shadow_w = 14 * scale
    shadow_h = 4 * scale
    draw.ellipse(
        [tip_x - shadow_w, tip_y - shadow_h * 0.8, tip_x + shadow_w, tip_y + shadow_h * 1.2],
        fill=(0, 0, 0, 75)
    )

    # Calcolo punti di tangenza tra cerchio e punta
    d = tip_y - head_cy
    alpha = math.acos(head_r / d)
    tangent_l_x = head_cx - head_r * math.sin(alpha)
    tangent_l_y = head_cy + head_r * math.cos(alpha)
    tangent_r_x = head_cx + head_r * math.sin(alpha)
    tangent_r_y = head_cy + head_r * math.cos(alpha)

    # Poligono della punta
    tip_polygon = [
        (head_cx, head_cy),
        (tangent_l_x, tangent_l_y),
        (tip_x, tip_y),
        (tangent_r_x, tangent_r_y)
    ]
    draw.polygon(tip_polygon, fill=pin_color)
    draw.ellipse([head_cx - head_r, head_cy - head_r, head_cx + head_r, head_cy + head_r], fill=pin_color)

    # Bordo esterno bianco per stacco nitido sulla mappa
    border_color_rgba = (255, 255, 255, 245)
    outline_w = 2 * scale
    draw.line([(tangent_l_x, tangent_l_y), (tip_x, tip_y)], fill=border_color_rgba, width=outline_w)
    draw.line([(tangent_r_x, tangent_r_y), (tip_x, tip_y)], fill=border_color_rgba, width=outline_w)
    draw.arc(
        [head_cx - head_r, head_cy - head_r, head_cx + head_r, head_cy + head_r],
        start=180 - math.degrees(alpha),
        end=360 + math.degrees(alpha),
        fill=border_color_rgba,
        width=outline_w
    )

    # Cerchio interno bianco (badge che ospita il logo)
    inner_r = 11.5 * scale
    badge_rect = [head_cx - inner_r, head_cy - inner_r, head_cx + inner_r, head_cy + inner_r]
    draw.ellipse(badge_rect, fill=(255, 255, 255, 255), outline=border_color, width=1 * scale)

    # Prepara il badge del brand con maschera circolare antialiasing
    badge_dim = int(inner_r * 2)
    badge_surface = Image.new("RGBA", (badge_dim, badge_dim), (255, 255, 255, 0))

    # Carica la migliore sorgente (privilegiando favicon se quadrata/ottimizzata per piccoli schermi)
    brand_im = load_brand_image(key, prefer_favicon=True)

    # Ridimensiona il logo per stare dentro l'82% del cerchio
    icon_max_dim = int(badge_dim * 0.82)
    fitted = fit_image_proportionally(brand_im, icon_max_dim, icon_max_dim)

    # Incolla il logo al centro della superficie del badge
    paste_bx = int(round((badge_dim - fitted.width) / 2))
    paste_by = int(round((badge_dim - fitted.height) / 2))
    badge_surface.alpha_composite(fitted, (paste_bx, paste_by))

    # Maschera circolare per non sbordare mai dal cerchio interno
    mask = Image.new("L", (badge_dim, badge_dim), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.ellipse([0, 0, badge_dim - 1, badge_dim - 1], fill=255)

    # Incolla il badge mascherato sul pin
    pin_paste_x = int(round(head_cx - inner_r))
    pin_paste_y = int(round(head_cy - inner_r))
    img.paste(badge_surface, (pin_paste_x, pin_paste_y), mask=mask)

    # Ridimensiona a 36x48 con filtro Lanczos ad alta precisione
    final_img = img.resize((36, 48), Image.Resampling.LANCZOS)
    target_path = os.path.join(MARKERS_DIR, f"marker_{key}.png")
    final_img.save(target_path, "PNG", optimize=True)
    print(f"  [OK] Marker: marker_{key}.png (36x48)")

def run():
    print("=== GENERAZIONE ASSET PNG (LOGHI E MARKER) ===")
    print(f"Totale marchi configurati: {len(BRAND_CONFIGS)}")
    print("Algoritmo di scaling: Lanczos sinc filtering con supersampling 4x")
    print(f"Cartella loghi: {LOGOS_DIR}")
    print(f"Cartella marker: {MARKERS_DIR}\n")

    for key, cfg in BRAND_CONFIGS.items():
        print(f"Processando [{key}] {cfg['name']}...")
        generate_logo_png(key, cfg)
        generate_marker_png(key, cfg)

    print("\nGenerazione completata con successo per tutti i brand!")

if __name__ == "__main__":
    run()
