import type { Metadata } from "next";
import { DeveloperFooter } from "@/components/DeveloperFooter";
import "../css/globals.css";

export const metadata: Metadata = {
  title: "电商客服AI岗位实训与出师认证平台",
  description: "面向中职电子商务专业的AI极端客户实训系统"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <DeveloperFooter />
      </body>
    </html>
  );
}
