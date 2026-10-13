import proj4 from 'proj4';

// Cấu hình thông số VN-2000 chuẩn của Bộ TN&MT
const VN2000_PROJ_STRING_TEMPLATE = '+proj=tmerc +lat_0=0 +lon_0={KTT} +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=-191.90441429,-39.30318279,-111.45032835,-0.00928836,0.01975479,-0.00427372,0.252906278 +units=m +no_defs';

export const PROVINCES = [
  { id: 'hcm', name: 'TP. Hồ Chí Minh', ktt: 105.75 },
  { id: 'dongnai', name: 'Đồng Nai', ktt: 107.75 },
  { id: 'binhduong', name: 'Bình Dương', ktt: 105.75 },
  { id: 'hanoi', name: 'Hà Nội', ktt: 105.0 },
  { id: 'longan', name: 'Long An', ktt: 105.75 },
  { id: 'vungtau', name: 'Bà Rịa - Vũng Tàu', ktt: 107.75 },
  { id: 'khanhhoa', name: 'Khánh Hòa', ktt: 108.25 },
  // Ta có thể bổ sung 63 tỉnh sau
];

export function convertVN2000ToWGS84(x: number, y: number, ktt: number): [number, number] {
  // Thay thế kinh tuyến trục vào chuỗi cấu hình
  const projString = VN2000_PROJ_STRING_TEMPLATE.replace('{KTT}', ktt.toString());
  
  // proj4(source, dest, [easting, northing])
  // Trong trắc địa VN, Y = Easting (trục ngang), X = Northing (trục dọc)
  // proj4 mong đợi tọa độ mảng: [X_proj (ngang), Y_proj (dọc)] => ứng với [Y, X] của VN
  const [lng, lat] = proj4(projString, 'EPSG:4326', [y, x]);
  
  return [lat, lng]; // Leaflet cần [lat, lng]
}
