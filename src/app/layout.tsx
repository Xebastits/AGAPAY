import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThirdwebProvider } from "thirdweb/react";
import Navbar from "./components/Navbar";
import AuthGuard from "./components/AuthGuard";



const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Agapay",
  description:
    "A BLOCKCHAIN ENABLED WEB APPLICATION CROWDFUNDING PLATFORM FOR SOCIAL WELFARE ASSISTANCE",
  icons: {
    icon: "/logofavicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-700">
        <ThirdwebProvider>
          {/* 2. Place the Guard here. It protects everything below it. */}
          <AuthGuard /> 
          <Navbar />
          {children}
        </ThirdwebProvider>
      </body>
    </html>
  );
}