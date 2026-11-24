import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Buxoro Sog‘liqni Saqlash KPI Nazorati",
  description:
    "Buxoro viloyati tibbiyot muassasalarini 60 kunlik dastur asosida baholash va nazorat qilish tizimi.",
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
    <html lang="uz">
      <body className="antialiased">{children}</body>
    </html>
  );
}


export const dynamic = "force-dynamic";
