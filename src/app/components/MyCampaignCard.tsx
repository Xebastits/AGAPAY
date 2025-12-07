'use client';

import { client } from "@/app/client";
import Link from "next/link";
import Image from "next/image"; 
import { getContract } from "thirdweb"; 
import { useReadContract, useActiveAccount } from "thirdweb/react";
import { prepareContractCall, sendTransaction } from "thirdweb"; 
import { useState, useEffect, useMemo } from "react";
import { useNetwork } from '../contexts/NetworkContext';
import { db } from "@/app/lib/firebase"; 
import { collection, query, where, getDocs } from "firebase/firestore";

type CampaignCardProps = {
    campaignAddress: string;
    showEmergencyFirst?: boolean;
    creationTime?: bigint;
    imageUrl?: string; 
};

export const MyCampaignCard: React.FC<CampaignCardProps> = ({ 
    campaignAddress, 
    showEmergencyFirst = false,
    creationTime,
    imageUrl,     
}) => {
    const { selectedChain } = useNetwork();   
    const account = useActiveAccount();
    const [firebaseImage, setFirebaseImage] = useState<string>("");
    const [isWithdrawing, setIsWithdrawing] = useState(false);

    const contract = getContract({
      client: client,
      chain: selectedChain,
      address: campaignAddress,
    });

    // Contract Reads
    const { data: campaignName } = useReadContract({ contract, method: "function name() view returns (string)", params: [] });
    const { data: campaignDescription } = useReadContract({ contract, method: "function description() view returns (string)", params: [] });
    const { data: goal } = useReadContract({ contract, method: "function goal() view returns (uint256)", params: [] });
    const { data: balance, isLoading: isLoadingBalance } = useReadContract({ contract, method: "function getContractBalance() view returns (uint256)", params: [] });
    const { data: owner } = useReadContract({ contract, method: "function owner() view returns (address)", params: [] });
    const { data: state } = useReadContract({ contract, method: "function state() view returns (uint8)", params: [] });
    const { data: deadline } = useReadContract({ contract, method: "function deadline() view returns (uint256)", params: [] });

    // 2. PERFORMANCE: Memoize calculations
    const stats = useMemo(() => {
        const displayBalance = balance ? balance.toString() : "0";
        const displayGoal = goal ? goal.toString() : "0";
        const percentage = goal && balance ? (Number(balance) / Number(goal)) * 100 : 0;

        const isSuccessful = state === 1 || (state === 0 && balance !== undefined && goal !== undefined && balance >= goal);
        
        // Show withdraw IF: Owner + Success + Money Exists (> 0)
        const canWithdraw = Boolean(owner === account?.address && isSuccessful && balance && balance > 0n);

        const now = Date.now();
        const deadlineMs = deadline ? Number(deadline) * 1000 : 0;
        const daysLeft = Math.ceil((deadlineMs - now) / (1000 * 60 * 60 * 24));
        const isExpired = deadlineMs ? now > deadlineMs : false;
        
        const formattedDate = creationTime ? new Date(Number(creationTime) * 1000).toLocaleDateString() : "";

        const isEmergency = campaignName && campaignDescription &&
            (campaignName.toLowerCase().includes('emergency') || campaignDescription.toLowerCase().includes('emergency'));

        return { displayBalance, displayGoal, percentage, isSuccessful, canWithdraw, daysLeft, isExpired, formattedDate, isEmergency };
    }, [balance, goal, state, owner, account, deadline, creationTime, campaignName, campaignDescription]);

    // Fetch Firebase Image
    useEffect(() => {
        const fetchMetadata = async () => {
            if (!campaignName) return;
            try {
                const q = query(collection(db, "campaigns"), where("name", "==", campaignName));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) setFirebaseImage(snapshot.docs[0].data().imageUrl);
            } catch (error) { console.error(error); }
        };
        fetchMetadata();
    }, [campaignName]);

    const finalImageUrl = imageUrl || firebaseImage;

    // Manual Withdraw Function
    const handleWithdraw = async () => {
        if(!account) return;
        setIsWithdrawing(true);
        try {
            const transaction = prepareContractCall({ contract, method: "function withdraw()", params: [] });
            await sendTransaction({ transaction, account });
            alert("✅ Withdrawal Successful!");
            window.location.reload();
        } catch (error: any) {
            if (!error?.message?.includes("rejected")) alert("Transaction Failed");
        } finally {
            setIsWithdrawing(false);
        }
    };

    return (
        <div className="flex flex-col justify-between max-w-sm bg-white border border-slate-200 rounded-lg shadow relative h-full hover:shadow-lg transition-shadow overflow-hidden group">
            
            {/* IMAGE HEADER - OPTIMIZED FOR LOW RESOLUTION */}
            <div className="h-48 w-full bg-slate-100 relative overflow-hidden">
                 {finalImageUrl ? (
                     <Image 
                        src={finalImageUrl} 
                        alt={campaignName || "Campaign"} 
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        
                        // 1. LIMIT SIZE: Never load image larger than the card itself (384px)
                        sizes="(max-width: 768px) 100vw, 384px"
                        
                        // 2. LOWER QUALITY: Saves ~40% RAM/Network
                        quality={80}
                     />
                 ) : (
                     <div className="flex items-center justify-center h-full text-slate-400 text-sm font-bold">No Image</div>
                 )}
                 
                 {showEmergencyFirst && stats.isEmergency && (
                    <div className="absolute top-3 right-3 bg-red-600 text-white px-3 py-1 rounded-full shadow-lg text-xs font-bold uppercase z-10">Emergency</div>
                 )}
            </div>
            
            <div className="p-5 flex-1 flex flex-col">
                
                {/* PROGRESS BAR - HIDDEN IF SUCCESSFUL */}
                {!isLoadingBalance && !stats.isSuccessful && (
                    <div className="mb-4">
                        <div className="flex justify-between text-xs mb-1.5 font-bold text-slate-600">
                            <span>Raised: ₱{stats.displayBalance}</span>
                            <span>Goal: ₱{stats.displayGoal}</span>
                        </div>
                        <div className="relative w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 rounded-full transition-all duration-1000" style={{ width: `${stats.percentage > 100 ? 100 : stats.percentage}%`}}></div>
                        </div>
                        <div className="text-right mt-1 text-xs text-slate-400 font-medium">{stats.percentage.toFixed(0)}% Funded</div>
                    </div>
                )}

                {/* SUCCESS BADGE */}
                {stats.isSuccessful && (
                    <div className="mb-4 bg-green-100 border border-green-200 text-green-800 text-xs font-bold px-3 py-2 rounded text-center">
                        🎉 GOAL REACHED! (₱{stats.displayBalance} Raised)
                    </div>
                )}
                
                <h5 className="mb-2 text-xl font-bold text-slate-900 line-clamp-1">{campaignName || "Loading..."}</h5>
                
                <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
                    <span className="bg-slate-100 px-2 py-1 rounded">{stats.formattedDate}</span>
                    {deadline && (
                        <span className={`px-2 py-1 rounded ${stats.isExpired ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>
                            {stats.isExpired ? `Ended` : `${stats.daysLeft} days left`}
                        </span>
                    )}
                </div>

                <p className="mb-4 text-slate-600 line-clamp-3 text-sm flex-1">{campaignDescription}</p>

                <Link href={`/campaign/${campaignAddress}`} passHref={true} className="mt-auto block">
                    <button className="w-full px-4 py-2.5 text-sm font-bold text-white bg-blue-700 rounded-lg hover:bg-slate-600 transition-colors shadow-sm">View Details</button>
                </Link>

                {/* WITHDRAW BUTTON (Conditional + Padding) */}
                {stats.canWithdraw && (
                    <div className="mt-3">
                        <button onClick={handleWithdraw} disabled={isWithdrawing} className={`w-full px-4 py-2.5 text-sm font-bold text-white rounded-lg transition-colors shadow-sm ${isWithdrawing ? "bg-green-400" : "bg-green-600 hover:bg-green-700"}`}>
                            {isWithdrawing ? "Processing..." : "⚡ Withdraw Funds"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};