import type { Metadata, Viewport } from "next";
import { Fraunces, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "DouceCreative · Reserva tu cita",
  description: "Reserva tu cita en DouceCreative. Tu estilo, a tu hora.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "DouceCreative", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { themeColor: "#000000", viewportFit: "cover", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${fraunces.variable} ${inter.variable} ${geistMono.variable}`}>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: "if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js')" }} />
      </body>
    </html>
  );
}
