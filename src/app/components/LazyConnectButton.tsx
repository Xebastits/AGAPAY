'use client';

import dynamic from 'next/dynamic';

// Dynamically import the Thirdweb ConnectButton
// ssr: false prevents it from bloating the server-generated HTML
export const ConnectButton = dynamic(
  () => import("thirdweb/react").then((mod) => mod.ConnectButton),
  {
    ssr: false,
    loading: () => (
      <button className="px-4 py-2 bg-slate-200 rounded-lg animate-pulse text-slate-400 font-bold min-w-[140px]">
        Loading...
      </button>
    ),
  }
);