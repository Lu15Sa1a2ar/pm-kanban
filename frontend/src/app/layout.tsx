import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kanban Studio",
  description: "Un tablero kanban de una sola vista, con copiloto.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
