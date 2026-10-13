"use client";

import { useState } from 'react';
import { PROVINCES, convertVN2000ToWGS84 } from '@/utils/vn2000';
import { useUserStore } from '@/store/useUserStore';
import UpgradeModal from './UpgradeModal';

export default function VN2000SearchModal({ 
  onClose, 
  onLocationFound 
}: { 
  onClose: () => void,
  onLocationFound: (lat: number, lng: number) => void 
}) {
  const [x, setX] = useState('');
  const [y, setY] = useState('');
  const [ktt, setKtt] = useState(PROVINCES[0].ktt);

  const incrementSearch = useUserStore(state => state.incrementSearch);
  const searchCount = useUserStore(state => state.searchCount);
  const isVip = useUserStore(state => state.isVip)();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    // Check paywall
    if (!incrementSearch()) {
      setShowUpgrade(true);
      return;
    }

    const nx = parseFloat(x);
    const ny = parseFloat(y);
    if (isNaN(nx) || isNaN(ny)) {
      alert('Tọa độ không hợp lệ');
      return;
    }
    try {
      const [lat, lng] = convertVN2000ToWGS84(nx, ny, ktt);
      onLocationFound(lat, lng);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Lỗi chuyển đổi tọa độ');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[1000] flex items-center justify-center text-black">
      <div className="bg-white rounded-lg shadow-lg p-6 w-96 max-w-[90%] relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 font-bold"
        >
          ✕
        </button>
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold">Tra cứu VN-2000</h2>
          {isVip ? (
            <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold border border-yellow-300">VIP</span>
          ) : (
            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">Lượt: {3 - searchCount}/3</span>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-4">Nhập tọa độ X, Y trên sổ hồng để xác định vị trí thửa đất.</p>
        
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tỉnh / Thành phố</label>
            <select 
              value={ktt} 
              onChange={(e) => setKtt(parseFloat(e.target.value))}
              className="w-full border border-gray-300 p-2 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PROVINCES.map(p => (
                <option key={p.id} value={p.ktt}>{p.name} (KTT: {p.ktt})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tọa độ X (Trục dọc)</label>
            <input 
              type="number" 
              step="any"
              value={x}
              onChange={(e) => setX(e.target.value)}
              required
              placeholder="VD: 1192345.67"
              className="w-full border border-gray-300 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tọa độ Y (Trục ngang)</label>
            <input 
              type="number" 
              step="any"
              value={y}
              onChange={(e) => setY(e.target.value)}
              required
              placeholder="VD: 601234.56"
              className="w-full border border-gray-300 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-blue-600 text-white font-bold py-2 rounded-md hover:bg-blue-700 transition"
          >
            Chuyển sang GPS & Tìm vị trí
          </button>
        </form>
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}
