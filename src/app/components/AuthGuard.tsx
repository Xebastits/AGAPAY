"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";

export default function AuthGuard() {
  const account = useActiveAccount();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!account && pathname !== "/") {
      router.push("/");
    }
  }, [account, pathname, router]);

  return null;
}
