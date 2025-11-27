import { client } from "@/app/client";
import Link from "next/link";
import { getContract, toEther } from "thirdweb"; 
import { polygonAmoy } from "thirdweb/chains";
import { useReadContract } from "thirdweb/react";

type CampaignCardProps = {
    campaignAddress: string;
    showEmergencyFirst?: boolean;
    creationTime?: bigint;
    imageUrl?: string;       // <--- Required for images
    isEmergency?: boolean;   // <--- Required for priority badge
};

export const CampaignCard: React.FC<CampaignCardProps> = ({ 
    campaignAddress, 
    showEmergencyFirst = false,
    creationTime,
    imageUrl,
    isEmergency
}) => {
    const contract = getContract({
        client: client,
        chain: polygonAmoy,
        address: campaignAddress,
    });

    const { data: campaignName } = useReadContract({
        contract: contract,
        method: "function name() view returns (string)",
        params: []
    });

    const { data: campaignDescription } = useReadContract({
        contract: contract,
        method: "function description() view returns (string)",
        params: []
    });

    const { data: goal } = useReadContract({
        contract: contract,
        method: "function goal() view returns (uint256)",
        params: [],
    });

    const { data: balance, isLoading: isLoadingBalance } = useReadContract({
        contract: contract,
        method: "function getContractBalance() view returns (uint256)",
        params: [],
    });

    const { data: deadline } = useReadContract({
        contract: contract,
        method: "function deadline() view returns (uint256)",
        params: [],
    });

    // --- 1. HYBRID CURRENCY FORMATTER ---
    // Fixes the "20000000..." vs "200" issue automatically
    const formatCurrency = (val: bigint | undefined) => {
        if (!val) return "0";
        // If huge (Wei), convert to Ether. If small (Legacy), keep as is.
        if (val > 1_000_000_000n) return toEther(val);
        return val.toString();
    };

    const displayBalance = formatCurrency(balance);
    const displayGoal = formatCurrency(goal);

    // Calculate Percentage
    const percentage = goal && balance 
        ? (Number(displayBalance) / Number(displayGoal)) * 100 
        : 0;

    // --- 2. DATE & DEADLINE ---
    const deadlineDate = deadline ? new Date(Number(deadline) * 1000) : null;
    const isExpired = deadlineDate ? new Date() > deadlineDate : false;
    const daysLeft = deadlineDate 
        ? Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) 
        : 0;

    const formattedDate = creationTime 
        ? new Date(Number(creationTime) * 1000).toLocaleDateString() 
        : "";

    return (
        <div className="flex flex-col justify-between max-w-sm bg-white border border-slate-200 rounded-lg shadow relative h-full hover:shadow-lg transition-shadow overflow-hidden group">
            
            {/* --- 3. IMAGE HEADER --- */}
            <div className="h-48 w-full bg-slate-100 relative">
                 {imageUrl ? (
                     <img 
                        src={imageUrl} 
                        alt="Campaign" 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                     />
                 ) : (
                     <div className="flex items-center justify-center h-full text-slate-400 text-sm font-mono">
                        No Image
                     </div>
                 )}
                 
                 {/* Emergency Badge */}
                 {isEmergency && (
                    <div className="absolute top-3 right-3 bg-red-600 text-white px-3 py-1 rounded-full shadow-lg animate-pulse flex items-center gap-1 z-10">
                         <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                         <span className="text-xs font-bold uppercase tracking-wider">Emergency</span>
                    </div>
                 )}
            </div>
            
            <div className="p-5 flex-1 flex flex-col">
                {!isLoadingBalance && (
                    <div className="mb-4">
                        <div className="flex justify-between text-xs mb-1.5 font-bold text-slate-600">
                            <span>Raised: {displayBalance} POL</span>
                            <span>Goal: {displayGoal} POL</span>
                        </div>
                        <div className="relative w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 rounded-full transition-all duration-1000" style={{ width: `${percentage > 100 ? 100 : percentage}%`}}></div>
                        </div>
                        <div className="text-right mt-1 text-xs text-slate-400 font-medium">
                            {percentage.toFixed(1)}% Funded
                        </div>
                    </div>
                )}
                
                <h5 className="mb-2 text-xl font-bold tracking-tight text-slate-900 line-clamp-1">{campaignName}</h5>
                
                <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
                    <span className="bg-slate-100 px-2 py-1 rounded">{formattedDate}</span>
                    {deadlineDate && (
                        <span className={`px-2 py-1 rounded ${isExpired ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>
                            {isExpired ? `Ended` : `${daysLeft} days left`}
                        </span>
                    )}
                </div>

                <p className="mb-4 font-normal text-slate-600 line-clamp-3 text-sm flex-1">
                    {campaignDescription}
                </p>
                
                <Link href={`/campaign/${campaignAddress}`} passHref={true} className="mt-auto">
                    <button className="w-full px-4 py-2.5 text-sm font-bold text-center text-white bg-blue-700 rounded-lg hover:bg-slate-600 transition-colors shadow-sm">
                        View
                    </button>
                </Link>
            </div>
        </div>
    )
};