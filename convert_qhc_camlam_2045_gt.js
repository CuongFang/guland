const fs = require('fs');
const proj4 = require('proj4');

const VN2000_KHANHHOA =
  '+proj=tmerc +lat_0=0 +lon_0=108.25 +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=-191.90441429,-39.30318279,-111.45032835,-0.00928836,0.01975479,-0.00427372,0.252906278 +units=m +no_defs';

// Bảng mã màu chuẩn 100% từ tab QHC10k (Hatanggiaothong & Đường sắt)
const GT_COLOR_MAP = {
  // Hạ tầng giao thông đường bộ
  HTKT_GT_Heduong: '#0000FF', // Hè đường (CAD 5.0 -> 0,0,255 -> #0000FF)
  HTKT_GT_Timduong: '#FF0000', // Tim đường (CAD 1.0 -> 255,0,0 -> #FF0000)
  HTKT_GT_Longduong: '#000000', // Lòng đường (CAD 250.0 -> 0,0,0 -> #000000)

  // Đường sắt
  HTKT_GT_Duongsathientrang: '#00FF00', // Đường sắt hiện trạng (CAD 3.0 -> 0,255,0 -> #00FF00)
  HTKT_GT_Duongsattocdocao: '#7F005F', // Đường sắt tốc độ cao (CAD 224.0 -> 127,0,95 -> #7F005F)
  HTKT_GT_Duongsattrencao: '#FF0000', // Đường sắt trên cao (CAD 1.0 -> 255,0,0 -> #FF0000)
};

const GT_NAME_MAP = {
  HTKT_GT_Heduong: 'Hè đường (Chỉ giới đường đỏ / Vỉa hè)',
  HTKT_GT_Timduong: 'Tim đường quy hoạch',
  HTKT_GT_Longduong: 'Lòng đường',
  HTKT_GT_Duongsathientrang: 'Đường sắt hiện trạng',
  HTKT_GT_Duongsattocdocao: 'Đường sắt tốc độ cao',
  HTKT_GT_Duongsattrencao: 'Đường sắt trên cao (Đường sắt đô thị)',
};

function interpolateArc(p1, mid, p2, numSegments = 6) {
  const [x1, y1] = p1;
  const [x2, y2] = mid;
  const [x3, y3] = p2;
  const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
  if (Math.abs(D) < 1e-6) {
    return [mid, p2];
  }
  const ux =
    ((x1 * x1 + y1 * y1) * (y2 - y3) +
      (x2 * x2 + y2 * y2) * (y3 - y1) +
      (x3 * x3 + y3 * y3) * (y1 - y2)) /
    D;
  const uy =
    ((x1 * x1 + y1 * y1) * (x3 - x2) +
      (x2 * x2 + y2 * y2) * (x1 - x3) +
      (x3 * x3 + y3 * y3) * (x2 - x1)) /
    D;
  const r = Math.hypot(x1 - ux, y1 - uy);
  if (!Number.isFinite(r) || r > 50000) {
    return [mid, p2];
  }

  const a1 = Math.atan2(y1 - uy, x1 - ux);
  const a2 = Math.atan2(y2 - uy, x2 - ux);
  const a3 = Math.atan2(y3 - uy, x3 - ux);

  const norm = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const d12 = norm(a2 - a1);
  const d13 = norm(a3 - a1);

  const delta = d12 <= d13 ? d13 : d13 - 2 * Math.PI;

  const pts = [];
  for (let i = 1; i <= numSegments; i++) {
    const t = i / numSegments;
    const ang = a1 + delta * t;
    pts.push([ux + r * Math.cos(ang), uy + r * Math.sin(ang)]);
  }
  pts[pts.length - 1] = [x3, y3];
  return pts;
}

function interpolateCenterArc(p1, arcDef, numSegments = 16) {
  const endPt = arcDef[0];
  const centerPt = arcDef[1];
  const clockwise = arcDef[3] === 1;
  const [x1, y1] = p1;
  const [x3, y3] = endPt;
  const [cx, cy] = centerPt;
  const r = Math.hypot(x1 - cx, y1 - cy);
  if (!Number.isFinite(r) || r < 1e-6) {
    return [endPt];
  }
  const a1 = Math.atan2(y1 - cy, x1 - cx);
  const isFullCircle = Math.hypot(x1 - x3, y1 - y3) < 1e-3;
  let delta;
  if (isFullCircle) {
    delta = clockwise ? -2 * Math.PI : 2 * Math.PI;
  } else {
    const a3 = Math.atan2(y3 - cy, x3 - cx);
    const norm = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const ccwDelta = norm(a3 - a1);
    delta = clockwise ? ccwDelta - 2 * Math.PI : ccwDelta;
  }
  const pts = [];
  for (let i = 1; i <= numSegments; i++) {
    const t = i / numSegments;
    const ang = a1 + delta * t;
    pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
  }
  pts[pts.length - 1] = [x3, y3];
  return pts;
}

