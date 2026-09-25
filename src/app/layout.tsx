import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orbit Meeting",
  description: "Orbit Meeting — real-time multilingual video meetings.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
