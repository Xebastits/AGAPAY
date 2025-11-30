"use client";

import { useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import NDAModal from "./NDAModal";

export default function NDAWrapper({ children }: { children: React.ReactNode }) {
  const account = useActiveAccount();
  const [showNDA, setShowNDA] = useState(false);

  useEffect(() => {
    if (!account?.address) return;

    const acceptedKey = `ndaAccepted_${account.address}`;
    const alreadyAccepted = localStorage.getItem(acceptedKey);

    if (!alreadyAccepted) {
      setShowNDA(true);
    }
  }, [account]);

  const handleAccept = () => {
    if (!account?.address) return;
    const acceptedKey = `ndaAccepted_${account.address}`;
    localStorage.setItem(acceptedKey, "true"); // mark as accepted
    setShowNDA(false);
  };

  return (
    <>
      {children}
      <NDAModal isOpen={showNDA} onAccept={handleAccept} />
    </>
  );
}
