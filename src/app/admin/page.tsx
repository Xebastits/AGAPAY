"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount, useReadContract } from "thirdweb/react";
import { isAdmin } from "../constants/admins"; 
import { db } from "../lib/firebase"; 
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { prepareContractCall, getContract, defineChain } from "thirdweb";
import { useSendTransaction } from "thirdweb/react";
import { client } from "@/app/client"; 
import { CROWDFUNDING_FACTORY } from "@/app/constants/contracts";
import Link from "next/link";
import { useNetwork } from '../contexts/NetworkContext';

interface Campaign {
  id: string;
  name: string;
  description: string;
  goal: string;
  deadline: number;
  idImageUrl: string;
  status: string;
  creator: string;
  imageUrl?: string; 
}

export default function AdminPage() {
const { selectedChain, setSelectedChain } = useNetwork();   
  const account = useActiveAccount();
  const router = useRouter();
  
  // 1. Blockchain Setup
  const factoryContract = getContract({
      client: client,
      chain: selectedChain,
      address: CROWDFUNDING_FACTORY,
  });

  const { mutate: sendTransaction, isPending: isDeploying } = useSendTransaction();
  
  // 2. Live Blockchain Campaigns (We fetch this to find the new address after deploy)
  const { data: liveCampaigns, refetch: refetchLive, isLoading: isLoadingLive } = useReadContract({
    contract: factoryContract,
    method: "function getAllCampaigns() view returns ((address campaignAddress, address owner, string name, uint256 creationTime)[])",
    params: []
  });

  // State
  const [pendingCampaigns, setPendingCampaigns] = useState<Campaign[]>([]);
  const [loadingFirebase, setLoadingFirebase] = useState(true);

  // Modals
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [campaignToApprove, setCampaignToApprove] = useState<Campaign | null>(null);

  // Toast
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false, message: '', type: 'success'
  });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  // --- SECURITY CHECK ---
  useEffect(() => {
    const checkAdmin = setTimeout(() => {
        if (account && !isAdmin(account.address)) {
            router.push("/");
        }
    }, 1000);
    return () => clearTimeout(checkAdmin);
  }, [account, router]);

  // --- FETCH PENDING REQUESTS ---
  useEffect(() => {
    const fetchPending = async () => {
      if (!account) return;
      try {
        const q = query(collection(db, "campaigns"), where("status", "==", "pending"));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
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

  // --- REJECT LOGIC ---
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

  // --- APPROVE LOGIC (With Link Back to Firebase) ---
  const openApproveModal = (campaign: Campaign) => {
    setCampaignToApprove(campaign);
    setIsApproveModalOpen(true);
  };

  const confirmApprove = async () => {
    if (!campaignToApprove) return;

    try {
        console.log("Deploying for Owner:", campaignToApprove.creator);

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
                
                // 1. Refresh the Blockchain List to find the new contract
                const result = await refetchLive();
                const latestList = result.data || [];
                
                // 2. Find the new address (Match by Owner and Name)
                // This logic finds the most recent campaign by this user with this name
                const newDeployment = latestList.find(c => 
                    c.owner.toLowerCase() === campaignToApprove.creator.toLowerCase() &&
                    c.name === campaignToApprove.name
                );

                const contractAddress = newDeployment ? newDeployment.campaignAddress : "";

                // 3. Update Firebase: Set status to 'approved' AND save the address
                await updateDoc(doc(db, "campaigns", campaignToApprove.id), {
                    status: "approved",
                    campaignAddress: contractAddress, // <--- CRITICAL LINK
                    deployedAt: Date.now()
                });

                setPendingCampaigns(prev => prev.filter(c => c.id !== campaignToApprove.id));
                setIsApproveModalOpen(false);
                showToast("✅ Linked & Approved!", "success");
            },
            onError: (error) => {
                console.error("Blockchain Error:", error);
                setIsApproveModalOpen(false);
                showToast("Transaction Failed. Check console.", "error");
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
      
      {/* TOAST */}
      {toast.show && (
        <div className={`fixed top-5 right-5 z-[100] px-6 py-4 rounded-lg shadow-2xl border-l-4 flex items-center gap-3 animate-slide-in bg-white ${toast.type === 'success' ? 'border-green-500 text-green-800' : 'border-red-500 text-red-800'}`}>
            <span className="text-xl">{toast.type === 'success' ? '✅' : '⚠️'}</span>
            <p className="font-bold">{toast.message}</p>
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

        {/* PENDING REQUESTS */}
        <section>
            <div className="flex items-center gap-3 mb-6">
                <h2 className="text-2xl font-bold text-slate-700">1. Pending Requests</h2>
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">
                    {pendingCampaigns.length} Needs Review
                </span>
            </div>

            {pendingCampaigns.length === 0 ? (
                <div className="bg-white p-8 rounded-lg border border-dashed border-slate-300 text-center text-slate-400">
                    No pending requests at the moment.
                </div>
            ) : (
                <div className="grid gap-6">
                    {pendingCampaigns.map((campaign) => (
                    <div key={campaign.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col lg:flex-row gap-8">
                        {/* Verification Image (Cloudinary Link from Firebase) */}
                        <div className="w-full lg:w-1/4 bg-slate-100 rounded-lg h-48 flex items-center justify-center overflow-hidden border relative group">
                            {campaign.idImageUrl ? (
                                <>
                                    <img src={campaign.idImageUrl} alt="ID" className="w-full h-full object-cover" />
                                    <a href={campaign.idImageUrl} target="_blank" className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold transition">View Full Size</a>
                                </>
                            ) : (
                                <span className="text-xs text-slate-400">No Image</span>
                            )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 flex flex-col justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">{campaign.name}</h3>
                                <p className="text-sm text-slate-500 mb-2 font-mono">Creator: {campaign.creator}</p>
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
            )}
        </section>

        {/* LIVE ON BLOCKCHAIN */}
        <section className="pb-20">
            <div className="flex items-center gap-3 mb-6 pt-8 border-t">
                <h2 className="text-2xl font-bold text-slate-700">2. Live on Blockchain</h2>
                <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-full">
                    {liveCampaigns?.length || 0} Active
                </span>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-100 text-xs uppercase font-bold text-slate-500">
                        <tr>
                            <th className="px-6 py-4">Campaign Name</th>
                            <th className="px-6 py-4">Contract Address</th>
                            <th className="px-6 py-4 text-right">Links</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {isLoadingLive ? (
                            <tr><td colSpan={3} className="px-6 py-8 text-center">Loading blockchain data...</td></tr>
                        ) : liveCampaigns && liveCampaigns.length > 0 ? (
                            [...liveCampaigns].reverse().map((camp, idx) => ( 
                                <tr key={idx} className="hover:bg-slate-50 transition">
                                    <td className="px-6 py-4 font-bold text-slate-800">{camp.name}</td>
                                    
                                    <td className="px-6 py-4 font-mono text-xs text-blue-600">
                                        <a 
                                            href={`https://sepolia.etherscan.io/address/${camp.campaignAddress}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="hover:underline flex items-center gap-1"
                                        >
                                            {camp.campaignAddress}
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                        </a>
                                    </td>
                                    
                                    <td className="px-6 py-4 text-right">
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
}