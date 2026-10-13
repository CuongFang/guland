"use client";

import { useState } from 'react';
import { addCreditToUser, deleteMember, toggleMemberStatus, updateMemberInfo } from '@/app/actions/member';

export default function MemberList({ users }: { users: any[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: '', email: '' });

  const handleEdit = (user: any) => {
    setEditingId(user.id);
    setEditData({ name: user.full_name || '', email: user.email || '' });
  };

  const handleSave = async (userId: string) => {
    await updateMemberInfo(userId, editData.name, editData.email);
    setEditingId(null);
  };

  const handleDelete = async (userId: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa thành viên này? Dữ liệu không thể phục hồi!")) {
      await deleteMember(userId);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Họ tên & Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phân cấp</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Credit hiện tại</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nạp thêm</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users && users.length > 0 ? (
              users.map((user: any) => {
                const isActive = user.is_active ?? true; // Mặc định là true nếu chưa có cột
                const isEditing = editingId === user.id;

                return (
                  <tr key={user.id} className={`hover:bg-gray-50 ${!isActive ? 'opacity-60 bg-gray-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <input 
                            type="text" 
                            value={editData.name} 
                            onChange={e => setEditData({...editData, name: e.target.value})}
                            className="border p-1 text-sm w-full rounded" 
                            placeholder="Họ tên"
                          />
                          <input 
                            type="email" 
                            value={editData.email} 
                            onChange={e => setEditData({...editData, email: e.target.value})}
                            className="border p-1 text-sm w-full rounded" 
                            placeholder="Email"
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="text-sm font-bold text-gray-900">{user.full_name}</div>
                          <div className="text-sm text-gray-500">{user.email || 'Chưa cập nhật'}</div>
                        </div>
                      )}
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {isActive ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        user.tier === 'Kim cương' ? 'bg-purple-100 text-purple-700' :
                        user.tier === 'Vàng' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {user.tier || 'Bạc'}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-yellow-600">
                      {new Intl.NumberFormat('vi-VN').format(user.credits || 0)}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <form action={addCreditToUser} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <select name="amount" className="border border-gray-300 rounded text-sm p-1 bg-white focus:ring-blue-500">
                          <option value="500">500</option>
                          <option value="1000">1,000</option>
                          <option value="5000">5,000</option>
                          <option value="10000">10,000</option>
                        </select>
                        <button type="submit" className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm hover:bg-blue-200 transition font-medium">
                          Nạp
                        </button>
                      </form>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        {isEditing ? (
                          <>
                            <button onClick={() => handleSave(user.id)} className="text-green-600 hover:text-green-900 bg-green-50 px-2 py-1 rounded">Lưu</button>
                            <button onClick={() => setEditingId(null)} className="text-gray-600 hover:text-gray-900 bg-gray-100 px-2 py-1 rounded">Hủy</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleEdit(user)} className="text-blue-600 hover:text-blue-900 bg-blue-50 px-2 py-1 rounded">Sửa</button>
                            <button 
                              onClick={() => toggleMemberStatus(user.id, isActive)} 
                              className={`${isActive ? 'text-orange-600 hover:text-orange-900 bg-orange-50' : 'text-green-600 hover:text-green-900 bg-green-50'} px-2 py-1 rounded`}
                            >
                              {isActive ? 'Khóa' : 'Mở khóa'}
                            </button>
                            <button onClick={() => handleDelete(user.id)} className="text-red-600 hover:text-red-900 bg-red-50 px-2 py-1 rounded">Xóa</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">Chưa có thành viên nào.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
