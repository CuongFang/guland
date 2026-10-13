"use server";

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createProperty(formData: FormData) {
  const supabase = await createClient();
  
  // Kiểm tra đăng nhập
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Bạn phải đăng nhập để đăng tin.' };
  }

  // 1. Lấy thông tin user hiện tại từ bảng profiles (kiểm tra credit)
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits, tier')
    .eq('id', user.id)
    .single();

  if (!profile || profile.credits < 500) {
    return { error: 'Bạn không đủ Credit. Cần 500 Credit để đăng tin!' };
  }

  // 2. Trừ 500 credit
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ credits: profile.credits - 500 })
    .eq('id', user.id);

  if (updateError) {
    return { error: 'Có lỗi xảy ra khi xử lý Credit.' };
  }

  // 3. Xử lý Upload Hình ảnh lên Supabase Storage
  const imageFiles = formData.getAll('images') as File[];
  const imageUrls: string[] = [];
  
  // Chỉ lấy tối đa 8 ảnh
  const filesToUpload = imageFiles.slice(0, 8).filter(f => f.size > 0);
  
  for (const file of filesToUpload) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const { data, error: uploadError } = await supabase.storage.from('property_images').upload(`${user.id}/${fileName}`, file);
    
    if (uploadError) {
      console.error('Lỗi upload ảnh:', uploadError);
      return { error: 'Không thể upload ảnh: ' + uploadError.message };
    }

    if (data) {
      const { data: publicUrlData } = supabase.storage.from('property_images').getPublicUrl(data.path);
      imageUrls.push(publicUrlData.publicUrl);
    }
  }

  // 4. Đăng tin vào bảng properties
  const title = formData.get('title') as string;
  const price = formData.get('price') as string;
  const area = formData.get('area') as string;
  const location = formData.get('location') as string;
  const google_map_link = formData.get('google_map_link') as string;

  const { error: insertError } = await supabase
    .from('properties')
    .insert({
      title,
      price: parseInt(price, 10),
      area: parseFloat(area),
      location,
      google_map_link,
      images: imageUrls,
      owner_id: user.id,
      status: 'Đang bán'
    });

  if (insertError) {
    return { error: 'Lỗi khi lưu bài đăng. Hãy thử lại!' };
  }

  revalidatePath('/admin/properties');
  redirect('/admin/properties');
}

export async function updateProperty(propertyId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Bạn chưa đăng nhập.' };

  // Xử lý upload ảnh bổ sung nếu có
  const imageFiles = formData.getAll('images') as File[];
  const newImageUrls: string[] = [];
  const filesToUpload = imageFiles.slice(0, 8).filter(f => f.size > 0);
  
  for (const file of filesToUpload) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const { data, error: uploadError } = await supabase.storage.from('property_images').upload(`${user.id}/${fileName}`, file);
    
    if (uploadError) {
      console.error('Lỗi upload ảnh:', uploadError);
      return { error: 'Không thể upload ảnh: ' + uploadError.message };
    }

    if (data) {
      const { data: publicUrlData } = supabase.storage.from('property_images').getPublicUrl(data.path);
      newImageUrls.push(publicUrlData.publicUrl);
    }
  }

  // Lấy ảnh cũ (dưới dạng chuỗi JSON nối lại)
  const existingImagesJson = formData.get('existing_images') as string;
  let finalImages: string[] = [];
  if (existingImagesJson) {
    try { finalImages = JSON.parse(existingImagesJson); } catch (e) {}
  }
  
  // Gộp ảnh cũ và ảnh mới (tối đa 8 ảnh)
  finalImages = [...finalImages, ...newImageUrls].slice(0, 8);

  const title = formData.get('title') as string;
  const price = formData.get('price') as string;
  const area = formData.get('area') as string;
  const location = formData.get('location') as string;
  const google_map_link = formData.get('google_map_link') as string;

  // Kiểm tra quyền (Admin có thể sửa mọi bài)
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const isAdmin = profile?.role?.trim().toLowerCase() === 'admin';

  let updateQuery = supabase
    .from('properties')
    .update({
      title,
      price: parseInt(price, 10),
      area: parseFloat(area),
      location,
      google_map_link,
      images: finalImages
    })
    .eq('id', propertyId);

  // Nếu không phải admin, chỉ được sửa bài của chính mình
  if (!isAdmin) {
    updateQuery = updateQuery.eq('owner_id', user.id);
  }

  const { error, count } = await updateQuery.select();

  if (error) {
    console.error('Update Error:', error);
    return { error: 'Lỗi khi cập nhật: ' + error.message };
  }

  revalidatePath('/admin/properties');
  redirect('/admin/properties');
}

export async function deleteProperty(propertyId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Bạn chưa đăng nhập.' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const isAdmin = profile?.role?.trim().toLowerCase() === 'admin';

  let query = supabase.from('properties').delete().eq('id', propertyId);
  if (!isAdmin) {
    query = query.eq('owner_id', user.id);
  }
  
  await query;

  revalidatePath('/admin/properties');
  revalidatePath('/');
}
