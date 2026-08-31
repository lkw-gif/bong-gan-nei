import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://ya-sai-di.davidlui.chatgpt.site'),
  title: '壓細啲｜免費檔案壓縮及格式轉換工具',
  description:
    '在瀏覽器內壓縮 PDF 及圖片，互轉 WebP、HEIC、JPEG、JPG，亦可生成透明 PNG 和網頁 QR Code。檔案不會上傳。',
  openGraph: {
    title: '壓細啲｜檔案細一截，傳送快好多。',
    description:
      '免費壓縮 PDF 及圖片，轉換常用格式、生成透明 PNG 和網頁 QR Code。全部在瀏覽器內處理。',
    type: 'website',
    locale: 'zh_HK',
    url: 'https://ya-sai-di.davidlui.chatgpt.site',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: '壓細啲檔案壓縮工具',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '壓細啲｜檔案細一截，傳送快好多。',
    description: '免費壓縮及轉換 PDF、圖片，檔案不會上傳。',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant-HK">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
