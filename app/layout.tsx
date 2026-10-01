import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { Annie_Use_Your_Telescope, Anton, JetBrains_Mono, Montserrat } from "next/font/google";
import "./globals.css";

const anton = Anton({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400"],
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

const handwritten = Annie_Use_Your_Telescope({
  subsets: ["latin"],
  variable: "--font-handwritten",
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "El Hierro Premia Deportistas",
  description:
    "Gestión de bonos comercio con QR para pruebas deportivas de El Hierro",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body
        className={`${montserrat.variable} ${anton.variable} ${jetbrainsMono.variable} ${handwritten.variable}`}
      >
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
