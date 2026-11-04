import json
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

SRC_PATH = r'd:\Edit video\New Product\guland-clone\public\Map\cam hai tay.geojson'
PREV_PATH = r'd:\Edit video\New Product\guland-clone\public\Map\td_22330_camhaitay.geojson'
OUT_PATH = r'd:\Edit video\New Product\guland-clone\public\Map\td_22330_camhaitay.geojson'

KEEP_LOWER = {
    'và', 'với', 'của', 'tại', 'xã', 'thôn', 'hộ', 'các', 'tổ', 'chức',
    'nhà', 'nước', 'giao', 'thuê', 'đồng', 'sử', 'dụng', 'quản', 'lý', 'lí',
    'đo', 'đạc', 'tách', 'thửa', 'tài', 'sản', 'nước', 'thải', 'điện',
    'trinh', 'sát', 'kỹ', 'thuật', 'chủng', 'hải', 'quân', 'cục', 'mẫu', 'mẩu', 'giáo'
}

def fix_word_case(w: str, idx: int, all_words: list[str]) -> str:
    if not w:
        return w
    m = re.match(r'^([(\[_"\']*)' + r'(.*?)' + r'([)\]_.,;:"\']*)$', w)
    if not m:
        return w
    pre, core, post = m.groups()
    if not core:
        return w

    # Preserve pure uppercase acronyms/abbreviations (e.g. UBND, TT, VPTT, CLĐ, KT-TM)
    if not any(c.islower() for c in core):
        return pre + core + post

    # Preserve dotted abbreviations like P.Anh, Đ.Anh
    if '.' in core:
        parts = [p if not any(c.islower() for c in p) else p.capitalize() for p in core.split('.')]
        return pre + '.'.join(parts) + post

    # Check if word has TCVN3 mixed-case anomaly (has both uppercase after 1st char AND lowercase, e.g. NGUYễN, TRầN, THị, áNh, MInh, sANG)
    has_upper_after_first = any(c.isupper() for c in core[1:])
    if has_upper_after_first and any(c.islower() for c in core):
        if core.lower() == 'và':
            return pre + 'và' + post
        return pre + core.capitalize() + post

    # If first letter is lowercase (e.g. ánh -> Ánh, ân -> Ân)
    if core[0].islower():
        if idx == 0:
            return pre + core.capitalize() + post
        if core.lower() in KEEP_LOWER:
            return pre + core.lower() + post
        return pre + core.capitalize() + post

    return pre + core + post

def normalize_tenchu(tc: str) -> str:
    if not tc:
        return ''
    tc = tc.strip().replace(' _', ' - ')
    words = tc.split()
    fixed = [fix_word_case(w, i, words) for i, w in enumerate(words)]
    return ' '.join(fixed)

def round_coords(coords):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], 6), round(coords[1], 6)]
    return [round_coords(c) for c in coords]

with open(SRC_PATH, 'r', encoding='utf-8') as f:
    src_data = json.load(f)

gcn_list = []
if os.path.exists(PREV_PATH):
    with open(PREV_PATH, 'r', encoding='utf-8') as f:
        prev_data = json.load(f)
    gcn_list = [feat['properties'].get('gcn', 0) for feat in prev_data.get('features', [])]

out_features = []
sample_fixed = []

for idx, feat in enumerate(src_data.get('features', [])):
    props = feat.get('properties', {})
    geom = feat.get('geometry')
    if not geom:
        continue

    gtype = geom['type']
    coords = round_coords(geom['coordinates'])
    if gtype == 'MultiPolygon' and len(coords) == 1:
        gtype = 'Polygon'
        coords = coords[0]

    raw_tc = (props.get('TENCHU') or '').strip()
    norm_tc = normalize_tenchu(raw_tc)
    if raw_tc and raw_tc != norm_tc and len(sample_fixed) < 25:
        sample_fixed.append((raw_tc, norm_tc))

    shbando = int(props.get('SHBANDO') or 0)
    shthua = int(props.get('SHTHUA') or 0)
    dientich = round(float(props.get('DIENTICH') or 0.0), 1)
    khloaidat = (props.get('KHLOAIDAT') or '').strip()
    diadanh = (props.get('DIADANH') or 'Xã Cam Lâm').strip()
    gcn = gcn_list[idx] if idx < len(gcn_list) else (1 if norm_tc else 0)

    new_props = {
        't': shbando,
        'th': shthua,
        'dt': dientich,
        'ld': khloaidat,
        'tc': norm_tc,
        'dd': diadanh,
        'gcn': gcn
    }

    out_features.append({
        'type': 'Feature',
        'properties': new_props,
        'geometry': {
            'type': gtype,
            'coordinates': coords
        }
    })

out_geojson = {
    'type': 'FeatureCollection',
    'features': out_features
}

with open(OUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(out_geojson, f, ensure_ascii=False, separators=(',', ':'))

size_mb = os.path.getsize(OUT_PATH) / 1024 / 1024
print(f"Saved {len(out_features)} features to {OUT_PATH} ({size_mb:.2f} MB)")
print("Sample normalized TENCHU:")
for old_tc, new_tc in sample_fixed:
    print(f"  {old_tc:38s} -> {new_tc}")
