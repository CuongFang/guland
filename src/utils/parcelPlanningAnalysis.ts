import * as turf from '@turf/turf';
import { convertWGS84ToVN2000 } from './vn2000';

export interface ZoneBreakdownItem {
  kyHieuLo: string;
  tenQuyHoach: string;
  giaiDoan?: string;
  mauSac: string;
  matDoXD: string;
  tangCao: string;
  heSoSDD: string;
  areaM2: number;
  percentage: number;
  isBuildableLand: boolean;
  geometry: any;
  sourceName: string;
}

export interface ParcelVertexCoord {
  index: number;
  lat: number;
  lng: number;
  vn2000X: number;
  vn2000Y: number;
  edgeLengthNextM: number;
}

export interface ParcelPlanningAnalysisResult {
  hasPlanningOverlap: boolean;
  planningSourceTitle: string;
  originalAreaM2: number;
  geometricAreaM2: number;
  trafficCutAreaM2: number;
  trafficCutPercentage: number;
  remainingAfterTrafficAreaM2: number;
  remainingAfterTrafficPercentage: number;
  buildableResidentialAreaM2: number;
  buildableResidentialPercentage: number;
  publicOrGreenCutAreaM2: number;
  publicOrGreenCutPercentage: number;
  zoneBreakdowns: ZoneBreakdownItem[];
  qhc2045Summary: ZoneBreakdownItem[];
  remainingVertices: ParcelVertexCoord[];
  highlightGeoJSON: {
    type: 'FeatureCollection';
    features: any[];
  };
}

let cachedSddGeoJSON: any = null;
let cachedGtGeoJSON: any = null;
let cachedQhc2045GeoJSON: any = null;
let cachedTd22330Index: Map<string, any> | null = null;
let loadingPromise: Promise<void> | null = null;

export async function ensurePlanningDataLoaded(): Promise<void> {
  if (cachedSddGeoJSON && cachedGtGeoJSON && cachedQhc2045GeoJSON) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const [sddRes, gtRes, qhcRes] = await Promise.all([
        fetch('/Map/camhaitay_1500_sdd.geojson'),
        fetch('/Map/camhaitay_1500_gt.geojson'),
        fetch('/Map/qhc_camlam_2045.geojson?v=qhc10k'),
      ]);
      if (sddRes.ok) {
        cachedSddGeoJSON = await sddRes.json();
        for (const f of cachedSddGeoJSON.features || []) {
          f._bbox = turf.bbox(f);
        }
      }
      if (gtRes.ok) {
        cachedGtGeoJSON = await gtRes.json();
        for (const f of cachedGtGeoJSON.features || []) {
          f._bbox = turf.bbox(f);
        }
      }
      if (qhcRes.ok) {
        cachedQhc2045GeoJSON = await qhcRes.json();
        for (const f of cachedQhc2045GeoJSON.features || []) {
          f._bbox = turf.bbox(f);
        }
      }
    } catch (err) {
      console.warn('Không thể tải dữ liệu quy hoạch để bóc tách:', err);
    }
  })();

  return loadingPromise;
}

export async function getUnclippedParcelFeature(
  soTo: number | string,
  soThua: number | string,
  fallbackGeometry: any
): Promise<any> {
  try {
    if (!cachedTd22330Index) {
      const res = await fetch('/Map/td_22330_camhaitay.geojson');
      if (res.ok) {
        const data = await res.json();
        const map = new Map<string, any>();
        for (const f of data.features || []) {
          const p = f.properties || {};
          const key = `${p.t}_${p.th}`;
          if (!map.has(key)) {
            map.set(key, f);
          }
        }
        cachedTd22330Index = map;
      }
    }
    if (cachedTd22330Index) {
      const exact = cachedTd22330Index.get(`${soTo}_${soThua}`);
      if (exact && exact.geometry) {
        return exact;
      }
    }
  } catch (e) {
    console.warn('Fallback to clicked geometry:', e);
  }
  return {
    type: 'Feature',
    properties: { t: soTo, th: soThua },
    geometry: fallbackGeometry,
  };
}

