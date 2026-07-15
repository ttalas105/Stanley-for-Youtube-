import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stanley",
  description: "One focused AI chat for YouTube video ideas, titles, and thumbnail concepts.",
  icons: {
    icon: [{ url: "/stanley-favicon.png", type: "image/png", sizes: "256x256" }],
    apple: [{ url: "/stanley-favicon.png", type: "image/png", sizes: "256x256" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={sans.variable}>
        {children}
      </body>
    </html>
  );
}
