import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "映序 · 图生视频工作台",
  description: "图生视频创作与多供应商 API 接入",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
