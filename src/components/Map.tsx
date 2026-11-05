"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import Map, { Source, Layer, Marker, Popup, NavigationControl, GeolocateControl, MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import MeasurementControlMapLibre from './MeasurementControlMapLibre';
import {
  analyzeParcelWithPlanning,
  ensurePlanningDataLoaded,
  ParcelPlanningAnalysisResult
} from '@/utils/parcelPlanningAnalysis';

import { setWorkerUrl, getVersion } from 'maplibre-gl';

// Fix lỗi Web Worker của MapLibre trong môi trường Next.js (Turbopack)
if (typeof window !== 'undefined') {
  setWorkerUrl(`https://unpkg.com/maplibre-gl@${getVersion()}/dist/maplibre-gl-worker.mjs`);
}

type Property = {
  id: string;
  title: string;
  price: number;
  lat: number | null;
  lng: number | null;
  location: string;
  images?: string[];
  google_map_link?: string;
};

export type LayerKey = '2030' | '2045' | 'khuvuc1' | 'docduong34' | 'dc21' | 'camtan_webp' | 'camlam_2030';
export type PlanningLayerType = LayerKey | 'to40' | 'khuvuc1_vector' | 'camtan_1500' | 'pk32_dienkhanh' | 'pk3_vector' | 'camhaitay_sdd' | 'camhaitay_gt' | 'td_22330' | 'qhc_camlam_2045' | 'qhc_camlam_2045_gt_bo' | 'qhc_camlam_2045_gt_sat';

const LOAI_DAT_NAMES: Record<string, string> = {
  'ODT': 'Đất ở tại đô thị',
  'ODT+LNC': 'Đất ở đô thị + Cây lâu năm',
  'ODT+BHK': 'Đất ở đô thị + Cây hàng năm',
  'ODT+CLN': 'Đất ở đô thị + Cây lâu năm',
  'ONT': 'Đất ở tại nông thôn',
  'ONT+LNQ': 'Đất ở nông thôn + Cây ăn quả',
  'ONT+LNK': 'Đất ở nông thôn + Cây lâu năm khác',
  'ONT+CLN': 'Đất ở nông thôn + Cây lâu năm',
  'ONT+BHK': 'Đất ở nông thôn + Cây hàng năm',
  'ONT+LUK': 'Đất ở nông thôn + Lúa nước',
  'ONT+LUC': 'Đất ở nông thôn + Lúa nước',
  'ONT+ONT': 'Đất ở tại nông thôn',
  'CLN': 'Đất trồng cây lâu năm',
  'LNK': 'Đất trồng cây lâu năm khác',
  'LNQ+BHK': 'Đất cây ăn quả + Cây hàng năm',
  'BHK': 'Đất bằng trồng cây hàng năm khác',
  'HNK': 'Đất trồng cây hàng năm khác',
  'NHK': 'Đất nương rẫy trồng cây hàng năm',
  'NKH': 'Đất nông nghiệp khác',
  'LUC': 'Đất chuyên trồng lúa nước',
  'LUK': 'Đất trồng lúa nước còn lại',
  'RST': 'Đất rừng sản xuất (Rừng trồng)',
  'RSX': 'Đất rừng sản xuất',
  'RSM': 'Đất rừng sản xuất',
  'NTS': 'Đất nuôi trồng thủy sản',
  'TSL': 'Đất nuôi trồng thủy sản nước lợ/mặn',
  'LMU': 'Đất làm muối',
  'DGT': 'Đất giao thông',
  'DTL': 'Đất thủy lợi',
  'SON': 'Đất sông, ngòi, kênh, rạch, suối',
  'MNC': 'Đất có mặt nước chuyên dùng',
  'BCS': 'Đất bằng chưa sử dụng',
  'CSD': 'Đất chưa sử dụng',
  'NTD': 'Đất nghĩa trang, nghĩa địa',
  'TSC': 'Đất trụ sở cơ quan',
  'CQP': 'Đất quốc phòng',
  'SKC': 'Đất cơ sở sản xuất phi nông nghiệp',
  'SKK': 'Đất khu công nghiệp',
  'DGD': 'Đất cơ sở giáo dục - đào tạo',
  'DCH': 'Đất chợ',
  'TON': 'Đất cơ sở tôn giáo',
  'TIN': 'Đất cơ sở tín ngưỡng',
  'DCS': 'Đất có di tích lịch sử - văn hóa',
  'DKV': 'Đất khu vui chơi, giải trí công cộng',
  'DNL': 'Đất công trình năng lượng',
};
export type QuadCoords = [[number, number], [number, number], [number, number], [number, number]];

const isCalibratableLayer = (layer: PlanningLayerType): layer is LayerKey => {
  return layer === '2030' || layer === '2045' || layer === 'khuvuc1' || layer === 'docduong34' || layer === 'dc21' || layer === 'camtan_webp' || layer === 'camlam_2030';
};

const BASE_MAP_STYLE: any = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    'satellite': {
      type: 'raster',
      tiles: ['https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'],
      tileSize: 256
    }
  },
  layers: [
    {
      id: 'satellite-layer',
      type: 'raster',
      source: 'satellite',
      minzoom: 0,
      maxzoom: 22
    }
  ]
};

const OSM_TILES = ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'];
const CAMTAN_TILES = ['/Map/camtan_tiles/{z}/{x}/{y}.webp'];
const CAMTAN_BOUNDS: [number, number, number, number] = [109.09220754, 12.10606002, 109.11479040, 12.13740052];

export const DEFAULT_COORDS: Record<LayerKey, QuadCoords> = {
  '2045': [
    [109.003095, 12.026543], // Top-Left (Tây Bắc)
    [109.296956, 12.025596], // Top-Right (Đông Bắc)
    [109.295989, 11.772498], // Bottom-Right (Đông Nam)
    [109.002399, 11.773424], // Bottom-Left (Tây Nam)
  ],
  '2030': [
    [109.003095, 12.026543],
    [109.296956, 12.025596],
    [109.295989, 11.772498],
    [109.002399, 11.773424],
  ],
  'khuvuc1': [
    [109.113441, 11.999380],
    [109.194403, 11.998904],
    [109.216069, 11.876910],
    [109.135107, 11.877386],
  ],
  'docduong34': [
    [109.150769, 11.914679],
    [109.158799, 11.914679],
    [109.158799, 11.912021],
    [109.150769, 11.912021],
  ],
  'dc21': [
    [109.150985, 11.914792],
    [109.154198, 11.914782],
    [109.154187, 11.911618],
    [109.150975, 11.911628],
  ],
  'camtan_webp': [
    [109.09220754, 12.13740052], // Top-Left (Tây Bắc)
    [109.11479040, 12.13740052], // Top-Right (Đông Bắc)
    [109.11479040, 12.10606002], // Bottom-Right (Đông Nam)
    [109.09220754, 12.10606002], // Bottom-Left (Tây Nam)
  ],
  'camlam_2030': [
    [108.93957001, 12.21491272], // Top-Left (Tây Bắc)
    [109.22624687, 12.21491272], // Top-Right (Đông Bắc)
    [109.22624687, 11.93583746], // Bottom-Right (Đông Nam)
    [108.93957001, 11.93583746], // Bottom-Left (Tây Nam)
  ],
};

