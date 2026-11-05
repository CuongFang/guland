const fs = require('fs');
const proj4 = require('proj4');
const turf = require('@turf/turf');

const VN2000_KHANHHOA =
  '+proj=tmerc +lat_0=0 +lon_0=108.25 +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=-191.90441429,-39.30318279,-111.45032835,-0.00928836,0.01975479,-0.00427372,0.252906278 +units=m +no_defs';

const SRC_PATH = 'public/Map/QuyhoachchungCamLam2045_1.json';
const OUT_PATH = 'public/Map/qhc_camlam_2045.geojson';

// Bảng mã màu chuẩn 100% từ tab QHC10k (Phanloai -> maHTML)
const QHC10K_COLOR_MAP = {
  // KHU ĐẤT DÂN DỤNG
  HT_DAT_DD_Donvio: '#FF7F00',
  QHDD_DAT_DD_Donvio: '#FF7F00',
  QHDH_DAT_DD_Donvio: '#FF7F00',

  HT_DAT_DD_Donviomoimatdothap: '#FFBF00',
  QHDD_DAT_DD_Donviomoimatdothap: '#FFBF00',
  QHDH_DAT_DD_Donviomoimatdothap: '#FFBF00',

  HT_DAT_DD_Donviomoimatdotb: '#FFBF7F',
  QHDD_DAT_DD_Donviomoimatdotb: '#FFBF7F',
  QHDH_DAT_DD_Donviomoimatdotb: '#FFBF7F',

  HT_DAT_DD_Langxomdothihoa: '#A5A500',
  QHDD_DAT_DD_Langxomdothihoa: '#A5A500',
  QHDH_DAT_DD_Langxomdothihoa: '#A5A500',

  HT_DAT_DD_Honhop: '#A52900',
  QHDD_DAT_DD_Honhop: '#A52900',
  QHDH_DAT_DD_Honhop: '#A52900',

  HT_DAT_DD_DVCCdothi: '#FF0000',
  QHDD_DAT_DD_DVCCdothi: '#FF0000',
  QHDH_DAT_DD_DVCCdothi: '#FF0000',

  HT_DAT_DD_Coquandothi: '#7F3F00',
  QHDD_DAT_DD_Coquandothi: '#7F3F00',
  QHDH_DAT_DD_Coquandothi: '#7F3F00',

  HT_DAT_DD_CayxanhCCdothi: '#52A500',
  QHDD_DAT_DD_CayxanhCCdothi: '#52A500',
  QHDH_DAT_DD_CayxanhCCdothi: '#52A500',

  HT_DAT_DD_Giaothongdothi: '#808080',
  QHDD_DAT_DD_Giaothongdothi: '#808080',
  QHDH_DAT_DD_Giaothongdothi: '#808080',

  HT_DAT_DD_HTkhacdothi: '#5F3F7F',
  QHDD_DAT_DD_HTkhacdothi: '#5F3F7F',
  QHDH_DAT_DD_HTkhacdothi: '#5F3F7F',

  // KHU ĐẤT NGOÀI DÂN DỤNG
  HT_DAT_NDD_Congnghiep: '#5200A5',
  QHDD_DAT_NDD_Congnghiep: '#5200A5',
  QHDH_DAT_NDD_Congnghiep: '#5200A5',

  HT_DAT_NDD_Daotao: '#005F7F',
  QHDD_DAT_NDD_Daotao: '#005F7F',
  QHDH_DAT_NDD_Daotao: '#005F7F',
  QHDH_HT_DAT_NDD_Daotao: '#005F7F',

  HT_DAT_NDD_Coquan: '#4C3900',
  QHDD_DAT_NDD_Coquan: '#4C3900',
  QHDH_DAT_NDD_Coquan: '#4C3900',

  HT_DAT_NDD_Dulich: '#FF00FF',
  QHDD_DAT_NDD_Dulich: '#FF00FF',
  QHDH_DAT_NDD_Dulich: '#FF00FF',

  HT_DAT_NDD_Yte: '#FF00BF',
  QHDD_DAT_NDD_Yte: '#FF00BF',
  QHDH_DAT_NDD_Yte: '#FF00BF',

  HT_DAT_NDD_Vanhoathethao: '#007F00',
  QHDD_DAT_NDD_Vanhoathethao: '#007F00',
  QHDH_DAT_NDD_Vanhoathethao: '#007F00',

  HT_DAT_NDD_CayxanhSDHC: '#007F00',
  QHDD_DAT_NDD_CayxanhSDHC: '#007F00',
  QHDH_DAT_NDD_CayxanhSDHC: '#007F00',

  HT_DAT_NDD_CayxanhCD: '#004C39',
  QHDD_DAT_NDD_CayxanhCD: '#004C39',
  QHDH_DAT_NDD_CayxanhCD: '#004C39',

  HT_DAT_NDD_Ditich: '#4C0000',
  QHDD_DAT_NDD_Ditich: '#4C0000',
  QHDH_DAT_NDD_Ditich: '#4C0000',

  HT_DAT_NDD_DancuNT: '#4C4C26',
  QHDD_DAT_NDD_DancuNT: '#4C4C26',
  QHDH_DAT_NDD_DancuNT: '#4C4C26',

  HT_DAT_NDD_Anninh: '#5F7F00',
  QHDD_DAT_NDD_Anninh: '#5F7F00',
  QHDH_DAT_NDD_Anninh: '#5F7F00',

  HT_DAT_NDD_Quocphong: '#1C2613',
  QHDD_DAT_NDD_Quocphong: '#1C2613',
  QHDH_DAT_NDD_Quocphong: '#1C2613',

  HT_DAT_NDD_GiaothongDN: '#656565',
  'QHDD_DAT_NDD-GiaothongDN': '#656565',
  'QHDH_DAT_NDD-GiaothongDN': '#656565',

  HT_DAT_NDD_Htkhacdoingoai: '#1C1358',
  QHDD_DAT_NDD_Htkhacdoingoai: '#1C1358',
  QHDH_DAT_NDD_Htkhacdoingoai: '#1C1358',

  // KHU ĐẤT NÔNG NGHIỆP VÀ CHỨC NĂNG KHÁC
  HT_DAT_NNK_Nongnghiep: '#00FF00',
  QHDD_DAT_NNK_Nongnghiep: '#00FF00',
  QHDH_DAT_NNK_Nongnghiep: '#00FF00',

  HT_DAT_NNK_Rungdacdung: '#001C26',
  QHDD_DAT_NNK_Rungdacdung: '#001C26',
  QHDH_DAT_NNK_Rungdacdung: '#001C26',

  HT_DAT_NNK_Rungphongho: '#135858',
  QHDD_DAT_NNK_Rungphongho: '#135858',
  QHDH_DAT_NNK_Rungphongho: '#135858',

  HT_DAT_NNK_Rungsanxuat: '#264C2F',
  QHDD_DAT_NNK_Rungsanxuat: '#264C2F',
  QHDH_DAT_NNK_Rungsanxuat: '#264C2F',

  HT_DAT_NNK_Thuysan: '#007FFF',
  QHDD_DAT_NNK_Thuysan: '#007FFF',
  QHDH_DAT_NNK_Thuysan: '#007FFF',

  HT_DAT_NNK_Chuasudung: '#C0C0C0',
  QHDD_DAT_NNK_Chuasudung: '#C0C0C0',
  QHDH_DAT_NNK_Chuasudung: '#C0C0C0',

  HT_DAT_NNK_Honuoc: '#003F7F',
  QHDD_DAT_NNK_Honuoc: '#003F7F',
  QHDH_DAT_NNK_Honuoc: '#003F7F',

  HT_DAT_NNK_Songsuoi: '#003F7F',
  QHDD_DAT_NNK_Songsuoi: '#003F7F',
  QHDH_DAT_NNK_Songsuoi: '#003F7F',

  HT_DAT_NNK_Matnuocbien: '#003F7F',
  QHDD_DAT_NNK_Matnuocbien: '#003F7F',
  QHDH_DAT_NNK_Matnuocbien: '#003F7F',

  HT_DAT_NNK_Nongnghiepkhac: '#00FF00',
  QHDD_DAT_NNK_Nongnghiepkhac: '#00FF00',
  QHDH_DAT_NNK_Nongnghiepkhac: '#00FF00',

  // ĐẤT NGHĨA TRANG, BỜ ĐẤT, ĐỒI NÚI
  HT_DAT_HTKT_Nghiatrang: '#808080',
  QHDD_DAT_HTKT_Nghiatrang: '#808080',
  QHDH_DAT_HTKT_Nghiatrang: '#808080',

  HT_DAT_DK_Bodat: '#656565',
  QHDD_DAT_DK_Bodat: '#656565',
  QHDH_DAT_DK_Bodat: '#656565',

  HT_DAT_DK_Doinui: '#52A552',
  QHDD_DAT_DK_Doinui: '#52A552',
  QHDH_DAT_DK_Doinui: '#52A552',
};

