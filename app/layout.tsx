import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Amazon Buy Group Command Center",
  description: "Local-first buy group order workflow CRM"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
