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

  const [activePlanningLayer, setActivePlanningLayer] = useState<'2030' | '2045' | 'khuvuc1' | 'docduong34' | 'dc21'>('2030');

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
  }, []);

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
    }
  };

  // Hàm chuyển tab trên thanh so sánh ngang: tự động bật độ mờ rõ ràng và bay mượt đến vị trí tương ứng
  const handleSelectPlanningTab = (layer: '2030' | '2045' | 'khuvuc1' | 'docduong34' | 'dc21') => {
    setActivePlanningLayer(layer);
    
    // Tự động bật độ mờ 75% cho lớp đang chọn và tắt các lớp khác để tập trung so sánh rõ ràng
    const targetOpacity = 0.75;
    setOpacity2045(layer === '2045' ? targetOpacity : 0);
    setOpacity2030(layer === '2030' ? targetOpacity : 0);
    setOpacityKhuVuc1(layer === 'khuvuc1' ? targetOpacity : 0);
    setOpacityDocDuong34(layer === 'docduong34' ? targetOpacity : 0);
    setOpacityDc21(layer === 'dc21' ? targetOpacity : 0);

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
          coordinates={[
            [109.003095, 12.026543], // Top-Left (Tây Bắc)
            [109.296956, 12.025596], // Top-Right (Đông Bắc)
            [109.295989, 11.772498], // Bottom-Right (Đông Nam)
            [109.002399, 11.773424], // Bottom-Left (Tây Nam)
          ]}
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
          coordinates={[
            [109.003095, 12.026543], // Top-Left (Tây Bắc)
            [109.296956, 12.025596], // Top-Right (Đông Bắc)
            [109.295989, 11.772498], // Bottom-Right (Đông Nam)
            [109.002399, 11.773424], // Bottom-Left (Tây Nam)
          ]}
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
          coordinates={[
            [109.113441, 11.999380], // Top-Left (Tây Bắc)
            [109.194403, 11.998904], // Top-Right (Đông Bắc)
            [109.216069, 11.876910], // Bottom-Right (Đông Nam)
            [109.135107, 11.877386], // Bottom-Left (Tây Nam)
          ]}
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
          coordinates={[
            [109.150574, 11.914948], // Top-Left (Tây Bắc)
            [109.158802, 11.914948], // Top-Right (Đông Bắc)
            [109.158802, 11.911839], // Bottom-Right (Đông Nam)
            [109.150574, 11.911839], // Bottom-Left (Tây Nam)
          ]}
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
          coordinates={[
            [109.150985, 11.914792], // Top-Left (NW)
            [109.154198, 11.914782], // Top-Right (NE)
            [109.154187, 11.911618], // Bottom-Right (SE)
            [109.150975, 11.911628], // Bottom-Left (SW)
          ]}
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

        <MeasurementControlMapLibre mode={measureMode} setMode={setMeasureMode} />
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
          </div>
        </div>
      </div>

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
          </div>
        )}
      </div>
    </div>
  );
}