function bboxesOverlap(a: number[], b: number[]): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

function isBuildableCategory(tenQuyHoach: string, phanLoai: string = ''): boolean {
  const lower = `${tenQuyHoach || ''} ${phanLoai || ''}`.toLowerCase();
  return (
    lower.includes('đất nhà ở') ||
    lower.includes('đơn vị ở') ||
    lower.includes('donvio') ||
    lower.includes('làng xóm đô thị hóa') ||
    lower.includes('langxomdothihoa') ||
    lower.includes('dân cư nông thôn') ||
    lower.includes('dancunt') ||
    lower.includes('đất ở') ||
    lower.includes('thương mại') ||
    lower.includes('dịch vụ') ||
    lower.includes('du lịch') ||
    lower.includes('dulich') ||
    lower.includes('hỗn hợp') ||
    lower.includes('honhop')
  );
}

function extractVerticesFromGeometry(geom: any): ParcelVertexCoord[] {
  if (!geom) return [];
  let mainRing: number[][] = [];

  if (geom.type === 'Polygon') {
    mainRing = geom.coordinates[0] || [];
  } else if (geom.type === 'MultiPolygon') {
    let maxArea = -1;
    for (const polyCoords of geom.coordinates || []) {
      try {
        const poly = turf.polygon(polyCoords);
        const a = turf.area(poly);
        if (a > maxArea) {
          maxArea = a;
          mainRing = polyCoords[0] || [];
        }
      } catch {}
    }
  }

  if (mainRing.length < 3) return [];

  const pts = mainRing.slice(0, mainRing.length - 1);
  const vertices: ParcelVertexCoord[] = [];

  for (let i = 0; i < pts.length; i++) {
    const [lng, lat] = pts[i];
    const nextPt = pts[(i + 1) % pts.length];
    const edgeLengthNextM = turf.distance(
      turf.point([lng, lat]),
      turf.point([nextPt[0], nextPt[1]]),
      { units: 'meters' }
    );
    const vn2000 = convertWGS84ToVN2000(lng, lat, 108.25);

    vertices.push({
      index: i + 1,
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      vn2000X: vn2000.x,
      vn2000Y: vn2000.y,
      edgeLengthNextM: Math.round(edgeLengthNextM * 100) / 100,
    });
  }

  return vertices;
}

function clipParcelAgainstLayer(
  parcelFeature: any,
  parcelBbox: number[],
  geomArea: number,
  scaleFactor: number,
  featuresList: any[],
  sourceName: string
) {
  const breakdowns: ZoneBreakdownItem[] = [];
  let remainingDiffFeature: any = parcelFeature;
  let totalZoneGeomArea = 0;

  for (const zone of featuresList || []) {
    const zBbox = zone._bbox || turf.bbox(zone);
    if (!bboxesOverlap(parcelBbox, zBbox)) continue;

    try {
      if (!turf.booleanIntersects(parcelFeature, zone)) continue;
      const inter = turf.intersect(turf.featureCollection([parcelFeature, zone]));
      if (!inter) continue;

      const interGeomArea = turf.area(inter);
      if (interGeomArea < 0.05) continue;

      totalZoneGeomArea += interGeomArea;
      const zp = zone.properties || {};
      const tenQuyHoach = zp.TenQuyHoach || 'Đất quy hoạch';

      breakdowns.push({
        kyHieuLo: zp.KyHieuLo || '',
        tenQuyHoach,
        giaiDoan: zp.GiaiDoan || '',
        mauSac: zp.MauSac || '#f97316',
        matDoXD: zp.MatDoXD || '',
        tangCao: zp.TangCao || '',
        heSoSDD: zp.HeSoSDD || '',
        areaM2: Math.round(interGeomArea * scaleFactor * 10) / 10,
        percentage: Math.round((interGeomArea / geomArea) * 1000) / 10,
        isBuildableLand: isBuildableCategory(tenQuyHoach, zp.phanLoai),
        geometry: inter.geometry,
        sourceName,
      });

      if (remainingDiffFeature) {
        try {
          remainingDiffFeature = turf.difference(
            turf.featureCollection([remainingDiffFeature, zone])
          );
        } catch {}
      }
    } catch {}
  }

  breakdowns.sort((a, b) => b.areaM2 - a.areaM2);
  return { breakdowns, remainingDiffFeature, totalZoneGeomArea };
}

