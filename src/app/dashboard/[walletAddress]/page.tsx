'use client';

import { client } from "@/app/client";
import { CROWDFUNDING_FACTORY } from "@/app/constants/contracts";
import { MyCampaignCard } from "../../components/MyCampaignCard";
import { useState, useEffect } from "react";
import { getContract } from "thirdweb";
import { useActiveAccount, useReadContract } from "thirdweb/react";
import { polygonAmoy, sepolia } from "thirdweb/chains";
import { useNetwork } from '../../contexts/NetworkContext';

const { selectedChain, setSelectedChain } = useNetwork();

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
};

export default function DashboardPage() {
    const { selectedChain, setSelectedChain } = useNetwork();   
    const account = useActiveAccount();
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [selectedFilter, setSelectedFilter] = useState<'all' | 'active' | 'successful' | 'failed'>('all');
    const [pendingRequests, setPendingRequests] = useState<CampaignRequest[]>([]);



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
            setPendingRequests(reqs);
        } catch (error) {
            console.error("Error fetching requests:", error);
        }
    };

    useEffect(() => {
        if (account) fetchPendingRequests();
    }, [account]);

    return (
        <div className="mx-auto max-w-7xl px-4 mt-16 sm:px-6 lg:px-8">
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
            <div className="mb-12 bg-slate-50 border border-slate-200 rounded-lg p-6">
                <h3 className="text-2xl font-bold text-slate-700 mb-4">Requests Status</h3>
                {pendingRequests.length === 0 ? (
                    <p className="text-slate-400 italic">No pending requests found.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {pendingRequests.map((req) => (
                            <div key={req.id} className="bg-white p-4 rounded shadow-sm border border-gray-200 relative overflow-hidden">
                                {req.isEmergency && (
                                    <div className="absolute top-0 left-0 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-br">
                                        EMERGENCY
                                    </div>
                                )}  
                                <div className="flex justify-between items-start mb-2 mt-2">
                                    <div>
                                        <h4 className="font-bold text-lg truncate pr-2">{req.name}</h4>
                                        {req.fullName && <p className="text-xs text-gray-400">By: {req.fullName}</p>}
                                    </div>
                                    <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${
                                        req.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                                        req.status === 'approved' ? 'bg-green-100 text-green-700' :
                                        'bg-yellow-100 text-yellow-700'
                                    }`}>{req.status}</span>
                                </div>
                                <p className="text-sm text-gray-600 line-clamp-2 mb-2">{req.description}</p>
                                {req.status === 'rejected' && (
                                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded mt-2">
                                        <strong>Reason:</strong> {req.rejectionReason}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ACTIVE CAMPAIGNS SECTION */}
            <div className="flex flex-row justify-between items-center mb-4">
                <p className="text-2xl font-semibold">Active Blockchain Campaigns:</p>
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

            <div className="grid grid-cols-3 gap-4 mb-20">
                {!isLoadingMyCampaigns && (
                    myCampaigns && myCampaigns.length > 0 ? (
                        myCampaigns.map((campaign, index) => (
                            <CampaignWithStatus
                                key={index}
                                contractAddress={campaign.campaignAddress}
                                selectedFilter={selectedFilter}
                            />
                        ))
                    ) : (
                        <p className="text-gray-500">No active campaigns on blockchain.</p>
                    )
                )}
            </div>
            
            {isModalOpen && (
                <CreateCampaignModal
                    setIsModalOpen={setIsModalOpen}
                    refreshRequests={fetchPendingRequests}
                />
            )}
        </div>
    );
}

// --------------------------------------------------------
// CREATE MODAL
// --------------------------------------------------------
type CreateCampaignModalProps = {
    setIsModalOpen: (value: boolean) => void;
    refreshRequests: () => void;
}

const CreateCampaignModal = ({ setIsModalOpen, refreshRequests }: CreateCampaignModalProps) => {
    const account = useActiveAccount();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [fullName, setFullName] = useState(""); 
    const [name, setName] = useState("");         
    const [age, setAge] = useState(""); 
    const [description, setDescription] = useState("");
    const [goal, setGoal] = useState(1);
    const [deadline, setDeadline] = useState(30);
    const [isEmergency, setIsEmergency] = useState(false);
    
    // File State
    const [campaignImage, setCampaignImage] = useState<File | null>(null);
    const [idImage, setIdImage] = useState<File | null>(null);

    const handleSubmit = async () => {
        if (!account) return alert("Connect wallet first");
        if (!fullName || !name || !description || !age || !campaignImage || !idImage) {
            return alert("Please fill all fields, including your Full Name, and upload BOTH images.");
        }

        try {
            setIsSubmitting(true);

            // 1. Upload Images
            const campUrl = await uploadToCloudinary(campaignImage);
            const idUrl = await uploadToCloudinary(idImage);

            // 2. LOGIC: Prepend string to Name if Emergency is checked.
            // This ensures your "namecheck logic" (name.includes('emergency')) works elsewhere.
            const finalName = isEmergency ? `(EMERGENCY) ${name}` : name;

            // 3. Save Data
            await addDoc(collection(db, "campaigns"), {
                creator: account.address,
                fullName: fullName, 
                name: finalName,    // <--- Sending the Modified Name
                description: description,
                age: age,
                goal: goal,
                deadline: deadline,
                isEmergency: isEmergency,
                imageUrl: campUrl,      
                idImageUrl: idUrl,      
                status: "pending",
                createdAt: Date.now()
            });

            alert("Request Submitted Successfully!");
            refreshRequests(); 
            setIsModalOpen(false);

        } catch (error) {
            console.error("Submission Error:", error);
            alert("Error submitting. Check console.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center backdrop-blur-md z-50">
            <div className="w-full max-w-lg bg-white p-6 rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <p className="text-xl font-bold text-slate-800">New Campaign Request</p>
                    <button className="text-gray-500 hover:text-black" onClick={() => setIsModalOpen(false)}>✕</button>
                </div>

                <div className="flex flex-col gap-4">
                    {/* Identity Info */}
                    <div className="grid grid-cols-3 gap-4">
                         <div className="col-span-2">
                            <label className="block text-sm font-bold mb-1">User's Legal Name</label>
                            <input 
                                value={fullName} 
                                onChange={(e) => setFullName(e.target.value)} 
                                className="w-full px-3 py-2 border rounded" 
                                placeholder="John Doe" 
                            />
                         </div>
                         <div>
                            <label className="block text-sm font-bold mb-1">Age</label>
                            <input 
                                type="number" 
                                value={age} 
                                onChange={(e) => setAge(e.target.value)} 
                                className="w-full px-3 py-2 border rounded" 
                                placeholder="18+" 
                            />
                         </div>
                    </div>

                    {/* Campaign Info */}
                    <div>
                        <label className="block text-sm font-bold mb-1">Campaign Title</label>
                        <input 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                            className="w-full px-3 py-2 border rounded" 
                            placeholder="e.g., Medical Fund for..." 
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-1">Description</label>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 border rounded h-24" placeholder="Description" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold mb-1">Goal (₱)</label>
                            <input type="number" value={goal} onChange={(e) => setGoal(Number(e.target.value))} className="w-full px-3 py-2 border rounded" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1">Duration (Days)</label>
                            <input type="number" value={deadline} onChange={(e) => setDeadline(Number(e.target.value))} className="w-full px-3 py-2 border rounded" />
                        </div>
                    </div>

                    {/* --- EMERGENCY TOGGLE --- */}
                    <div 
                        className={`p-4 rounded border cursor-pointer transition flex items-center gap-3 ${
                            isEmergency ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200'
                        }`} 
                        onClick={() => setIsEmergency(!isEmergency)}
                    >
                        <input 
                            type="checkbox" 
                            checked={isEmergency}
                            onChange={(e) => setIsEmergency(e.target.checked)}
                            className="w-5 h-5 text-red-600 rounded focus:ring-red-500 cursor-pointer"
                        />
                        <div>
                            <label className={`block font-bold text-sm cursor-pointer ${isEmergency ? 'text-red-700' : 'text-slate-600'}`}>
                                Mark as Emergency (High Priority)
                            </label>
                            <p className="text-xs text-slate-500">Checking this will append "(EMERGENCY)" to your campaign title.</p>
                        </div>
                    </div>

                    {/* IMAGE INPUTS */}
                    <div className="border-t pt-4 mt-2">
                        <label className="block text-sm font-bold text-blue-800 mb-2">1. Campaign Cover Image</label>
                        <input type="file" accept="image/*" onChange={(e) => setCampaignImage(e.target.files?.[0] || null)} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                    </div>

                    <div className="border-t pt-4 mt-2 bg-yellow-50 p-3 rounded">
                        <label className="block text-sm font-bold text-yellow-800 mb-2">2. ID Verification (Required)</label>
                        <input type="file" accept="image/*" onChange={(e) => setIdImage(e.target.files?.[0] || null)} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-100 file:text-yellow-700 hover:file:bg-yellow-200"/>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded shadow transition"
                    >
                        {isSubmitting ? "Uploading & Saving..." : "Submit for Approval"}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- HELPER ---
type CampaignWithStatusProps = {
    contractAddress: string;
    selectedFilter: 'all' | 'active' | 'successful' | 'failed';
};

const CampaignWithStatus: React.FC<CampaignWithStatusProps> = ({ contractAddress, selectedFilter }) => {
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

    return <MyCampaignCard contractAddress={contractAddress} />;
};