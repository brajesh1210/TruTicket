import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TruTicket — Fair Ticketing",
  description: "Fair access. Genuine tickets. Controlled resale.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-truticket-dark text-gray-100`}>{children}</body>
    </html>
  );
}