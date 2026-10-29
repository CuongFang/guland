import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import PWARegister from "@/components/PWARegister";
import { Suspense } from "react";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-geist-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Quy Hoạch Khánh Hòa App - Bản Đồ Quy Hoạch Bất Động Sản",
  description: "Bản đồ tra cứu quy hoạch và thông tin bất động sản trực tuyến",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Quy Hoạch Khánh Hòa App",
  },
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const revalidate = 0;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      className={`${beVietnamPro.variable} ${beVietnamPro.className} h-full antialiased`}
    >
      <body className="h-full flex flex-col overflow-hidden">
        <PWARegister />
        <Suspense fallback={<div className="h-16 bg-white border-b border-gray-200 flex items-center px-8 text-sm">Đang tải công cụ...</div>}>
          <Navbar />
        </Suspense>
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}