function getColorForPhanLoai(phanLoai) {
  const key = (phanLoai || '').trim();
  if (QHC10K_COLOR_MAP[key]) {
    return QHC10K_COLOR_MAP[key];
  }
  // Case-insensitive lookup if needed
  const lower = key.toLowerCase();
  for (const [k, v] of Object.entries(QHC10K_COLOR_MAP)) {
    if (k.toLowerCase() === lower) return v;
  }
  console.warn('Unmapped phanLoai:', key);
  return '#C0C0C0';
}

function parseGhiChu(ghiChu, phanLoai) {
  let raw = (ghiChu || phanLoai || 'Đất quy hoạch').trim();
  let giaiDoan = 'Quy hoạch đến năm 2045';
  if (raw.endsWith('_HT') || (phanLoai || '').startsWith('HT_')) {
    raw = raw.replace(/_HT$/i, '').trim();
    giaiDoan = 'Hiện trạng giữ lại / Chỉnh trang (HT)';
  } else if (raw.endsWith('_DD') || (phanLoai || '').startsWith('QHDD_')) {
    raw = raw.replace(/_DD$/i, '').replace(/_DH$/i, '').trim();
    giaiDoan = 'Quy hoạch giai đoạn đầu (Đợt đầu)';
  } else if (raw.endsWith('_DH') || (phanLoai || '').startsWith('QHDH_')) {
    raw = raw.replace(/_DH$/i, '').replace(/_DD$/i, '').trim();
    giaiDoan = 'Quy hoạch dài hạn (Đến năm 2045)';
  }
  return { tenQuyHoach: raw, giaiDoan };
}

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

  let a1 = Math.atan2(y1 - uy, x1 - ux);
  let a2 = Math.atan2(y2 - uy, x2 - ux);
  let a3 = Math.atan2(y3 - uy, x3 - ux);

  const norm = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const d12 = norm(a2 - a1);
  const d13 = norm(a3 - a1);

  let delta;
  if (d12 <= d13) {
    delta = d13;
  } else {
    delta = d13 - 2 * Math.PI;
  }

  const pts = [];
  for (let i = 1; i <= numSegments; i++) {
    const t = i / numSegments;
    const ang = a1 + delta * t;
    pts.push([ux + r * Math.cos(ang), uy + r * Math.sin(ang)]);
  }
  pts[pts.length - 1] = [x3, y3];
  return pts;
}

