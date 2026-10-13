import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';

export default async function PropertiesManagementPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  let role = 'Thành viên';
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile) role = profile.role;
  }

  // Bắt đầu query
  let query = supabase
    .from('properties')
    .select(`
      id, title, price, area, location, status, images,
      profiles ( full_name )
    `)
    .order('created_at', { ascending: false });

  // Nếu không phải admin, chỉ hiện BĐS do mình đăng
  if (role.trim().toLowerCase() !== 'admin' && user) {
    query = query.eq('owner_id', user.id);
  }

  const { data: properties, error } = await query;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  return (
    <div className="p-8 text-black">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Quản lý Bất động sản</h1>
        <Link href="/admin/properties/create" className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700">
          + Đăng tin mới
        </Link>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 text-red-600 p-4 rounded">
          Lỗi tải dữ liệu: {error.message}
        </div>
      )}

      <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ảnh</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tiêu đề</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mức giá</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Diện tích</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Khu vực</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {properties && properties.length > 0 ? (
              properties.map((prop: any) => (
                <tr key={prop.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {prop.images && prop.images.length > 0 ? (
                      <div className="w-16 h-12 rounded bg-gray-100 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={prop.images[0]} alt="Ảnh" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-16 h-12 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                        N/A
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {prop.title}
                    <div className="text-xs text-gray-400 font-normal">Người đăng: {prop.profiles?.full_name || 'Ẩn danh'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-semibold">{formatPrice(prop.price)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{prop.area} m²</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{prop.location}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      prop.status === 'Đang bán' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {prop.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link href={`/admin/properties/${prop.id}/edit`} className="text-blue-600 hover:text-blue-900 mr-4">Sửa</Link>
                    <form action={async () => {
                      "use server";
                      const { deleteProperty } = await import('@/app/actions/property');
                      await deleteProperty(prop.id);
                    }} className="inline">
                      <button type="submit" className="text-red-600 hover:text-red-900">Xóa</button>
                    </form>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">Chưa có tin đăng nào.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
