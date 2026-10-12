"""Extract the cursor artwork from the supplied Wii cursor reference sheet."""
from pathlib import Path
import struct
import cv2
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SHEET = Image.open(ROOT / 'uploads/image-1.png').convert('RGB')
OUT = ROOT / 'site-cache/cursors/truf'
OUT.mkdir(parents=True, exist_ok=True)


def save_cursor(canvas, name, hotspot):
    """Write a standard 32-bit BMP-backed CUR with the indicated click point."""
    width, height = canvas.size
    pixels = np.array(canvas)
    xor = bytearray()
    mask = bytearray()
    padded_mask_width = ((width + 31) // 32) * 4
    for y in range(height - 1, -1, -1):
        row = pixels[y]
        for red, green, blue, alpha in row:
            xor.extend((int(blue), int(green), int(red), int(alpha)))
        and_row = bytearray(padded_mask_width)
        for x, pixel in enumerate(row):
            if pixel[3] == 0:
                and_row[x // 8] |= 1 << (7 - x % 8)
        mask.extend(and_row)
    dib = struct.pack('<IiiHHIIiiII', 40, width, height * 2, 1, 32, 0, len(xor), 0, 0, 0, 0)
    image_data = dib + xor + mask
    header = struct.pack('<HHH', 0, 2, 1)
    directory = struct.pack('<BBBBHHII', width, height, 0, 0, hotspot[0], hotspot[1], len(image_data), 22)
    (OUT / f'{name}.cur').write_bytes(header + directory + image_data)


def cursor_from_reference(name, crop, kind, hotspot):
    tile = np.array(SHEET.crop(crop))
    r, g, b = tile[:, :, 0].astype(int), tile[:, :, 1].astype(int), tile[:, :, 2].astype(int)
    if kind == 'dark':
        detected = ((r < 90) & (g < 90) & (b < 90)).astype('uint8') * 255
    elif kind == 'blue':
        detected = ((b > r + 58) & (b > g + 10) & (b > 140)).astype('uint8') * 255
    else:  # dark I-beam edges on the pale card
        detected = ((r < 125) & (g < 125) & (b < 125)).astype('uint8') * 255
    contours, _ = cv2.findContours(detected, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    if not contours:
        raise ValueError('No cursor outline found: ' + name)
    mask = np.zeros(detected.shape, dtype=np.uint8)
    cv2.drawContours(mask, [contours[0]], -1, 255, thickness=cv2.FILLED)
    # Restore one edge pixel and soften the harsh crop edge at the icon outline.
    mask = cv2.dilate(mask, np.ones((2, 2), dtype=np.uint8), iterations=1)
    alpha = Image.fromarray(mask).filter(ImageFilter.GaussianBlur(0.35))
    icon = Image.fromarray(tile).convert('RGBA')
    icon.putalpha(alpha)
    bounds = alpha.getbbox()
    icon = icon.crop(bounds)
    max_dimension = 46 if name in ('normal', 'link') else 40
    scale = min(max_dimension / icon.width, max_dimension / icon.height)
    icon = icon.resize((round(icon.width * scale), round(icon.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (48, 48), (0, 0, 0, 0))
    canvas.alpha_composite(icon, (2, 1))
    canvas.save(OUT / f'{name}.png')
    save_cursor(canvas, name, hotspot)
    print(name, 'source bounds', bounds, 'hotspot', hotspot)


cursor_from_reference('normal', (108, 218, 187, 308), 'dark', (14, 3))
cursor_from_reference('link', (887, 610, 973, 700), 'blue', (15, 3))
cursor_from_reference('text', (128, 430, 163, 486), 'text', (11, 22))

# The blue waiting ring is easier to read as a clean cursor at 48px.
from PIL import ImageDraw
ring = Image.new('RGBA', (48, 48), (0, 0, 0, 0))
draw = ImageDraw.Draw(ring)
draw.ellipse((8, 9, 39, 40), outline='#03aafa', width=5)
draw.ellipse((18, 2, 29, 13), fill='#009bf0')
ring.save(OUT / 'busy-01.png')
save_cursor(ring, 'busy-01', (24, 24))
