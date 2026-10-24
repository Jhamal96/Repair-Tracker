#!/usr/bin/env python3
"""Generate matching AJD PWA and favicon PNGs from the shared brand SVG."""
from io import BytesIO
from pathlib import Path
import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SVG = ROOT / "ajd-logo.svg"
OUTPUTS = {
    "ajd-logo-32.png": 32,
    "admin-icon-192.png": 192,
    "admin-icon-512.png": 512,
}
for relative_path, size in OUTPUTS.items():
    png = cairosvg.svg2png(
        bytestring=SVG.read_bytes(), output_width=size, output_height=size
    )
    image = Image.open(BytesIO(png)).convert("RGBA")
    output = ROOT / relative_path
    image.save(output, format="PNG", optimize=True)
    print(f"Created {relative_path}: {image.size}")
