import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TruTicket · Organiser",
  description: "Fair access. Genuine tickets. Controlled resale.",
  icons: { icon: "/brand/favicon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
