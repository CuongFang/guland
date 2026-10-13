"use client";

import { useState, useEffect } from 'react';
import { useUserStore } from '@/store/useUserStore';

interface VietQRPaymentProps {
  amount: number;
  days: number;
  planName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function VietQRPayment({ amount, days, planName, onSuccess, onCancel }: VietQRPaymentProps) {
  const activateVip = useUserStore(state => state.activateVip);
  const [isChecking, setIsChecking] = useState(false);
  const [countdown, setCountdown] = useState(300); // 5 minutes

  // Mock checking payment status
  const checkPaymentStatus = () => {
    setIsChecking(true);
    // Giả lập hệ thống kiểm tra sau 2s thì tự động thành công
    setTimeout(() => {
      activateVip(days);
      setIsChecking(false);
      onSuccess();
    }, 2000);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Tạo mã QR với VietQR (thông qua SePay / VietQR API)
  // Trong thực tế, bạn sẽ dùng tài khoản ngân hàng thực của dự án
  const bankId = 'MB'; // Vietinbank, VCB, MB, v.v.
  const accountNo = '0123456789'; 
  const accountName = 'GULAND CLONE';
  const description = `NAP VIP ${days} NGAY`;
  
  // Dùng QR Code Generator API (VD: vietqr.io)
  const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(description)}&accountName=${encodeURIComponent(accountName)}`;

  return (
    <div className="flex flex-col items-center">
      <h3 className="text-xl font-bold mb-2 text-blue-700">Thanh toán {planName}</h3>
      <p className="text-gray-600 mb-4 text-center">Vui lòng quét mã QR dưới đây bằng ứng dụng ngân hàng để thanh toán tự động.</p>
      
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrUrl} alt="VietQR Payment" className="w-64 h-64 object-contain" />
      </div>
      
      <div className="text-2xl font-bold text-red-600 mb-2">
        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)}
      </div>
      
      <p className="text-sm text-gray-500 mb-6">Thời gian chờ thanh toán: <span className="font-bold text-red-500">{formatTime(countdown)}</span></p>

      <div className="flex gap-4 w-full">
        <button 
          onClick={onCancel}
          className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50"
        >
          Hủy bỏ
        </button>
        <button 
          onClick={checkPaymentStatus}
          disabled={isChecking}
          className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold shadow-md hover:bg-blue-700 disabled:opacity-70 flex items-center justify-center"
        >
          {isChecking ? 'Đang kiểm tra...' : 'Xác nhận Đã chuyển khoản'}
        </button>
      </div>
    </div>
  );
}
