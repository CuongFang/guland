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
  const [planningOpacity, setPlanningOpacity] = useState(0); // Mặc định 0%
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
        if (mapRef.current) {
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
    : { longitude: 106.660172, latitude: 10.762622 };

  if (!mounted) return <div className="h-full w-full bg-gray-100 flex items-center justify-center">Đang tải bản đồ 3D...</div>;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
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

        {/* Lớp Bản đồ Quy hoạch 2030 (Demo dùng lớp giao thông OSM đè lên vệ tinh) */}
        <Source id="planning" type="raster" tiles={['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png']} tileSize={256} maxzoom={19}>
          <Layer id="planning-layer" type="raster" paint={{ 'raster-opacity': planningOpacity }} />
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

      {/* Toggles Panel */}
      <div className={`absolute bottom-6 left-6 z-[500] bg-white rounded-xl shadow-lg border border-gray-200 text-black transition-all duration-300 overflow-hidden flex flex-col ${isLayersCollapsed ? 'w-12 h-12' : 'w-64'}`}>
        {/* Nút thu gọn / mở rộng */}
        <div className={`flex items-center ${isLayersCollapsed ? 'justify-center w-full h-full' : 'justify-between px-4 py-3 border-b border-gray-100 bg-gray-50'}`}>
          {!isLayersCollapsed && <span className="font-bold text-gray-800">Lớp Bản đồ</span>}
          <button 
            onClick={() => setIsLayersCollapsed(!isLayersCollapsed)}
            className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
            title={isLayersCollapsed ? "Mở lớp bản đồ" : "Thu gọn"}
          >
            {isLayersCollapsed ? '🗺️' : '✖'}
          </button>
        </div>

        {!isLayersCollapsed && (
          <div className="p-4 space-y-4">
            {/* Heatmap Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={showHeatmap} 
                onChange={e => setShowHeatmap(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm font-medium">Bản đồ nhiệt (Heatmap)</span>
            </label>

            {/* Planning Opacity Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-sm font-medium">
                <span>Quy hoạch 2030</span>
                <span>{Math.round(planningOpacity * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="1" step="0.05"
                value={planningOpacity}
                onChange={e => setPlanningOpacity(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
