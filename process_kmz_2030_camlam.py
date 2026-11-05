import zipfile
import re
from PIL import Image
import io
import os

kmz_path = r"d:\Edit video\New Product\guland-clone\public\Map\DC Quy hoach su dung dat 2030 Cam Lam.kmz"
out_webp = r"d:\Edit video\New Product\guland-clone\public\Map\dc_qhsdd_2030_camlam.webp"

with zipfile.ZipFile(kmz_path, 'r') as z:
    kml_text = z.read('doc.kml').decode('utf-8', errors='replace')
    pattern = re.compile(
        r'<GroundOverlay>.*?<drawOrder>(.*?)</drawOrder>.*?<href>(.*?)</href>.*?<LatLonBox>\s*<north>(.*?)</north>\s*<south>(.*?)</south>\s*<east>(.*?)</east>\s*<west>(.*?)</west>\s*</LatLonBox>',
        re.DOTALL
    )
    matches = pattern.findall(kml_text)
    by_level = {}
    for draw_order, href, n, s, e, w in matches:
        m = re.search(r'_L(\d+)_(\d+)_(\d+)\.png', href)
        lvl = int(m.group(1)) if m else 0
        row = int(m.group(2)) if m else 0
        col = int(m.group(3)) if m else 0
        by_level.setdefault(lvl, []).append({
            'row': row, 'col': col, 'href': href,
            'n': float(n), 's': float(s), 'e': float(e), 'w': float(w),
        })

    # Check L5 grid structure
    l5 = by_level[5]
    min_w = min(x['w'] for x in l5)
    max_e = max(x['e'] for x in l5)
    min_s = min(x['s'] for x in l5)
    max_n = max(x['n'] for x in l5)

    # Find resolution (deg per pixel) from a full 1024x1024 L5 tile
    ref_tile = None
    for t in l5:
        im = Image.open(io.BytesIO(z.read(t['href'])))
        if im.size == (1024, 1024):
            ref_tile = (t, im.size)
            break
    t0, (tw, th) = ref_tile
    dlon_px = (t0['e'] - t0['w']) / tw
    dlat_px = (t0['n'] - t0['s']) / th

    canvas_w = int(round((max_e - min_w) / dlon_px))
    canvas_h = int(round((max_n - min_s) / dlat_px))
    print(f"L5 Canvas size: {canvas_w} x {canvas_h}")
    print(f"L5 Geographic Bounds: W={min_w:.10f}, S={min_s:.10f}, E={max_e:.10f}, N={max_n:.10f}")

    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))

    # Paint L4 first (scaled) just in case any area in L5 is missing, then paint L5 on top
    for lvl in [4, 5]:
        for t in by_level.get(lvl, []):
            im = Image.open(io.BytesIO(z.read(t['href']))).convert("RGBA")
            x0 = int(round((t['w'] - min_w) / dlon_px))
            y0 = int(round((max_n - t['n']) / dlat_px))
            x1 = int(round((t['e'] - min_w) / dlon_px))
            y1 = int(round((max_n - t['s']) / dlat_px))
            target_w = x1 - x0
            target_h = y1 - y0
            if im.size != (target_w, target_h):
                im = im.resize((target_w, target_h), Image.Resampling.BILINEAR)
            canvas.paste(im, (x0, y0), im)

    # Crop to non-transparent bounding box
    bbox = canvas.getbbox()
    print(f"Non-transparent pixel bbox on L5 canvas: {bbox}")
    crop_x0, crop_y0, crop_x1, crop_y1 = bbox
    cropped = canvas.crop(bbox)
    crop_w, crop_h = cropped.size

    # Calculate exact geographic coordinates of the cropped bounding box
    exact_w = min_w + crop_x0 * dlon_px
    exact_e = min_w + crop_x1 * dlon_px
    exact_n = max_n - crop_y0 * dlat_px
    exact_s = max_n - crop_y1 * dlat_px

    print(f"Cropped size: {crop_w} x {crop_h}")
    print(f"EXACT Cropped Bounds:")
    print(f"  West : {exact_w:.8f}")
    print(f"  South: {exact_s:.8f}")
    print(f"  East : {exact_e:.8f}")
    print(f"  North: {exact_n:.8f}")
    print(f"QuadCoords (TL, TR, BR, BL):")
    print(f"  [[{exact_w:.8f}, {exact_n:.8f}], [{exact_e:.8f}, {exact_n:.8f}], [{exact_e:.8f}, {exact_s:.8f}], [{exact_w:.8f}, {exact_s:.8f}]]")

    # Resize to fit max 8192x8192 for universal WebGL compatibility while preserving ultra-sharp details
    MAX_DIM = 8192
    if crop_w > MAX_DIM or crop_h > MAX_DIM:
        scale = MAX_DIM / max(crop_w, crop_h)
        new_w = int(round(crop_w * scale))
        new_h = int(round(crop_h * scale))
        print(f"Resizing from {crop_w}x{crop_h} to {new_w}x{new_h} (scale={scale:.4f})...")
        cropped = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)

    cropped.save(out_webp, "WEBP", quality=90, method=4)
    size_mb = os.path.getsize(out_webp) / (1024 * 1024)
    print(f"Saved {out_webp} ({size_mb:.2f} MB)")
