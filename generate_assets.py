"""
generate_assets.py
Genera icone PNG per i loghi delle compagnie petrolifere e marker "a goccia" (teardrop pin)
per Google Maps e Leaflet, con fallback su immagine neutra.
"""
import os
import math
from PIL import Image, ImageDraw, ImageFont

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOGOS_DIR = os.path.join(BASE_DIR, "public", "img", "logos")
MARKERS_DIR = os.path.join(BASE_DIR, "public", "img", "markers")

os.makedirs(LOGOS_DIR, exist_ok=True)
os.makedirs(MARKERS_DIR, exist_ok=True)

# Definizioni dei Brand principali
BRAND_DEFS = {
    "eni": {
        "name": "Eni",
        "primary": (255, 216, 0),      # Giallo Eni
        "border": (217, 119, 6),
        "text_color": (24, 24, 27),
        "symbol": "eni"
    },
    "ip": {
        "name": "IP",
        "primary": (0, 136, 54),       # Verde IP
        "border": (0, 95, 36),
        "text_color": (0, 75, 151),    # Blu IP
        "symbol": "ip"
    },
    "q8": {
        "name": "Q8",
        "primary": (0, 51, 153),       # Blu Q8
        "border": (0, 34, 102),
        "text_color": (237, 28, 36),   # Rosso Q8
        "symbol": "q8"
    },
    "esso": {
        "name": "Esso",
        "primary": (225, 27, 34),      # Rosso Esso
        "border": (153, 27, 27),
        "text_color": (0, 51, 153),
        "symbol": "esso"
    },
    "tamoil": {
        "name": "Tamoil",
        "primary": (234, 88, 12),      # Arancione Tamoil
        "border": (194, 65, 12),
        "text_color": (0, 85, 165),
        "symbol": "tamoil"
    },
    "conad": {
        "name": "Conad",
        "primary": (220, 38, 38),      # Rosso Conad
        "border": (153, 27, 27),
        "text_color": (255, 216, 0),
        "symbol": "conad"
    },
    "repsol": {
        "name": "Repsol",
        "primary": (249, 115, 22),
        "border": (194, 65, 12),
        "text_color": (220, 38, 38),
        "symbol": "repsol"
    },
    "beyfin": {
        "name": "Beyfin",
        "primary": (22, 163, 74),
        "border": (21, 128, 61),
        "text_color": (250, 204, 21),
        "symbol": "beyfin"
    },
    "neutral": {
        "name": "Pompe Bianche / No Logo",
        "primary": (15, 118, 110),     # Ottanio neutro
        "border": (17, 94, 89),
        "text_color": (15, 118, 110),
        "symbol": "pump"
    }
}

