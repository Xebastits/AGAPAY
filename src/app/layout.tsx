import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThirdwebProvider } from "thirdweb/react";
import Navbar from "./components/Navbar";
import { NetworkProvider } from "./contexts/NetworkContext";
import NDAWrapper from "./components/NDAWrapper";   // <-- ADD THIS

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
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-700">
        <ThirdwebProvider>
          <Navbar />
          <NetworkProvider>
            <NDAWrapper>   {/* <-- NDA wraps everything */}
              {children}
            </NDAWrapper>
          </NetworkProvider>
        </ThirdwebProvider>
      </body>
    </html>
  );
}
