"use client";

import { useState } from 'react';
import VietQRPayment from './VietQRPayment';

export default function UpgradeModal({ onClose }: { onClose: () => void }) {
  const [selectedPlan, setSelectedPlan] = useState<{name: string, price: number, days: number} | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const plans = [
    { id: 'day', name: 'Gói 1 Ngày', price: 49000, days: 1, desc: 'Tra cứu quy hoạch, VN-2000 không giới hạn trong 24h.' },
    { id: 'month', name: 'Gói 30 Ngày', price: 199000, days: 30, desc: 'Tiết kiệm hơn! Xem quy hoạch thả ga suốt 1 tháng.' },
  ];

  if (paymentSuccess) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 z-[2000] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Thanh toán thành công!</h2>
          <p className="text-gray-600 mb-6">Tài khoản VIP của bạn đã được kích hoạt. Hãy tiếp tục tra cứu quy hoạch nhé!</p>
          <button 
            onClick={onClose}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Quay lại bản đồ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[2000] flex items-center justify-center p-4 text-black">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-800"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {!selectedPlan ? (
          <>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-red-600 uppercase mb-2">Giới hạn tra cứu</h2>
              <p className="text-gray-600 text-sm">Bạn đã hết lượt tra cứu miễn phí hôm nay (3/3 lượt). Vui lòng nâng cấp VIP để tiếp tục sử dụng tính năng không giới hạn!</p>
            </div>

            <div className="space-y-4">
              {plans.map(plan => (
                <div 
                  key={plan.id} 
                  onClick={() => setSelectedPlan(plan)}
                  className="border-2 border-gray-200 hover:border-blue-500 rounded-xl p-4 cursor-pointer transition flex flex-col group"
                >
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-lg text-gray-800 group-hover:text-blue-700">{plan.name}</h3>
                    <span className="text-blue-600 font-black text-xl">
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(plan.price)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{plan.desc}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <VietQRPayment 
            amount={selectedPlan.price}
            days={selectedPlan.days}
            planName={selectedPlan.name}
            onCancel={() => setSelectedPlan(null)}
            onSuccess={() => setPaymentSuccess(true)}
          />
        )}
      </div>
    </div>
  );
}
