import { createClient } from '@/utils/supabase/server';
import HomeLayoutClient from '@/components/HomeLayoutClient';

export default async function Home() {
  const supabase = await createClient();
  
  // Kéo toàn bộ danh sách BĐS (ưu tiên tin mới nhất)
  const { data: properties } = await supabase
    .from('properties')
    .select('*, profiles(full_name)')
    .order('created_at', { ascending: false });

  return <HomeLayoutClient properties={properties || []} />;
}
