import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { logout } from '@/app/actions/auth';

export default async function Navbar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  let profile = null;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, credits, tier, role')
      .eq('id', user.id)
      .single();
    profile = data;
  }

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm text-black h-16 z-50 relative">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-extrabold text-blue-600 tracking-tight">
            GULAND<span className="text-orange-500">.CLONE</span>
          </Link>
          <Link href="/" className="text-sm font-medium hover:text-blue-600 hidden sm:block">Trang chủ Bản đồ</Link>
          {user && (
            <Link href="/admin/properties" className="text-sm font-medium text-gray-600 hover:text-blue-600 hidden sm:block">
              Vào Trang Quản Trị
            </Link>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <div className="hidden sm:flex flex-col items-end mr-2">
                <span className="text-sm text-gray-700">
                  Xin chào, <span className="font-bold">{profile?.full_name || 'Thành viên'}</span>
                </span>
                <span className="text-xs text-gray-500">{profile?.role || 'Thành viên'} • {profile?.tier || 'Bạc'}</span>
                <div className="flex gap-2 items-center mt-1">
                  <span className="text-[10px] text-red-500">ID: {user.id.substring(0, 8)}</span>
                  {profile?.role !== 'admin' && (
                    <form action={async (formData) => {
                      "use server";
                      const { makeMeAdmin } = await import('@/app/actions/member');
                      await makeMeAdmin(formData);
                    }}>
                      <input type="hidden" name="userId" value={user.id} />
                      <button type="submit" className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded cursor-pointer hover:bg-red-700">Cấp quyền Admin</button>
                    </form>
                  )}
                </div>
              </div>
              <div className="text-sm bg-yellow-100 border border-yellow-300 text-yellow-800 px-3 py-1 rounded-full font-bold shadow-sm">
                {new Intl.NumberFormat('vi-VN').format(profile?.credits || 0)} Credit
              </div>
              <form action={logout}>
                <button type="submit" className="text-sm text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded border border-transparent hover:border-red-200 hover:bg-red-50 transition">
                  Đăng xuất
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-blue-600">Đăng nhập</Link>
              <Link href="/register" className="bg-blue-600 text-white text-sm px-5 py-2 rounded-full shadow-md hover:bg-blue-700 transition">
                Đăng ký ngay
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
