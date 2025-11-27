'use client';
import { client } from "@/app/client";
import Link from "next/link";
import { ConnectButton, lightTheme, useActiveAccount } from "thirdweb/react";
import Image from 'next/image';
import thirdwebIcon from "../favicon.ico";
import { usePathname } from "next/navigation";
import { isAdmin } from "../constants/admins";

const Navbar = () => {
    const account = useActiveAccount();
    const pathname = usePathname();

    // Hide Navbar on Login Page
    if (pathname === "/") return null;

    return (
        <nav className="bg-slate-100 border-b-2 border-b-slate-300">
            <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
                <div className="relative flex h-16 items-center justify-between">
                    <div className="absolute inset-y-0 left-0 flex items-center sm:hidden">
                        {/* Mobile menu button logic here (omitted for brevity) */}
                    </div>
                    <div className="flex flex-1 items-center justify-center sm:items-stretch sm:justify-start">
                        <div className="flex flex-shrink-0 items-center">
                            <Image 
                                src={thirdwebIcon} 
                                alt="Agapay" 
                                width={32} 
                                height={32} 
                                style={{
                                    filter: "drop-shadow(0px 0px 24px #a726a9a8)",
                                }}
                            />
                        </div>
                        <div className="hidden sm:ml-6 sm:block">
                            <div className="flex space-x-4">
                                {/* 1. Public Campaigns Link */}
                                <Link href={'/campaigns'}>
                                    <p className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
                                        Campaigns
                                    </p>
                                </Link>

                                {/* 2. Regular User Dashboard (Visible to everyone connected) */}
                                {account && !isAdmin(account.address) && (
                                    <Link href={`/dashboard/${account?.address}`}>
                                        <p className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
                                            My Dashboard
                                        </p>
                                    </Link>
                                )}

                                {/* 3. ADMIN LINK (Visible only if Admin) */}
                                {account && isAdmin(account.address) && (
                                    <Link href="/admin">
                                        <p className="rounded-md px-3 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200">
                                            Admin Panel
                                        </p>
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
                        <ConnectButton 
                            client={client}
                            theme={lightTheme()}
                            detailsButton={{
                                style: {
                                    maxHeight: "50px",
                                }
                            }}
                        />
                    </div>
                </div>
            </div>
        </nav>
    )
};

export default Navbar;