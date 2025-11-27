'use client';
import { client } from "@/app/client";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { getContract, prepareContractCall, toEther, toWei } from "thirdweb";
import { polygonAmoy } from "thirdweb/chains";
import { lightTheme, TransactionButton, useActiveAccount, useReadContract } from "thirdweb/react";

// --- FIREBASE IMPORTS ---
import { db } from "@/app/lib/firebase"; 
import { collection, query, where, getDocs } from "firebase/firestore";

export default function CampaignPage() {
    const account = useActiveAccount();
    const { campaignAddress } = useParams();
    const [donationAmount, setDonationAmount] = useState<string>("");
    
    // --- State for Image ---
    const [imageUrl, setImageUrl] = useState<string>("");

    const contract = getContract({
        client: client,
        chain: polygonAmoy,
        address: campaignAddress as string,
    });

    // --- HELPER: Format Currency ---
    const formatCurrency = (val: bigint | undefined) => {
        if (!val) return "0";
        if (val > 1_000_000_000n) return toEther(val);
        return val.toString();
    };

    // 1. Fetch Name
    const { data: name, isLoading: isLoadingName } = useReadContract({
        contract: contract,
        method: "function name() view returns (string)",
        params: [],
    });

    // --- Fetch Image from Firebase ---
    useEffect(() => {
        const fetchImage = async () => {
            if (!name) return;
            try {
                const q = query(collection(db, "campaigns"), where("name", "==", name));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    setImageUrl(snapshot.docs[0].data().imageUrl);
                }
            } catch (err) {
                console.error("Error fetching image:", err);
            }
        };
        fetchImage();
    }, [name]);

    // 2. Fetch Description
    const { data: description, isLoading: isLoadingDescription } = useReadContract({ 
        contract, 
        method: "function description() view returns (string)", 
        params: [] 
    });

    // 3. Deadline Logic
    const { data: deadline, isLoading: isLoadingDeadline } = useReadContract({
        contract: contract,
        method: "function deadline() view returns (uint256)",
        params: [],
    });
    const deadlineDate = deadline ? new Date(parseInt(deadline.toString()) * 1000) : null;
    const hasDeadlinePassed = deadlineDate ? deadlineDate < new Date() : false;

    // 4. Goal & Balance
    const { data: goal, isLoading: isLoadingGoal } = useReadContract({
        contract: contract,
        method: "function goal() view returns (uint256)",
        params: [],
    });
    
    const { data: balance, isLoading: isLoadingBalance } = useReadContract({
        contract: contract,
        method: "function getContractBalance() view returns (uint256)",
        params: [],
    });

    const totalBalance = balance ? Number(formatCurrency(balance)) : 0;
    const totalGoal = goal ? Number(formatCurrency(goal)) : 0;
    
    let balancePercentage = totalGoal > 0 ? (totalBalance / totalGoal) * 100 : 0;
    if (balancePercentage >= 100) balancePercentage = 100;

    // 5. Owner & State
    const { data: owner } = useReadContract({
        contract: contract,
        method: "function owner() view returns (address)",
        params: [],
    });

    const { data: status, isLoading: isLoadingStatus } = useReadContract({ 
        contract, 
        method: "function state() view returns (uint8)", 
        params: [] 
    });

    const getStatusText = (s: number | undefined) => {
        if (s === 0) return "Active";
        if (s === 1) return "Successful";
        if (s === 2) return "Failed";
        return "Unknown";
    };

    return (
<div className="mx-auto max-w-7xl px-4 mt-8 sm:px-6 lg:px-8 pb-20">
            
            {}
            <div className="max-w-2xl mx-auto h-56 md:h-80 bg-slate-100 rounded-xl overflow-hidden mb-8 shadow-sm relative">
                                {imageUrl ? (
                                    <img 
                                        src={imageUrl} 
                                        alt={name || "Campaign Cover"} 
                                        className="w-full h-full object-cover"
                                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 flex-col gap-2">
                         <svg className="w-16 h-16 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                         <span className="font-semibold opacity-50">No Cover Image</span>
                    </div>
                )}
                
                {/* Status Badge Over Image */}
                {!isLoadingStatus && (
                    <div className="absolute top-4 right-4">
                        <span className={`px-4 py-2 text-sm font-bold rounded-full shadow-md uppercase tracking-wide ${
                            status === 0 ? "bg-green-500 text-white" :
                            status === 1 ? "bg-blue-600 text-white" :
                            "bg-red-600 text-white"
                        }`}>
                            {getStatusText(status)}
                        </span>
                    </div>
                )}
            </div>

            {/* HEADER INFO */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    {!isLoadingName && <h1 className="text-4xl font-bold text-slate-900">{name}</h1>}
                    {!isLoadingDescription && (
                         <p className="text-sm text-slate-400 mt-1 font-mono truncate max-w-xs">
                             Creator: {owner}
                         </p>
                    )}
                </div>

                {/* OWNER ACTIONS */}
                {owner === account?.address && (
                    <div className="flex gap-2">
                         {status === 1 && (
                            <TransactionButton
                                transaction={() => prepareContractCall({
                                    contract: contract,
                                    method: "function withdraw()",
                                    params: []
                                })}
                                onTransactionConfirmed={() => alert("Withdrawal successful!")}
                                onError={(error) => alert(`Error: ${error.message}`)}
                                theme={lightTheme()}
                                className="!bg-green-600 !text-white"
                            >
                                Withdraw Funds
                            </TransactionButton>
                        )}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* LEFT COLUMN: Description */}
                <div className="md:col-span-2">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 mb-8">
                        <h3 className="text-lg font-bold mb-4 border-b pb-2">About this Campaign</h3>
                        {!isLoadingDescription && <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">{description}</p>}
                    </div>
                </div>

                {/* RIGHT COLUMN: Stats & Donation */}
                <div className="flex flex-col gap-6">
                    
                    {/* PROGRESS CARD */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                        <div className="mb-4">
                            {/* UPDATED: Currency Symbol to ₱ */}
                            <p className="text-4xl font-extrabold text-blue-600">₱ {formatCurrency(balance)}</p>
                            <p className="text-sm text-slate-500 font-medium mt-1">
                                raised of <span className="text-slate-800 font-bold">₱ {formatCurrency(goal)}</span> goal
                            </p>
                        </div>

                        <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
                            <div 
                                className="h-full bg-blue-600 rounded-full transition-all duration-1000 ease-out" 
                                style={{ width: `${balancePercentage}%`}}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 font-bold">
                            <span>{balancePercentage.toFixed(1)}% Funded</span>
                            <span>
                                {!isLoadingDeadline && deadlineDate && (
                                    <span className={hasDeadlinePassed ? "text-red-500" : ""}>
                                        {hasDeadlinePassed ? "Ended" : deadlineDate.toLocaleDateString()}
                                    </span>
                                )}
                            </span>
                        </div>
                    </div>

                    {/* DONATION CARD */}
                    {status === 0 && !hasDeadlinePassed && (
                        <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 shadow-sm">
                            <h3 className="text-lg font-bold text-blue-900 mb-4">Make a Contribution</h3>
                            
                            <div className="space-y-4">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        {/* UPDATED: Input Icon to ₱ */}
                                        <span className="text-blue-500 font-bold text-xl">₱</span>
                                    </div>
                                    <input 
                                        type="number" 
                                        value={donationAmount}
                                        onChange={(e) => setDonationAmount(e.target.value)}
                                        placeholder="Amount"
                                        className="pl-10 pr-4 py-3 w-full border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-lg font-semibold text-slate-700"
                                    />
                                </div>
                                
                                <TransactionButton
                                    transaction={() => prepareContractCall({
                                        contract: contract,
                                        method: "function donate()",
                                        params: [],
                                        value: toWei(donationAmount || "0")
                                    })}
                                    onTransactionConfirmed={() => {
                                        alert("Donation successful!");
                                        setDonationAmount("");
                                    }}
                                    onError={(error) => alert(`Error: ${error.message}`)}
                                    theme={lightTheme()}
                                    disabled={!donationAmount || parseFloat(donationAmount) <= 0}
                                    className="!w-full !py-4 !text-lg !font-bold !rounded-lg"
                                >
                                    Donate Now
                                </TransactionButton>
                            </div>
                            <p className="text-xs text-blue-400 mt-3 text-center">
                                Secure transaction on Blockchain
                            </p>
                        </div>
                    )}

                    {/* REFUND ACTION */}
                    {status === 2 && (
                        <div className="bg-red-50 p-6 rounded-lg border border-red-100 text-center shadow-sm">
                            <h3 className="text-lg font-bold text-red-800 mb-2">Campaign Failed</h3>
                            <p className="text-sm text-red-600 mb-4">The funding goal was not met. Contributors can claim a refund.</p>
                            <TransactionButton
                                transaction={() => prepareContractCall({
                                    contract: contract,
                                    method: "function refund()",
                                    params: []
                                })}
                                onTransactionConfirmed={() => alert("Refund processed!")}
                                theme={lightTheme()}
                                className="!bg-red-600 !text-white !w-full"
                            >
                                Claim Refund
                            </TransactionButton>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}