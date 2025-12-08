"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react";
import { getContract, prepareContractCall } from "thirdweb";
import { client } from "@/app/client";
import { CROWDFUNDING_FACTORY } from "@/app/constants/contracts";
import { useNetwork } from '../contexts/NetworkContext';
import { isAdmin } from "../constants/admins";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";

interface Campaign {
    id: string;
    name: string;
    description: string;
    goal: string;
    deadline: number;
    idImageUrl: string;
    status: string;
    creator: string; 
    fullName?: string; 
    imageUrl?: string;
    createdAt?: number;
}

const ITEMS_PER_PAGE = 5;

export const AdminDashboard = () => {
    const { selectedChain } = useNetwork();
    const account = useActiveAccount();
    const router = useRouter();

    const factoryContract = getContract({
        client: client,
        chain: selectedChain,
        address: CROWDFUNDING_FACTORY,
    });

    const { mutate: sendTransaction, isPending: isDeploying } = useSendTransaction();

    const { data: liveCampaigns, refetch: refetchLive, isLoading: isLoadingLive } = useReadContract({
        contract: factoryContract,
        method: "function getAllCampaigns() view returns ((address campaignAddress, address owner, string name, uint256 creationTime)[])",
        params: []
    });

    const [pendingCampaigns, setPendingCampaigns] = useState<Campaign[]>([]);
    const [loadingFirebase, setLoadingFirebase] = useState(true);

    // PAGINATION STATE
    const [pendingPage, setPendingPage] = useState(1);
    const [livePage, setLivePage] = useState(1);

    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
    const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
    const [campaignToApprove, setCampaignToApprove] = useState<Campaign | null>(null);
    const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
        show: false, message: '', type: 'success'
    });

    // PAGINATION LOGIC
    const visiblePending = useMemo(() => {
        const start = (pendingPage - 1) * ITEMS_PER_PAGE;
        return pendingCampaigns.slice(start, start + ITEMS_PER_PAGE);
    }, [pendingCampaigns, pendingPage]);

    const totalPendingPages = Math.ceil(pendingCampaigns.length / ITEMS_PER_PAGE);

    const visibleLive = useMemo(() => {
        if (!liveCampaigns) return [];
        const reversed = [...liveCampaigns].reverse();
        const start = (livePage - 1) * ITEMS_PER_PAGE;
        return reversed.slice(start, start + ITEMS_PER_PAGE);
    }, [liveCampaigns, livePage]);

    const totalLivePages = liveCampaigns ? Math.ceil(liveCampaigns.length / ITEMS_PER_PAGE) : 0;

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
    };

    useEffect(() => {
        const checkAdmin = setTimeout(() => {
            if (account && !isAdmin(account.address)) {
                router.push("/");
            }
        }, 1000);
        return () => clearTimeout(checkAdmin);
    }, [account, router]);

    // --- FETCH PENDING REQUESTS (SORTED) ---
    useEffect(() => {
        const fetchPending = async () => {
            if (!account) return;
            try {
                const q = query(collection(db, "campaigns"), where("status", "==", "pending"));
                const snapshot = await getDocs(q);
                const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
                
                // Sort Newest First
                list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

                setPendingCampaigns(list);
            } catch (e) {
                console.error("Firebase Error:", e);
            } finally {
                setLoadingFirebase(false);
            }
        };

        if (account && isAdmin(account.address)) {
            fetchPending();
        }
    }, [account]);

    const openRejectModal = (id: string) => {
        setSelectedCampaignId(id);
        setRejectReason("");
        setIsRejectModalOpen(true);
    };

    const submitRejection = async () => {
        if (!selectedCampaignId || !rejectReason) return showToast("Please enter a reason.", "error");

        try {
            await updateDoc(doc(db, "campaigns", selectedCampaignId), {
                status: "rejected",
                rejectionReason: rejectReason,
            });
            setPendingCampaigns(prev => prev.filter(c => c.id !== selectedCampaignId));
            setIsRejectModalOpen(false);
            showToast("Campaign Rejected", "success");
        } catch (e) {
            showToast("Error updating database.", "error");
        }
    };

    const openApproveModal = (campaign: Campaign) => {
        setCampaignToApprove(campaign);
        setIsApproveModalOpen(true);
    };

    const confirmApprove = async () => {
        if (!campaignToApprove) return;

        try {
            const transaction = prepareContractCall({
                contract: factoryContract,
                method: "function createCampaign(address _owner, string _name, string _description, uint256 _goal, uint256 _durationInDays)",
                params: [
                    campaignToApprove.creator,
                    campaignToApprove.name,
                    campaignToApprove.description,
                    BigInt(campaignToApprove.goal),
                    BigInt(campaignToApprove.deadline || 30),
                ],
            });

            sendTransaction(transaction, {
                onSuccess: async () => {
                    showToast("Deployed! Linking to database...", "success");

                    const result = await refetchLive();
                    const latestList = result.data || [];

                    const newDeployment = latestList.find(c =>
                        c.owner.toLowerCase() === campaignToApprove.creator.toLowerCase() &&
                        c.name === campaignToApprove.name
                    );

                    const contractAddress = newDeployment ? newDeployment.campaignAddress : "";

                    await updateDoc(doc(db, "campaigns", campaignToApprove.id), {
                        status: "approved",
                        campaignAddress: contractAddress,
                        deployedAt: Date.now()
                    });

                    setPendingCampaigns(prev => prev.filter(c => c.id !== campaignToApprove.id));
                    setIsApproveModalOpen(false);
                    showToast(" Linked & Approved!", "success");
                },
                onError: (error) => {
                    console.error("Blockchain Error:", error);
                    setIsApproveModalOpen(false);
                    showToast(" Transaction Failed.", "error");
                },
            });
        } catch (e) {
            console.error(e);
            showToast("Error preparing transaction.", "error");
        }
    };

    if (loadingFirebase) return <div className="p-10 text-center animate-pulse">Loading Dashboard...</div>;
    if (!account || !isAdmin(account.address)) return <div className="p-10 text-center text-red-500">Access Denied</div>;

    return (
        <div className="min-h-screen bg-slate-50 p-6 relative">

            {toast.show && (
                <div className={`fixed top-5 right-5 z-[100] px-6 py-4 rounded-lg shadow-2xl border-l-4 flex items-center gap-3 animate-slide-in bg-white ${toast.type === 'success' ? 'border-green-500 text-green-800' : 'border-red-500 text-red-800'}`}>
                    <span className="text-xl font-bold">{toast.type === 'success' ? 'Success:' : 'Error:'}</span>
                    <p className="">{toast.message}</p>
                </div>
            )}

            <div className="max-w-7xl mx-auto space-y-12">
                {/* HEADER */}
                <div className="flex justify-between items-end border-b pb-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Admin Dashboard</h1>
                        <p className="text-slate-500">Manage requests and monitor the blockchain.</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-bold text-slate-600">Logged in as:</p>
                        <p className="font-mono text-xs bg-slate-200 px-2 py-1 rounded">{account.address}</p>
                    </div>
                </div>

                {/* 1. PENDING REQUESTS */}
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-slate-700">1. Pending Requests</h2>
                            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">
                                {pendingCampaigns.length} Needs Review
                            </span>
                        </div>
                    </div>

                    {pendingCampaigns.length === 0 ? (
                        <div className="bg-white p-8 rounded-lg border border-dashed border-slate-300 text-center text-slate-400">
                            No pending requests at the moment.
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-6">
                                {visiblePending.map((campaign) => (
                                    <div key={campaign.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col lg:flex-row gap-8">
                                        <div className="w-full lg:w-1/4 bg-slate-100 rounded-lg h-48 flex items-center justify-center overflow-hidden border relative group">
                                            {campaign.idImageUrl ? (
                                                <>
                                                    <Image
                                                        src={campaign.idImageUrl}
                                                        alt="ID"
                                                        fill
                                                        className="object-cover"
                                                        sizes="(max-width: 768px) 100vw, 300px"
                                                    />
                                                    <a href={campaign.idImageUrl} target="_blank" className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold transition z-10">View Full Size</a>
                                                </>
                                            ) : (
                                                <span className="text-xs text-slate-400">No Image</span>
                                            )}
                                        </div>

                                        <div className="flex-1 flex flex-col justify-between">
                                            <div>
                                                <h3 className="text-xl font-bold text-slate-800">{campaign.name}</h3>
                                                <p className="text-sm text-slate-500 mb-2 font-mono">
                                                    Creator: {campaign.fullName ? `${campaign.fullName} (${campaign.creator})` : campaign.creator} <br />
                                                    {/* UPDATED DATE FORMAT HERE */}
                                                    Created: {campaign.createdAt ? new Date(campaign.createdAt).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true }) : 'N/A'}
                                                </p>
                                                <p className="text-slate-600 mb-4 bg-slate-50 p-3 rounded">{campaign.description}</p>
                                                <div className="flex gap-4 text-sm font-medium text-slate-700">
                                                    <span className="bg-blue-50 px-2 py-1 rounded border border-blue-100">Goal: ₱{campaign.goal}</span>
                                                    <span className="bg-blue-50 px-2 py-1 rounded border border-blue-100">Duration: {campaign.deadline} Days</span>
                                                </div>
                                            </div>

                                            <div className="flex gap-3 mt-6 pt-6 border-t">
                                                <button
                                                    onClick={() => openApproveModal(campaign)}
                                                    disabled={isDeploying}
                                                    className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg font-bold shadow-sm transition flex items-center gap-2"
                                                >
                                                    {isDeploying ? "Processing..." : "✓ Approve & Deploy"}
                                                </button>
                                                <button
                                                    onClick={() => openRejectModal(campaign.id)}
                                                    disabled={isDeploying}
                                                    className="bg-white border border-red-200 text-red-600 hover:bg-red-50 px-5 py-2 rounded-lg font-bold transition"
                                                >
                                                    ✕ Reject
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {totalPendingPages > 1 && (
                                <div className="flex justify-center items-center gap-4 mt-6">
                                    <button
                                        onClick={() => setPendingPage(p => Math.max(1, p - 1))}
                                        disabled={pendingPage === 1}
                                        className="px-4 py-2 text-sm bg-white border rounded hover:bg-slate-50 disabled:opacity-50"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-sm font-bold text-slate-600">Page {pendingPage} of {totalPendingPages}</span>
                                    <button
                                        onClick={() => setPendingPage(p => Math.min(totalPendingPages, p + 1))}
                                        disabled={pendingPage === totalPendingPages}
                                        className="px-4 py-2 text-sm bg-white border rounded hover:bg-slate-50 disabled:opacity-50"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </section>

                {/* 2. LIVE ON BLOCKCHAIN - UPDATED TABLE */}
                <section className="pb-20">
                    <div className="flex items-center justify-between mb-6 pt-8 border-t">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-slate-700">2. Live on Blockchain</h2>
                            <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-full">
                                {liveCampaigns?.length || 0} Active
                            </span>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden table-fixed">
                        <table className="w-full text-left text-sm text-slate-600">
                            <thead className="bg-slate-100 text-xs uppercase font-bold text-slate-500">
                                <tr>
                                    {/* CAMPAIGN NAME: Flexible width (takes remaining space) */}
                                    <th className="px-6 py-4 w-auto">Campaign Name</th>

                                    {/* CONTRACT ADDRESS: Fixed width (Constrained) */}
                                    <th className="px-6 py-4 w-56">Contract Address</th>

                                    {/* LINKS: Fixed width */}
                                    <th className="px-6 py-4 text-right w-32">Links</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoadingLive ? (
                                    <tr><td colSpan={3} className="px-6 py-8 text-center">Loading blockchain data...</td></tr>
                                ) : visibleLive.length > 0 ? (
                                    visibleLive.map((camp, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition">
                                            <td className="px-6 py-4 font-bold text-slate-800 truncate">
                                                {camp.name}
                                            </td>

                                            {/* CONSTRAINED ADDRESS CELL */}
                                            <td className="px-6 py-4 font-mono text-xs text-blue-600 w-56">
                                                <a
                                                    href={`https://sepolia.etherscan.io/address/${camp.campaignAddress}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="hover:underline flex items-center gap-1 w-full"
                                                >
                                                    <span className="truncate block w-full">
                                                        {camp.campaignAddress}
                                                    </span>
                                                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                                </a>
                                            </td>

                                            <td className="px-6 py-4 text-right w-32">
                                                <Link
                                                    href={`/campaign/${camp.campaignAddress}`}
                                                    className="text-slate-700 hover:text-blue-600 font-bold text-xs"
                                                >
                                                    View Page →
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-400">No campaigns found on the blockchain.</td></tr>
                                )}
                            </tbody>
                        </table>

                        {/* Live Pagination Controls */}
                        {!isLoadingLive && totalLivePages > 1 && (
                            <div className="flex justify-center items-center gap-4 py-4 border-t bg-slate-50">
                                <button
                                    onClick={() => setLivePage(p => Math.max(1, p - 1))}
                                    disabled={livePage === 1}
                                    className="px-4 py-2 text-sm bg-white border rounded hover:bg-slate-100 disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <span className="text-sm font-bold text-slate-600">Page {livePage} of {totalLivePages}</span>
                                <button
                                    onClick={() => setLivePage(p => Math.min(totalLivePages, p + 1))}
                                    disabled={livePage === totalLivePages}
                                    className="px-4 py-2 text-sm bg-white border rounded hover:bg-slate-100 disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                </section>

            </div>

            {/* --- REJECTION MODAL --- */}
            {isRejectModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Reject Campaign</h3>
                        <p className="text-sm text-slate-500 mb-4">Provide a reason for the user.</p>
                        <textarea
                            className="w-full border border-slate-300 rounded-md p-3 h-32 focus:ring-2 focus:ring-red-500 outline-none resize-none"
                            placeholder="e.g. ID Image is blurry..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                        />
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setIsRejectModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md font-medium">Cancel</button>
                            <button onClick={submitRejection} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-bold shadow">Confirm Reject</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- APPROVE MODAL --- */}
            {isApproveModalOpen && campaignToApprove && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Approve Campaign?</h3>
                        <p className="text-slate-600 mb-6">This will create a smart contract for <strong>{campaignToApprove.name}</strong>.</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setIsApproveModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md font-medium">Cancel</button>
                            <button
                                onClick={confirmApprove}
                                disabled={isDeploying}
                                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-bold shadow flex items-center gap-2"
                            >
                                {isDeploying ? "Waiting..." : "Confirm & Deploy"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};