export async function analyzeParcelWithPlanning(
  soTo: number | string,
  soThua: number | string,
  legalAreaM2: number,
  fallbackGeometry: any
): Promise<ParcelPlanningAnalysisResult | null> {
  await ensurePlanningDataLoaded();

  const parcelFeature = await getUnclippedParcelFeature(soTo, soThua, fallbackGeometry);
  if (!parcelFeature || !parcelFeature.geometry) return null;

  const parcelBbox = turf.bbox(parcelFeature);
  const geomArea = turf.area(parcelFeature);
  if (geomArea <= 0.01) return null;

  const baseAreaM2 = legalAreaM2 > 0 ? legalAreaM2 : Math.round(geomArea * 10) / 10;
  const scaleFactor = baseAreaM2 / geomArea;

  // 1. Check intersection with QHC Cam Lam 2045 (covers entire Cam Lam district)
  let qhcResult = {
    breakdowns: [] as ZoneBreakdownItem[],
    remainingDiffFeature: parcelFeature as any,
    totalZoneGeomArea: 0,
  };
  if (cachedQhc2045GeoJSON) {
    qhcResult = clipParcelAgainstLayer(
      parcelFeature,
      parcelBbox,
      geomArea,
      scaleFactor,
      cachedQhc2045GeoJSON.features,
      'QHC Cam Lâm 2045'
    );
  }

  // 2. Check intersection with QH 1/500 Cam Hai Tay (detailed 1/500 area)
  const sddBbox = [109.1275, 12.0963, 109.1546, 12.1152];
  let sddResult = {
    breakdowns: [] as ZoneBreakdownItem[],
    remainingDiffFeature: parcelFeature as any,
    totalZoneGeomArea: 0,
  };
  let has1500Overlap = false;

  if (cachedSddGeoJSON && bboxesOverlap(parcelBbox, sddBbox)) {
    sddResult = clipParcelAgainstLayer(
      parcelFeature,
      parcelBbox,
      geomArea,
      scaleFactor,
      cachedSddGeoJSON.features,
      'QH 1/500 Cam Hải Tây'
    );
    if (sddResult.breakdowns.length > 0) {
      has1500Overlap = true;
    } else if (cachedGtGeoJSON) {
      for (const gtLine of cachedGtGeoJSON.features || []) {
        const gBbox = gtLine._bbox || turf.bbox(gtLine);
        const exp = [gBbox[0] - 0.00015, gBbox[1] - 0.00015, gBbox[2] + 0.00015, gBbox[3] + 0.00015];
        if (!bboxesOverlap(parcelBbox, exp)) continue;
        try {
          if (turf.booleanIntersects(parcelFeature, gtLine)) {
            has1500Overlap = true;
            break;
          }
        } catch {}
      }
    }
  }

  // Prefer QH 1/500 when the parcel is inside the 1/500 neighborhood; otherwise use QHC Cam Lam 2045
  const use1500Primary = has1500Overlap;
  const activeResult = use1500Primary ? sddResult : qhcResult;
  const planningSourceTitle = use1500Primary
    ? 'QH Chi tiết 1/500 & Giao thông'
    : 'QHC Đô thị mới Cam Lâm 2045';

  if (!use1500Primary && qhcResult.breakdowns.length === 0) {
    return null;
  }

  const rawBreakdowns = activeResult.breakdowns;
  const remainingDiffFeature = activeResult.remainingDiffFeature;
  const totalZoneGeomArea = activeResult.totalZoneGeomArea;

  const diffGeomArea = Math.max(0, geomArea - totalZoneGeomArea);
  let trafficCutAreaM2 = Math.round(diffGeomArea * scaleFactor * 10) / 10;
  let remainingAfterTrafficAreaM2 = Math.round((baseAreaM2 - trafficCutAreaM2) * 10) / 10;

  if (remainingAfterTrafficAreaM2 < 0) remainingAfterTrafficAreaM2 = 0;
  if (trafficCutAreaM2 < 0.1) {
    trafficCutAreaM2 = 0;
    remainingAfterTrafficAreaM2 = baseAreaM2;
  }

  const trafficCutPercentage = Math.min(
    100,
    Math.round((trafficCutAreaM2 / baseAreaM2) * 1000) / 10
  );
  const remainingAfterTrafficPercentage = Math.max(
    0,
    Math.round((100 - trafficCutPercentage) * 10) / 10
  );

  let buildableResidentialAreaM2 = 0;
  let publicOrGreenCutAreaM2 = 0;

  for (const item of rawBreakdowns) {
    if (item.isBuildableLand) {
      buildableResidentialAreaM2 += item.areaM2;
    } else {
      publicOrGreenCutAreaM2 += item.areaM2;
    }
  }

  buildableResidentialAreaM2 = Math.round(buildableResidentialAreaM2 * 10) / 10;
  publicOrGreenCutAreaM2 = Math.round(publicOrGreenCutAreaM2 * 10) / 10;

  const buildableResidentialPercentage =
    Math.round((buildableResidentialAreaM2 / baseAreaM2) * 1000) / 10;
  const publicOrGreenCutPercentage =
    Math.round((publicOrGreenCutAreaM2 / baseAreaM2) * 1000) / 10;

  const highlightFeatures: any[] = [];

  for (const item of rawBreakdowns) {
    highlightFeatures.push({
      type: 'Feature',
      properties: {
        partType: item.isBuildableLand ? 'remaining_buildable' : 'remaining_public',
        label: `${item.kyHieuLo ? item.kyHieuLo + ': ' : ''}${item.areaM2} m²`,
        areaM2: item.areaM2,
      },
      geometry: item.geometry,
    });
  }

  if (remainingDiffFeature && remainingDiffFeature.geometry && trafficCutAreaM2 >= 0.1) {
    highlightFeatures.push({
      type: 'Feature',
      properties: {
        partType: 'traffic_cut',
        label: `Trừ QH Giao thông: -${trafficCutAreaM2} m²`,
        areaM2: trafficCutAreaM2,
      },
      geometry: remainingDiffFeature.geometry,
    });
  }

  const primaryRemainingGeometry =
    rawBreakdowns.length > 0 ? rawBreakdowns[0].geometry : parcelFeature.geometry;
  const remainingVertices = extractVerticesFromGeometry(primaryRemainingGeometry);

  return {
    hasPlanningOverlap: true,
    planningSourceTitle,
    originalAreaM2: baseAreaM2,
    geometricAreaM2: Math.round(geomArea * 10) / 10,
    trafficCutAreaM2,
    trafficCutPercentage,
    remainingAfterTrafficAreaM2,
    remainingAfterTrafficPercentage,
    buildableResidentialAreaM2,
    buildableResidentialPercentage,
    publicOrGreenCutAreaM2,
    publicOrGreenCutPercentage,
    zoneBreakdowns: rawBreakdowns,
    qhc2045Summary: use1500Primary ? qhcResult.breakdowns : [],
    remainingVertices,
    highlightGeoJSON: {
      type: 'FeatureCollection',
      features: highlightFeatures,
    },
  };
}
