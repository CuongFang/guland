"use server";

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function addCreditToUser(formData: FormData) {
  const userId = formData.get('userId') as string;
  const amount = parseInt(formData.get('amount') as string, 10);
  
  const supabase = await createClient();
  
  // Lấy credit hiện tại
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', userId)
    .single();
  
  if (profile) {
    // Cập nhật credit mới
    await supabase
      .from('profiles')
      .update({ credits: profile.credits + amount })
      .eq('id', userId);
      
    // Refresh lại trang quản lý thành viên
    revalidatePath('/admin/members');
  }
}

export async function makeMeAdmin(formData: FormData) {
  const userId = formData.get('userId') as string;
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', userId);
    
  if (error) {
    console.error("Lỗi cấp quyền Admin:", error);
  }
  
  revalidatePath('/', 'layout');
}

export async function deleteMember(userId: string) {
  const supabase = await createClient();
  await supabase.from('profiles').delete().eq('id', userId);
  revalidatePath('/admin/members');
}

export async function toggleMemberStatus(userId: string, currentStatus: boolean) {
  const supabase = await createClient();
  await supabase.from('profiles').update({ is_active: !currentStatus }).eq('id', userId);
  revalidatePath('/admin/members');
}

export async function updateMemberInfo(userId: string, name: string, email: string) {
  const supabase = await createClient();
  await supabase.from('profiles').update({ full_name: name, email: email }).eq('id', userId);
  revalidatePath('/admin/members');
}
