"use client";

import dynamic from 'next/dynamic';

// Khởi tạo Map component với ssr: false bên trong Client Component
const DynamicMap = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-gray-100 flex items-center justify-center text-sm text-gray-500">Đang tải bản đồ tương tác...</div>
});

type Property = {
  id: string;
  title: string;
  price: number;
  lat: number | null;
  lng: number | null;
  location: string;
};

export default function MapWrapper({ properties, searchLocation }: { properties: Property[], searchLocation?: [number, number] | null }) {
  return <DynamicMap properties={properties} searchLocation={searchLocation} />;
}