function flattenPathVN2000(rawPath) {
  const pts = [];
  for (const item of rawPath) {
    if (Array.isArray(item)) {
      pts.push([item[0], item[1]]);
    } else if (item && item.c && Array.isArray(item.c)) {
      const endPt = item.c[0];
      const midPt = item.c[1];
      if (pts.length > 0) {
        const prevPt = pts[pts.length - 1];
        const arcPts = interpolateArc(prevPt, midPt, endPt, 6);
        for (const ap of arcPts) {
          pts.push(ap);
        }
      } else {
        pts.push([midPt[0], midPt[1]]);
        pts.push([endPt[0], endPt[1]]);
      }
    } else if (item && item.a && Array.isArray(item.a)) {
      if (pts.length > 0) {
        const prevPt = pts[pts.length - 1];
        const arcPts = interpolateCenterArc(prevPt, item.a, 16);
        for (const ap of arcPts) {
          pts.push(ap);
        }
      } else if (Array.isArray(item.a[0])) {
        pts.push([item.a[0][0], item.a[0][1]]);
      }
    }
  }
  return pts;
}

function convertPathToWGS84(pts) {
  return pts.map(([x, y]) => {
    const [lng, lat] = proj4(VN2000_KHANHHOA, 'EPSG:4326', [x, y]);
    return [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6];
  });
}

function convertPolylineFile(srcPath, outPath, layerLabel) {
  const rawData = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
  const outFeatures = [];
  let minLng = Infinity,
    maxLng = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity;
  const countsByPhanLoai = {};

  for (const feat of rawData.features || []) {
    const attr = feat.attributes || {};
    const geom = feat.geometry || {};
    const rawPaths = geom.curvePaths || geom.paths || [];
    const phanLoai = (attr.phanLoai || '').trim();
    const mauSac = GT_COLOR_MAP[phanLoai] || '#0000FF';
    const tenQuyHoach = GT_NAME_MAP[phanLoai] || attr.ghiChu || phanLoai;
    const chieuDaiM = Math.round((attr.Shape_Length || 0) * 10) / 10;

    const wgsPaths = [];
    for (const rp of rawPaths) {
      const vnPts = flattenPathVN2000(rp);
      if (vnPts.length < 2) continue;
      const wgsPts = convertPathToWGS84(vnPts);
      for (const [lng, lat] of wgsPts) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      wgsPaths.push(wgsPts);
    }

    if (wgsPaths.length === 0) continue;
    countsByPhanLoai[phanLoai] = (countsByPhanLoai[phanLoai] || 0) + 1;

    outFeatures.push({
      type: 'Feature',
      properties: {
        ID: attr.OBJECTID,
        phanLoai,
        PhanLoai: phanLoai,
        TenQuyHoach: tenQuyHoach,
        GhiChu: attr.ghiChu || '',
        MauSac: mauSac,
        ChieuDaiM: chieuDaiM,
      },
      geometry:
        wgsPaths.length === 1
          ? { type: 'LineString', coordinates: wgsPaths[0] }
          : { type: 'MultiLineString', coordinates: wgsPaths },
    });
  }

  const outGeoJSON = {
    type: 'FeatureCollection',
    features: outFeatures,
  };

  fs.writeFileSync(outPath, JSON.stringify(outGeoJSON));
  const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
  console.log(`=== ${layerLabel} ===`);
  console.log(`  Output: ${outPath} (${sizeMB} MB, ${outFeatures.length} features)`);
  console.log(`  Bounds: W=${minLng.toFixed(6)}, S=${minLat.toFixed(6)}, E=${maxLng.toFixed(6)}, N=${maxLat.toFixed(6)}`);
  console.log(`  Counts by phanLoai:`, countsByPhanLoai);
}

convertPolylineFile(
  'public/Map/QuyhoachchungCamLam2045_Mangluoigiaothongduongbo.json',
  'public/Map/qhc_camlam_2045_gt_duongbo.geojson',
  'Mạng lưới Giao thông Đường bộ QHC Cam Lâm 2045'
);

convertPolylineFile(
  'public/Map/QuyhoachchungCamLam2045_Mangluoigiaothongduongsat.json',
  'public/Map/qhc_camlam_2045_gt_duongsat.geojson',
  'Mạng lưới Giao thông Đường sắt QHC Cam Lâm 2045'
);
