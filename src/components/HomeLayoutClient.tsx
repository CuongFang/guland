"use client";

import { useState, useMemo } from 'react';
import MapWrapper from '@/components/MapWrapper';
import VN2000SearchModal from '@/components/VN2000SearchModal';

export default function HomeLayoutClient({ properties }: { properties: any[] }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [priceFilter, setPriceFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  
  const [isVn2000Open, setIsVn2000Open] = useState(false);
  const [vn2000Location, setVn2000Location] = useState<[number, number] | null>(null);

  // Logic bộ lọc
  const filteredProperties = useMemo(() => {
    let result = properties || [];

    if (searchTerm.trim() !== '') {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(
        (p) => p.title?.toLowerCase().includes(lowerTerm) || p.location?.toLowerCase().includes(lowerTerm)
      );
    }

    if (priceFilter) {
      result = result.filter((p) => {
        if (priceFilter === 'under2') return p.price < 2_000_000_000;
        if (priceFilter === '2to5') return p.price >= 2_000_000_000 && p.price <= 5_000_000_000;
        if (priceFilter === 'above5') return p.price > 5_000_000_000;
        return true;
      });
    }

    if (areaFilter) {
      result = result.filter((p) => {
        if (areaFilter === 'under50') return p.area < 50;
        if (areaFilter === 'above50') return p.area >= 50;
        return true;
      });
    }

    return result;
  }, [properties, searchTerm, priceFilter, areaFilter]);

  return (
    <main className="flex h-full w-full bg-white overflow-hidden text-black relative">
      {/* Nút thu gọn / mở rộng Sidebar (Nằm giữa cạnh phải của Sidebar) */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className={`absolute top-1/2 -translate-y-1/2 z-[400] bg-white border border-gray-300 shadow-md flex items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-all duration-300 
          ${isSidebarOpen 
            ? 'left-[24rem] w-6 h-14 rounded-r-lg border-l-0' 
            : 'left-0 w-8 h-14 rounded-r-lg border-l-0'
          }`}
        title={isSidebarOpen ? 'Thu gọn danh sách' : 'Mở danh sách'}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="14" 
          height="14" 
          fill="currentColor" 
          className={`transition-transform duration-300 stroke-[1px] ${isSidebarOpen ? 'rotate-180' : 'rotate-0'}`} 
          viewBox="0 0 16 16"
        >
          <path fillRule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
        </svg>
      </button>

      {/* Sidebar - Bộ lọc & Tra cứu */}
      <aside 
        className={`bg-white border-r border-gray-200 flex flex-col z-10 shadow-lg relative transition-all duration-300 overflow-hidden ${
          isSidebarOpen ? 'w-96 border-r' : 'w-0 border-r-0'
        }`}
      >
        <div className="w-96 flex flex-col h-full bg-white">
          <div className="p-4 border-b border-gray-200 bg-blue-600 text-white">
            <h1 className="text-xl font-bold">Tìm kiếm & Tra cứu</h1>
            <p className="text-xs text-blue-100 mt-0.5">Bộ lọc quy hoạch & tra cứu tọa độ VN-2000</p>
          </div>
          
          {/* Thanh tìm kiếm / Lọc */}
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Từ khóa tìm kiếm</label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Tìm vị trí, dự án, tên đường..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                />
                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Mức giá</label>
                <select 
                  value={priceFilter}
                  onChange={(e) => setPriceFilter(e.target.value)}
                  className="w-full p-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                >
                  <option value="">Tất cả giá</option>
                  <option value="under2">Dưới 2 tỷ</option>
                  <option value="2to5">2 - 5 tỷ</option>
                  <option value="above5">Trên 5 tỷ</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Diện tích</label>
                <select 
                  value={areaFilter}
                  onChange={(e) => setAreaFilter(e.target.value)}
                  className="w-full p-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                >
                  <option value="">Tất cả diện tích</option>
                  <option value="under50">Dưới 50m²</option>
                  <option value="above50">Trên 50m²</option>
                </select>
              </div>
            </div>

            {(searchTerm || priceFilter || areaFilter) && (
              <div className="flex justify-between items-center pt-1">
                <span className="text-xs text-gray-500">
                  {filteredProperties.length} kết quả trên bản đồ
                </span>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setPriceFilter('');
                    setAreaFilter('');
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                >
                  ✕ Xóa bộ lọc
                </button>
              </div>
            )}
            
            <div className="pt-2 border-t border-gray-200">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Định vị thửa đất</label>
              <button 
                onClick={() => setIsVn2000Open(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-sm font-semibold rounded-md shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
                </svg>
                Tra cứu Tọa độ VN-2000
              </button>
            </div>
          </div>

          {/* Hướng dẫn tiện ích */}
          <div className="flex-1 p-4 bg-gray-50/50 overflow-y-auto space-y-3 text-xs text-gray-600">
            <div className="bg-white p-3.5 rounded-lg border border-gray-200 shadow-sm space-y-2">
              <h3 className="font-semibold text-gray-800 text-xs uppercase tracking-wider flex items-center gap-1.5 text-blue-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Hướng dẫn tra cứu
              </h3>
              <ul className="space-y-2 text-gray-600 list-disc list-inside">
                <li><strong className="text-gray-700">Tra tọa độ VN-2000:</strong> Bấm nút phía trên để nhập tọa độ X, Y góc ranh từ sổ đỏ và tự động bay đến vị trí thửa đất.</li>
                <li><strong className="text-gray-700">So sánh quy hoạch:</strong> Dùng thanh trượt ở góc dưới bản đồ để so sánh giữa bản đồ quy hoạch và vệ tinh thực tế.</li>
                <li><strong className="text-gray-700">Lớp bản đồ:</strong> Chọn các tab (2030, 2045, Khu vực 1, Đường 3/4, Tờ 21) để kiểm tra thông tin đất.</li>
              </ul>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content - Map */}
      <section className="flex-1 relative z-0">
        <MapWrapper properties={filteredProperties} searchLocation={vn2000Location} />
      </section>

      {/* VN2000 Modal */}
      {isVn2000Open && (
        <VN2000SearchModal 
          onClose={() => setIsVn2000Open(false)} 
          onLocationFound={(lat, lng) => setVn2000Location([lat, lng])} 
        />
      )}
    </main>
  );
}