def draw_symbol(draw, symbol, cx, cy, radius, defs):
    """Disegna il simbolo del brand centrato su (cx, cy)"""
    if symbol == "eni":
        # Cane a sei zampe stilizzato + fiamma
        # Corpo
        draw.ellipse([cx - radius*0.5, cy - radius*0.3, cx + radius*0.3, cy + radius*0.3], fill=(24, 24, 27))
        # Testa
        draw.ellipse([cx - radius*0.7, cy - radius*0.6, cx - radius*0.3, cy - radius*0.1], fill=(24, 24, 27))
        # Zampe
        for i in range(4):
            x_leg = cx - radius*0.4 + (i * radius*0.25)
            draw.line([x_leg, cy + radius*0.1, x_leg + radius*0.1, cy + radius*0.6], fill=(24, 24, 27), width=max(2, int(radius*0.15)))
        # Fiamma rossa
        draw.ellipse([cx - radius*0.85, cy - radius*0.85, cx - radius*0.55, cy - radius*0.55], fill=(225, 27, 34))

    elif symbol == "ip":
        # Badge bicolore Verde/Blu con lettere IP
        badge_w = radius * 1.5
        badge_h = radius * 1.1
        draw.rounded_rectangle([cx - badge_w/2, cy - badge_h/2, cx + badge_w/2, cy + badge_h/2], radius=int(radius*0.2), fill=(0, 136, 54))
        # Lettera I (bianca) e P (blu su bianco o giallo)
        draw.rectangle([cx - badge_w*0.3, cy - badge_h*0.3, cx - badge_w*0.15, cy + badge_h*0.3], fill=(255, 255, 255))
        # P
        draw.rectangle([cx - badge_w*0.05, cy - badge_h*0.3, cx + badge_w*0.08, cy + badge_h*0.3], fill=(255, 255, 255))
        draw.rectangle([cx + badge_w*0.08, cy - badge_h*0.3, cx + badge_w*0.3, cy], fill=(255, 255, 255))
        draw.rectangle([cx + badge_w*0.08, cy - badge_h*0.15, cx + badge_w*0.2, cy - badge_h*0.05], fill=(0, 136, 54))

    elif symbol == "q8":
        # Due vele caratteristiche: blu a sinistra, rossa a destra
        # Vela sinistra (blu)
        draw.polygon([
            (cx - radius*0.6, cy + radius*0.4),
            (cx - radius*0.05, cy - radius*0.5),
            (cx - radius*0.05, cy + radius*0.4)
        ], fill=(0, 51, 153))
        # Vela destra (rossa)
        draw.polygon([
            (cx + radius*0.05, cy - radius*0.7),
            (cx + radius*0.7, cy + radius*0.4),
            (cx + radius*0.05, cy + radius*0.4)
        ], fill=(237, 28, 36))
        # Linea orizzontale gialla
        draw.rectangle([cx - radius*0.7, cy + radius*0.45, cx + radius*0.7, cy + radius*0.65], fill=(255, 216, 0))

    elif symbol == "esso":
        # Ovale bianco con bordo blu e scritta rossa Esso
        oval_rx = radius * 0.95
        oval_ry = radius * 0.65
        draw.ellipse([cx - oval_rx, cy - oval_ry, cx + oval_rx, cy + oval_ry], fill=(255, 255, 255), outline=(0, 51, 153), width=max(2, int(radius*0.12)))
        # Barra rossa stilizzata Esso
        draw.rectangle([cx - radius*0.6, cy - radius*0.15, cx + radius*0.6, cy + radius*0.15], fill=(225, 27, 34))

    elif symbol == "tamoil":
        # Disco blu con simbolo a T rosso
        draw.ellipse([cx - radius*0.8, cy - radius*0.8, cx + radius*0.8, cy + radius*0.8], fill=(0, 85, 165))
        # T rossa
        t_w = radius * 0.5
        t_h = radius * 0.5
        draw.rectangle([cx - t_w, cy - t_h*0.7, cx + t_w, cy - t_h*0.2], fill=(234, 88, 12))
        draw.rectangle([cx - t_w*0.3, cy - t_h*0.2, cx + t_w*0.3, cy + t_h*0.7], fill=(234, 88, 12))

    elif symbol == "conad":
        # Fiore / Margherita rossa con centro giallo
        draw.ellipse([cx - radius*0.7, cy - radius*0.7, cx + radius*0.7, cy + radius*0.7], fill=(220, 38, 38))
        draw.ellipse([cx - radius*0.3, cy - radius*0.3, cx + radius*0.3, cy + radius*0.3], fill=(255, 216, 0))
        # Petali bianchi
        for angle in [0, math.pi/2, math.pi, 3*math.pi/2]:
            px = cx + math.cos(angle) * (radius*0.45)
            py = cy + math.sin(angle) * (radius*0.45)
            draw.ellipse([px - radius*0.18, py - radius*0.18, px + radius*0.18, py + radius*0.18], fill=(255, 255, 255))

    elif symbol == "repsol":
        draw.ellipse([cx - radius*0.7, cy - radius*0.7, cx + radius*0.7, cy + radius*0.7], fill=(249, 115, 22))
        draw.ellipse([cx - radius*0.7, cy - radius*0.2, cx + radius*0.7, cy + radius*0.3], fill=(220, 38, 38))
        draw.rectangle([cx - radius*0.7, cy + radius*0.3, cx + radius*0.7, cy + radius*0.5], fill=(2, 132, 199))

    elif symbol == "beyfin":
        # Quadrifoglio verde
        clover_r = radius * 0.35
        for dx, dy in [(-1,-1), (1,-1), (-1,1), (1,1)]:
            draw.ellipse([cx + dx*clover_r*0.7 - clover_r/2, cy + dy*clover_r*0.7 - clover_r/2,
                          cx + dx*clover_r*0.7 + clover_r/2, cy + dy*clover_r*0.7 + clover_r/2], fill=(22, 163, 74))
        draw.ellipse([cx - radius*0.18, cy - radius*0.18, cx + radius*0.18, cy + radius*0.18], fill=(250, 204, 21))

    else:
        # Pompa di carburante neutra (pump)
        pw = radius * 0.7
        ph = radius * 1.1
        draw.rounded_rectangle([cx - pw/2, cy - ph/2, cx + pw*0.15, cy + ph/2], radius=int(radius*0.15), fill=(15, 118, 110))
        # Display pompa
        draw.rounded_rectangle([cx - pw*0.35, cy - ph*0.35, cx - pw*0.05, cy - ph*0.1], radius=1, fill=(240, 253, 250))
        # Tubo erogatore
        draw.arc([cx, cy - ph*0.25, cx + pw*0.5, cy + ph*0.2], 270, 90, fill=(15, 118, 110), width=max(2, int(radius*0.12)))
        draw.line([cx + pw*0.35, cy + ph*0.2, cx + pw*0.35, cy - ph*0.05], fill=(15, 118, 110), width=max(2, int(radius*0.12)))

