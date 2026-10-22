"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import Map, { Source, Layer, Marker, Popup, NavigationControl, GeolocateControl, MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import MeasurementControlMapLibre from './MeasurementControlMapLibre';

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

export type LayerKey = '2030' | '2045' | 'khuvuc1' | 'docduong34' | 'dc21';
export type QuadCoords = [[number, number], [number, number], [number, number], [number, number]];

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
};

export default function MapLibreWrapper({ properties = [], searchLocation }: { properties?: Property[], searchLocation?: [number, number] | null }) {
  const [mounted, setMounted] = useState(false);
  const mapRef = useRef<MapRef>(null);
  const [popupInfo, setPopupInfo] = useState<Property | null>(null);

  const [showHeatmap, setShowHeatmap] = useState(false);
  const [streetMapOpacity, setStreetMapOpacity] = useState(0); // Độ mờ lớp Bản đồ Đường phố (OSM Map)
  
  // 5 Lớp Bản đồ Quy hoạch & Địa chính Cam Ranh
  const [opacity2030, setOpacity2030] = useState(0.7); // Mặc định mở Kế hoạch SDĐ 2030 (70%) để thấy ngay quy hoạch khi load trang
  const [opacity2045, setOpacity2045] = useState(0); // QHC Cam Ranh 2045 (1/10.000)
  const [opacityKhuVuc1, setOpacityKhuVuc1] = useState(0); // Phân khu 1/2000 Khu vực 1
  const [opacityDocDuong34, setOpacityDocDuong34] = useState(0); // 1/500 Dọc đường 3/4
  const [opacityDc21, setOpacityDc21] = useState(0); // Địa chính 1/500 Tờ 21 Cam Thuận
  const [opacityTo40, setOpacityTo40] = useState(0.85); // Địa chính Vector Tờ 40 Cam An Nam (389 thửa - GeoJSON)
  const [opacityKhuVuc1Vector, setOpacityKhuVuc1Vector] = useState(0.8); // Quy hoạch Phân khu 1 Cam Ranh (1.472 ô - GeoJSON)

  const [activePlanningLayer, setActivePlanningLayer] = useState<LayerKey | 'to40' | 'khuvuc1_vector'>('2030');
  const [selectedParcel, setSelectedParcel] = useState<{ lng: number; lat: number; properties: any } | null>(null);
  const [selectedPlanningZone, setSelectedPlanningZone] = useState<{ lng: number; lat: number; properties: any } | null>(null);
  const [isHoveredParcel, setIsHoveredParcel] = useState(false);

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

  const getLayerName = (layer: LayerKey | 'to40' | 'khuvuc1_vector') => {
    switch (layer) {
      case '2045': return 'QHC Cam Ranh 2045 (1/10.000)';
      case '2030': return 'Sử dụng đất 2030 (1/25.000)';
      case 'khuvuc1': return 'Phân khu 1/2000 Khu vực 1';
      case 'docduong34': return 'Dọc đường 3 Tháng 4 (1/500)';
      case 'dc21': return 'Địa chính Tờ 21 (1/500)';
      case 'to40': return 'Địa chính Tờ 40 Cam An Nam (Vector)';
      case 'khuvuc1_vector': return 'Quy hoạch Phân khu 1 (Vector 1.472 ô)';
    }
  };

  const updateSourceCoordinates = (layerKey: LayerKey, coords: QuadCoords) => {
    const sourceIdMap: Record<LayerKey, string> = {
      '2045': 'planning-cam-ranh-2045',
      '2030': 'planning-cam-ranh-2030',
      'khuvuc1': 'planning-khuvuc1',
      'docduong34': 'planning-docduong34',
      'dc21': 'planning-dc21',
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
    if (activePlanningLayer === 'to40' || activePlanningLayer === 'khuvuc1_vector') return;
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
    if (activePlanningLayer === 'to40' || activePlanningLayer === 'khuvuc1_vector') return;
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
    if (activePlanningLayer === 'to40' || activePlanningLayer === 'khuvuc1_vector') return;
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
    if (activePlanningLayer === 'to40' || activePlanningLayer === 'khuvuc1_vector') return;
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
    if (activePlanningLayer === 'to40' || activePlanningLayer === 'khuvuc1_vector') return;
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
    if (activePlanningLayer === 'to40' || activePlanningLayer === 'khuvuc1_vector') {
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
    if (activePlanningLayer === 'to40' || activePlanningLayer === 'khuvuc1_vector') return;
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
    if (activePlanningLayer === 'to40' || activePlanningLayer === 'khuvuc1_vector') return;
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

  const defaultCenter = properties.length > 0 && properties[0].lat && properties[0].lng
    ? { longitude: properties[0].lng, latitude: properties[0].lat }
    : { longitude: 109.135, latitude: 11.91 }; // Mặc định trung tâm TP Cam Ranh

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
    }
  };

  // Hàm chuyển tab trên thanh so sánh ngang: tự động bật độ mờ rõ ràng và bay mượt đến vị trí tương ứng
  const handleSelectPlanningTab = (layer: '2030' | '2045' | 'khuvuc1' | 'docduong34' | 'dc21' | 'to40' | 'khuvuc1_vector') => {
    setActivePlanningLayer(layer);
    
    // Tự động bật độ mờ cho lớp đang chọn và tắt các lớp khác để tập trung so sánh rõ ràng
    const targetOpacity = 0.75;
    setOpacity2045(layer === '2045' ? targetOpacity : 0);
    setOpacity2030(layer === '2030' ? targetOpacity : 0);
    setOpacityKhuVuc1(layer === 'khuvuc1' ? targetOpacity : 0);
    setOpacityDocDuong34(layer === 'docduong34' ? targetOpacity : 0);
    setOpacityDc21(layer === 'dc21' ? targetOpacity : 0);
    setOpacityTo40(layer === 'to40' ? 0.85 : 0);
    setOpacityKhuVuc1Vector(layer === 'khuvuc1_vector' ? 0.8 : 0);

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
    }
  };

  const handleMapClick = (e: any) => {
    if (measureMode !== 'none') return;
    const features = e.features;
    if (features && features.length > 0) {
      // 1. Thửa đất địa chính Tờ 40
      const parcel = features.find((f: any) => f.layer.id === 'cadastre-40-fill');
      if (parcel) {
        setSelectedPlanningZone(null);
        setSelectedParcel({
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
          properties: parcel.properties
        });
        return;
      }
      // 2. Ô quy hoạch phân khu 1
      const zone = features.find((f: any) => f.layer.id === 'khuvuc1-vector-fill');
      if (zone) {
        setSelectedParcel(null);
        setSelectedPlanningZone({
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
          properties: zone.properties
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
          zoom: 13
        }}
        mapStyle={{
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
        }}
        interactiveLayerIds={['cadastre-40-fill', 'khuvuc1-vector-fill']}
        onClick={handleMapClick}
        onMouseEnter={(e: any) => {
          if (e.features && e.features.length > 0) {
            setIsHoveredParcel(true);
          }
        }}
        onMouseLeave={() => {
          setIsHoveredParcel(false);
        }}
        style={{ width: '100%', height: '100%', cursor: measureMode !== 'none' ? 'crosshair' : isHoveredParcel ? 'pointer' : 'grab' }}
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
          tiles={['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png']} 
          tileSize={256} 
          maxzoom={19}
        >
          <Layer 
            id="osm-layer" 
            type="raster" 
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
            paint={{ 
              'fill-color': ['get', 'MauSac'], 
              'fill-opacity': opacityKhuVuc1Vector * 0.65 
            }} 
          />
          {/* Lớp Viền ranh giới quy hoạch */}
          <Layer 
            id="khuvuc1-vector-line" 
            type="line" 
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
        {selectedParcel && (
          <Popup
            longitude={selectedParcel.lng}
            latitude={selectedParcel.lat}
            anchor="bottom"
            offset={15}
            onClose={() => setSelectedParcel(null)}
            className="z-50"
          >
            <div className="p-1 min-w-[220px] text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
                <span className="font-bold text-red-600 text-sm">
                  Thửa #{selectedParcel.properties.SHTHUA}
                </span>
                <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold text-[10px]">
                  Tờ #{selectedParcel.properties.SHBANDO || '40'}
                </span>
              </div>
              <div className="space-y-1.5 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Diện tích:</span>
                  <span className="font-bold text-emerald-600 text-sm">
                    {Number(selectedParcel.properties.DIENTICH || 0).toLocaleString('vi-VN')} m²
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Loại đất:</span>
                  <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {selectedParcel.properties.KHLOAIDAT || selectedParcel.properties.MDSD2003 || 'Chưa xác định'}
                  </span>
                </div>
                {selectedParcel.properties.DIADANH && (
                  <div className="flex justify-between items-start gap-1">
                    <span className="text-gray-500 whitespace-nowrap">Chủ / Địa danh:</span>
                    <span className="font-semibold text-gray-800 text-right">
                      {selectedParcel.properties.DIADANH}
                    </span>
                  </div>
                )}
                {selectedParcel.properties.DaCapGCN !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Cấp GCN:</span>
                    <span className="text-[11px] text-gray-700">
                      {selectedParcel.properties.DaCapGCN === 1 ? '✅ Đã cấp GCN' : 'Chưa cấp GCN'}
                    </span>
                  </div>
                )}
                <div className="text-[10px] text-gray-500 pt-1.5 border-t border-gray-100 flex items-center justify-between">
                  <span>📍 Cam An Nam, Cam Lâm</span>
                  <span className="text-gray-400">#ID: {selectedParcel.properties.ID}</span>
                </div>
              </div>
            </div>
          </Popup>
        )}

        {/* Popup Ô Quy hoạch Phân khu 1 GeoJSON */}
        {selectedPlanningZone && (
          <Popup
            longitude={selectedPlanningZone.lng}
            latitude={selectedPlanningZone.lat}
            anchor="bottom"
            offset={15}
            onClose={() => setSelectedPlanningZone(null)}
            className="z-50"
          >
            <div className="p-1 min-w-[240px] text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
                <span className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                  <span
                    className="w-3.5 h-3.5 rounded-full inline-block border border-gray-300 shadow-sm"
                    style={{ backgroundColor: selectedPlanningZone.properties.MauSac || '#3b82f6' }}
                  />
                  <span>{selectedPlanningZone.properties.TenQuyHoach || 'Quy hoạch xây dựng'}</span>
                </span>
              </div>
              <div className="space-y-1.5 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Mã lớp CAD:</span>
                  <span className="font-mono text-[10px] text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                    {selectedPlanningZone.properties.Layer}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Khu vực:</span>
                  <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                    Phân khu 1 Cam Ranh
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
                  <span>📍 Ven vịnh Cam Ranh</span>
                  <span>ID: #{selectedPlanningZone.properties.ID}</span>
                </div>
              </div>
            </div>
          </Popup>
        )}

        <MeasurementControlMapLibre mode={measureMode} setMode={setMeasureMode} />

        {/* 4 Chốt kéo ở 4 góc và 1 Chốt tâm khi bật Chế độ Căn chỉnh thủ công */}
        {isCalibrating && activePlanningLayer !== 'to40' && activePlanningLayer !== 'khuvuc1_vector' && layerCoords[activePlanningLayer as LayerKey] && (
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
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[450] max-w-[95vw] sm:max-w-2xl">
        <div className="bg-white/95 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl shadow-xl border border-gray-200/90 flex flex-col gap-1.5 text-xs sm:text-sm font-semibold select-none">
          {/* Tabs chọn nhanh bản đồ gán vào thanh trượt ngang */}
          <div className="flex items-center justify-center gap-1 overflow-x-auto pb-1 max-w-full text-[11px] font-medium text-gray-600 scrollbar-none">
            <button
              type="button"
              onClick={() => handleSelectPlanningTab('2045')}
              className={`px-2 py-0.5 rounded-lg whitespace-nowrap transition-colors ${activePlanningLayer === '2045' ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'hover:bg-gray-100'}`}
            >
              QHC 2045 (1/10k)
            </button>
            <button
              type="button"
              onClick={() => handleSelectPlanningTab('2030')}
              className={`px-2 py-0.5 rounded-lg whitespace-nowrap transition-colors ${activePlanningLayer === '2030' ? 'bg-blue-600 text-white font-bold shadow-sm' : 'hover:bg-gray-100'}`}
            >
              SDĐ 2030 (1/25k)
            </button>
            <button
              type="button"
              onClick={() => handleSelectPlanningTab('khuvuc1')}
              className={`px-2 py-0.5 rounded-lg whitespace-nowrap transition-colors ${activePlanningLayer === 'khuvuc1' ? 'bg-amber-600 text-white font-bold shadow-sm' : 'hover:bg-gray-100'}`}
            >
              Khu vực 1 (1/2k)
            </button>
            <button
              type="button"
              onClick={() => handleSelectPlanningTab('docduong34')}
              className={`px-2 py-0.5 rounded-lg whitespace-nowrap transition-colors ${activePlanningLayer === 'docduong34' ? 'bg-purple-600 text-white font-bold shadow-sm' : 'hover:bg-gray-100'}`}
            >
              Đường 3/4 (1/500)
            </button>
            <button
              type="button"
              onClick={() => handleSelectPlanningTab('dc21')}
              className={`px-2 py-0.5 rounded-lg whitespace-nowrap transition-colors ${activePlanningLayer === 'dc21' ? 'bg-rose-600 text-white font-bold shadow-sm' : 'hover:bg-gray-100'}`}
            >
              Tờ 21 (1/500)
            </button>
            <button
              type="button"
              onClick={() => handleSelectPlanningTab('khuvuc1_vector')}
              className={`px-2 py-0.5 rounded-lg whitespace-nowrap transition-colors ${activePlanningLayer === 'khuvuc1_vector' ? 'bg-amber-600 text-white font-bold shadow-sm' : 'hover:bg-gray-100'}`}
            >
              PK1 (Vector)
            </button>
            <button
              type="button"
              onClick={() => handleSelectPlanningTab('to40')}
              className={`px-2 py-0.5 rounded-lg whitespace-nowrap transition-colors ${activePlanningLayer === 'to40' ? 'bg-emerald-600 text-white font-bold shadow-sm' : 'hover:bg-gray-100'}`}
            >
              Tờ 40 (Vector)
            </button>
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
                  { key: 'khuvuc1', label: 'Khu vực 1' },
                  { key: 'docduong34', label: 'Đường 3/4' },
                  { key: 'dc21', label: 'Tờ 21 (1/500)' },
                  { key: '2045', label: 'QHC 2045' },
                  { key: '2030', label: 'SDĐ 2030' },
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
          {!isLayersCollapsed && <span className="font-bold text-gray-800">Lớp Bản đồ ({[streetMapOpacity, opacity2045, opacity2030, opacityKhuVuc1, opacityDocDuong34, opacityDc21].filter(o => o > 0).length} đang bật)</span>}
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
          </div>
        )}
      </div>
    </div>
  );
}