export default function MapLibreWrapper({ properties = [], searchLocation }: { properties?: Property[], searchLocation?: [number, number] | null }) {
  const [mounted, setMounted] = useState(false);
  const mapRef = useRef<MapRef>(null);
  const [popupInfo, setPopupInfo] = useState<Property | null>(null);

  const [showHeatmap, setShowHeatmap] = useState(false);
  const [streetMapOpacity, setStreetMapOpacity] = useState(0); // Độ mờ lớp Bản đồ Đường phố (OSM Map)
  
  // Các Lớp Bản đồ Quy hoạch & Địa chính (Chỉ bật sẵn lớp đang chọn để tối ưu GPU 60fps mượt mà)
  const [opacity2030, setOpacity2030] = useState(0); // Kế hoạch SDĐ 2030 (1/25.000)
  const [opacity2045, setOpacity2045] = useState(0); // QHC Cam Ranh 2045 (1/10.000)
  const [opacityKhuVuc1, setOpacityKhuVuc1] = useState(0); // Phân khu 1/2000 Khu vực 1
  const [opacityDocDuong34, setOpacityDocDuong34] = useState(0); // 1/500 Dọc đường 3/4
  const [opacityDc21, setOpacityDc21] = useState(0); // Địa chính 1/500 Tờ 21 Cam Thuận
  const [opacityTo40, setOpacityTo40] = useState(0); // Địa chính Vector Tờ 40 Cam An Nam (389 thửa - GeoJSON)
  const [opacityKhuVuc1Vector, setOpacityKhuVuc1Vector] = useState(0); // Quy hoạch Phân khu 1 Cam Ranh (1.472 ô - GeoJSON)
  const [opacityCamTan1500, setOpacityCamTan1500] = useState(0); // Quy hoạch 1/500 Cam Tân - PA2 (Multi-tile 10K×14K)
  const [opacityCamTanWebp, setOpacityCamTanWebp] = useState(0); // Quy hoạch 1/500 Cam Tân - PA1 (Ảnh đơn WebP 8K)
  const [opacityPk32, setOpacityPk32] = useState(0); // Quy hoạch Phân khu 3.2 Diên Khánh (638 lô - GeoJSON)
  const [opacityPk3, setOpacityPk3] = useState(0); // Quy hoạch Phân khu 3 (1.407 lô - GeoJSON)
  const [opacityTd22330, setOpacityTd22330] = useState(0); // Tạm ẩn: Địa chính Cam Hải Tây - TD 22330 (83.509 thửa)
  const [opacityQhcCamLam2045, setOpacityQhcCamLam2045] = useState(0.75); // Quy hoạch chung Đô thị mới Cam Lâm 2045 (1.438 ô - QĐ 205/QĐ-TTg)
  const [opacityCamlam2030, setOpacityCamlam2030] = useState(0); // Điều chỉnh Quy hoạch Sử dụng đất đến năm 2030 huyện Cam Lâm (WebP 8K từ KMZ)
  const [opacityQhcCamLamGtBo, setOpacityQhcCamLamGtBo] = useState(1); // Mạng lưới Giao thông Đường bộ QHC Cam Lâm 2045 (32.252 đoạn)
  const [opacityQhcCamLamGtSat, setOpacityQhcCamLamGtSat] = useState(1); // Mạng lưới Giao thông Đường sắt QHC Cam Lâm 2045 (684 đoạn)
  const [opacityCamHaiTaySdd, setOpacityCamHaiTaySdd] = useState(0); // Tạm ẩn: QH 1/500 Cam Hải Tây - Sử dụng đất (282 ô)
  const [opacityCamHaiTayGt, setOpacityCamHaiTayGt] = useState(0); // Tạm ẩn: QH 1/500 Cam Hải Tây - Giao thông (3.929 đoạn)

  const [activePlanningLayer, setActivePlanningLayer] = useState<PlanningLayerType>('qhc_camlam_2045');
  const [selectedParcel, setSelectedParcel] = useState<{ lng: number; lat: number; properties: any } | null>(null);
  const [parcelAnalysis, setParcelAnalysis] = useState<ParcelPlanningAnalysisResult | null>(null);
  const [isAnalyzingParcel, setIsAnalyzingParcel] = useState(false);
  const [showRemainingCoords, setShowRemainingCoords] = useState(false);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [selectedPlanningZone, setSelectedPlanningZone] = useState<{ lng: number; lat: number; properties: any } | null>(null);

  // Quản lý tọa độ các lớp quy hoạch và chế độ Căn chỉnh thủ công bằng chuột
  const [layerCoords, setLayerCoords] = useState<Record<LayerKey, QuadCoords>>(DEFAULT_COORDS);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibNudgeMeters, setCalibNudgeMeters] = useState<number>(2); // 1m, 2m, 5m, 20m
  const [isCalibPanelCollapsed, setIsCalibPanelCollapsed] = useState(false);
  const lastDragPointRef = useRef<{ lng: number; lat: number } | null>(null);

  const [measureMode, setMeasureMode] = useState<'none' | 'distance' | 'area'>('none');
  const [isLayersCollapsed, setIsLayersCollapsed] = useState(true);
  
  // Custom User Location
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const locateUser = (auto: boolean = false) => {
    if (!auto) setIsLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setUserPos([longitude, latitude]);
        if (!auto && mapRef.current) {
          mapRef.current.flyTo({ center: [longitude, latitude], zoom: 15, duration: 2000 });
        }
        if (!auto) setIsLocating(false);
      }, (error) => {
        console.warn('Không thể định vị:', error);
        if (!auto) setIsLocating(false);
      });
    } else {
      if (!auto) setIsLocating(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    // Tự động định vị khi load trang
    locateUser(true);
    // Tải trước dữ liệu quy hoạch 1/500 để tính toán cắt giao thông tức thì
    ensurePlanningDataLoaded();

    // Khôi phục cấu hình căn chỉnh từ localStorage nếu có
    try {
      const saved = localStorage.getItem('guland_calib_coords');
      if (saved) {
        const parsed = JSON.parse(saved);
        setLayerCoords(prev => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.warn('Lỗi đọc localStorage:', e);
    }
  }, []);

  const getLayerName = (layer: PlanningLayerType) => {
    switch (layer) {
      case '2045': return 'QHC Cam Ranh 2045 (1/10.000)';
      case '2030': return 'Sử dụng đất 2030 (1/25.000)';
      case 'khuvuc1': return 'Phân khu 1/2000 Khu vực 1';
      case 'docduong34': return 'Dọc đường 3 Tháng 4 (1/500)';
      case 'dc21': return 'Địa chính Tờ 21 (1/500)';
      case 'to40': return 'Địa chính Tờ 40 Cam An Nam (Vector)';
      case 'khuvuc1_vector': return 'Quy hoạch Phân khu 1 (Vector 1.472 ô)';
      case 'camtan_1500': return 'QH 1/500 Cam Tân - PA2 (Đa mảnh 14K)';
      case 'camtan_webp': return 'QH 1/500 Cam Tân - PA1 (Ảnh ghép WebP)';
      case 'pk32_dienkhanh': return 'Quy hoạch Phân khu 3.2 Diên Khánh (638 ô Vector)';
      case 'pk3_vector': return 'Quy hoạch Phân khu 3 (1.407 ô Vector)';
      case 'camhaitay_sdd': return 'QH 1/500 Cam Hải Tây - Sử dụng đất (282 ô)';
      case 'camhaitay_gt': return 'QH 1/500 Cam Hải Tây - Mạng lưới Giao thông';
      case 'td_22330': return 'Địa chính Cam Hải Tây - TD 22330 (83.509 thửa)';
      case 'qhc_camlam_2045': return 'QHC Đô thị mới Cam Lâm 2045 (QĐ 205/QĐ-TTg)';
      case 'camlam_2030': return 'ĐCQH Sử dụng đất đến năm 2030 huyện Cam Lâm';
      case 'qhc_camlam_2045_gt_bo': return 'QHC Cam Lâm 2045 - Mạng lưới Giao thông Đường bộ';
      case 'qhc_camlam_2045_gt_sat': return 'QHC Cam Lâm 2045 - Mạng lưới Giao thông Đường sắt';
    }
  };

  const updateSourceCoordinates = (layerKey: LayerKey, coords: QuadCoords) => {
    const sourceIdMap: Record<LayerKey, string> = {
      '2045': 'planning-cam-ranh-2045',
      '2030': 'planning-cam-ranh-2030',
      'khuvuc1': 'planning-khuvuc1',
      'docduong34': 'planning-docduong34',
      'dc21': 'planning-dc21',
      'camtan_webp': 'planning-camtan-webp',
      'camlam_2030': 'planning-camlam-2030',
    };
    if (mapRef.current) {
      const src = mapRef.current.getSource(sourceIdMap[layerKey]) as any;
      if (src && typeof src.setCoordinates === 'function') {
        src.setCoordinates(coords);
      }
    }
  };

  // Cập nhật tọa độ 1 góc khi người dùng kéo chuột
  const handleCornerDrag = (cornerIdx: number, lng: number, lat: number) => {
    if (!isCalibratableLayer(activePlanningLayer)) return;
    const calibKey = activePlanningLayer as LayerKey;
    setLayerCoords(prev => {
      const current = [...prev[calibKey]] as QuadCoords;
      current[cornerIdx] = [lng, lat];
      const updated = {
        ...prev,
        [calibKey]: current
      };
      updateSourceCoordinates(calibKey, current);
      return updated;
    });
  };

  // Kéo điểm Tâm để di chuyển toàn bộ tấm bản đồ bằng delta chính xác
  const handleCenterDragDelta = (newLng: number, newLat: number) => {
    if (!isCalibratableLayer(activePlanningLayer)) return;
    if (!lastDragPointRef.current) {
      lastDragPointRef.current = { lng: newLng, lat: newLat };
      return;
    }
    const dLng = newLng - lastDragPointRef.current.lng;
    const dLat = newLat - lastDragPointRef.current.lat;
    lastDragPointRef.current = { lng: newLng, lat: newLat };

    setLayerCoords(prev => {
      const current = prev[activePlanningLayer];
      const nextCoords = current.map(([lng, lat]) => [
        lng + dLng,
        lat + dLat
      ]) as QuadCoords;
      updateSourceCoordinates(activePlanningLayer, nextCoords);
      return {
        ...prev,
        [activePlanningLayer]: nextCoords
      };
    });
  };

  // Dịch chuyển theo mét
  const nudge = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (!isCalibratableLayer(activePlanningLayer)) return;
    const meters = calibNudgeMeters;
    const dLat = (meters / 110580.0) * (direction === 'up' ? 1 : direction === 'down' ? -1 : 0);
    const dLng = (meters / 108923.0) * (direction === 'right' ? 1 : direction === 'left' ? -1 : 0);

    setLayerCoords(prev => {
      const current = prev[activePlanningLayer];
      const nextCoords = current.map(([lng, lat]) => [
        lng + dLng,
        lat + dLat
      ]) as QuadCoords;
      updateSourceCoordinates(activePlanningLayer, nextCoords);
      return {
        ...prev,
        [activePlanningLayer]: nextCoords
      };
    });
  };

  // Xoay bản đồ quanh tâm
  const rotateLayer = (deg: number) => {
    if (!isCalibratableLayer(activePlanningLayer)) return;
    setLayerCoords(prev => {
      const current = prev[activePlanningLayer];
      const cLng = (current[0][0] + current[1][0] + current[2][0] + current[3][0]) / 4;
      const cLat = (current[0][1] + current[1][1] + current[2][1] + current[3][1]) / 4;
      const rad = (deg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const cosLat = Math.cos((cLat * Math.PI) / 180);

      const nextCoords = current.map(([lng, lat]) => {
        const x = (lng - cLng) * cosLat;
        const y = lat - cLat;
        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;
        return [
          cLng + rx / cosLat,
          cLat + ry
        ];
      }) as QuadCoords;

      updateSourceCoordinates(activePlanningLayer, nextCoords);
      return {
        ...prev,
        [activePlanningLayer]: nextCoords
      };
    });
  };

  // Thu phóng quanh tâm
  const scaleLayer = (factor: number, axis: 'both' | 'x' | 'y' = 'both') => {
    if (!isCalibratableLayer(activePlanningLayer)) return;
    setLayerCoords(prev => {
      const current = prev[activePlanningLayer];
      const cLng = (current[0][0] + current[1][0] + current[2][0] + current[3][0]) / 4;
      const cLat = (current[0][1] + current[1][1] + current[2][1] + current[3][1]) / 4;

      const fx = axis === 'both' || axis === 'x' ? factor : 1;
      const fy = axis === 'both' || axis === 'y' ? factor : 1;

      const nextCoords = current.map(([lng, lat]) => [
        cLng + (lng - cLng) * fx,
        cLat + (lat - cLat) * fy
      ]) as QuadCoords;

      updateSourceCoordinates(activePlanningLayer, nextCoords);
      return {
        ...prev,
        [activePlanningLayer]: nextCoords
      };
    });
  };

  // Lưu cấu hình vào localStorage
  const saveCalibration = () => {
    if (!isCalibratableLayer(activePlanningLayer)) {
      alert('Lớp GeoJSON vector đã có tọa độ chuẩn GPS, không cần lưu căn chỉnh!');
      return;
    }
    try {
      localStorage.setItem('guland_calib_coords', JSON.stringify(layerCoords));
      alert(`Đã lưu thành công tọa độ căn chỉnh cho lớp "${getLayerName(activePlanningLayer)}"!`);
    } catch (e) {
      alert('Không thể lưu vào trình duyệt: ' + e);
    }
  };

  // Khôi phục mặc định
  const resetCalibration = () => {
    if (!isCalibratableLayer(activePlanningLayer)) return;
    if (confirm(`Bạn có chắc muốn khôi phục tọa độ mặc định ban đầu cho lớp "${getLayerName(activePlanningLayer)}"?`)) {
      const def = DEFAULT_COORDS[activePlanningLayer];
      setLayerCoords(prev => ({
        ...prev,
        [activePlanningLayer]: def
      }));
      updateSourceCoordinates(activePlanningLayer, def);
      try {
        const saved = JSON.parse(localStorage.getItem('guland_calib_coords') || '{}');
        delete saved[activePlanningLayer];
        localStorage.setItem('guland_calib_coords', JSON.stringify(saved));
      } catch (e) {}
    }
  };

  // Sao chép tọa độ
  const copyCoords = () => {
    if (!isCalibratableLayer(activePlanningLayer)) return;
    const text = JSON.stringify(layerCoords[activePlanningLayer], null, 2);
    navigator.clipboard.writeText(text);
    alert('Đã sao chép mảng tọa độ vào Clipboard! Bạn có thể gửi lại cho chúng tôi để cập nhật cố định.');
  };

  useEffect(() => {
    if (searchLocation && mapRef.current) {
      mapRef.current.flyTo({ center: [searchLocation[1], searchLocation[0]], zoom: 16, duration: 2000 });
    }
  }, [searchLocation]);

  const geojson = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: properties.filter(p => p.lat && p.lng).map(p => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { ...p }
      }))
    };
  }, [properties]);

  const activeInteractiveLayers = useMemo(() => {
    const ids: string[] = [];
    if (opacityTo40 > 0) ids.push('cadastre-40-fill');
    if (opacityKhuVuc1Vector > 0) ids.push('khuvuc1-vector-fill');
    if (opacityPk32 > 0) ids.push('pk32-dienkhanh-fill');
    if (opacityPk3 > 0) ids.push('pk3-vector-fill');
    if (opacityQhcCamLamGtSat > 0) ids.push('qhc-camlam-2045-gt-sat-line');
    if (opacityQhcCamLamGtBo > 0) ids.push('qhc-camlam-2045-gt-bo-line');
    if (opacityQhcCamLam2045 > 0) ids.push('qhc-camlam-2045-fill');
    if (opacityCamHaiTaySdd > 0) ids.push('camhaitay-1500-fill');
    if (opacityTd22330 > 0) ids.push('cadastre-td22330-fill');
    return ids;
  }, [opacityTo40, opacityKhuVuc1Vector, opacityPk32, opacityPk3, opacityQhcCamLamGtSat, opacityQhcCamLamGtBo, opacityQhcCamLam2045, opacityCamHaiTaySdd, opacityTd22330]);

  const defaultCenter = properties.length > 0 && properties[0].lat && properties[0].lng
    ? { longitude: properties[0].lng, latitude: properties[0].lat }
    : { longitude: 109.125, latitude: 12.085 }; // Mặc định trung tâm QHC Cam Lâm 2045

  if (!mounted) return <div className="h-full w-full bg-gray-100 flex items-center justify-center">Đang tải bản đồ 3D...</div>;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const getActiveOpacity = () => {
    switch (activePlanningLayer) {
      case '2045': return opacity2045;
      case '2030': return opacity2030;
      case 'khuvuc1': return opacityKhuVuc1;
      case 'docduong34': return opacityDocDuong34;
      case 'dc21': return opacityDc21;
      case 'to40': return opacityTo40;
      case 'khuvuc1_vector': return opacityKhuVuc1Vector;
      case 'camtan_1500': return opacityCamTan1500;
      case 'camtan_webp': return opacityCamTanWebp;
      case 'pk32_dienkhanh': return opacityPk32;
      case 'pk3_vector': return opacityPk3;
      case 'qhc_camlam_2045': return opacityQhcCamLam2045;
      case 'camlam_2030': return opacityCamlam2030;
      case 'qhc_camlam_2045_gt_bo': return opacityQhcCamLamGtBo;
      case 'qhc_camlam_2045_gt_sat': return opacityQhcCamLamGtSat;
      case 'camhaitay_sdd': return opacityCamHaiTaySdd;
      case 'camhaitay_gt': return opacityCamHaiTayGt;
      case 'td_22330': return opacityTd22330;
      default: return opacity2030;
    }
  };

  const setActiveOpacity = (val: number) => {
    switch (activePlanningLayer) {
      case '2045': setOpacity2045(val); break;
      case '2030': setOpacity2030(val); break;
      case 'khuvuc1': setOpacityKhuVuc1(val); break;
      case 'docduong34': setOpacityDocDuong34(val); break;
      case 'dc21': setOpacityDc21(val); break;
      case 'to40': setOpacityTo40(val); break;
      case 'khuvuc1_vector': setOpacityKhuVuc1Vector(val); break;
      case 'camtan_1500': setOpacityCamTan1500(val); break;
      case 'camtan_webp': setOpacityCamTanWebp(val); break;
      case 'pk32_dienkhanh': setOpacityPk32(val); break;
      case 'pk3_vector': setOpacityPk3(val); break;
      case 'qhc_camlam_2045': setOpacityQhcCamLam2045(val); break;
      case 'camlam_2030': setOpacityCamlam2030(val); break;
      case 'qhc_camlam_2045_gt_bo': setOpacityQhcCamLamGtBo(val); break;
      case 'qhc_camlam_2045_gt_sat': setOpacityQhcCamLamGtSat(val); break;
      case 'camhaitay_sdd': setOpacityCamHaiTaySdd(val); break;
      case 'camhaitay_gt': setOpacityCamHaiTayGt(val); break;
      case 'td_22330': setOpacityTd22330(val); break;
    }
  };

  // Hàm chuyển tab trên thanh so sánh ngang:
  // Giữ nguyên độ mờ (opacity) của các tấm bản đồ đang bật để có thể chồng mờ nhiều tấm lên nhau và kéo riêng từng tấm!
  const handleSelectPlanningTab = (layer: PlanningLayerType) => {
    setActivePlanningLayer(layer);

    // Nếu tấm bản đồ được chọn đang tắt (0%), bật nhẹ lên (75%) để người dùng kéo chỉnh độ mờ chồng lớp ngay
    switch (layer) {
      case '2045': if (opacity2045 === 0) setOpacity2045(0.75); break;
      case '2030': if (opacity2030 === 0) setOpacity2030(0.75); break;
      case 'khuvuc1': if (opacityKhuVuc1 === 0) setOpacityKhuVuc1(0.75); break;
      case 'docduong34': if (opacityDocDuong34 === 0) setOpacityDocDuong34(0.75); break;
      case 'dc21': if (opacityDc21 === 0) setOpacityDc21(0.75); break;
      case 'to40': if (opacityTo40 === 0) setOpacityTo40(0.85); break;
      case 'khuvuc1_vector': if (opacityKhuVuc1Vector === 0) setOpacityKhuVuc1Vector(0.8); break;
      case 'camtan_1500': if (opacityCamTan1500 === 0) setOpacityCamTan1500(0.85); break;
      case 'camtan_webp': if (opacityCamTanWebp === 0) setOpacityCamTanWebp(0.85); break;
      case 'pk32_dienkhanh': if (opacityPk32 === 0) setOpacityPk32(0.85); break;
      case 'pk3_vector': if (opacityPk3 === 0) setOpacityPk3(0.85); break;
      case 'qhc_camlam_2045': if (opacityQhcCamLam2045 === 0) setOpacityQhcCamLam2045(0.75); break;
      case 'camlam_2030': if (opacityCamlam2030 === 0) setOpacityCamlam2030(0.85); break;
      case 'qhc_camlam_2045_gt_bo': if (opacityQhcCamLamGtBo === 0) setOpacityQhcCamLamGtBo(1); break;
      case 'qhc_camlam_2045_gt_sat': if (opacityQhcCamLamGtSat === 0) setOpacityQhcCamLamGtSat(1); break;
      case 'camhaitay_sdd': if (opacityCamHaiTaySdd === 0) setOpacityCamHaiTaySdd(0.75); break;
      case 'camhaitay_gt': if (opacityCamHaiTayGt === 0) setOpacityCamHaiTayGt(0.9); break;
      case 'td_22330': if (opacityTd22330 === 0) setOpacityTd22330(0.65); break;
    }

    // Tự động bay đến đúng tâm và đúng mức zoom tương ứng
    switch (layer) {
      case '2045':
      case '2030':
        mapRef.current?.flyTo({ center: [109.135, 11.91], zoom: 12.5, duration: 1500 });
        break;
      case 'khuvuc1':
        mapRef.current?.flyTo({ center: [109.1648, 11.9381], zoom: 13, duration: 1500 });
        break;
      case 'docduong34':
        mapRef.current?.flyTo({ center: [109.1547, 11.9134], zoom: 16.5, duration: 1500 });
        break;
      case 'dc21':
        mapRef.current?.flyTo({ center: [109.1526, 11.9132], zoom: 17.5, duration: 1500 });
        break;
      case 'to40':
        mapRef.current?.flyTo({ center: [109.07435, 11.97525], zoom: 16.5, duration: 1500 });
        break;
      case 'khuvuc1_vector':
        mapRef.current?.flyTo({ center: [109.1669, 11.9304], zoom: 14.5, duration: 1500 });
        break;
      case 'camtan_1500':
      case 'camtan_webp': {
        // Nếu người dùng đang đứng sẵn trong khu vực Cam Tân để so sánh PA1 và PA2 thì giữ nguyên vị trí & độ zoom!
        const center = mapRef.current?.getCenter();
        const inCamTan = center && center.lat > 12.09 && center.lat < 12.15 && center.lng > 109.08 && center.lng < 109.13;
        if (!inCamTan) {
          mapRef.current?.flyTo({ center: [109.1035, 12.1217], zoom: 15.2, duration: 1500 });
        }
        break;
      }
      case 'pk32_dienkhanh':
        mapRef.current?.flyTo({ center: [109.06155, 12.26125], zoom: 14.5, duration: 1500 });
        break;
      case 'pk3_vector':
        mapRef.current?.flyTo({ center: [109.10235, 12.15651], zoom: 12.6, duration: 1500 });
        break;
      case 'qhc_camlam_2045':
      case 'camlam_2030':
      case 'qhc_camlam_2045_gt_bo':
      case 'qhc_camlam_2045_gt_sat': {
        const center = mapRef.current?.getCenter();
        const inCamLam = center && center.lat > 11.93 && center.lat < 12.22 && center.lng > 108.94 && center.lng < 109.23;
        if (!inCamLam) {
          mapRef.current?.flyTo({ center: [109.135, 12.085], zoom: 13.2, duration: 1500 });
        }
        break;
      }
      case 'camhaitay_sdd':
      case 'camhaitay_gt':
      case 'td_22330': {
        const center = mapRef.current?.getCenter();
        const inCamHaiTay = center && center.lat > 12.04 && center.lat < 12.16 && center.lng > 109.08 && center.lng < 109.20;
        if (!inCamHaiTay) {
          mapRef.current?.flyTo({ center: [109.14082, 12.10621], zoom: layer === 'td_22330' ? 16.0 : 15.4, duration: 1500 });
        }
        break;
      }
    }
  };

  const flyToActive = () => {
    switch (activePlanningLayer) {
      case '2045':
      case '2030':
        mapRef.current?.flyTo({ center: [109.135, 11.91], zoom: 12.5, duration: 2000 });
        break;
      case 'khuvuc1':
        mapRef.current?.flyTo({ center: [109.1648, 11.9381], zoom: 13, duration: 2000 });
        break;
      case 'docduong34':
        mapRef.current?.flyTo({ center: [109.1547, 11.9134], zoom: 16.5, duration: 2000 });
        break;
      case 'dc21':
        mapRef.current?.flyTo({ center: [109.1526, 11.9132], zoom: 17.5, duration: 2000 });
        break;
      case 'to40':
        mapRef.current?.flyTo({ center: [109.07435, 11.97525], zoom: 16.5, duration: 2000 });
        break;
      case 'khuvuc1_vector':
        mapRef.current?.flyTo({ center: [109.1669, 11.9304], zoom: 14.5, duration: 2000 });
        break;
      case 'camtan_1500':
      case 'camtan_webp':
        mapRef.current?.flyTo({ center: [109.1035, 12.1217], zoom: 15.2, duration: 2000 });
        break;
      case 'pk32_dienkhanh':
        mapRef.current?.flyTo({ center: [109.06155, 12.26125], zoom: 14.5, duration: 2000 });
        break;
      case 'pk3_vector':
        mapRef.current?.flyTo({ center: [109.10235, 12.15651], zoom: 12.6, duration: 2000 });
        break;
      case 'camhaitay_sdd':
      case 'camhaitay_gt':
        mapRef.current?.flyTo({ center: [109.14082, 12.10621], zoom: 15.4, duration: 2000 });
        break;
      case 'td_22330':
        mapRef.current?.flyTo({ center: [109.14082, 12.10621], zoom: 16.0, duration: 2000 });
        break;
      case 'qhc_camlam_2045':
      case 'camlam_2030':
      case 'qhc_camlam_2045_gt_bo':
      case 'qhc_camlam_2045_gt_sat':
        mapRef.current?.flyTo({ center: [109.135, 12.085], zoom: 13.0, duration: 2000 });
        break;
    }
  };

  const handleMapClick = (e: any) => {
    if (measureMode !== 'none') return;
    const features = e.features;
    if (features && features.length > 0) {
      // 1. Thửa đất địa chính (Tờ 40 Cam An Nam hoặc Địa chính Cam Hải Tây TD_22330)
      const parcel = features.find((f: any) => f.layer.id === 'cadastre-40-fill' || f.layer.id === 'cadastre-td22330-fill');
      const overlappingZone = features.find((f: any) => f.layer.id === 'camhaitay-1500-fill' || f.layer.id === 'qhc-camlam-2045-fill' || f.layer.id === 'khuvuc1-vector-fill' || f.layer.id === 'pk32-dienkhanh-fill' || f.layer.id === 'pk3-vector-fill');
      if (parcel) {
        setSelectedPlanningZone(null);
        setParcelAnalysis(null);
        setShowRemainingCoords(false);
        setCopiedCoords(false);
        const pProps = parcel.properties || {};
        const isTd22330 = parcel.layer.id === 'cadastre-td22330-fill';
        const soThua = isTd22330 ? pProps.th : pProps.SHTHUA;
        const soTo = isTd22330 ? pProps.t : (pProps.SHBANDO || '40');
        const dienTich = Number((isTd22330 ? pProps.dt : pProps.DIENTICH) || 0);

        setSelectedParcel({
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
          properties: {
            ...pProps,
            _sourceLayer: parcel.layer.id,
            _planningZone: overlappingZone ? overlappingZone.properties : null
          }
        });

        setIsAnalyzingParcel(true);
        analyzeParcelWithPlanning(soTo, soThua, dienTich, parcel.geometry)
          .then((res) => {
            setParcelAnalysis(res);
          })
          .finally(() => {
            setIsAnalyzingParcel(false);
          });
        return;
      }
      // 2. Tuyến giao thông đường sắt / đường bộ hoặc Ô quy hoạch Vector
      const zone = features.find((f: any) =>
        f.layer.id === 'qhc-camlam-2045-gt-sat-line' ||
        f.layer.id === 'qhc-camlam-2045-gt-bo-line' ||
        f.layer.id === 'camhaitay-1500-fill' ||
        f.layer.id === 'qhc-camlam-2045-fill' ||
        f.layer.id === 'khuvuc1-vector-fill' ||
        f.layer.id === 'pk32-dienkhanh-fill' ||
        f.layer.id === 'pk3-vector-fill'
      );
      if (zone) {
        setSelectedParcel(null);
        setSelectedPlanningZone({
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
          properties: {
            ...zone.properties,
            _sourceLayer: zone.layer.id
          }
        });
        return;
      }
    }
  };

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        initialViewState={{
          ...defaultCenter,
          zoom: 12.6
        }}
        mapStyle={BASE_MAP_STYLE}
        interactiveLayerIds={activeInteractiveLayers}
        onClick={handleMapClick}
        onMouseEnter={() => {
          if (measureMode === 'none' && mapRef.current) {
            mapRef.current.getCanvas().style.cursor = 'pointer';
          }
        }}
        onMouseLeave={() => {
          if (measureMode === 'none' && mapRef.current) {
            mapRef.current.getCanvas().style.cursor = '';
          }
        }}
        style={{ width: '100%', height: '100%', cursor: measureMode !== 'none' ? 'crosshair' : 'grab' }}
      >
        <NavigationControl position="bottom-right" />

        {/* Marker vị trí hiện tại của người dùng */}
        {userPos && (
          <>
            <Marker longitude={userPos[0]} latitude={userPos[1]} anchor="center">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-12 h-12 bg-blue-500 rounded-full opacity-20 animate-ping"></div>
                <div className="relative w-4 h-4 bg-blue-600 border-2 border-white rounded-full shadow-md"></div>
              </div>
            </Marker>
            <Popup longitude={userPos[0]} latitude={userPos[1]} anchor="bottom" offset={15} closeButton={false} closeOnClick={false}>
              <span className="font-bold text-blue-700 text-xs">Bạn đang ở đây</span>
            </Popup>
          </>
        )}

        {/* Nút định vị tùy chỉnh (góc dưới bên phải, trên cụm zoom) */}
        <div className="absolute bottom-32 right-2 z-[500]">
          <button 
            onClick={() => locateUser(false)}
            disabled={isLocating}
            className="w-10 h-10 bg-white text-blue-600 rounded-lg shadow-md border border-gray-200 hover:bg-gray-50 flex items-center justify-center transition-colors disabled:opacity-70"
            title="Đến vị trí của tôi"
          >
            {isLocating ? (
              <span className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></span>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
              </svg>
            )}
          </button>
        </div>

        {/* Lớp Bản đồ Đường phố OSM (Giao thông / Đường xá) */}
        <Source 
          id="osm-streets" 
          type="raster" 
          tiles={OSM_TILES} 
          tileSize={256} 
          maxzoom={19}
        >
          <Layer 
            id="osm-layer" 
            type="raster"
            layout={{ visibility: streetMapOpacity > 0 ? 'visible' : 'none' }}
            paint={{ 
              'raster-opacity': streetMapOpacity,
              'raster-fade-duration': 0 
            }} 
          />
        </Source>

        {/* 1. Lớp Bản đồ Quy hoạch Chung TP Cam Ranh 2045 (1/10.000) */}
        <Source 
          id="planning-cam-ranh-2045" 
          type="image" 
          url="/Map/cam_ranh_2045.webp"
          coordinates={layerCoords['2045']}
        >
          <Layer 
            id="planning-layer-2045" 
            type="raster"
            layout={{ visibility: opacity2045 > 0 ? 'visible' : 'none' }}
            paint={{ 
              'raster-opacity': opacity2045,
              'raster-fade-duration': 0
            }} 
          />
        </Source>

        {/* 2. Lớp Bản đồ Kế hoạch Sử dụng đất 2030 (1/25.000) */}
        <Source 
          id="planning-cam-ranh-2030" 
          type="image" 
          url="/Map/cam_ranh_2030.webp"
          coordinates={layerCoords['2030']}
        >
          <Layer 
            id="planning-layer-2030" 
            type="raster"
            layout={{ visibility: opacity2030 > 0 ? 'visible' : 'none' }}
            paint={{ 
              'raster-opacity': opacity2030,
              'raster-fade-duration': 0
            }} 
          />
        </Source>

        {/* 3. Lớp Bản đồ Quy hoạch Phân khu 1/2000 Khu vực 1 Cam Ranh */}
        <Source 
          id="planning-khuvuc1" 
          type="image" 
          url="/Map/khuvuc1_camranh.webp"
          coordinates={layerCoords['khuvuc1']}
        >
          <Layer 
            id="planning-layer-khuvuc1" 
            type="raster"
            layout={{ visibility: opacityKhuVuc1 > 0 ? 'visible' : 'none' }}
            paint={{ 
              'raster-opacity': opacityKhuVuc1,
              'raster-fade-duration': 0
            }} 
          />
        </Source>

        {/* 4. Lớp Bản đồ Quy hoạch Chi tiết 1/500 Dọc đường 3 Tháng 4 */}
        <Source 
          id="planning-docduong34" 
          type="image" 
          url="/Map/docduong_3thang4.webp"
          coordinates={layerCoords['docduong34']}
        >
          <Layer 
            id="planning-layer-docduong34" 
            type="raster"
            layout={{ visibility: opacityDocDuong34 > 0 ? 'visible' : 'none' }}
            paint={{ 
              'raster-opacity': opacityDocDuong34,
              'raster-fade-duration': 0
            }} 
          />
        </Source>

        {/* 5. Lớp Bản đồ Địa chính 1/500 Tờ số 21 Cam Thuận */}
        <Source 
          id="planning-dc21" 
          type="image" 
          url="/Map/dc21_map.webp"
          coordinates={layerCoords['dc21']}
        >
          <Layer 
            id="planning-layer-dc21" 
            type="raster"
            layout={{ visibility: opacityDc21 > 0 ? 'visible' : 'none' }}
            paint={{ 
              'raster-opacity': opacityDc21,
              'raster-fade-duration': 0
            }} 
          />
        </Source>

        {/* 6. Lớp Bản đồ Địa chính Vector Tờ 40 Cam An Nam (389 thửa - GeoJSON) */}
        <Source id="cadastre-to40" type="geojson" data="/Map/1111111111.geojson">
          {/* Lớp Fill tô màu phân loại đất */}
          <Layer 
            id="cadastre-40-fill" 
            type="fill"
            layout={{ visibility: opacityTo40 > 0 ? 'visible' : 'none' }}
            paint={{ 
              'fill-color': [
                'match',
                ['get', 'KHLOAIDAT'],
                'ONT', '#f43f5e',
                'ONT+LNQ', '#fb7185',
                'ONT+CLN', '#f472b6',
                'ONT+BHK', '#f472b6',
                'CLN', '#f59e0b',
                'BHK', '#eab308',
                'HNK', '#facc15',
                'LUK', '#84cc16',
                'LUC', '#a3e635',
                'BCS', '#94a3b8',
                'DGT', '#64748b',
                'DTL', '#0284c7',
                'SON', '#38bdf8',
                'TSC', '#8b5cf6',
                'SKC', '#a855f7',
                'CSD', '#6366f1',
                '#e2e8f0'
              ],
              'fill-opacity': opacityTo40 * 0.65
            }} 
          />
          {/* Lớp Viền ranh thửa đất sắc nét */}
          <Layer 
            id="cadastre-40-line" 
            type="line"
            layout={{ visibility: opacityTo40 > 0 ? 'visible' : 'none' }}
            paint={{ 
              'line-color': '#dc2626',
              'line-width': [
                'interpolate', ['linear'], ['zoom'],
                14, 0.8,
                17, 1.8,
                20, 2.5
              ],
              'line-opacity': opacityTo40 > 0 ? 0.95 : 0
            }} 
          />
          {/* Lớp Nhãn hiển thị Số thửa & Loại đất */}
          <Layer 
            id="cadastre-40-label" 
            type="symbol" 
            minzoom={16}
            layout={{
              visibility: opacityTo40 > 0 ? 'visible' : 'none',
              'text-font': ['Noto Sans Regular'],
              'text-field': [
                'concat',
                ['to-string', ['get', 'SHTHUA']],
                '\n',
                ['to-string', ['get', 'KHLOAIDAT']]
              ],
              'text-size': [
                'interpolate', ['linear'], ['zoom'],
                16, 9,
                18, 12,
                20, 14
              ],
              'text-anchor': 'center',
              'text-allow-overlap': false
            }}
            paint={{ 
              'text-color': '#0f172a',
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.5,
              'text-opacity': opacityTo40 > 0 ? 0.95 : 0
            }} 
          />
        </Source>

        {/* 7. Lớp Bản đồ Quy hoạch Phân khu 1 Cam Ranh (1.472 ô quy hoạch - GeoJSON Vector) */}
        <Source id="khuvuc1-vector" type="geojson" data="/Map/khuvuc1_camranh_vector.geojson">
          {/* Lớp Fill tô màu quy hoạch chức năng đất */}
          <Layer 
            id="khuvuc1-vector-fill" 
            type="fill"
            layout={{ visibility: opacityKhuVuc1Vector > 0 ? 'visible' : 'none' }}
            paint={{ 
              'fill-color': ['get', 'MauSac'], 
              'fill-opacity': opacityKhuVuc1Vector 
            }} 
          />
          {/* Lớp Viền ranh giới quy hoạch */}
          <Layer 
            id="khuvuc1-vector-line" 
            type="line"
            layout={{ visibility: opacityKhuVuc1Vector > 0 ? 'visible' : 'none' }}
            paint={{ 
              'line-color': '#ffffff', 
              'line-width': [
                'interpolate', ['linear'], ['zoom'],
                12, 0.5,
                15, 1.2,
                18, 2.0
              ],
              'line-opacity': opacityKhuVuc1Vector > 0 ? 0.85 : 0 
            }} 
          />
        </Source>

        {/* 8. Lớp Bản đồ Quy hoạch 1/500 Cam Tân - PA2 (Multi-tile Pyramid z12..z18 siêu nét) */}
        <Source
          id="planning-camtan-1500"
          type="raster"
          tiles={CAMTAN_TILES}
          tileSize={512}
          minzoom={12}
          maxzoom={18}
          bounds={CAMTAN_BOUNDS}
        >
          <Layer
            id="planning-layer-camtan-1500"
            type="raster"
            layout={{ visibility: opacityCamTan1500 > 0 ? 'visible' : 'none' }}
            paint={{
              'raster-opacity': opacityCamTan1500,
              'raster-fade-duration': 0,
              'raster-resampling': 'linear'
            }}
          />
        </Source>

        {/* 9. Lớp Bản đồ Quy hoạch 1/500 Cam Tân - PA1 (Ảnh ghép đơn .webp 5808x8192) */}
        <Source
          id="planning-camtan-webp"
          type="image"
          url="/Map/camtan_1500.webp"
          coordinates={layerCoords['camtan_webp']}
        >
          <Layer
            id="planning-layer-camtan-webp"
            type="raster"
            layout={{ visibility: opacityCamTanWebp > 0 ? 'visible' : 'none' }}
            paint={{
              'raster-opacity': opacityCamTanWebp,
              'raster-fade-duration': 0
            }}
          />
        </Source>

        {/* 10. Lớp Bản đồ Quy hoạch Phân khu 3.2 Diên Khánh (638 ô quy hoạch - GeoJSON Vector) */}
        <Source id="pk32-dienkhanh" type="geojson" data="/Map/phankhu32_dienkhanh.geojson">
          <Layer
            id="pk32-dienkhanh-fill"
            type="fill"
            layout={{ visibility: opacityPk32 > 0 ? 'visible' : 'none' }}
            paint={{
              'fill-color': ['get', 'MauSac'],
              'fill-opacity': opacityPk32
            }}
          />
          <Layer
            id="pk32-dienkhanh-line"
            type="line"
            layout={{ visibility: opacityPk32 > 0 ? 'visible' : 'none' }}
            paint={{
              'line-color': '#ffffff',
              'line-width': [
                'interpolate', ['linear'], ['zoom'],
                12, 0.5,
                15, 1.2,
                18, 2.2
              ],
              'line-opacity': opacityPk32 > 0 ? 0.9 : 0
            }}
          />
          <Layer
            id="pk32-dienkhanh-label"
            type="symbol"
            minzoom={15.5}
            layout={{
              visibility: opacityPk32 > 0 ? 'visible' : 'none',
              'text-font': ['Noto Sans Regular'],
              'text-field': ['get', 'TenQuyHoach'],
              'text-size': [
                'interpolate', ['linear'], ['zoom'],
                15.5, 9,
                18, 12
              ],
              'text-anchor': 'center',
              'text-allow-overlap': false
            }}
            paint={{
              'text-color': '#0f172a',
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.5,
              'text-opacity': opacityPk32 > 0 ? 0.9 : 0
            }}
          />
        </Source>

        {/* 11. Lớp Bản đồ Quy hoạch Phân khu 3 (1.407 ô quy hoạch - GeoJSON Vector) */}
        <Source id="pk3-vector" type="geojson" data="/Map/phankhu3_vector.geojson">
          <Layer
            id="pk3-vector-fill"
            type="fill"
            layout={{ visibility: opacityPk3 > 0 ? 'visible' : 'none' }}
            paint={{
              'fill-color': ['get', 'MauSac'],
              'fill-opacity': opacityPk3
            }}
          />
          <Layer
            id="pk3-vector-line"
            type="line"
            layout={{ visibility: opacityPk3 > 0 ? 'visible' : 'none' }}
            paint={{
              'line-color': '#ffffff',
              'line-width': [
                'interpolate', ['linear'], ['zoom'],
                11, 0.4,
                15, 1.1,
                18, 2.0
              ],
              'line-opacity': opacityPk3 > 0 ? 0.88 : 0
            }}
          />
          <Layer
            id="pk3-vector-label"
            type="symbol"
            minzoom={15}
            layout={{
              visibility: opacityPk3 > 0 ? 'visible' : 'none',
              'text-font': ['Noto Sans Regular'],
              'text-field': ['get', 'TenQuyHoach'],
              'text-size': [
                'interpolate', ['linear'], ['zoom'],
                15, 9,
                18, 12
              ],
              'text-anchor': 'center',
              'text-allow-overlap': false
            }}
            paint={{
              'text-color': '#0f172a',
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.5,
              'text-opacity': opacityPk3 > 0 ? 0.9 : 0
            }}
          />
        </Source>

        {/* 12A. Lớp Bản đồ Địa chính Cam Hải Tây - TD 22330 (83.509 thửa đất - GeoJSON Vector) */}
        <Source
          id="cadastre-td22330"
          type="geojson"
          data="/Map/td_22330_camhaitay.geojson"
          maxzoom={18}
          tolerance={0.35}
        >
          {/* Lớp Fill trong suốt (không tô màu ô đất, chỉ giữ vùng tương tác để click xem thông tin thửa) */}
          <Layer
            id="cadastre-td22330-fill"
            type="fill"
            minzoom={12}
            layout={{ visibility: opacityTd22330 > 0 ? 'visible' : 'none' }}
            paint={{
              'fill-color': '#0077ff',
              'fill-opacity': 0.01
            }}
          />
          {/* Lớp Viền ranh giới thửa đất: đường kẻ mảnh màu xanh dương */}
          <Layer
            id="cadastre-td22330-line"
            type="line"
            minzoom={12}
            layout={{ visibility: opacityTd22330 > 0 ? 'visible' : 'none' }}
            paint={{
              'line-color': '#0077ff',
              'line-width': [
                'interpolate', ['linear'], ['zoom'],
                12, 0.3,
                14, 0.5,
                16, 0.75,
                18, 1.0,
                20, 1.25
              ],
              'line-opacity': opacityTd22330
            }}
          />
          {/* Lớp Nhãn Số thửa + Loại đất (+ Tên chủ khi zoom sát >= 17.8) */}
          <Layer
            id="cadastre-td22330-label"
            type="symbol"
            minzoom={16.2}
            layout={{
              visibility: opacityTd22330 > 0 ? 'visible' : 'none',
              'text-font': ['Noto Sans Regular'],
              'text-field': [
                'step',
                ['zoom'],
                [
                  'concat',
                  ['to-string', ['get', 'th']],
                  '\n',
                  ['get', 'ld']
                ],
                17.8,
                [
                  'case',
                  ['!=', ['get', 'tc'], ''],
                  [
                    'concat',
                    ['to-string', ['get', 'th']],
                    ' (',
                    ['get', 'ld'],
                    ')\n',
                    ['get', 'tc']
                  ],
                  [
                    'concat',
                    ['to-string', ['get', 'th']],
                    '\n',
                    ['get', 'ld']
                  ]
                ]
              ],
              'text-size': [
                'interpolate', ['linear'], ['zoom'],
                16.2, 9,
                18, 11,
                20, 13
              ],
              'text-anchor': 'center',
              'text-allow-overlap': false
            }}
            paint={{
              'text-color': '#0f172a',
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.6,
              'text-opacity': opacityTd22330
            }}
          />
        </Source>

        {/* 11A. Lớp Bản đồ Điều chỉnh Quy hoạch Sử dụng đất đến năm 2030 huyện Cam Lâm (WebP 8K trích xuất từ KMZ L5) */}
        <Source
          id="planning-camlam-2030"
          type="image"
          url="/Map/dc_qhsdd_2030_camlam.webp"
          coordinates={layerCoords['camlam_2030']}
        >
          <Layer
            id="planning-layer-camlam-2030"
            type="raster"
            layout={{ visibility: opacityCamlam2030 > 0 ? 'visible' : 'none' }}
            paint={{
              'raster-opacity': opacityCamlam2030,
              'raster-fade-duration': 0
            }}
          />
        </Source>

        {/* 11B. Lớp Bản đồ Quy hoạch Chung Đô thị mới Cam Lâm đến năm 2045 (1.438 ô quy hoạch - QĐ 205/QĐ-TTg) */}
        <Source id="qhc-camlam-2045" type="geojson" data="/Map/qhc_camlam_2045.geojson?v=qhc10k" tolerance={0.3}>
          <Layer
            id="qhc-camlam-2045-fill"
            type="fill"
            layout={{ visibility: opacityQhcCamLam2045 > 0 ? 'visible' : 'none' }}
            paint={{
              'fill-color': ['get', 'MauSac'],
              'fill-opacity': opacityQhcCamLam2045
            }}
          />
          <Layer
            id="qhc-camlam-2045-line"
            type="line"
            layout={{ visibility: opacityQhcCamLam2045 > 0 ? 'visible' : 'none' }}
            paint={{
              'line-color': '#ffffff',
              'line-width': [
                'interpolate', ['linear'], ['zoom'],
                11, 0.4,
                14, 1.0,
                17, 1.8
              ],
              'line-opacity': opacityQhcCamLam2045
            }}
          />
          <Layer
            id="qhc-camlam-2045-label"
            type="symbol"
            minzoom={13.5}
            layout={{
              visibility: opacityQhcCamLam2045 > 0 ? 'visible' : 'none',
              'text-font': ['Noto Sans Regular'],
              'text-field': ['get', 'TenQuyHoach'],
              'text-size': [
                'interpolate', ['linear'], ['zoom'],
                13.5, 9.5,
                16, 11.5,
                18, 13
              ],
              'text-anchor': 'center',
              'text-allow-overlap': false
            }}
            paint={{
              'text-color': '#0f172a',
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.8,
              'text-opacity': opacityQhcCamLam2045
            }}
          />
        </Source>

        {/* 11C. Lớp Mạng lưới Giao thông Đường bộ - QHC Cam Lâm 2045 (32.252 đoạn - maHTML QHC10k) */}
        <Source id="qhc-camlam-2045-gt-bo" type="geojson" data="/Map/qhc_camlam_2045_gt_duongbo.geojson" tolerance={0.3}>
          <Layer
            id="qhc-camlam-2045-gt-bo-line"
            type="line"
            layout={{ visibility: opacityQhcCamLamGtBo > 0 ? 'visible' : 'none' }}
            paint={{
              'line-color': ['get', 'MauSac'],
              'line-width': [
                'interpolate', ['linear'], ['zoom'],
                11, 0.5,
                13, [
                  'match', ['get', 'phanLoai'],
                  'HTKT_GT_Timduong', 1.2,
                  0.9
                ],
                16, [
                  'match', ['get', 'phanLoai'],
                  'HTKT_GT_Timduong', 2.2,
                  1.6
                ],
                19, [
                  'match', ['get', 'phanLoai'],
                  'HTKT_GT_Timduong', 3.2,
                  2.5
                ]
              ],
              'line-opacity': opacityQhcCamLamGtBo
            }}
          />
        </Source>

        {/* 11D. Lớp Mạng lưới Giao thông Đường sắt - QHC Cam Lâm 2045 (684 đoạn - maHTML QHC10k) */}
        <Source id="qhc-camlam-2045-gt-sat" type="geojson" data="/Map/qhc_camlam_2045_gt_duongsat.geojson" tolerance={0.2}>
          <Layer
            id="qhc-camlam-2045-gt-sat-line"
            type="line"
            layout={{ visibility: opacityQhcCamLamGtSat > 0 ? 'visible' : 'none' }}
            paint={{
              'line-color': ['get', 'MauSac'],
              'line-width': [
                'interpolate', ['linear'], ['zoom'],
                11, 1.4,
                14, 2.2,
                17, 3.4,
                19, 4.5
              ],
              'line-opacity': opacityQhcCamLamGtSat
            }}
          />
        </Source>

        {/* 12. Lớp Bản đồ Quy hoạch Sử dụng đất 1/500 Cam Hải Tây (282 ô quy hoạch - GeoJSON Vector) */}
        <Source id="camhaitay-1500-sdd" type="geojson" data="/Map/camhaitay_1500_sdd.geojson">
          <Layer
            id="camhaitay-1500-fill"
            type="fill"
            layout={{ visibility: opacityCamHaiTaySdd > 0 ? 'visible' : 'none' }}
            paint={{
              'fill-color': ['get', 'MauSac'],
              'fill-opacity': opacityCamHaiTaySdd
            }}
          />
          <Layer
            id="camhaitay-1500-line"
            type="line"
            layout={{ visibility: opacityCamHaiTaySdd > 0 ? 'visible' : 'none' }}
            paint={{
              'line-color': '#fef08a',
              'line-width': [
                'interpolate', ['linear'], ['zoom'],
                13, 0.8,
                16, 1.8,
                19, 2.8
              ],
              'line-opacity': opacityCamHaiTaySdd
            }}
          />
          <Layer
            id="camhaitay-1500-label"
            type="symbol"
            minzoom={15.0}
            maxzoom={17.0}
            layout={{
              visibility: opacityCamHaiTaySdd > 0 ? 'visible' : 'none',
              'text-font': ['Noto Sans Regular'],
              'text-field': ['get', 'TenQuyHoach'],
              'text-size': [
                'interpolate', ['linear'], ['zoom'],
                15.0, 9.5,
                16.8, 11.5
              ],
              'text-anchor': 'center',
              'text-allow-overlap': false
            }}
            paint={{
              'text-color': '#0f172a',
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.8,
              'text-opacity': opacityCamHaiTaySdd
            }}
          />
        </Source>

        {/* 12B. Lớp Vòng tròn chỉ tiêu quy hoạch (Tem sử dụng đất - 247 vòng tròn từ vongtron.json) */}
        <Source id="camhaitay-vongtron" type="geojson" data="/Map/camhaitay_vongtron.geojson">
          {/* Viền nền tối bên dưới giúp vòng tròn nổi bật rõ trên mọi màu nền lô đất */}
          <Layer
            id="camhaitay-vongtron-casing"
            type="line"
            minzoom={14.5}
            layout={{ visibility: opacityCamHaiTaySdd > 0 ? 'visible' : 'none' }}
            paint={{
              'line-color': '#0f172a',
              'line-width': [
                'interpolate', ['linear'], ['zoom'],
                14.5, 1.6,
                16.5, 2.8,
                19, 4.2
              ],
              'line-opacity': opacityCamHaiTaySdd * 0.85
            }}
          />
          {/* Nét vẽ vòng tròn & thanh chia 6 ngăn chuẩn bản vẽ CAD */}
          <Layer
            id="camhaitay-vongtron-line"
            type="line"
            minzoom={14.5}
            layout={{ visibility: opacityCamHaiTaySdd > 0 ? 'visible' : 'none' }}
            paint={{
              'line-color': '#ffffff',
              'line-width': [
                'interpolate', ['linear'], ['zoom'],
                14.5, 0.8,
                16.5, 1.5,
                19, 2.4
              ],
              'line-opacity': opacityCamHaiTaySdd
            }}
          />
        </Source>

        {/* 12C. Lớp Nhãn chỉ tiêu quy hoạch bên trong Vòng tròn (1.293 nhãn từ nhan.json) */}
        <Source id="camhaitay-nhan" type="geojson" data="/Map/camhaitay_nhan.geojson">
          {/* Nhãn Ký hiệu lô đất ở ngăn trên cùng của vòng tròn (OHT-001, P-15, CX-15...) */}
          <Layer
            id="camhaitay-nhan-header"
            type="symbol"
            minzoom={15.2}
            filter={['==', ['get', 'hdr'], 1]}
            layout={{
              visibility: opacityCamHaiTaySdd > 0 ? 'visible' : 'none',
              'text-font': ['Noto Sans Regular'],
              'text-field': ['get', 't'],
              'text-size': [
                'interpolate', ['exponential', 1.55], ['zoom'],
                15.2, 8.5,
                17.0, ['*', ['max', ['get', 'h'], 1.1], 4.8],
                19.0, ['*', ['max', ['get', 'h'], 1.1], 9.2],
                21.0, ['*', ['max', ['get', 'h'], 1.1], 17.5]
              ],
              'text-anchor': 'center',
              'text-allow-overlap': ['step', ['zoom'], false, 16.8, true],
              'text-ignore-placement': ['step', ['zoom'], false, 16.8, true]
            }}
            paint={{
              'text-color': '#b91c1c',
              'text-halo-color': '#ffffff',
              'text-halo-width': 2.0,
              'text-opacity': opacityCamHaiTaySdd
            }}
          />
          {/* Nhãn các thông số Diện tích, Mật độ XD, Tầng cao, Hệ số SDĐ trong 4 ngăn dưới của vòng tròn */}
          <Layer
            id="camhaitay-nhan-values"
            type="symbol"
            minzoom={17.0}
            filter={['==', ['get', 'hdr'], 0]}
            layout={{
              visibility: opacityCamHaiTaySdd > 0 ? 'visible' : 'none',
              'text-font': ['Noto Sans Regular'],
              'text-field': ['get', 't'],
              'text-size': [
                'interpolate', ['exponential', 1.55], ['zoom'],
                17.0, ['*', ['max', ['get', 'h'], 1.0], 4.2],
                19.0, ['*', ['max', ['get', 'h'], 1.0], 8.2],
                21.0, ['*', ['max', ['get', 'h'], 1.0], 15.5]
              ],
              'text-anchor': 'center',
              'text-allow-overlap': true,
              'text-ignore-placement': true
            }}
            paint={{
              'text-color': '#0f172a',
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.8,
              'text-opacity': opacityCamHaiTaySdd
            }}
          />
        </Source>

        {/* 13. Lớp Bản đồ Mạng lưới Giao thông đường bộ 1/500 Cam Hải Tây (3.929 đoạn tuyến - GeoJSON Vector) */}
        <Source id="camhaitay-1500-gt" type="geojson" data="/Map/camhaitay_1500_gt.geojson">
          <Layer
            id="camhaitay-1500-gt-line"
            type="line"
            layout={{ visibility: opacityCamHaiTayGt > 0 ? 'visible' : 'none' }}
            paint={{
              'line-color': [
                'match',
                ['get', 'phanLoai'],
                'HTKT_GT_Timduong', '#ff1e1e',
                'HTKT_GT_Longduong', '#ffd000',
                'HTKT_GT_Heduong', '#00f5d4',
                'HTKT_GT_DuongHem1', '#38bdf8',
                '#ffffff'
              ],
              'line-width': [
                'interpolate', ['linear'], ['zoom'],
                13, 1.0,
                16, [
                  'match',
                  ['get', 'phanLoai'],
                  'HTKT_GT_Longduong', 2.4,
                  'HTKT_GT_Heduong', 1.8,
                  'HTKT_GT_Timduong', 1.6,
                  1.6
                ],
                19, [
                  'match',
                  ['get', 'phanLoai'],
                  'HTKT_GT_Longduong', 4.0,
                  'HTKT_GT_Heduong', 2.8,
                  'HTKT_GT_Timduong', 2.5,
                  2.5
                ]
              ],
              'line-opacity': opacityCamHaiTayGt
            }}
          />
        </Source>

        {/* 14. Lớp Highlight trực quan bóc tách Thửa đất sau khi trừ Quy hoạch Giao thông & 1/500 */}
        {selectedParcel && parcelAnalysis && (
          <Source
            id="selected-parcel-clip-highlight"
            type="geojson"
            data={parcelAnalysis.highlightGeoJSON as any}
          >
            <Layer
              id="selected-parcel-clip-fill"
              type="fill"
              paint={{
                'fill-color': [
                  'match',
                  ['get', 'partType'],
                  'remaining_buildable', '#10b981',
                  'remaining_public', '#f59e0b',
                  'traffic_cut', '#ef4444',
                  '#3b82f6'
                ],
                'fill-opacity': [
                  'match',
                  ['get', 'partType'],
                  'traffic_cut', 0.62,
                  0.48
                ]
              }}
            />
            <Layer
              id="selected-parcel-clip-line"
              type="line"
              paint={{
                'line-color': [
                  'match',
                  ['get', 'partType'],
                  'remaining_buildable', '#059669',
                  'remaining_public', '#d97706',
                  'traffic_cut', '#fef08a',
                  '#2563eb'
                ],
                'line-width': 2.6
              }}
            />
            <Layer
              id="selected-parcel-clip-label"
              type="symbol"
              minzoom={16}
              layout={{
                'text-font': ['Noto Sans Regular'],
                'text-field': ['get', 'label'],
                'text-size': 11,
                'text-anchor': 'center',
                'text-allow-overlap': true
              }}
              paint={{
                'text-color': '#ffffff',
                'text-halo-color': '#0f172a',
                'text-halo-width': 1.8
              }}
            />
          </Source>
        )}

        {/* Heatmap Layer */}
        {showHeatmap && (
          <Source id="properties-heatmap" type="geojson" data={geojson as any}>
            <Layer 
              id="heatmap"
              type="heatmap"
              paint={{
                'heatmap-weight': ['interpolate', ['linear'], ['get', 'price'], 0, 0, 10000000000, 1],
                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
                'heatmap-color': [
                  'interpolate', ['linear'], ['heatmap-density'],
                  0, 'rgba(33,102,172,0)',
                  0.2, 'rgb(103,169,207)',
                  0.4, 'rgb(209,229,240)',
                  0.6, 'rgb(253,219,199)',
                  0.8, 'rgb(239,138,98)',
                  1, 'rgb(178,24,43)'
                ],
                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 15, 20],
                'heatmap-opacity': 0.8
              }}
            />
          </Source>
        )}

        {/* Markers */}
        {!showHeatmap && properties.map((prop) => (
          prop.lat && prop.lng && (
            <Marker 
              key={prop.id} 
              longitude={prop.lng} 
              latitude={prop.lat} 
              anchor="bottom"
              onClick={e => {
                e.originalEvent.stopPropagation();
                setPopupInfo(prop);
              }}
            >
              <div className="w-8 h-8 cursor-pointer transform hover:scale-110 transition-transform">
                <svg viewBox="0 0 24 24" fill="red" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              </div>
            </Marker>
          )
        ))}

        {/* VN-2000 Search Marker */}
        {searchLocation && (
          <Marker longitude={searchLocation[1]} latitude={searchLocation[0]} anchor="bottom">
            <div className="w-8 h-8 text-blue-600 animate-bounce">
              <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
            </div>
          </Marker>
        )}

        {/* Popup */}
        {popupInfo && popupInfo.lng && popupInfo.lat && (
          <Popup
            longitude={popupInfo.lng}
            latitude={popupInfo.lat}
            anchor="bottom"
            offset={30}
            onClose={() => setPopupInfo(null)}
            className="z-50"
          >
            <div className="p-1 min-w-[200px]">
              <div className="font-bold text-gray-800 mb-1">{popupInfo.title}</div>
              {popupInfo.images && popupInfo.images.length > 0 && (
                <div className="w-full h-24 mt-1 mb-2 bg-gray-100 rounded overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={popupInfo.images[0]} alt={popupInfo.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="text-red-600 font-bold mt-1">{formatPrice(popupInfo.price)}</div>
              <div className="text-xs text-gray-500 mt-1">{popupInfo.location}</div>
              {popupInfo.google_map_link && (
                <a href={popupInfo.google_map_link} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100 hover:bg-blue-100">
                  📍 Xem trên Google Maps
                </a>
              )}
            </div>
          </Popup>
        )}

        {/* Popup Thông tin Thửa đất GeoJSON */}
        {selectedParcel && (() => {
          const p = selectedParcel.properties;
          const isTd22330 = p._sourceLayer === 'cadastre-td22330-fill';
          const soThua = isTd22330 ? p.th : p.SHTHUA;
          const soTo = isTd22330 ? p.t : (p.SHBANDO || '40');
          const dienTich = isTd22330 ? p.dt : p.DIENTICH;
          const maLoaiDat = (isTd22330 ? p.ld : (p.KHLOAIDAT || p.MDSD2003)) || 'Chưa xác định';
          const tenLoaiDat = LOAI_DAT_NAMES[maLoaiDat] || '';
          const tenChu = isTd22330 ? p.tc : p.DIADANH;
          const daCapGcn = isTd22330 ? p.gcn === 1 : p.DaCapGCN === 1;
          return (
            <Popup
              longitude={selectedParcel.lng}
              latitude={selectedParcel.lat}
              anchor="bottom"
              offset={15}
              onClose={() => setSelectedParcel(null)}
              className="z-50"
            >
              <div className="p-1 min-w-[245px] text-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
                  <span className="font-bold text-red-600 text-sm">
                    Thửa #{soThua}
                  </span>
                  <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold text-[11px] border border-amber-200">
                    Tờ bản đồ #{soTo}
                  </span>
                </div>
                <div className="space-y-1.5 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Diện tích:</span>
                    <span className="font-bold text-emerald-600 text-sm">
                      {Number(dienTich || 0).toLocaleString('vi-VN')} m²
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-gray-500 whitespace-nowrap">Mã loại đất:</span>
                    <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {maLoaiDat}
                    </span>
                  </div>
                  {tenLoaiDat && (
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-gray-500 whitespace-nowrap">Mục đích SDĐ:</span>
                      <span className="font-medium text-gray-800 text-right">
                        {tenLoaiDat}
                      </span>
                    </div>
                  )}
                  {tenChu && (
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-gray-500 whitespace-nowrap">Chủ sử dụng:</span>
                      <span className="font-bold text-slate-900 text-right">
                        {tenChu}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Pháp lý GCN:</span>
                    <span className={`text-[11px] font-semibold ${daCapGcn ? 'text-emerald-700' : 'text-gray-600'}`}>
                      {daCapGcn ? '✅ Đã cấp GCN' : 'Chưa cập nhật GCN'}
                    </span>
                  </div>
                  {isAnalyzingParcel && (
                    <div className="mt-2 py-2 px-2.5 bg-blue-50 rounded-lg border border-blue-200 text-[11px] text-blue-700 flex items-center gap-2">
                      <span className="animate-spin w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full inline-block" />
                      <span>Đang tính toán tọa độ & trừ lộ giới quy hoạch...</span>
                    </div>
                  )}

                  {parcelAnalysis && parcelAnalysis.hasPlanningOverlap ? (
                    <div className="mt-2 pt-2 border-t-2 border-dashed border-emerald-300 bg-slate-50 -mx-1 px-2.5 py-2 rounded-lg space-y-2">
                      <div className="font-bold text-slate-800 text-[11px] flex items-center justify-between gap-1">
                        <span>📐 Bóc tách sau trừ QH:</span>
                        <span className="bg-emerald-600 text-white px-1.5 py-0.5 rounded text-[10px]">
                          {parcelAnalysis.planningSourceTitle}
                        </span>
                      </div>

                      {/* Thanh tỷ lệ trực quan */}
                      <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden flex border border-gray-300">
                        {parcelAnalysis.buildableResidentialPercentage > 0 && (
                          <div
                            style={{ width: `${parcelAnalysis.buildableResidentialPercentage}%` }}
                            className="bg-emerald-500 h-full"
                            title={`Đất ở/Thương mại: ${parcelAnalysis.buildableResidentialAreaM2} m² (${parcelAnalysis.buildableResidentialPercentage}%)`}
                          />
                        )}
                        {parcelAnalysis.publicOrGreenCutPercentage > 0 && (
                          <div
                            style={{ width: `${parcelAnalysis.publicOrGreenCutPercentage}%` }}
                            className="bg-amber-500 h-full"
                            title={`QH Công cộng/Cây xanh: ${parcelAnalysis.publicOrGreenCutAreaM2} m² (${parcelAnalysis.publicOrGreenCutPercentage}%)`}
                          />
                        )}
                        {parcelAnalysis.trafficCutPercentage > 0 && (
                          <div
                            style={{ width: `${parcelAnalysis.trafficCutPercentage}%` }}
                            className="bg-red-500 h-full"
                            title={`Trừ QH Giao thông: ${parcelAnalysis.trafficCutAreaM2} m² (${parcelAnalysis.trafficCutPercentage}%)`}
                          />
                        )}
                      </div>

                      {/* Bảng tổng hợp diện tích */}
                      <div className="bg-white rounded-md p-2 border border-slate-200 space-y-1 text-[11px]">
                        <div className="flex justify-between items-center text-red-600">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                            Trừ QH Giao thông (Lộ giới):
                          </span>
                          <span className="font-bold">
                            -{parcelAnalysis.trafficCutAreaM2.toLocaleString('vi-VN')} m² ({parcelAnalysis.trafficCutPercentage}%)
                          </span>
                        </div>

                        {parcelAnalysis.publicOrGreenCutAreaM2 > 0 && (
                          <div className="flex justify-between items-center text-amber-700">
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                              QH Công cộng / Cây xanh:
                            </span>
                            <span className="font-bold">
                              {parcelAnalysis.publicOrGreenCutAreaM2.toLocaleString('vi-VN')} m² ({parcelAnalysis.publicOrGreenCutPercentage}%)
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-emerald-700">
                          <span className="font-bold flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                            Còn lại sau trừ Giao thông:
                          </span>
                          <span className="font-extrabold text-xs">
                            {parcelAnalysis.remainingAfterTrafficAreaM2.toLocaleString('vi-VN')} m² ({parcelAnalysis.remainingAfterTrafficPercentage}%)
                          </span>
                        </div>

                        {parcelAnalysis.publicOrGreenCutAreaM2 > 0 && (
                          <div className="flex justify-between items-center text-blue-700">
                            <span className="font-semibold">Đất ở / TM thực còn:</span>
                            <span className="font-bold">
                              {parcelAnalysis.buildableResidentialAreaM2.toLocaleString('vi-VN')} m² ({parcelAnalysis.buildableResidentialPercentage}%)
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Chi tiết từng ô quy hoạch 1/500 giao cắt */}
                      {parcelAnalysis.zoneBreakdowns.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[10px] font-semibold text-gray-500 uppercase">
                            Chi tiết các ô quy hoạch trên thửa đất:
                          </div>
                          {parcelAnalysis.zoneBreakdowns.map((zb, idx) => (
                            <div
                              key={idx}
                              className="bg-white p-1.5 rounded border border-slate-200 space-y-1 text-[11px]"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full inline-block border border-gray-400 shrink-0"
                                    style={{ backgroundColor: zb.mauSac }}
                                  />
                                  <span className="truncate max-w-[140px]" title={zb.tenQuyHoach}>
                                    {zb.tenQuyHoach}
                                  </span>
                                </div>
                                <span className="font-bold text-emerald-700 whitespace-nowrap">
                                  {zb.areaM2.toLocaleString('vi-VN')} m² ({zb.percentage}%)
                                </span>
                              </div>
                              {(zb.kyHieuLo || zb.matDoXD || zb.tangCao || zb.heSoSDD) && (
                                <div className="flex items-center justify-between text-[10px] text-gray-600 bg-slate-50 px-1.5 py-0.5 rounded">
                                  {zb.kyHieuLo && (
                                    <span className="font-bold text-orange-700">Lô {zb.kyHieuLo}</span>
                                  )}
                                  {zb.matDoXD && <span>MĐ: <b>{zb.matDoXD}</b></span>}
                                  {zb.tangCao && <span>Cao: <b>{zb.tangCao}</b></span>}
                                  {zb.heSoSDD && <span>HS: <b>{zb.heSoSDD}</b></span>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Nút xem & copy tọa độ VN-2000 của phần đất còn lại */}
                      {parcelAnalysis.remainingVertices.length > 0 && (
                        <div className="pt-1">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setShowRemainingCoords(prev => !prev)}
                              className="flex-1 py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded text-[11px] transition-colors flex items-center justify-center gap-1"
                            >
                              <span>📍 {showRemainingCoords ? 'Ẩn tọa độ đỉnh còn lại' : `Tọa độ sau trừ QH (${parcelAnalysis.remainingVertices.length} đỉnh)`}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const textToCopy = parcelAnalysis.remainingVertices
                                  .map(v => `Đỉnh ${v.index}: X=${v.vn2000X.toFixed(2)}, Y=${v.vn2000Y.toFixed(2)} (Cạnh: ${v.edgeLengthNextM}m)`)
                                  .join('\n');
                                navigator.clipboard.writeText(textToCopy);
                                setCopiedCoords(true);
                                setTimeout(() => setCopiedCoords(false), 2000);
                              }}
                              className="py-1 px-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded text-[11px] transition-colors"
                              title="Copy danh sách tọa độ VN-2000"
                            >
                              {copiedCoords ? '✅ Đã copy' : '📋 Copy'}
                            </button>
                          </div>

                          {showRemainingCoords && (
                            <div className="mt-1.5 max-h-36 overflow-y-auto bg-white border border-slate-200 rounded p-1.5 text-[10px]">
                              <div className="font-bold text-slate-700 mb-1">
                                Hệ tọa độ VN-2000 Khánh Hòa (KTT 108°15&apos;):
                              </div>
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-200 text-gray-500">
                                    <th className="py-0.5">Đỉnh</th>
                                    <th className="py-0.5">X (m)</th>
                                    <th className="py-0.5">Y (m)</th>
                                    <th className="py-0.5 text-right">Cạnh (m)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {parcelAnalysis.remainingVertices.map((v) => (
                                    <tr key={v.index} className="border-b border-slate-100 font-mono">
                                      <td className="py-0.5 font-bold text-blue-700">#{v.index}</td>
                                      <td className="py-0.5">{v.vn2000X.toFixed(2)}</td>
                                      <td className="py-0.5">{v.vn2000Y.toFixed(2)}</td>
                                      <td className="py-0.5 text-right text-emerald-700 font-semibold">{v.edgeLengthNextM}m</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : p._planningZone ? (
                    <div className="mt-2 pt-2 border-t-2 border-dashed border-orange-200 bg-orange-50/70 -mx-1 px-2 py-1.5 rounded-lg space-y-1">
                      <div className="font-bold text-orange-800 text-[11px] flex items-center justify-between">
                        <span>📐 Quy hoạch 1/500 tại thửa này:</span>
                        {p._planningZone.KyHieuLo && (
                          <span className="bg-orange-600 text-white px-1.5 py-0.2 rounded text-[10px]">
                            Lô {p._planningZone.KyHieuLo}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 font-bold text-gray-900">
                        <span
                          className="w-3 h-3 rounded-full inline-block border border-gray-400 shrink-0"
                          style={{ backgroundColor: p._planningZone.MauSac || '#f97316' }}
                        />
                        <span>{p._planningZone.TenQuyHoach || 'Đất quy hoạch'}</span>
                      </div>
                    </div>
                  ) : null}
                  <div className="text-[10px] text-gray-500 pt-1.5 border-t border-gray-100 flex items-center justify-between">
                    <span>{isTd22330 ? `📍 ${p.dd || 'Xã Cam Lâm'} (Cam Hải Tây)` : '📍 Cam An Nam, Cam Lâm'}</span>
                    <span className="text-gray-400">Tờ {soTo} / Thửa {soThua}</span>
                  </div>
                </div>
              </div>
            </Popup>
          );
        })()}

        {/* Popup Ô Quy hoạch Vector (Phân khu 1 Cam Ranh & Phân khu 3.2 Diên Khánh) */}
        {selectedPlanningZone && (
          <Popup
            longitude={selectedPlanningZone.lng}
            latitude={selectedPlanningZone.lat}
            anchor="bottom"
            offset={15}
            onClose={() => setSelectedPlanningZone(null)}
            className="z-50"
          >
            <div className="p-1 min-w-[250px] text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
                <span className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                  <span
                    className="w-3.5 h-3.5 rounded-full inline-block border border-gray-300 shadow-sm shrink-0"
                    style={{ backgroundColor: selectedPlanningZone.properties.MauSac || '#3b82f6' }}
                  />
                  <span>{selectedPlanningZone.properties.TenQuyHoach || 'Quy hoạch xây dựng'}</span>
                </span>
              </div>
              <div className="space-y-1.5 mt-2">
                {selectedPlanningZone.properties.GiaiDoan && (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-gray-500 whitespace-nowrap">Giai đoạn QH:</span>
                    <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 text-right">
                      {selectedPlanningZone.properties.GiaiDoan}
                    </span>
                  </div>
                )}
                {selectedPlanningZone.properties.DienTichM2 !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Diện tích ô này:</span>
                    <span className="font-bold text-emerald-600 text-sm">
                      {Number(selectedPlanningZone.properties.DienTichHa).toLocaleString('vi-VN')} ha
                      <span className="text-[11px] text-gray-500 font-normal ml-1">
                        ({Number(selectedPlanningZone.properties.DienTichM2).toLocaleString('vi-VN')} m²)
                      </span>
                    </span>
                  </div>
                )}
                {selectedPlanningZone.properties.TongDienTichPhanLoaiHa !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Tổng DT phân loại:</span>
                    <span className="font-semibold text-slate-700">
                      {Number(selectedPlanningZone.properties.TongDienTichPhanLoaiHa).toLocaleString('vi-VN')} ha
                    </span>
                  </div>
                )}
                {selectedPlanningZone.properties.DienTich !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Diện tích lô:</span>
                    <span className="font-bold text-emerald-600 text-sm">
                      {Number(selectedPlanningZone.properties.DienTich).toLocaleString('vi-VN')} m²
                      {Number(selectedPlanningZone.properties.DienTich) >= 10000 && (
                        <span className="text-[11px] text-gray-500 font-normal ml-1">
                          ({(Number(selectedPlanningZone.properties.DienTich) / 10000).toFixed(2)} ha)
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {selectedPlanningZone.properties.ChieuDaiM !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Chiều dài đoạn tuyến:</span>
                    <span className="font-bold text-emerald-600 text-sm">
                      {Number(selectedPlanningZone.properties.ChieuDaiM).toLocaleString('vi-VN')} m
                    </span>
                  </div>
                )}
                {selectedPlanningZone.properties.KyHieuLo && (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-gray-500 whitespace-nowrap">Ký hiệu ô quy hoạch:</span>
                    <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      {selectedPlanningZone.properties.KyHieuLo}
                    </span>
                  </div>
                )}
                {(selectedPlanningZone.properties.MatDoXD || selectedPlanningZone.properties.TangCao || selectedPlanningZone.properties.HeSoSDD) && (
                  <div className="grid grid-cols-3 gap-1 bg-slate-50 p-1.5 rounded-lg border border-slate-200 text-center my-1">
                    <div>
                      <div className="text-[10px] text-gray-500">Mật độ XD</div>
                      <div className="font-bold text-slate-800">{selectedPlanningZone.properties.MatDoXD || '-'}</div>
                    </div>
                    <div className="border-x border-slate-200">
                      <div className="text-[10px] text-gray-500">Tầng cao</div>
                      <div className="font-bold text-blue-700">{selectedPlanningZone.properties.TangCao || '-'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500">Hệ số SDĐ</div>
                      <div className="font-bold text-purple-700">{selectedPlanningZone.properties.HeSoSDD || '-'}</div>
                    </div>
                  </div>
                )}
                {selectedPlanningZone.properties.TrangThai && (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-gray-500 whitespace-nowrap">Trạng thái:</span>
                    <span className="font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-right">
                      {selectedPlanningZone.properties.TrangThai}
                    </span>
                  </div>
                )}
                {(selectedPlanningZone.properties.PhanLoai || selectedPlanningZone.properties.Layer) && (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-gray-500 whitespace-nowrap">Mã đất (Phanloai):</span>
                    <span className="font-mono text-[10px] text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 font-semibold">
                      {selectedPlanningZone.properties.PhanLoai || selectedPlanningZone.properties.Layer}
                    </span>
                  </div>
                )}
                {selectedPlanningZone.properties.MauSac && (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-gray-500 whitespace-nowrap">Mã màu (maHTML):</span>
                    <span className="font-mono text-[10px] text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200 flex items-center gap-1">
                      <span
                        className="w-2.5 h-2.5 rounded-sm inline-block border border-gray-300"
                        style={{ backgroundColor: selectedPlanningZone.properties.MauSac }}
                      />
                      <span>{selectedPlanningZone.properties.MauSac}</span>
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Khu vực:</span>
                  <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                    {selectedPlanningZone.properties._sourceLayer === 'pk32-dienkhanh-fill'
                      ? 'Phân khu 3.2 Diên Khánh'
                      : selectedPlanningZone.properties._sourceLayer === 'pk3-vector-fill'
                        ? 'Phân khu 3 (Diên Khánh - Cam Lâm)'
                        : selectedPlanningZone.properties._sourceLayer === 'camhaitay-1500-fill'
                          ? 'QH 1/500 Cam Hải Tây (Tiểu khu E)'
                          : selectedPlanningZone.properties._sourceLayer === 'qhc-camlam-2045-fill'
                            ? 'QHC Đô thị mới Cam Lâm 2045 (QĐ 205/QĐ-TTg)'
                            : selectedPlanningZone.properties._sourceLayer === 'qhc-camlam-2045-gt-bo-line'
                              ? 'QHC Cam Lâm 2045 - Giao thông Đường bộ'
                              : selectedPlanningZone.properties._sourceLayer === 'qhc-camlam-2045-gt-sat-line'
                                ? 'QHC Cam Lâm 2045 - Giao thông Đường sắt'
                                : 'Phân khu 1 Cam Ranh'}
                  </span>
                </div>
                {selectedPlanningZone.properties.Text && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Ký hiệu bản vẽ:</span>
                    <span className="font-semibold text-gray-800">
                      {selectedPlanningZone.properties.Text}
                    </span>
                  </div>
                )}
                <div className="text-[10px] text-gray-400 pt-1.5 border-t border-gray-100 flex items-center justify-between">
                  <span>
                    {selectedPlanningZone.properties._sourceLayer === 'pk32-dienkhanh-fill'
                      ? '📍 Diên Khánh, Khánh Hòa'
                      : selectedPlanningZone.properties._sourceLayer === 'pk3-vector-fill'
                        ? '📍 Diên Khánh – Cam Lâm'
                        : selectedPlanningZone.properties._sourceLayer === 'camhaitay-1500-fill'
                          ? '📍 Cam Hải Tây, Cam Lâm'
                          : selectedPlanningZone.properties._sourceLayer?.startsWith('qhc-camlam-2045')
                            ? '📍 Đô thị mới Cam Lâm, Khánh Hòa'
                            : '📍 Ven vịnh Cam Ranh'}
                  </span>
                  <span>ID: #{selectedPlanningZone.properties.ID || selectedPlanningZone.properties.OBJECTID}</span>
                </div>
              </div>
            </div>
          </Popup>
        )}

        <MeasurementControlMapLibre mode={measureMode} setMode={setMeasureMode} />

        {/* 4 Chốt kéo ở 4 góc và 1 Chốt tâm khi bật Chế độ Căn chỉnh thủ công */}
        {isCalibrating && isCalibratableLayer(activePlanningLayer) && layerCoords[activePlanningLayer] && (
          <>
            {/* Chốt 1: Top-Left (Tây Bắc) */}
            <Marker
              longitude={layerCoords[activePlanningLayer][0][0]}
              latitude={layerCoords[activePlanningLayer][0][1]}
              draggable
              onDrag={(e: any) => handleCornerDrag(0, e.lngLat.lng, e.lngLat.lat)}
              onDragEnd={(e: any) => handleCornerDrag(0, e.lngLat.lng, e.lngLat.lat)}
              anchor="center"
            >
              <div 
                className="w-7 h-7 bg-red-600 hover:bg-red-500 text-white rounded-full flex items-center justify-center font-bold text-xs border-2 border-white shadow-2xl cursor-grab active:cursor-grabbing hover:scale-125 transition-transform select-none"
                title="Góc 1: Tây Bắc - Kéo chuột để nắn góc"
              >
                1
              </div>
            </Marker>

            {/* Chốt 2: Top-Right (Đông Bắc) */}
            <Marker
              longitude={layerCoords[activePlanningLayer][1][0]}
              latitude={layerCoords[activePlanningLayer][1][1]}
              draggable
              onDrag={(e: any) => handleCornerDrag(1, e.lngLat.lng, e.lngLat.lat)}
              onDragEnd={(e: any) => handleCornerDrag(1, e.lngLat.lng, e.lngLat.lat)}
              anchor="center"
            >
              <div 
                className="w-7 h-7 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold text-xs border-2 border-white shadow-2xl cursor-grab active:cursor-grabbing hover:scale-125 transition-transform select-none"
                title="Góc 2: Đông Bắc - Kéo chuột để nắn góc"
              >
                2
              </div>
            </Marker>

            {/* Chốt 3: Bottom-Right (Đông Nam) */}
            <Marker
              longitude={layerCoords[activePlanningLayer][2][0]}
              latitude={layerCoords[activePlanningLayer][2][1]}
              draggable
              onDrag={(e: any) => handleCornerDrag(2, e.lngLat.lng, e.lngLat.lat)}
              onDragEnd={(e: any) => handleCornerDrag(2, e.lngLat.lng, e.lngLat.lat)}
              anchor="center"
            >
              <div 
                className="w-7 h-7 bg-purple-600 hover:bg-purple-500 text-white rounded-full flex items-center justify-center font-bold text-xs border-2 border-white shadow-2xl cursor-grab active:cursor-grabbing hover:scale-125 transition-transform select-none"
                title="Góc 3: Đông Nam - Kéo chuột để nắn góc"
              >
                3
              </div>
            </Marker>

            {/* Chốt 4: Bottom-Left (Tây Nam) */}
            <Marker
              longitude={layerCoords[activePlanningLayer][3][0]}
              latitude={layerCoords[activePlanningLayer][3][1]}
              draggable
              onDrag={(e: any) => handleCornerDrag(3, e.lngLat.lng, e.lngLat.lat)}
              onDragEnd={(e: any) => handleCornerDrag(3, e.lngLat.lng, e.lngLat.lat)}
              anchor="center"
            >
              <div 
                className="w-7 h-7 bg-amber-500 hover:bg-amber-400 text-white rounded-full flex items-center justify-center font-bold text-xs border-2 border-white shadow-2xl cursor-grab active:cursor-grabbing hover:scale-125 transition-transform select-none"
                title="Góc 4: Tây Nam - Kéo chuột để nắn góc"
              >
                4
              </div>
            </Marker>

            {/* Chốt Tâm: Kéo dời toàn bộ bản đồ */}
            <Marker
              longitude={(layerCoords[activePlanningLayer][0][0] + layerCoords[activePlanningLayer][1][0] + layerCoords[activePlanningLayer][2][0] + layerCoords[activePlanningLayer][3][0]) / 4}
              latitude={(layerCoords[activePlanningLayer][0][1] + layerCoords[activePlanningLayer][1][1] + layerCoords[activePlanningLayer][2][1] + layerCoords[activePlanningLayer][3][1]) / 4}
              draggable
              onDragStart={(e: any) => {
                lastDragPointRef.current = { lng: e.lngLat.lng, lat: e.lngLat.lat };
              }}
              onDrag={(e: any) => handleCenterDragDelta(e.lngLat.lng, e.lngLat.lat)}
              onDragEnd={() => {
                lastDragPointRef.current = null;
              }}
              anchor="center"
            >
              <div 
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center gap-1 font-bold text-xs border-2 border-white shadow-2xl cursor-move hover:scale-110 transition-transform select-none"
                title="Kéo điểm này để dời cả tấm bản đồ"
              >
                <span>✥</span>
                <span>Kéo dời bản đồ</span>
              </div>
            </Marker>
          </>
        )}
      </Map>

      {/* Floating Horizontal Comparison Slider (Thanh kéo trượt ngang so sánh Hiện trạng & Quy hoạch) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[450] max-w-[95vw] sm:max-w-3xl">
        <div className="bg-white/95 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl shadow-xl border border-gray-200/90 flex flex-col gap-1.5 text-xs sm:text-sm font-semibold select-none">
          {/* Các tấm bản đồ Cam Lâm độc lập: Bấm chọn tấm nào thì thanh trượt kéo độ mờ riêng của tấm đó (không làm tắt các tấm bên dưới) */}
          <div className="flex items-center justify-center gap-1.5 overflow-x-auto pb-1 max-w-full text-xs font-medium text-gray-600 scrollbar-none">
            <button
              type="button"
              onClick={() => handleSelectPlanningTab('qhc_camlam_2045')}
              className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activePlanningLayer === 'qhc_camlam_2045'
                  ? 'bg-indigo-600 text-white font-bold shadow-sm ring-2 ring-indigo-300'
                  : opacityQhcCamLam2045 > 0
                    ? 'bg-indigo-50 text-indigo-800 border border-indigo-200 font-semibold hover:bg-indigo-100'
                    : 'hover:bg-gray-100 text-gray-500'
              }`}
              title="Chọn tấm Quy hoạch Chung Đô thị mới Cam Lâm đến năm 2045 (QĐ 205/QĐ-TTg) để kéo chỉnh độ mờ"
            >
              <span>QHC Cam Lâm 2045</span>
              <span className={`text-[10px] px-1 py-0.2 rounded ${activePlanningLayer === 'qhc_camlam_2045' ? 'bg-indigo-800 text-white' : 'bg-white/80 text-gray-600'}`}>
                {Math.round(opacityQhcCamLam2045 * 100)}%
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectPlanningTab('camlam_2030')}
              className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activePlanningLayer === 'camlam_2030'
                  ? 'bg-amber-600 text-white font-bold shadow-sm ring-2 ring-amber-300'
                  : opacityCamlam2030 > 0
                    ? 'bg-amber-50 text-amber-800 border border-amber-200 font-semibold hover:bg-amber-100'
                    : 'hover:bg-gray-100 text-gray-500'
              }`}
              title="Chọn tấm Điều chỉnh Quy hoạch Sử dụng đất đến năm 2030 huyện Cam Lâm để kéo chỉnh độ mờ"
            >
              <span>ĐCQH SDĐ 2030 Cam Lâm</span>
              <span className={`text-[10px] px-1 py-0.2 rounded ${activePlanningLayer === 'camlam_2030' ? 'bg-amber-800 text-white' : 'bg-white/80 text-gray-600'}`}>
                {Math.round(opacityCamlam2030 * 100)}%
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectPlanningTab('qhc_camlam_2045_gt_bo')}
              className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activePlanningLayer === 'qhc_camlam_2045_gt_bo'
                  ? 'bg-blue-600 text-white font-bold shadow-sm ring-2 ring-blue-300'
                  : opacityQhcCamLamGtBo > 0
                    ? 'bg-blue-50 text-blue-800 border border-blue-200 font-semibold hover:bg-blue-100'
                    : 'hover:bg-gray-100 text-gray-500'
              }`}
              title="Chọn lớp Mạng lưới Giao thông Đường bộ - QHC Cam Lâm 2045 (32.252 đoạn)"
            >
              <span>GT Đường bộ 2045</span>
              <span className={`text-[10px] px-1 py-0.2 rounded ${activePlanningLayer === 'qhc_camlam_2045_gt_bo' ? 'bg-blue-800 text-white' : 'bg-white/80 text-gray-600'}`}>
                {Math.round(opacityQhcCamLamGtBo * 100)}%
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectPlanningTab('qhc_camlam_2045_gt_sat')}
              className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activePlanningLayer === 'qhc_camlam_2045_gt_sat'
                  ? 'bg-fuchsia-700 text-white font-bold shadow-sm ring-2 ring-fuchsia-300'
                  : opacityQhcCamLamGtSat > 0
                    ? 'bg-fuchsia-50 text-fuchsia-800 border border-fuchsia-200 font-semibold hover:bg-fuchsia-100'
                    : 'hover:bg-gray-100 text-gray-500'
              }`}
              title="Chọn lớp Mạng lưới Giao thông Đường sắt - QHC Cam Lâm 2045 (684 đoạn)"
            >
              <span>GT Đường sắt 2045</span>
              <span className={`text-[10px] px-1 py-0.2 rounded ${activePlanningLayer === 'qhc_camlam_2045_gt_sat' ? 'bg-fuchsia-900 text-white' : 'bg-white/80 text-gray-600'}`}>
                {Math.round(opacityQhcCamLamGtSat * 100)}%
              </span>
            </button>
            {/* Tạm ẩn 3 nút Cam Hải Tây (SDĐ), Cam Hải Tây (Giao thông), Địa chính Cam Hải Tây theo yêu cầu */}
          </div>

          {/* Thanh điều khiển trượt */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Nút Hiện trạng (0%) */}
            <button
              type="button"
              onClick={() => setActiveOpacity(0)}
              className={`flex items-center gap-1 px-2 py-1 rounded-xl transition-all whitespace-nowrap ${
                getActiveOpacity() === 0 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              title="Xem 100% ảnh vệ tinh hiện trạng (0% quy hoạch)"
            >
              <span>🛰️</span>
              <span className="hidden sm:inline">Hiện trạng</span>
              <span className="sm:hidden">Vệ tinh</span>
            </button>

            {/* Thanh kéo trượt ngang */}
            <div className="flex flex-col items-center gap-0.5 min-w-[120px] sm:min-w-[200px] flex-1">
              <div className="w-full flex justify-between items-center text-[10px] text-gray-500 font-medium px-0.5">
                <span>0%</span>
                <span className="px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                  {Math.round(getActiveOpacity() * 100)}%
                </span>
                <span>100%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={getActiveOpacity()}
                onChange={(e) => setActiveOpacity(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-700 transition-all"
                aria-label="Thanh trượt độ mờ so sánh quy hoạch"
              />
            </div>

            {/* Nút Quy hoạch (100%) */}
            <button
              type="button"
              onClick={() => setActiveOpacity(1)}
              className={`flex items-center gap-1 px-2 py-1 rounded-xl transition-all whitespace-nowrap ${
                getActiveOpacity() > 0.85 
                  ? 'bg-rose-600 text-white shadow-sm' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              title="Xem 100% bản đồ quy hoạch đang chọn"
            >
              <span>📑</span>
              <span className="hidden sm:inline">Quy hoạch</span>
              <span className="sm:hidden">100%</span>
            </button>

            {/* Nút Định vị vị trí bản đồ đang chọn */}
            <button
              type="button"
              onClick={() => {
                if (getActiveOpacity() === 0) setActiveOpacity(0.7);
                flyToActive();
              }}
              className="p-1 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors border border-blue-100 flex items-center justify-center"
              title="Định vị vị trí bản đồ này"
            >
              📍
            </button>

            {/* Nút Căn chỉnh tay */}
            <button
              type="button"
              onClick={() => {
                if (!isCalibrating && getActiveOpacity() < 0.2) {
                  setActiveOpacity(0.65);
                }
                setIsCalibrating(!isCalibrating);
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-xl transition-all text-xs font-bold border ${
                isCalibrating 
                  ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-300' 
                  : 'text-amber-800 bg-amber-50 border-amber-200 hover:bg-amber-100'
              }`}
              title="Bật/Tắt chế độ dùng chuột & tay để căn chỉnh lại bản đồ"
            >
              <span>🛠️</span>
              <span className="hidden sm:inline">{isCalibrating ? 'Đang căn chỉnh' : 'Căn chỉnh tay'}</span>
              <span className="sm:hidden">Căn chỉnh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Calibration Control Panel (Bảng điều khiển căn chỉnh thủ công) */}
      {isCalibrating && (
        isCalibPanelCollapsed ? (
          <div className="absolute top-4 right-4 z-[500]">
            <button
              type="button"
              onClick={() => setIsCalibPanelCollapsed(false)}
              className="flex items-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xl border-2 border-white transition-all hover:scale-105"
            >
              <span>🛠️ Bảng căn chỉnh ({getLayerName(activePlanningLayer)})</span>
              <span className="bg-amber-700 text-[10px] px-1.5 py-0.5 rounded">Mở</span>
            </button>
          </div>
        ) : (
          <div className="absolute top-4 right-4 z-[500] w-80 sm:w-96 max-w-[95vw] max-h-[92vh] overflow-y-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 text-gray-800 flex flex-col p-4 text-xs select-none">
            {/* Tiêu đề & Thu nhỏ / Đóng */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-base">🛠️</span>
                <div>
                  <div className="font-bold text-sm text-gray-900">Căn Chỉnh Thủ Công</div>
                  <div className="text-[10px] text-amber-700 font-semibold">{getLayerName(activePlanningLayer)}</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsCalibPanelCollapsed(true)}
                  className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-200 rounded-lg transition-colors font-bold"
                  title="Thu nhỏ bảng điều khiển"
                >
                  _
                </button>
                <button
                  type="button"
                  onClick={() => setIsCalibrating(false)}
                  className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors font-bold"
                  title="Đóng chế độ căn chỉnh"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Tabs chọn lớp quy hoạch để căn chỉnh */}
            <div className="pt-2.5 pb-2">
              <div className="text-[11px] font-bold text-gray-700 mb-1.5">Chọn lớp cần căn chỉnh:</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                {[
                  { key: 'camlam_2030', label: 'ĐCQH 2030 CL' },
                  { key: 'khuvuc1', label: 'Khu vực 1' },
                  { key: 'docduong34', label: 'Đường 3/4' },
                  { key: 'dc21', label: 'Tờ 21 (1/500)' },
                  { key: '2045', label: 'QHC 2045' },
                  { key: '2030', label: 'SDĐ 2030' },
                  { key: 'camtan_webp', label: 'Cam Tân (PA1)' },
                ].map(item => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleSelectPlanningTab(item.key as any)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                      activePlanningLayer === item.key
                        ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Điều chỉnh độ mờ để so sánh với ảnh vệ tinh */}
            <div className="py-2 border-t border-gray-100">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-gray-700">Độ mờ so sánh ảnh vệ tinh:</span>
                <span className="font-bold text-amber-600">{Math.round(getActiveOpacity() * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={getActiveOpacity()}
                onChange={e => setActiveOpacity(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <button type="button" onClick={() => setActiveOpacity(0.3)} className="hover:underline">30% (Nhìn xuyên)</button>
                <button type="button" onClick={() => setActiveOpacity(0.6)} className="hover:underline font-bold text-amber-700">60% (Chuẩn)</button>
                <button type="button" onClick={() => setActiveOpacity(0.9)} className="hover:underline">90% (Rõ)</button>
              </div>
            </div>

            {/* Hướng dẫn thao tác chuột trực tiếp */}
            <div className="py-2 px-2.5 bg-amber-50 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1 text-amber-800">
                <span>🎯</span> Thao tác chuột trực tiếp trên bản đồ:
              </div>
              <p>
                • <strong>Kéo các chốt 1, 2, 3, 4:</strong> Nắn chỉnh riêng từng góc để khít các ngã ba, khúc cong, ranh giới đất.
              </p>
              <p>
                • <strong>Kéo chốt ✥ (Tâm):</strong> Dời toàn bộ tấm bản đồ theo chuột.
              </p>
            </div>

            {/* D-Pad dịch chuyển theo mét */}
            <div className="py-2.5 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-gray-700">Di chuyển tinh vi (D-Pad):</span>
                <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                  {[1, 2, 5, 20].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setCalibNudgeMeters(m)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        calibNudgeMeters === m ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Nút mũi tên D-Pad */}
              <div className="grid grid-cols-3 gap-1.5 w-40 mx-auto">
                <div></div>
                <button
                  type="button"
                  onClick={() => nudge('up')}
                  className="p-2 bg-gray-100 hover:bg-amber-100 hover:text-amber-700 active:bg-amber-200 rounded-xl border border-gray-200 font-bold flex flex-col items-center justify-center transition-all shadow-sm"
                  title="Dịch lên Bắc"
                >
                  <span>⬆️</span>
                  <span className="text-[9px]">Lên</span>
                </button>
                <div></div>

                <button
                  type="button"
                  onClick={() => nudge('left')}
                  className="p-2 bg-gray-100 hover:bg-amber-100 hover:text-amber-700 active:bg-amber-200 rounded-xl border border-gray-200 font-bold flex flex-col items-center justify-center transition-all shadow-sm"
                  title="Dịch sang Tây"
                >
                  <span>⬅️</span>
                  <span className="text-[9px]">Trái</span>
                </button>
                <div className="flex items-center justify-center font-bold text-amber-700 text-xs bg-amber-50 rounded-xl border border-amber-200">
                  {calibNudgeMeters}m
                </div>
                <button
                  type="button"
                  onClick={() => nudge('right')}
                  className="p-2 bg-gray-100 hover:bg-amber-100 hover:text-amber-700 active:bg-amber-200 rounded-xl border border-gray-200 font-bold flex flex-col items-center justify-center transition-all shadow-sm"
                  title="Dịch sang Đông"
                >
                  <span>➡️</span>
                  <span className="text-[9px]">Phải</span>
                </button>

                <div></div>
                <button
                  type="button"
                  onClick={() => nudge('down')}
                  className="p-2 bg-gray-100 hover:bg-amber-100 hover:text-amber-700 active:bg-amber-200 rounded-xl border border-gray-200 font-bold flex flex-col items-center justify-center transition-all shadow-sm"
                  title="Dịch xuống Nam"
                >
                  <span>⬇️</span>
                  <span className="text-[9px]">Xuống</span>
                </button>
                <div></div>
              </div>
            </div>

            {/* Xoay & Co dãn bản đồ */}
            <div className="py-2.5 border-t border-gray-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-700">Xoay quanh tâm:</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => rotateLayer(-0.5)}
                    className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200 font-semibold"
                    title="Xoay ngược chiều kim đồng hồ 0.5 độ"
                  >
                    ↺ -0.5°
                  </button>
                  <button
                    type="button"
                    onClick={() => rotateLayer(-0.1)}
                    className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200 font-semibold"
                    title="Xoay ngược chiều kim đồng hồ 0.1 độ"
                  >
                    ↺ -0.1°
                  </button>
                  <button
                    type="button"
                    onClick={() => rotateLayer(0.1)}
                    className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200 font-semibold"
                    title="Xoay thuận chiều kim đồng hồ 0.1 độ"
                  >
                    ↻ +0.1°
                  </button>
                  <button
                    type="button"
                    onClick={() => rotateLayer(0.5)}
                    className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200 font-semibold"
                    title="Xoay thuận chiều kim đồng hồ 0.5 độ"
                  >
                    ↻ +0.5°
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-700">Thu phóng kích thước:</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => scaleLayer(0.995)}
                    className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200 font-semibold"
                    title="Thu nhỏ 0.5%"
                  >
                    🔍- Thu nhỏ
                  </button>
                  <button
                    type="button"
                    onClick={() => scaleLayer(1.005)}
                    className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200 font-semibold"
                    title="Phóng to 0.5%"
                  >
                    🔍+ Phóng to
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-700">Co dãn ngang / dọc:</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => scaleLayer(0.995, 'x')}
                    className="px-1.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200"
                    title="Thu hẹp ngang 0.5%"
                  >
                    ↔️ Hẹp
                  </button>
                  <button
                    type="button"
                    onClick={() => scaleLayer(1.005, 'x')}
                    className="px-1.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200"
                    title="Mở rộng ngang 0.5%"
                  >
                    ↔️ Rộng
                  </button>
                  <button
                    type="button"
                    onClick={() => scaleLayer(0.995, 'y')}
                    className="px-1.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200"
                    title="Thu ngắn dọc 0.5%"
                  >
                    ↕️ Thấp
                  </button>
                  <button
                    type="button"
                    onClick={() => scaleLayer(1.005, 'y')}
                    className="px-1.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200"
                    title="Kéo dài dọc 0.5%"
                  >
                    ↕️ Cao
                  </button>
                </div>
              </div>
            </div>

            {/* Nút Hành động: Lưu, Copy, Reset, Đóng */}
            <div className="pt-3 border-t border-gray-200 space-y-1.5">
              <button
                type="button"
                onClick={saveCalibration}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 text-xs"
              >
                <span>💾</span>
                <span>Lưu vị trí này (Lưu vào trình duyệt)</span>
              </button>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={copyCoords}
                  className="py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-xl border border-blue-200 transition-colors flex items-center justify-center gap-1 text-[11px]"
                  title="Sao chép mảng JSON 4 góc"
                >
                  <span>📋</span>
                  <span>Sao chép mã</span>
                </button>
                <button
                  type="button"
                  onClick={resetCalibration}
                  className="py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded-xl border border-red-200 transition-colors flex items-center justify-center gap-1 text-[11px]"
                  title="Khôi phục lại tọa độ gốc"
                >
                  <span>🔄</span>
                  <span>Khôi phục gốc</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsCalibrating(false)}
                className="w-full py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors text-center text-[11px]"
              >
                Hoàn tất căn chỉnh (Ẩn chốt)
              </button>
            </div>
          </div>
        )
      )}

      {/* Toggles Panel */}
      <div className={`absolute bottom-6 left-6 z-[500] bg-white rounded-xl shadow-lg border border-gray-200 text-black transition-all duration-300 overflow-hidden flex flex-col ${isLayersCollapsed ? 'w-12 h-12' : 'w-80 sm:w-96'}`}>
        {/* Nút thu gọn / mở rộng */}
        <div className={`flex items-center ${isLayersCollapsed ? 'justify-center w-full h-full' : 'justify-between px-4 py-3 border-b border-gray-100 bg-gray-50'}`}>
          {!isLayersCollapsed && <span className="font-bold text-gray-800">Lớp Bản đồ ({[streetMapOpacity, opacity2045, opacity2030, opacityTo40, opacityKhuVuc1Vector, opacityCamTan1500, opacityCamTanWebp, opacityPk32, opacityPk3, opacityQhcCamLam2045, opacityCamlam2030, opacityQhcCamLamGtBo, opacityQhcCamLamGtSat].filter(o => o > 0).length} đang bật)</span>}
          <button 
            onClick={() => setIsLayersCollapsed(!isLayersCollapsed)}
            className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
            title={isLayersCollapsed ? "Mở lớp bản đồ" : "Thu gọn"}
          >
            {isLayersCollapsed ? '🗺️' : '✖'}
          </button>
        </div>

        {!isLayersCollapsed && (
          <div className="p-4 space-y-3.5 max-h-[75vh] overflow-y-auto divide-y divide-gray-100">
            {/* Heatmap Toggle */}
            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showHeatmap} 
                  onChange={e => setShowHeatmap(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium">Bản đồ nhiệt giá đất (Heatmap)</span>
              </label>
            </div>

            {/* 1. Street Map (OSM Map) Slider */}
            <div className="space-y-1 pt-2.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-gray-800">
                  🗺️ <span>Bản đồ Map (Giao thông OSM)</span>
                </span>
                <span className="text-emerald-600 font-bold">{Math.round(streetMapOpacity * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="1" step="0.05"
                value={streetMapOpacity}
                onChange={e => setStreetMapOpacity(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <div className="flex justify-between text-[10px] text-gray-500 font-medium">
                <button type="button" onClick={() => setStreetMapOpacity(0)} className="hover:underline">Tắt (0%)</button>
                <button type="button" onClick={() => setStreetMapOpacity(0.5)} className="hover:underline">Chồng 50%</button>
                <button type="button" onClick={() => setStreetMapOpacity(1)} className="hover:underline">Map 100%</button>
              </div>
            </div>

            {/* 2. QHC Cam Ranh 2045 (1/10.000) */}
            <div className="space-y-1 pt-2.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="flex items-center gap-1 text-gray-800">
                  📑 <span>QHC Cam Ranh 2045</span>
                  <span className="text-[10px] font-normal text-gray-500">(1/10.000)</span>
                </span>
                <span className="text-indigo-600 font-bold">{Math.round(opacity2045 * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="1" step="0.05"
                value={opacity2045}
                onChange={e => setOpacity2045(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between items-center text-[10px]">
                <div className="flex gap-2 text-gray-500">
                  <button type="button" onClick={() => setOpacity2045(0)} className="hover:underline">0%</button>
                  <button type="button" onClick={() => setOpacity2045(0.5)} className="hover:underline">50%</button>
                  <button type="button" onClick={() => setOpacity2045(1)} className="hover:underline">100%</button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (opacity2045 === 0) setOpacity2045(0.7);
                    mapRef.current?.flyTo({ center: [109.135, 11.91], zoom: 12.5, duration: 2000 });
                  }}
                  className="px-2 py-0.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-[10px] font-medium border border-indigo-200 flex items-center gap-0.5"
                >
                  📍 Định vị
                </button>
              </div>
            </div>

            {/* 3. Kế hoạch SDĐ Cam Ranh 2030 (1/25.000) */}
            <div className="space-y-1 pt-2.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="flex items-center gap-1 text-gray-800">
                  📊 <span>Sử dụng đất 2030</span>
                  <span className="text-[10px] font-normal text-gray-500">(1/25.000)</span>
                </span>
                <span className="text-blue-600 font-bold">{Math.round(opacity2030 * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="1" step="0.05"
                value={opacity2030}
                onChange={e => setOpacity2030(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between items-center text-[10px]">
                <div className="flex gap-2 text-gray-500">
                  <button type="button" onClick={() => setOpacity2030(0)} className="hover:underline">0%</button>
                  <button type="button" onClick={() => setOpacity2030(0.5)} className="hover:underline">50%</button>
                  <button type="button" onClick={() => setOpacity2030(1)} className="hover:underline">100%</button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (opacity2030 === 0) setOpacity2030(0.7);
                    mapRef.current?.flyTo({ center: [109.135, 11.91], zoom: 12.5, duration: 2000 });
                  }}
                  className="px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[10px] font-medium border border-blue-200 flex items-center gap-0.5"
                >
                  📍 Định vị
                </button>
              </div>
            </div>

            {/* 4. Quy hoạch Phân khu 1/2000 Khu vực 1 */}
            <div className="space-y-1 pt-2.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="flex items-center gap-1 text-gray-800">
                  🏗️ <span>Phân khu Khu vực 1</span>
                  <span className="text-[10px] font-normal text-gray-500">(1/2.000)</span>
                </span>
                <span className="text-amber-600 font-bold">{Math.round(opacityKhuVuc1 * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="1" step="0.05"
                value={opacityKhuVuc1}
                onChange={e => setOpacityKhuVuc1(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
              />
              <div className="flex justify-between items-center text-[10px]">
                <div className="flex gap-2 text-gray-500">
                  <button type="button" onClick={() => setOpacityKhuVuc1(0)} className="hover:underline">0%</button>
                  <button type="button" onClick={() => setOpacityKhuVuc1(0.5)} className="hover:underline">50%</button>
                  <button type="button" onClick={() => setOpacityKhuVuc1(1)} className="hover:underline">100%</button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (opacityKhuVuc1 === 0) setOpacityKhuVuc1(0.7);
                    mapRef.current?.flyTo({ center: [109.1648, 11.9381], zoom: 13, duration: 2000 });
                  }}
                  className="px-2 py-0.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded text-[10px] font-medium border border-amber-200 flex items-center gap-0.5"
                >
                  📍 Định vị
                </button>
              </div>
            </div>

            {/* 5. Quy hoạch Chi tiết 1/500 Dọc đường 3 Tháng 4 */}
            <div className="space-y-1 pt-2.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="flex items-center gap-1 text-gray-800">
                  📐 <span>Dọc đường 3 Tháng 4</span>
                  <span className="text-[10px] font-normal text-gray-500">(1/500)</span>
                </span>
                <span className="text-purple-600 font-bold">{Math.round(opacityDocDuong34 * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="1" step="0.05"
                value={opacityDocDuong34}
                onChange={e => setOpacityDocDuong34(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div className="flex justify-between items-center text-[10px]">
                <div className="flex gap-2 text-gray-500">
                  <button type="button" onClick={() => setOpacityDocDuong34(0)} className="hover:underline">0%</button>
                  <button type="button" onClick={() => setOpacityDocDuong34(0.5)} className="hover:underline">50%</button>
                  <button type="button" onClick={() => setOpacityDocDuong34(1)} className="hover:underline">100%</button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (opacityDocDuong34 === 0) setOpacityDocDuong34(0.7);
                    mapRef.current?.flyTo({ center: [109.1535, 11.9131], zoom: 15, duration: 2000 });
                  }}
                  className="px-2 py-0.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded text-[10px] font-medium border border-purple-200 flex items-center gap-0.5"
                >
                  📍 Định vị
                </button>
              </div>
            </div>

            {/* 6. Bản đồ Địa chính 1/500 Tờ số 21 Cam Thuận */}
            <div className="space-y-1 pt-2.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="flex items-center gap-1 text-gray-800">
                  📜 <span>Địa chính Tờ 21 Cam Thuận</span>
                  <span className="text-[10px] font-normal text-gray-500">(1/500)</span>
                </span>
                <span className="text-rose-600 font-bold">{Math.round(opacityDc21 * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="1" step="0.05"
                value={opacityDc21}
                onChange={e => setOpacityDc21(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
              />
              <div className="flex justify-between items-center text-[10px]">
                <div className="flex gap-2 text-gray-500">
                  <button type="button" onClick={() => setOpacityDc21(0)} className="hover:underline">0%</button>
                  <button type="button" onClick={() => setOpacityDc21(0.5)} className="hover:underline">50%</button>
                  <button type="button" onClick={() => setOpacityDc21(1)} className="hover:underline">100%</button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (opacityDc21 === 0) setOpacityDc21(0.7);
                    mapRef.current?.flyTo({ center: [109.1526, 11.9132], zoom: 17.5, duration: 2000 });
                  }}
                  className="px-2 py-0.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded text-[10px] font-medium border border-rose-200 flex items-center gap-0.5"
                >
                  📍 Định vị
                </button>
              </div>
            </div>

            {/* 7. Bản đồ Địa chính Vector Tờ 40 Cam An Nam (389 thửa) */}
            <div className="space-y-1 pt-2.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="flex items-center gap-1 text-gray-800">
                  🗺️ <span>Địa chính Tờ 40 Cam An Nam</span>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">Vector 389 thửa</span>
                </span>
                <span className="text-emerald-600 font-bold">{Math.round(opacityTo40 * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="1" step="0.05"
                value={opacityTo40}
                onChange={e => setOpacityTo40(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <div className="flex justify-between items-center text-[10px]">
                <div className="flex gap-2 text-gray-500">
                  <button type="button" onClick={() => setOpacityTo40(0)} className="hover:underline">0%</button>
                  <button type="button" onClick={() => setOpacityTo40(0.5)} className="hover:underline">50%</button>
                  <button type="button" onClick={() => setOpacityTo40(1)} className="hover:underline">100%</button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (opacityTo40 === 0) setOpacityTo40(0.85);
                    setActivePlanningLayer('to40');
                    mapRef.current?.flyTo({ center: [109.07435, 11.97525], zoom: 16.5, duration: 2000 });
                  }}
                  className="px-2 py-0.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-[10px] font-medium border border-emerald-200 flex items-center gap-0.5"
                >
                  📍 Định vị
                </button>
              </div>
            </div>

            {/* 8. Bản đồ Quy hoạch Phân khu 1 Cam Ranh (Vector 1.472 ô) */}
            <div className="space-y-1 pt-2.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="flex items-center gap-1 text-gray-800">
                  🏗️ <span>Quy hoạch Phân khu 1</span>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">Vector 1.472 ô</span>
                </span>
                <span className="text-amber-600 font-bold">{Math.round(opacityKhuVuc1Vector * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="1" step="0.05"
                value={opacityKhuVuc1Vector}
                onChange={e => setOpacityKhuVuc1Vector(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
              />
              <div className="flex justify-between items-center text-[10px]">
                <div className="flex gap-2 text-gray-500">
                  <button type="button" onClick={() => setOpacityKhuVuc1Vector(0)} className="hover:underline">0%</button>
                  <button type="button" onClick={() => setOpacityKhuVuc1Vector(0.5)} className="hover:underline">50%</button>
                  <button type="button" onClick={() => setOpacityKhuVuc1Vector(1)} className="hover:underline">100%</button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (opacityKhuVuc1Vector === 0) setOpacityKhuVuc1Vector(0.8);
                    setActivePlanningLayer('khuvuc1_vector');
                    mapRef.current?.flyTo({ center: [109.1669, 11.9304], zoom: 14.5, duration: 2000 });
                  }}
                  className="px-2 py-0.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded text-[10px] font-medium border border-amber-200 flex items-center gap-0.5"
                >
                  📍 Định vị
                </button>
              </div>
            </div>

            {/* 9. Bản đồ Quy hoạch 1/500 Cam Tân - PA1 (Ảnh ghép đơn .webp) */}
            <div className="space-y-1 pt-2.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="flex items-center gap-1 text-gray-800">
                  🖼️ <span>QH 1/500 Cam Tân (PA1)</span>
                  <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-1 py-0.5 rounded border border-teal-200">1 Ảnh WebP</span>
                </span>
                <span className="text-teal-600 font-bold">{Math.round(opacityCamTanWebp * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="1" step="0.05"
                value={opacityCamTanWebp}
                onChange={e => setOpacityCamTanWebp(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
              />
              <div className="flex justify-between items-center text-[10px]">
                <div className="flex gap-2 text-gray-500">
                  <button type="button" onClick={() => setOpacityCamTanWebp(0)} className="hover:underline">0%</button>
                  <button type="button" onClick={() => setOpacityCamTanWebp(0.5)} className="hover:underline">50%</button>
                  <button type="button" onClick={() => setOpacityCamTanWebp(1)} className="hover:underline">100%</button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (opacityCamTanWebp === 0) setOpacityCamTanWebp(0.95);
                    setOpacityCamTan1500(0);
                    setActivePlanningLayer('camtan_webp');
                    mapRef.current?.flyTo({ center: [109.1035, 12.1217], zoom: 15.2, duration: 2000 });
                  }}
                  className="px-2 py-0.5 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded text-[10px] font-medium border border-teal-200 flex items-center gap-0.5"
                >
                  📍 Định vị
                </button>
              </div>
            </div>

            {/* 10. Bản đồ Quy hoạch 1/500 Cam Tân - PA2 (Đa mảnh siêu nét) */}
            <div className="space-y-1 pt-2.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="flex items-center gap-1 text-gray-800">
                  📐 <span>QH 1/500 Cam Tân (PA2)</span>
                  <span className="text-[10px] font-bold text-cyan-700 bg-cyan-50 px-1 py-0.5 rounded border border-cyan-200">Đa mảnh 14K</span>
                </span>
                <span className="text-cyan-600 font-bold">{Math.round(opacityCamTan1500 * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="1" step="0.05"
                value={opacityCamTan1500}
                onChange={e => setOpacityCamTan1500(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-600"
              />
              <div className="flex justify-between items-center text-[10px]">
                <div className="flex gap-2 text-gray-500">
                  <button type="button" onClick={() => setOpacityCamTan1500(0)} className="hover:underline">0%</button>
                  <button type="button" onClick={() => setOpacityCamTan1500(0.5)} className="hover:underline">50%</button>
                  <button type="button" onClick={() => setOpacityCamTan1500(1)} className="hover:underline">100%</button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (opacityCamTan1500 === 0) setOpacityCamTan1500(0.95);
                    setActivePlanningLayer('camtan_1500');
                    mapRef.current?.flyTo({ center: [109.1035, 12.1217], zoom: 15.2, duration: 2000 });
                  }}
                  className="px-2 py-0.5 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 rounded text-[10px] font-medium border border-cyan-200 flex items-center gap-0.5"
                >
                  📍 Định vị
                </button>
              </div>
            </div>

            {/* 11. Bản đồ Quy hoạch Phân khu 3.2 Diên Khánh (Vector 638 ô) */}
            <div className="space-y-1 pt-2.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="flex items-center gap-1 text-gray-800">
                  🏙️ <span>Phân khu 3.2 Diên Khánh</span>
                  <span className="text-[10px] font-bold text-fuchsia-700 bg-fuchsia-50 px-1 py-0.5 rounded border border-fuchsia-200">Vector 638 ô</span>
                </span>
                <span className="text-fuchsia-600 font-bold">{Math.round(opacityPk32 * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="1" step="0.05"
                value={opacityPk32}
                onChange={e => setOpacityPk32(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-fuchsia-600"
              />
              <div className="flex justify-between items-center text-[10px]">
                <div className="flex gap-2 text-gray-500">
                  <button type="button" onClick={() => setOpacityPk32(0)} className="hover:underline">0%</button>
                  <button type="button" onClick={() => setOpacityPk32(0.5)} className="hover:underline">50%</button>
                  <button type="button" onClick={() => setOpacityPk32(1)} className="hover:underline">100%</button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (opacityPk32 === 0) setOpacityPk32(0.85);
                    setActivePlanningLayer('pk32_dienkhanh');
                    mapRef.current?.flyTo({ center: [109.06155, 12.26125], zoom: 14.5, duration: 2000 });
                  }}
                  className="px-2 py-0.5 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100 rounded text-[10px] font-medium border border-fuchsia-200 flex items-center gap-0.5"
                >
                  📍 Định vị
                </button>
              </div>
            </div>

            {/* 12. Bản đồ Quy hoạch Phân khu 3 (Vector 1.407 ô) */}
            <div className="space-y-1 pt-2.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="flex items-center gap-1 text-gray-800">
                  🏞️ <span>Quy hoạch Phân khu 3</span>
                  <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-1 py-0.5 rounded border border-violet-200">Vector 1.407 ô</span>
                </span>
                <span className="text-violet-600 font-bold">{Math.round(opacityPk3 * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="1" step="0.05"
                value={opacityPk3}
                onChange={e => setOpacityPk3(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
              />
              <div className="flex justify-between items-center text-[10px]">
                <div className="flex gap-2 text-gray-500">
                  <button type="button" onClick={() => setOpacityPk3(0)} className="hover:underline">0%</button>
                  <button type="button" onClick={() => setOpacityPk3(0.5)} className="hover:underline">50%</button>
                  <button type="button" onClick={() => setOpacityPk3(1)} className="hover:underline">100%</button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (opacityPk3 === 0) setOpacityPk3(0.85);
                    setActivePlanningLayer('pk3_vector');
                    mapRef.current?.flyTo({ center: [109.10235, 12.15651], zoom: 12.6, duration: 2000 });
                  }}
                  className="px-2 py-0.5 bg-violet-50 text-violet-700 hover:bg-violet-100 rounded text-[10px] font-medium border border-violet-200 flex items-center gap-0.5"
                >
                  📍 Định vị
                </button>
              </div>
            </div>

            {/* 13. Quy hoạch Chung Đô thị mới Cam Lâm đến năm 2045 (1.438 ô) */}
            <div className="space-y-1 pt-2.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="flex items-center gap-1 text-gray-800">
                  🏙️ <span>QHC Đô thị mới Cam Lâm 2045</span>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-200">1.438 ô</span>
                </span>
                <span className="text-indigo-600 font-bold">{Math.round(opacityQhcCamLam2045 * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="1" step="0.05"
                value={opacityQhcCamLam2045}
                onChange={e => setOpacityQhcCamLam2045(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between items-center text-[10px]">
                <div className="flex gap-2 text-gray-500">
                  <button type="button" onClick={() => setOpacityQhcCamLam2045(0)} className="hover:underline">0%</button>
                  <button type="button" onClick={() => setOpacityQhcCamLam2045(0.5)} className="hover:underline">50%</button>
                  <button type="button" onClick={() => setOpacityQhcCamLam2045(1)} className="hover:underline">100%</button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (opacityQhcCamLam2045 === 0) setOpacityQhcCamLam2045(0.85);
                    setActivePlanningLayer('qhc_camlam_2045');
                    mapRef.current?.flyTo({ center: [109.135, 12.085], zoom: 13.2, duration: 2000 });
                  }}
                  className="px-2 py-0.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-[10px] font-medium border border-indigo-200 flex items-center gap-0.5"
                >
                  📍 Định vị
                </button>
              </div>
            </div>

            {/* 14. Điều chỉnh Quy hoạch Sử dụng đất đến năm 2030 huyện Cam Lâm */}
            <div className="space-y-1 pt-2.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="flex items-center gap-1 text-gray-800">
                  🗺️ <span>ĐCQH SDĐ 2030 Cam Lâm</span>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">KMZ 8K</span>
                </span>
                <span className="text-amber-600 font-bold">{Math.round(opacityCamlam2030 * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="1" step="0.05"
                value={opacityCamlam2030}
                onChange={e => setOpacityCamlam2030(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
              />
              <div className="flex justify-between items-center text-[10px]">
                <div className="flex gap-2 text-gray-500">
                  <button type="button" onClick={() => setOpacityCamlam2030(0)} className="hover:underline">0%</button>
                  <button type="button" onClick={() => setOpacityCamlam2030(0.5)} className="hover:underline">50%</button>
                  <button type="button" onClick={() => setOpacityCamlam2030(1)} className="hover:underline">100%</button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (opacityCamlam2030 === 0) setOpacityCamlam2030(0.85);
                    setActivePlanningLayer('camlam_2030');
                    mapRef.current?.flyTo({ center: [109.135, 12.085], zoom: 13.0, duration: 2000 });
                  }}
                  className="px-2 py-0.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded text-[10px] font-medium border border-amber-200 flex items-center gap-0.5"
                >
                  📍 Định vị
                </button>
              </div>
            </div>

            {/* 15. Mạng lưới Giao thông Đường bộ - QHC Cam Lâm 2045 (32.252 đoạn) */}
            <div className="space-y-1 pt-2.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="flex items-center gap-1 text-gray-800">
                  🛣️ <span>GT Đường bộ Cam Lâm 2045</span>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1 py-0.5 rounded border border-blue-200">32.252 đoạn</span>
                </span>
                <span className="text-blue-600 font-bold">{Math.round(opacityQhcCamLamGtBo * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="1" step="0.05"
                value={opacityQhcCamLamGtBo}
                onChange={e => setOpacityQhcCamLamGtBo(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between items-center text-[10px]">
                <div className="flex gap-2 text-gray-500">
                  <button type="button" onClick={() => setOpacityQhcCamLamGtBo(0)} className="hover:underline">0%</button>
                  <button type="button" onClick={() => setOpacityQhcCamLamGtBo(0.5)} className="hover:underline">50%</button>
                  <button type="button" onClick={() => setOpacityQhcCamLamGtBo(1)} className="hover:underline">100%</button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (opacityQhcCamLamGtBo === 0) setOpacityQhcCamLamGtBo(1);
                    setActivePlanningLayer('qhc_camlam_2045_gt_bo');
                    mapRef.current?.flyTo({ center: [109.135, 12.085], zoom: 13.5, duration: 2000 });
                  }}
                  className="px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[10px] font-medium border border-blue-200 flex items-center gap-0.5"
                >
                  📍 Định vị
                </button>
              </div>
            </div>

            {/* 16. Mạng lưới Giao thông Đường sắt - QHC Cam Lâm 2045 (684 đoạn) */}
            <div className="space-y-1 pt-2.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="flex items-center gap-1 text-gray-800">
                  🚆 <span>GT Đường sắt Cam Lâm 2045</span>
                  <span className="text-[10px] font-bold text-fuchsia-700 bg-fuchsia-50 px-1 py-0.5 rounded border border-fuchsia-200">684 đoạn</span>
                </span>
                <span className="text-fuchsia-700 font-bold">{Math.round(opacityQhcCamLamGtSat * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="1" step="0.05"
                value={opacityQhcCamLamGtSat}
                onChange={e => setOpacityQhcCamLamGtSat(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-fuchsia-700"
              />
              <div className="flex justify-between items-center text-[10px]">
                <div className="flex gap-2 text-gray-500">
                  <button type="button" onClick={() => setOpacityQhcCamLamGtSat(0)} className="hover:underline">0%</button>
                  <button type="button" onClick={() => setOpacityQhcCamLamGtSat(0.5)} className="hover:underline">50%</button>
                  <button type="button" onClick={() => setOpacityQhcCamLamGtSat(1)} className="hover:underline">100%</button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (opacityQhcCamLamGtSat === 0) setOpacityQhcCamLamGtSat(1);
                    setActivePlanningLayer('qhc_camlam_2045_gt_sat');
                    mapRef.current?.flyTo({ center: [109.135, 12.085], zoom: 13.5, duration: 2000 });
                  }}
                  className="px-2 py-0.5 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100 rounded text-[10px] font-medium border border-fuchsia-200 flex items-center gap-0.5"
                >
                  📍 Định vị
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
