"use client";

import { client } from "@/app/client";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAdmin } from "./constants/admins";
import { defineChain } from "thirdweb/chains";
import NDAModal from "./components/NDAModal";

const POLYGON_AMOY = defineChain(80002);
const SEPOLIA = defineChain(11155111);

export default function Home() {
  const account = useActiveAccount();
  const router = useRouter();

  const [showNDA, setShowNDA] = useState(false);
  const [pendingAddress, setPendingAddress] = useState<string | null>(null);

  useEffect(() => {
    if (!account?.address) return;

    const ndaAccepted = localStorage.getItem("nda_accepted") === "true";

    // --- IMPORTANT ---
    // Detect if this page load is NEW or REFRESH
    const refreshed = sessionStorage.getItem("has_refreshed") === "true";

    // Mark this session as already refreshed once
    if (!refreshed) {
      sessionStorage.setItem("has_refreshed", "true");
    }

    // If the user refreshed the page:
    if (refreshed) {
      // Do NOT show NDA again on refresh → skip straight to redirect
      if (isAdmin(account.address)) {
        router.push("/admin");
      } else {
        router.push("/campaigns");
      }
      return;
    }

    // First time account connects (NO refresh)
    if (!ndaAccepted) {
      setPendingAddress(account.address);
      setShowNDA(true);
      return;
    }

    // If NDA already accepted
    if (isAdmin(account.address)) {
      router.push("/admin");
    } else {
      router.push("/campaigns");
    }

  }, [account, router]);

  const handleAcceptNDA = () => {
    localStorage.setItem("nda_accepted", "true");
    setShowNDA(false);

    if (!pendingAddress) return;

    if (isAdmin(pendingAddress)) {
      router.push("/admin");
    } else {
      router.push("/campaigns");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-8 text-slate-700">Welcome to Agapay</h1>
        <p className="text-lg mb-8 text-slate-600">Connect your wallet to get started</p>

        <ConnectButton 
          client={client}
          chains={[POLYGON_AMOY, SEPOLIA]} 
          theme="light"
        />
      </div>

      {/* NDA modal */}
      <NDAModal isOpen={showNDA} onAccept={handleAcceptNDA} />
    </div>
  );
}
