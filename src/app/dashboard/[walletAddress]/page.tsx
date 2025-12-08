'use client';

import { client } from "@/app/client";
import { CROWDFUNDING_FACTORY } from "@/app/constants/contracts";
import { MyCampaignCard } from "../../components/MyCampaignCard";
import RejectionGuidanceModal from "../../components/RejectionGuidanceModal";
import { useState, useEffect, useMemo } from "react";
import { getContract } from "thirdweb";
import { useActiveAccount, useReadContract } from "thirdweb/react";
import { useNetwork } from '../../contexts/NetworkContext';
import CreateCampaignModal from "../../components/CreateCampaignModal";


// Imports for Data & Image
import { db } from "@/app/lib/firebase";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { uploadToCloudinary } from "../../lib/cloudinary";

type CampaignRequest = {
    id: string;
    name: string;
    fullName?: string;
    description: string;
    status: string;
    rejectionReason?: string;
    isEmergency?: boolean;
    createdAt?: number;
};

const ITEMS_PER_PAGE = 6;

export default function DashboardPage() {
    const { selectedChain } = useNetwork();
    const account = useActiveAccount();

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [isRejectionModalOpen, setIsRejectionModalOpen] = useState<boolean>(false);
    const [selectedRejectedRequest, setSelectedRejectedRequest] = useState<CampaignRequest | null>(null);
    const [selectedFilter, setSelectedFilter] = useState<'all' | 'active' | 'successful' | 'failed'>('all');

    // Data State
    const [pendingRequests, setPendingRequests] = useState<CampaignRequest[]>([]);

    // Pagination State
    const [pendingPage, setPendingPage] = useState(1);
    const [activePage, setActivePage] = useState(1);

    const contract = getContract({
        client: client,
        chain: selectedChain,
        address: CROWDFUNDING_FACTORY,
    });

    const { data: myCampaigns, isLoading: isLoadingMyCampaigns } = useReadContract({
        contract: contract,
        method: "function getUserCampaigns(address _user) view returns ((address campaignAddress, address owner, string name)[])",
        params: [account?.address || ""]
    });

    const fetchPendingRequests = async () => {
        if (!account) return;
        try {
            const q = query(collection(db, "campaigns"), where("creator", "==", account.address));
            const snapshot = await getDocs(q);
            const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CampaignRequest));

            // Sort: Newest First
            reqs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

            setPendingRequests(reqs);
        } catch (error) {
            console.error("Error fetching requests:", error);
        }
    };

    useEffect(() => {
        if (account) fetchPendingRequests();
    }, [account]);

    // --- PAGINATION LOGIC ---
    const visiblePending = useMemo(() => {
        const start = (pendingPage - 1) * ITEMS_PER_PAGE;
        return pendingRequests.slice(start, start + ITEMS_PER_PAGE);
    }, [pendingRequests, pendingPage]);

    const totalPendingPages = Math.ceil(pendingRequests.length / ITEMS_PER_PAGE);

    const visibleActive = useMemo(() => {
        if (!myCampaigns) return [];
        const reversed = [...myCampaigns].reverse();
        const start = (activePage - 1) * ITEMS_PER_PAGE;
        return reversed.slice(start, start + ITEMS_PER_PAGE);
    }, [myCampaigns, activePage]);

    const totalActivePages = myCampaigns ? Math.ceil(myCampaigns.length / ITEMS_PER_PAGE) : 0;

    return (
        <div className="mx-auto max-w-7xl px-4 mt-16 sm:px-6 lg:px-8 pb-20">
            <div className="flex flex-row justify-between items-center mb-8">
                <p className="text-4xl font-semibold">Dashboard</p>
                <button
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium shadow"
                    onClick={() => setIsModalOpen(true)}
                >
                    + Create Campaign Request
                </button>
            </div>

            {/* PENDING SECTION */}
            {/* 1. FIXED HEIGHT CONTAINER: h-[44rem] ensures the box never changes size */}
            <div className="mb-12 bg-slate-50 border border-slate-200 rounded-lg p-6 h-[36rem] flex flex-col">
                <h3 className="text-2xl font-bold text-slate-700 mb-4 flex-none">Requests Status</h3>

                {pendingRequests.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                        <p className="text-slate-400 italic">No pending requests found.</p>
                    </div>
                ) : (
                    <>
                        {/* Content Area - Takes up available space */}
                        <div className="flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {visiblePending.map((req) => (
                                    <div
                                        key={req.id}
                                        // 2. FIXED CARD HEIGHT: h-48 prevents row shifting
                                        className={`bg-white p-4 pr-6 rounded shadow-sm border border-gray-200 
                                        relative break-words h-48 flex flex-col justify-between
                                        ${req.status === "rejected" ? "cursor-pointer hover:shadow-md transition" : ""}`}
                                        onClick={() => {
                                            if (req.status === "rejected") {
                                                setSelectedRejectedRequest(req);
                                                setIsRejectionModalOpen(true);
                                            }
                                        }}
                                    >
                                        {req.isEmergency && (
                                            <div className="absolute top-0 left-0 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-br">
                                                EMERGENCY
                                            </div>
                                        )}
                                        <div className="flex justify-between items-start mb-2 mt-2">
                                            <div className="pr-2 w-full">
                                                <h4 className="font-bold text-lg break-words line-clamp-1" title={req.name}>{req.name}</h4>
                                                {req.fullName && (
                                                    <p className="text-xs text-gray-400 break-words line-clamp-1">By: {req.fullName}</p>
                                                )}
                                            </div>
                                            <span
                                                className={`text-xs font-bold px-2 py-1 rounded uppercase flex-shrink-0 ml-1 ${req.status === "rejected"
                                                    ? "bg-red-100 text-red-700"
                                                    : req.status === "approved"
                                                        ? "bg-green-100 text-green-700"
                                                        : "bg-yellow-100 text-yellow-700"
                                                    }`}
                                            >
                                                {req.status}
                                            </span>
                                        </div>

                                        {/* Description limited to 3 lines to fit in fixed height */}
                                        <p className="text-sm text-gray-600 line-clamp-3 mb-2 break-words flex-1">{req.description}</p>

                                        {req.status === "rejected" && (
                                            <div className="text-xs text-red-600 bg-red-50 p-1.5 rounded mt-auto text-center font-bold">
                                                View reason
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 3. PAGINATION: Pinned to bottom using flex-none and margin-top-auto logic */}
                        <div className="flex-none pt-4 border-t border-slate-200 mt-4 h-16 flex items-center justify-center">
                            {totalPendingPages > 1 && (
                                <div className="flex justify-center items-center gap-4 w-64 mx-auto">
                                    <button
                                        onClick={() => setPendingPage(p => Math.max(1, p - 1))}
                                        disabled={pendingPage === 1}
                                        className="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-100 disabled:opacity-50 transition-colors"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-sm text-gray-600 text-center w-24 font-medium">{`Page ${pendingPage} of ${totalPendingPages}`}</span>
                                    <button
                                        onClick={() => setPendingPage(p => Math.min(totalPendingPages, p + 1))}
                                        disabled={pendingPage === totalPendingPages}
                                        className="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-100 disabled:opacity-50 transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>


            {/* ACTIVE SECTION */}
            <div className="flex flex-row justify-between items-center mb-4 border-t pt-8">
                <p className="text-2xl font-semibold">My Campaigns:</p>
                <div className="flex items-center">
                    <label className="mr-2 text-sm font-medium">Filter:</label>
                    <select
                        value={selectedFilter}
                        onChange={(e) => setSelectedFilter(e.target.value as any)}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-md"
                    >
                        <option value="all">All</option>
                        <option value="active">Active</option>
                        <option value="successful">Successful</option>
                        <option value="failed">Failed</option>
                    </select>
                </div>
            </div>

            <div className="mb-20">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {!isLoadingMyCampaigns && (
                        myCampaigns && myCampaigns.length > 0 ? (
                            visibleActive.map((campaign, index) => (
                                <CampaignWithStatus
                                    key={index}
                                    contractAddress={campaign.campaignAddress}
                                    selectedFilter={selectedFilter}
                                />
                            ))
                        ) : (
                            <p className="text-gray-500 col-span-3 text-center py-10">No active campaigns on blockchain.</p>
                        )
                    )}
                </div>

                {totalActivePages > 1 && (
                    <div className="flex justify-center items-center gap-4 mt-8">
                        <button
                            onClick={() => setActivePage(p => Math.max(1, p - 1))}
                            disabled={activePage === 1}
                            className="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-100 disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-gray-600">Page {activePage} of {totalActivePages}</span>
                        <button
                            onClick={() => setActivePage(p => Math.min(totalActivePages, p + 1))}
                            disabled={activePage === totalActivePages}
                            className="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-100 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <CreateCampaignModal
                    setIsModalOpen={setIsModalOpen}
                    refreshRequests={fetchPendingRequests}
                />
            )}

            {isRejectionModalOpen && selectedRejectedRequest && (
                <RejectionGuidanceModal
                    isOpen={isRejectionModalOpen}
                    onClose={() => {
                        setIsRejectionModalOpen(false);
                        setSelectedRejectedRequest(null);
                    }}
                    request={selectedRejectedRequest}
                    openCreateModal={() => setIsModalOpen(true)}
                />
            )}

        </div>
    );
}


// --- HELPER ---
type CampaignWithStatusProps = {
    contractAddress: string;
    selectedFilter: 'all' | 'active' | 'successful' | 'failed';
};

const CampaignWithStatus: React.FC<CampaignWithStatusProps> = ({ contractAddress, selectedFilter }) => {
    const { selectedChain } = useNetwork();
    const contract = getContract({
        client: client,
        chain: selectedChain,
        address: contractAddress,
    });

    const { data: status } = useReadContract({
        contract: contract,
        method: "function state() view returns (uint8)",
        params: [],
    });

    const statusString = status === 0 ? 'active' : status === 1 ? 'successful' : status === 2 ? 'failed' : 'unknown';

    if (selectedFilter !== 'all' && statusString !== selectedFilter) {
        return null;
    }

    return <MyCampaignCard campaignAddress={contractAddress} />;
};