def generate_logo_png(key, defs):
    """Crea una PNG 128x128 con supersampling 4x per altissima nitidezza"""
    scale = 4
    size = 128 * scale
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    margin = 8 * scale
    card_rect = [margin, margin, size - margin, size - margin]
    radius_card = 24 * scale

    # Sfondo card con gradiente o colore morbido
    draw.rounded_rectangle(card_rect, radius=radius_card, fill=(255, 255, 255, 255), outline=defs["border"], width=4*scale)

    # Disegna simbolo al centro
    cx = size / 2
    cy = size / 2
    r = 44 * scale
    draw_symbol(draw, defs["symbol"], cx, cy, r, defs)

    # Ridimensiona a 128x128 con filtro Lanczos
    final_img = img.resize((128, 128), Image.Resampling.LANCZOS)
    target_path = os.path.join(LOGOS_DIR, f"{key}.png")
    final_img.save(target_path, "PNG", optimize=True)
    print(f"  Logo generato: {target_path}")

def generate_marker_png(key, defs):
    """Crea un marker a goccia (teardrop pin) 36x48 px con supersampling 4x"""
    scale = 4
    w = 36 * scale
    h = 48 * scale
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pin_color = defs["primary"]
    border_color = (255, 255, 255, 240)

    # Coordinate del pin a goccia
    head_cx = 18 * scale
    head_cy = 18 * scale
    head_r = 16 * scale
    tip_x = 18 * scale
    tip_y = 46 * scale

    # Ombra sfumata alla base
    shadow_w = 14 * scale
    shadow_h = 4 * scale
    draw.ellipse([tip_x - shadow_w, tip_y - shadow_h*0.8, tip_x + shadow_w, tip_y + shadow_h*1.2], fill=(0, 0, 0, 80))

    # Corpo della goccia: cerchio testa + poligono punta
    # Punti tangenti tra cerchio e punta
    # Tangente da (tip_x, tip_y) al cerchio di raggio head_r centrato in (head_cx, head_cy)
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

    # Bordo esterno bianco per staccare dalla mappa
    draw.line([(tangent_l_x, tangent_l_y), (tip_x, tip_y)], fill=border_color, width=2*scale)
    draw.line([(tangent_r_x, tangent_r_y), (tip_x, tip_y)], fill=border_color, width=2*scale)
    draw.arc([head_cx - head_r, head_cy - head_r, head_cx + head_r, head_cy + head_r], start=180 - math.degrees(alpha), end=360 + math.degrees(alpha), fill=border_color, width=2*scale)

    # Cerchio interno bianco che ospita il logo
    inner_r = 11.5 * scale
    draw.ellipse([head_cx - inner_r, head_cy - inner_r, head_cx + inner_r, head_cy + inner_r], fill=(255, 255, 255), outline=defs["border"], width=1*scale)

    # Disegna simbolo all'interno del cerchio
    draw_symbol(draw, defs["symbol"], head_cx, head_cy, inner_r * 0.75, defs)

    # Ridimensiona a 36x48 con Lanczos
    final_img = img.resize((36, 48), Image.Resampling.LANCZOS)
    target_path = os.path.join(MARKERS_DIR, f"marker_{key}.png")
    final_img.save(target_path, "PNG", optimize=True)
    print(f"  Marker generato: {target_path}")

def run():
    print("=== GENERAZIONE ASSET PNG (LOGHI E MARKER) ===")
    for key, defs in BRAND_DEFS.items():
        generate_logo_png(key, defs)
        generate_marker_png(key, defs)
    print("Generazione completata con successo!")

if __name__ == "__main__":
    run()
