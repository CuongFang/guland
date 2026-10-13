"use client";

import { useEffect, useState, RefObject } from 'react';
import { Source, Layer, useMap } from 'react-map-gl/maplibre';
import * as turf from '@turf/turf';
import type { MapRef } from 'react-map-gl/maplibre';

export default function MeasurementControlMapLibre({
  mode,
  setMode
}: {
  mode: 'none' | 'distance' | 'area';
  setMode: (mode: 'none' | 'distance' | 'area') => void;
}) {
  const { current: mapRefContext } = useMap();
  const [points, setPoints] = useState<[number, number][]>([]);
  const [mousePos, setMousePos] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (mode === 'none') {
      setPoints([]);
      setMousePos(null);
      return;
    }

    const map = mapRefContext?.getMap();
    if (!map) return;

    const onClick = (e: any) => {
      setPoints(prev => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
    };

    const onMouseMove = (e: any) => {
      setMousePos([e.lngLat.lng, e.lngLat.lat]);
    };

    map.on('click', onClick);
    map.on('mousemove', onMouseMove);

    return () => {
      map.off('click', onClick);
      map.off('mousemove', onMouseMove);
    };
  }, [mode, mapRefContext]);

  const activePoints = mousePos ? [...points, mousePos] : points;

  // Tính toán Turf
  let resultText = '';
  let geojson: any = null;

  if (mode === 'distance' && activePoints.length > 1) {
    const line = turf.lineString(activePoints);
    const lengthKm = turf.length(line, { units: 'kilometers' });
    resultText = lengthKm < 1 ? `${Math.round(lengthKm * 1000)} mét` : `${lengthKm.toFixed(2)} km`;
    geojson = line;
  } else if (mode === 'area' && activePoints.length > 2) {
    // Để vẽ Polygon thì phải khép kín
    const ring = [...activePoints, activePoints[0]];
    // Chỉ tính diện tích khi có >= 3 điểm cố định
    if (points.length > 2) {
      const fixedRing = [...points, points[0]];
      const polygon = turf.polygon([fixedRing]);
      const areaSqMeters = turf.area(polygon);
      resultText = areaSqMeters > 10000 ? `${(areaSqMeters / 10000).toFixed(2)} Hecta` : `${Math.round(areaSqMeters)} m²`;
    }
    geojson = turf.polygon([ring]);
  } else if (activePoints.length > 0) {
    // Vẽ điểm tạm khi mới có 1 điểm
    geojson = turf.point(activePoints[0]);
  }

  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <>
      <div className={`absolute top-16 right-4 z-[500] bg-white rounded-xl shadow-lg border border-gray-200 text-sm text-black transition-all duration-300 overflow-hidden flex flex-col ${isCollapsed ? 'w-12 h-12' : 'w-48'}`}>
        {/* Nút thu gọn / mở rộng */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center w-full h-full' : 'justify-between px-3 py-2 border-b border-gray-100 bg-gray-50'}`}>
          {!isCollapsed && <span className="font-bold text-gray-800">Công cụ Đo đạc</span>}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
            title={isCollapsed ? "Mở công cụ đo đạc" : "Thu gọn"}
          >
            {isCollapsed ? '📐' : '✖'}
          </button>
        </div>

        {!isCollapsed && (
          <div className="flex flex-col gap-2 p-3">
            <button 
              onClick={() => { setMode(mode === 'distance' ? 'none' : 'distance'); setPoints([]); }}
              className={`text-left px-2 py-2 rounded hover:bg-gray-100 flex items-center gap-2 ${mode === 'distance' ? 'bg-blue-100 text-blue-700 font-semibold' : ''}`}
            >
              <span>📏</span> Đo Khoảng cách
            </button>
            <button 
              onClick={() => { setMode(mode === 'area' ? 'none' : 'area'); setPoints([]); }}
              className={`text-left px-2 py-2 rounded hover:bg-gray-100 flex items-center gap-2 ${mode === 'area' ? 'bg-blue-100 text-blue-700 font-semibold' : ''}`}
            >
              <span>📐</span> Đo Diện tích
            </button>
            {mode !== 'none' && (
              <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                {resultText ? (
                  <div className="font-bold text-red-600 mb-1">Kết quả: {resultText}</div>
                ) : (
                  <div className="italic mb-1 text-gray-500">Click trên bản đồ để đo...</div>
                )}
                <button 
                  onClick={() => setPoints([])}
                  className="w-full text-center bg-gray-200 hover:bg-gray-300 py-1.5 rounded font-medium transition-colors"
                >
                  Xóa làm lại
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {geojson && (
        <Source id="measure-data" type="geojson" data={geojson}>
          {mode === 'distance' && (
            <Layer 
              id="measure-line" 
              type="line" 
              paint={{ 'line-color': '#ef4444', 'line-width': 3, 'line-dasharray': [2, 2] }} 
            />
          )}
          {mode === 'area' && (
            <Layer 
              id="measure-fill" 
              type="fill" 
              paint={{ 'fill-color': '#3b82f6', 'fill-opacity': 0.3 }} 
            />
          )}
          {mode === 'area' && (
            <Layer 
              id="measure-outline" 
              type="line" 
              paint={{ 'line-color': '#2563eb', 'line-width': 2 }} 
            />
          )}
          {activePoints.length === 1 && (
            <Layer 
              id="measure-point" 
              type="circle" 
              paint={{ 'circle-radius': 5, 'circle-color': '#ef4444' }} 
            />
          )}
        </Source>
      )}
    </>
  );
}