function flattenRingVN2000(rawRing) {
  const pts = [];
  for (const item of rawRing) {
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
    }
  }
  return pts;
}

function signedArea(pts) {
  let area = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    area += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
  }
  return area / 2;
}

function convertRingToWGS84(pts) {
  const out = pts.map(([x, y]) => {
    const [lng, lat] = proj4(VN2000_KHANHHOA, 'EPSG:4326', [x, y]);
    return [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6];
  });
  if (out.length > 0) {
    const first = out[0];
    const last = out[out.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      out.push([first[0], first[1]]);
    }
  }
  return out;
}

const rawData = JSON.parse(fs.readFileSync(SRC_PATH, 'utf8'));
const outFeatures = [];
const mappedSummary = [];

for (const feat of rawData.features || []) {
  const attr = feat.attributes || {};
  const geom = feat.geometry || {};
  const rawRings = geom.curveRings || geom.rings || [];
  const phanLoai = attr.phanLoai || '';
  const { tenQuyHoach, giaiDoan } = parseGhiChu(attr['Ghi_chú'], phanLoai);
  const mauSac = getColorForPhanLoai(phanLoai);
  mappedSummary.push(`${phanLoai} -> ${mauSac} (${tenQuyHoach})`);

  const tongDienTichHa = Math.round(((attr.Shape_Area || 0) / 10000) * 100) / 100;
  const quyetDinh =
    attr['Tên_Quy_hoạch'] ||
    'Quy hoạch chung đô thị mới Cam Lâm đến năm 2045 (QĐ 205/QĐ-TTg ngày 28/02/2024)';

  const outerRings = [];
  const holeRings = [];

  for (const r of rawRings) {
    const vnPts = flattenRingVN2000(r);
    if (vnPts.length < 4) continue;
    const sa = signedArea(vnPts);
    const wgsRing = convertRingToWGS84(vnPts);
    if (wgsRing.length < 4) continue;

    if (sa < 0) {
      const ccwOuter = [...wgsRing].reverse();
      try {
        const poly = turf.polygon([ccwOuter]);
        outerRings.push({
          ring: ccwOuter,
          absArea: Math.abs(sa),
          poly,
          bbox: turf.bbox(poly),
          holes: [],
        });
      } catch {}
    } else {
      const cwHole = [...wgsRing].reverse();
      holeRings.push({
        ring: cwHole,
        testPt: turf.point(cwHole[0]),
        absArea: Math.abs(sa),
      });
    }
  }

  outerRings.sort((a, b) => a.absArea - b.absArea);

  for (const h of holeRings) {
    const [hx, hy] = h.ring[0];
    for (const o of outerRings) {
      if (o.absArea <= h.absArea) continue;
      if (hx < o.bbox[0] || hx > o.bbox[2] || hy < o.bbox[1] || hy > o.bbox[3]) continue;
      try {
        if (turf.booleanPointInPolygon(h.testPt, o.poly)) {
          o.holes.push(h.ring);
          break;
        }
      } catch {}
    }
  }

  outerRings.forEach((o, idx) => {
    const coords = [o.ring, ...o.holes];
    let areaM2 = o.absArea;
    try {
      areaM2 = turf.area({ type: 'Polygon', coordinates: coords });
    } catch {}
    const areaHa = Math.round((areaM2 / 10000) * 100) / 100;

    outFeatures.push({
      type: 'Feature',
      properties: {
        OBJECTID: attr.OBJECTID,
        SubIndex: idx + 1,
        phanLoai,
        PhanLoai: phanLoai,
        TenQuyHoach: tenQuyHoach,
        GiaiDoan: giaiDoan,
        MauSac: mauSac,
        DienTichM2: Math.round(areaM2 * 10) / 10,
        DienTichHa: areaHa,
        TongDienTichPhanLoaiHa: tongDienTichHa,
        QuyetDinh: quyetDinh,
      },
      geometry: {
        type: 'Polygon',
        coordinates: coords,
      },
    });
  });
}

const outGeoJSON = {
  type: 'FeatureCollection',
  features: outFeatures,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(outGeoJSON));
const sizeMB = (fs.statSync(OUT_PATH).size / 1024 / 1024).toFixed(2);
console.log(
  `Successfully updated ${outFeatures.length} polygons in ${OUT_PATH} (${sizeMB} MB) with 100% QHC10k maHTML colors!`
);
