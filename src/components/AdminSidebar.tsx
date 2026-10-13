"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminSidebar({ role }: { role: string }) {
  const pathname = usePathname();

  // Danh sách menu mặc định
  let menuItems = [
    { name: 'Quản lý Bất động sản', path: '/admin/properties' },
    { name: 'Về Trang chủ', path: '/' },
  ];

  // Nếu là admin, thêm mục Quản lý Thành viên lên đầu
  if (role && role.trim().toLowerCase() === 'admin') {
    menuItems = [
      { name: 'Quản lý Thành viên', path: '/admin/members' },
      ...menuItems
    ];
  }

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-lg">
      <div className="p-4 text-xl font-bold border-b border-slate-700">
        Guland Admin
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link 
              key={item.path} 
              href={item.path} 
              className={`block p-3 rounded transition-colors ${
                isActive ? 'bg-blue-600' : 'hover:bg-slate-800'
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
