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
  title: '壓細啲｜免費 PDF 及圖片壓縮工具',
  description:
    '在瀏覽器內壓縮 PDF、JPEG、JPG、PNG、WebP，或無損互換 JPEG 與 JPG 副檔名。檔案不會上傳。',
  openGraph: {
    title: '壓細啲｜檔案細一截，傳送快好多。',
    description:
      '免費壓縮 PDF 及圖片，並可無損互換 JPEG 與 JPG。全部在瀏覽器內處理。',
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
    description: '免費壓縮 PDF 及圖片，檔案不會上傳。',
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
