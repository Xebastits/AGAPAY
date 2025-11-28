"use client";

import { ThirdwebProvider } from "thirdweb/react";
import { NetworkProvider } from "./contexts/NetworkContext";
import AuthGuard from "./components/AuthGuard";
import Navbar from "./components/Navbar";

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThirdwebProvider>
      <NetworkProvider>
        <AuthGuard />
        <Navbar />
        {children}
      </NetworkProvider>
    </ThirdwebProvider>
  );
}
