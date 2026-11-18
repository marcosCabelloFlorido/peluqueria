import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Inter_Tight } from "next/font/google";
import "./globals.css";

const display = Inter_Tight({ subsets: ["latin"], variable: "--font-display-face", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "DouceCreative · Reserva tu cita",
  description: "Reserva tu cita en DouceCreative. Tu estilo, a tu hora.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "DouceCreative", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#0b0b0c", viewportFit: "cover", width: "device-width", initialScale: 1 };

// tema antes del primer pintado (sin destello blanco); oscuro por defecto
const themeScript =
  'try{var t=localStorage.getItem("theme");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={`${display.variable} ${inter.variable} ${geistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: "if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js')" }} />
      </body>
    </html>
  );
}
