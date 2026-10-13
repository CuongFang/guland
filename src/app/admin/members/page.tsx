import { createClient } from '@/utils/supabase/server';
import { addCreditToUser } from '@/app/actions/member';
import Link from 'next/link';
import MemberList from './MemberList';

export default async function MembersManagementPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role?.trim().toLowerCase() !== 'admin') {
      return (
        <div className="p-8 text-center text-red-600 font-bold text-xl mt-20">
          Bạn không có quyền truy cập trang Quản lý Thành viên!
        </div>
      );
    }
  }

  // Lấy dữ liệu profile thật từ Supabase
  const { data: users, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="p-8 text-black">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Danh sách Thành viên</h1>
        <div className="flex gap-2">
          {/* Để thêm user từ Admin an toàn nhất là qua UI register hoặc gửi link cho họ */}
          <Link href="/register" className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700">
            + Tạo thành viên mới
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 text-red-600 p-4 rounded">
          Lỗi tải dữ liệu: {error.message}
        </div>
      )}

      <MemberList users={users || []} />
    </div>
  );
}
