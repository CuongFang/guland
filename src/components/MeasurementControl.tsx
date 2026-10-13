"use client";

import { useMap, useMapEvents, Polyline, Polygon, Marker, Tooltip } from 'react-leaflet';
import { useState, useEffect } from 'react';
import * as turf from '@turf/turf';

export default function MeasurementControl({
  mode,
  setMode
}: {
  mode: 'none' | 'distance' | 'area',
  setMode: (mode: 'none' | 'distance' | 'area') => void
}) {
  const [points, setPoints] = useState<[number, number][]>([]);
  const [mousePos, setMousePos] = useState<[number, number] | null>(null);

  useMapEvents({
    click(e) {
      if (mode === 'none') return;
      setPoints([...points, [e.latlng.lat, e.latlng.lng]]);
    },
    mousemove(e) {
      if (mode === 'none') {
        setMousePos(null);
        return;
      }
      setMousePos([e.latlng.lat, e.latlng.lng]);
    }
  });

  // Khi tắt chế độ đo, xoá dữ liệu
  useEffect(() => {
    if (mode === 'none') {
      setPoints([]);
      setMousePos(null);
    }
  }, [mode]);

  const activePoints = mousePos ? [...points, mousePos] : points;

  // Tính toán
  let resultText = '';
  if (mode === 'distance' && points.length > 0) {
    const line = turf.lineString(activePoints.map(p => [p[1], p[0]])); // Turf dùng [lng, lat]
    const lengthKm = turf.length(line, { units: 'kilometers' });
    resultText = lengthKm < 1 ? `${Math.round(lengthKm * 1000)} mét` : `${lengthKm.toFixed(2)} km`;
  } else if (mode === 'area' && points.length > 2) {
    // Polygon cần khép kín: thêm điểm đầu vào cuối
    const ring = [...points, points[0]].map(p => [p[1], p[0]]);
    const polygon = turf.polygon([ring]);
    const areaSqMeters = turf.area(polygon);
    resultText = areaSqMeters > 10000 ? `${(areaSqMeters / 10000).toFixed(2)} Hecta` : `${Math.round(areaSqMeters)} m²`;
  }

  return (
    <>
      {/* UI Control Panel */}
      <div className="leaflet-top leaflet-right" style={{ top: '60px', right: '10px', position: 'absolute', zIndex: 1000 }}>
        <div className="leaflet-control bg-white rounded-md shadow-md border border-gray-300 p-2 text-sm flex flex-col gap-2 w-40">
          <div className="font-bold border-b pb-1">Công cụ Đo đạc</div>
          <button 
            onClick={() => { setMode(mode === 'distance' ? 'none' : 'distance'); setPoints([]); }}
            className={`text-left px-2 py-1 rounded hover:bg-gray-100 ${mode === 'distance' ? 'bg-blue-100 text-blue-700 font-semibold' : ''}`}
          >
            📏 Đo Khoảng cách
          </button>
          <button 
            onClick={() => { setMode(mode === 'area' ? 'none' : 'area'); setPoints([]); }}
            className={`text-left px-2 py-1 rounded hover:bg-gray-100 ${mode === 'area' ? 'bg-blue-100 text-blue-700 font-semibold' : ''}`}
          >
            📐 Đo Diện tích
          </button>
          {mode !== 'none' && (
            <div className="mt-2 text-xs text-gray-600">
              {resultText ? (
                <div className="font-bold text-red-600 mb-1">Kết quả: {resultText}</div>
              ) : (
                <div className="italic mb-1">Click bản đồ để đo...</div>
              )}
              <button 
                onClick={() => setPoints([])}
                className="w-full text-center bg-gray-200 hover:bg-gray-300 py-1 rounded"
              >
                Xóa làm lại
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Render Hình vẽ */}
      {mode === 'distance' && activePoints.length > 1 && (
        <Polyline positions={activePoints} pathOptions={{ color: 'red', weight: 3, dashArray: '5, 5' }} />
      )}
      {mode === 'area' && points.length > 1 && (
        <>
          <Polygon 
            positions={activePoints.length > 2 ? activePoints : points} 
            pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.3, weight: 2 }} 
          />
        </>
      )}
    </>
  );
}
