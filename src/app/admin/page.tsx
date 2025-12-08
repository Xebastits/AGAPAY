'use client';

import dynamic from 'next/dynamic';

// 1. LAZY LOAD THE HEAVY DASHBOARD
// This moves the 700kb bloat into a separate chunk that loads later.
const AdminDashboard = dynamic(
  () => import('./AdminDashboard').then((mod) => mod.AdminDashboard),
  {
    loading: () => (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-slate-500 font-bold">Loading Admin Tools...</p>
      </div>
    ),
    ssr: false, // Admin dashboard doesn't need SEO, so client-only is fine/faster
  }
);

export default function AdminPage() {
  return <AdminDashboard />;
}