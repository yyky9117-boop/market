import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "热点增长台 · AI 电商营销工作台",
  description: "捕捉热点，发现商品机会，让 AI 完成从热点到营销内容的全过程。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
