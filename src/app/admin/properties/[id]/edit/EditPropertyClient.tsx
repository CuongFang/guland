"use client";

import { useRef, useState } from 'react';
import { updateProperty } from '@/app/actions/property';

export default function EditPropertyClient({ property }: { property: any }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setError(null);
    
    // Thêm chuỗi JSON của các ảnh hiện tại
    formData.append('existing_images', JSON.stringify(property.images || []));

    const result = await updateProperty(property.id, formData);
    
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div className="p-8 text-black">
      <div className="max-w-3xl mx-auto bg-white p-6 shadow rounded-lg border border-gray-200">
        <h1 className="text-2xl font-bold mb-6">Chỉnh sửa Bất động sản</h1>

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
              defaultValue={property.title}
              required 
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Mức giá (VNĐ)</label>
              <input 
                type="number" 
                name="price" 
                defaultValue={property.price}
                required 
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Diện tích (m²)</label>
              <input 
                type="number" 
                name="area" 
                defaultValue={property.area}
                required 
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Khu vực / Địa chỉ</label>
            <input 
              type="text" 
              name="location" 
              defaultValue={property.location}
              required 
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Link Google Map (Tùy chọn)</label>
            <input 
              type="url" 
              name="google_map_link" 
              defaultValue={property.google_map_link || ''}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white"
              placeholder="VD: https://goo.gl/maps/..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Thêm hình ảnh (Tối đa 8 ảnh tổng cộng)</label>
            <input 
              type="file" 
              name="images" 
              multiple
              accept="image/*"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white"
            />
            <p className="text-xs text-gray-500 mt-1">Đã tải lên {property.images?.length || 0}/8 ảnh.</p>
            
            {/* Hiển thị ảnh đã upload */}
            {property.images && property.images.length > 0 && (
              <div className="mt-4 grid grid-cols-4 gap-2">
                {property.images.map((img: string, idx: number) => (
                  <div key={idx} className="relative aspect-video bg-gray-100 rounded-md overflow-hidden border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={() => window.history.back()}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
