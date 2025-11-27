import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThirdwebProvider } from "thirdweb/react";
import Navbar from "./components/Navbar";
import AuthGuard from "./components/AuthGuard";
import { NetworkProvider } from "./contexts/NetworkContext";



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
           <NetworkProvider>
          {}
          <AuthGuard /> 
          <Navbar />
          {children}
          </NetworkProvider>
        </ThirdwebProvider>
      </body>
    </html>
  );
}