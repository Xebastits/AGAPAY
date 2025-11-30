"use client";

import { client } from "@/app/client";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isAdmin } from "../constants/admins";
import { defineChain } from "thirdweb/chains";

const POLYGON_AMOY = defineChain(80002);
const SEPOLIA = defineChain(11155111);

export default function LoginPage() {
  const account = useActiveAccount();
  const router = useRouter();

  useEffect(() => {
    if (account?.address) {
      if (isAdmin(account.address)) {
        router.push("/admin");
      } else {
        router.push("/campaigns");
      }
    }
  }, [account, router]);

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
    </div>
  );
}
