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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

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

      {/* Sidebar - Danh sách BĐS */}
      <aside 
        className={`bg-white border-r border-gray-200 flex flex-col z-10 shadow-lg relative transition-all duration-300 overflow-hidden ${
          isSidebarOpen ? 'w-96 border-r' : 'w-0 border-r-0'
        }`}
      >
        <div className="w-96 flex flex-col h-full">
          <div className="p-4 border-b border-gray-200 bg-blue-600 text-white">
            <h1 className="text-xl font-bold">Danh sách Tin đăng</h1>
            <p className="text-sm opacity-80">Có {filteredProperties.length} bất động sản phù hợp</p>
          </div>
          
          {/* Thanh tìm kiếm / Lọc */}
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
            <input 
              type="text" 
              placeholder="Tìm kiếm vị trí, dự án..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            />
            <div className="flex gap-2 mt-2">
              <select 
                value={priceFilter}
                onChange={(e) => setPriceFilter(e.target.value)}
                className="flex-1 p-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Mức giá</option>
                <option value="under2">Dưới 2 tỷ</option>
                <option value="2to5">2 - 5 tỷ</option>
                <option value="above5">Trên 5 tỷ</option>
              </select>
              <select 
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                className="flex-1 p-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Diện tích</option>
                <option value="under50">Dưới 50m²</option>
                <option value="above50">Trên 50m²</option>
              </select>
            </div>
            
            <button 
              onClick={() => setIsVn2000Open(true)}
              className="mt-3 w-full bg-blue-100 text-blue-700 hover:bg-blue-200 py-2 text-sm font-semibold rounded-md border border-blue-200 transition-colors flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
              </svg>
              Tra cứu Tọa độ VN-2000
            </button>
          </div>

          {/* Danh sách kết quả */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {filteredProperties.length > 0 ? (
              filteredProperties.map((prop: any) => (
                <div key={prop.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-md cursor-pointer transition-shadow bg-white relative">
                  {prop.images && prop.images.length > 0 ? (
                    <div className="w-full h-32 rounded-md mb-2 overflow-hidden bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={prop.images[0]} alt={prop.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-full h-32 bg-gray-100 rounded-md mb-2 flex items-center justify-center text-gray-400 text-xs">
                      Chưa có ảnh
                    </div>
                  )}
                  <h3 className="font-semibold text-gray-800 text-sm line-clamp-2" title={prop.title}>{prop.title}</h3>
                  <p className="text-red-600 font-bold mt-1">{formatPrice(prop.price)}</p>
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-gray-500 line-clamp-1">{prop.location}</p>
                    <p className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded">{prop.area} m²</p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-xs text-gray-400">
                    <span>Người đăng: <span className="font-medium text-gray-600">{prop.profiles?.full_name || 'Ẩn danh'}</span></span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-sm text-gray-500 mt-10">
                Không tìm thấy bất động sản nào phù hợp với bộ lọc!
              </div>
            )}
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
