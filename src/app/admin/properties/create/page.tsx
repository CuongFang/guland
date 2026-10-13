"use client";

import { useRef, useState } from 'react';
import { createProperty } from '@/app/actions/property';

export default function CreatePropertyPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setError(null);
    
    // Gọi Server Action
    const result = await createProperty(formData);
    
    // Nếu action trả về object có chứa error, nghĩa là có lỗi (không đủ credit hoặc chưa đăng nhập)
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div className="p-8 text-black">
      <div className="max-w-3xl mx-auto bg-white p-6 shadow rounded-lg border border-gray-200">
        <h1 className="text-2xl font-bold mb-2">Đăng tin Bất động sản mới</h1>
        <p className="text-sm text-gray-500 mb-6 border-b pb-4">
          Phí đăng tin: <span className="font-bold text-red-600">500 Credit</span> / tin
        </p>

        {error && (
          <div className="mb-4 bg-red-50 p-4 border border-red-200 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        <form ref={formRef} action={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Tiêu đề bài đăng</label>
            <input 
              type="text" 
              name="title" 
              required 
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white"
              placeholder="VD: Bán gấp nhà phố mặt tiền..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Mức giá (VNĐ)</label>
              <input 
                type="number" 
                name="price" 
                required 
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white"
                placeholder="VD: 5000000000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Diện tích (m²)</label>
              <input 
                type="number" 
                name="area" 
                required 
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white"
                placeholder="VD: 50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Khu vực / Địa chỉ</label>
            <input 
              type="text" 
              name="location" 
              required 
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white"
              placeholder="VD: Quận 10, TP. Hồ Chí Minh"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Link Google Map (Tùy chọn)</label>
            <input 
              type="url" 
              name="google_map_link" 
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white"
              placeholder="VD: https://goo.gl/maps/..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Hình ảnh BĐS (Tối đa 8 ảnh)</label>
            <input 
              type="file" 
              name="images" 
              multiple
              accept="image/*"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white"
            />
            <p className="text-xs text-gray-500 mt-1">Hỗ trợ JPG, PNG. Có thể chọn nhiều ảnh một lúc.</p>
          </div>

          <div className="pt-4 flex justify-end">
            <button 
              type="submit" 
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Đang xử lý...' : 'Xác nhận Đăng tin (-500 Credit)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
