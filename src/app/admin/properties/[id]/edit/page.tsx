import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import EditPropertyClient from './EditPropertyClient';

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { id } = await params;

  if (!user) {
    redirect('/login');
  }

  // Get the property details
  const { data: property, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !property) {
    return <div className="p-8">Không tìm thấy bất động sản</div>;
  }

  return <EditPropertyClient property={property} />;
}
