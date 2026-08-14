import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SiteGuard AI · 筑安智巡",
  description: "AI 工程巡检与隐患闭环原型",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
