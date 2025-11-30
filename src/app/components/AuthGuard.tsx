"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";

const PUBLIC_PATHS = ["/", "/campaigns", "/login"]; // pages anyone can see

export default function AuthGuard() {
  const account = useActiveAccount();
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false); // wait until wallet status is ready

  useEffect(() => {
    if (account === undefined) return; // still connecting
    if (!account?.address && !PUBLIC_PATHS.includes(pathname)) {
      router.push("/login");
    }
    setChecked(true);
  }, [account, pathname, router]);

  // Wait until we know wallet status before rendering
  if (!checked) return null;

  return null;
}