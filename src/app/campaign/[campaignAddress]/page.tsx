'use client';
import { client } from "@/app/client";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { getContract, prepareContractCall, toEther, toWei } from "thirdweb";
import { 
    lightTheme, 
    useActiveAccount, 
    useReadContract,
    useActiveWalletChain,
    useSwitchActiveWalletChain,
    ConnectButton
} from "thirdweb/react";
import { sendTransaction } from "thirdweb";
import { useNetwork } from '../../contexts/NetworkContext';
import { createWallet, inAppWallet } from "thirdweb/wallets";

// --- FIREBASE IMPORTS ---
import { db } from "@/app/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

const wallets = [
    inAppWallet({
        auth: {
            options: ["email", "google", "apple", "facebook"],
        },
    }),
    createWallet("io.metamask"),
    createWallet("com.coinbase.wallet"),
];

export default function CampaignPage() {
    const { selectedChain } = useNetwork();
    const account = useActiveAccount();
    const activeChain = useActiveWalletChain();
    const switchChain = useSwitchActiveWalletChain();
    const { campaignAddress } = useParams();
    
    const [donationAmount, setDonationAmount] = useState<string>("");
    const [imageUrl, setImageUrl] = useState<string>("");
    const [isDonating, setIsDonating] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);

    // --- Toast Notification State ---
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'pending' } | null>(null);

    const contract = getContract({
        client: client,
        chain: selectedChain,
        address: campaignAddress as string,
    });

    // --- HELPER: Show Toast ---
    const showToast = (message: string, type: 'success' | 'error' | 'info' | 'pending' = 'info', duration = 4000) => {
        setToast({ message, type });
        if (type !== 'pending') {
            setTimeout(() => setToast(null), duration);
        }
    };

    const clearToast = () => setToast(null);

    // --- HELPER: Format Currency ---
    const formatCurrency = (val: bigint | undefined) => {
        if (!val) return "0";
        return toEther(val);
    };

    // Contract reads
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

    const { data: description, isLoading: isLoadingDescription } = useReadContract({ 
        contract, 
        method: "function description() view returns (string)", 
        params: [] 
    });

    const { data: deadline, isLoading: isLoadingDeadline } = useReadContract({
        contract: contract,
        method: "function deadline() view returns (uint256)",
        params: [],
    });
    const deadlineDate = deadline ? new Date(parseInt(deadline.toString()) * 1000) : null;
    const hasDeadlinePassed = deadlineDate ? deadlineDate < new Date() : false;

    const { data: goal, isLoading: isLoadingGoal } = useReadContract({
        contract: contract,
        method: "function goal() view returns (uint256)",
        params: [],
    });

    const { data: balance, isLoading: isLoadingBalance, refetch: refetchBalance } = useReadContract({
        contract: contract,
        method: "function getContractBalance() view returns (uint256)",
        params: [],
    });

    const totalBalance = balance ? Number(formatCurrency(balance)) : 0;
    const totalGoal = goal ? Number(formatCurrency(goal)) : 0;
    let balancePercentage = totalGoal > 0 ? (totalBalance / totalGoal) * 100 : 0;
    if (balancePercentage >= 100) balancePercentage = 100;

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

    // --- INSTANT DONATION - Direct sendTransaction ---
    const handleDonate = async () => {
        const amount = parseFloat(donationAmount);
        
        // Validation
        if (!amount || amount < 0.0001) {
            showToast("Minimum donation is 0.0001 ETH", 'error');
            return;
        }

        if (!account) {
            showToast("Please connect your wallet first", 'error');
            return;
        }

        // Check if on correct chain
        if (activeChain?.id !== selectedChain.id) {
            showToast("Switching to correct network...", 'info');
            try {
                await switchChain(selectedChain);
            } catch (e) {
                showToast("Failed to switch network", 'error');
                return;
            }
        }

        setIsDonating(true);
        showToast("⏳ Confirm in your wallet...", 'pending');

        try {
            // Prepare the transaction
            const transaction = prepareContractCall({
                contract: contract,
                method: "function donate()",
                params: [],
                value: toWei(donationAmount),
            });

            // DIRECT SEND - No modal, instant wallet popup
            const result = await sendTransaction({
                transaction,
                account,
            });

            setTxHash(result.transactionHash);
            showToast(`🎉 Donation sent! TX: ${result.transactionHash.slice(0, 10)}...`, 'success', 6000);
            setDonationAmount("");
            
            // Refetch balance after a delay
            setTimeout(() => refetchBalance(), 3000);

        } catch (error: any) {
            console.error("Donation Error:", error);
            
            // Handle specific errors
            if (error?.message?.includes("rejected") || error?.message?.includes("denied")) {
                showToast("Transaction cancelled by user", 'info');
            } else if (error?.message?.includes("insufficient")) {
                showToast("Insufficient funds in wallet", 'error');
            } else {
                showToast(`Error: ${error?.message?.slice(0, 50) || "Transaction failed"}`, 'error');
            }
        } finally {
            setIsDonating(false);
            clearToast();
        }
    };

    // --- INSTANT WITHDRAW ---
    const handleWithdraw = async () => {
        if (!account) return;
        
        setIsDonating(true);
        showToast("⏳ Confirm withdrawal in wallet...", 'pending');

        try {
            const transaction = prepareContractCall({
                contract: contract,
                method: "function withdraw()",
                params: [],
            });

            const result = await sendTransaction({
                transaction,
                account,
            });

            showToast(`✅ Withdrawal successful! TX: ${result.transactionHash.slice(0, 10)}...`, 'success', 6000);
            setTimeout(() => refetchBalance(), 3000);

        } catch (error: any) {
            console.error("Withdraw Error:", error);
            showToast(`Error: ${error?.message?.slice(0, 50) || "Withdrawal failed"}`, 'error');
        } finally {
            setIsDonating(false);
            clearToast();
        }
    };

    // --- INSTANT REFUND ---
    const handleRefund = async () => {
        if (!account) return;
        
        setIsDonating(true);
        showToast("⏳ Confirm refund in wallet...", 'pending');

        try {
            const transaction = prepareContractCall({
                contract: contract,
                method: "function refund()",
                params: [],
            });

            const result = await sendTransaction({
                transaction,
                account,
            });

            showToast(`✅ Refund processed! TX: ${result.transactionHash.slice(0, 10)}...`, 'success', 6000);

        } catch (error: any) {
            console.error("Refund Error:", error);
            showToast(`Error: ${error?.message?.slice(0, 50) || "Refund failed"}`, 'error');
        } finally {
            setIsDonating(false);
            clearToast();
        }
    };

    // --- Quick Preset Amounts ---
    const presetAmounts = ["0.001", "0.01", "0.1", "1"];

    return (
        <div className="mx-auto max-w-7xl px-4 mt-8 sm:px-6 lg:px-8 pb-20">
            
            {/* TOAST NOTIFICATION */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-xl animate-slideIn flex items-center gap-3 ${
                    toast.type === 'success' ? 'bg-green-500 text-white' :
                    toast.type === 'error' ? 'bg-red-500 text-white' :
                    toast.type === 'pending' ? 'bg-yellow-500 text-white' :
                    'bg-blue-500 text-white'
                }`}>
                    {toast.type === 'pending' && (
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                        </svg>
                    )}
                    <p className="font-semibold">{toast.message}</p>
                </div>
            )}

            {/* HERO IMAGE */}
            <div className="max-w-2xl mx-auto h-56 md:h-80 bg-slate-100 rounded-xl overflow-hidden mb-8 shadow-sm relative">
                {imageUrl ? (
                    <img 
                        src={imageUrl} 
                        alt={name || "Campaign Cover"} 
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 flex-col gap-2">
                        <svg className="w-16 h-16 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="font-semibold opacity-50">No Cover Image</span>
                    </div>
                )}
                
                {/* Status Badge */}
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
                    {owner && (
                        <p className="text-sm text-slate-400 mt-1 font-mono truncate max-w-xs">
                            Creator: {owner.slice(0, 6)}...{owner.slice(-4)}
                        </p>
                    )}
                </div>

                {/* OWNER ACTIONS - Now using direct function */}
                {owner === account?.address && status === 1 && (
                    <button
                        onClick={handleWithdraw}
                        disabled={isDonating}
                        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isDonating ? "Processing..." : "⚡ Withdraw Funds"}
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* LEFT COLUMN: Description */}
                <div className="md:col-span-2">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 mb-8">
                        <h3 className="text-lg font-bold mb-4 border-b pb-2">About this Campaign</h3>
                        {!isLoadingDescription && (
                            <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">{description}</p>
                        )}
                    </div>

                    {/* TX Hash Display */}
                    {txHash && (
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4">
                            <p className="text-sm text-green-800">
                                <strong>Last Transaction:</strong>{" "}
                                <a 
                                    href={`${selectedChain.blockExplorers?.[0]?.url}/tx/${txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline hover:text-green-600"
                                >
                                    {txHash.slice(0, 20)}...
                                </a>
                            </p>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: Stats & Donation */}
                <div className="flex flex-col gap-6">
                    
                    {/* PROGRESS CARD */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                        <div className="mb-4">
                            <p className="text-4xl font-extrabold text-blue-600">
                                {formatCurrency(balance)} ETH
                            </p>
                            <p className="text-sm text-slate-500 font-medium mt-1">
                                raised of <span className="text-slate-800 font-bold">{formatCurrency(goal)} ETH</span> goal
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

                    {/* DONATION CARD - INSTANT VERSION */}
                    {status === 0 && !hasDeadlinePassed && (
                        <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 shadow-sm">
                            <h3 className="text-lg font-bold text-blue-900 mb-4">⚡ Quick Donate</h3>
                            
                            {!account ? (
                                <div className="text-center py-4">
                                    <p className="text-sm text-slate-600 mb-4">Connect wallet to donate</p>
                                    <ConnectButton
                                        client={client}
                                        wallets={wallets}
                                        theme={lightTheme()}
                                        connectButton={{ label: "Connect Wallet" }}
                                    />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Quick Preset Buttons */}
                                    <div className="grid grid-cols-4 gap-2">
                                        {presetAmounts.map((amt) => (
                                            <button
                                                key={amt}
                                                onClick={() => setDonationAmount(amt)}
                                                disabled={isDonating}
                                                className={`px-3 py-2 text-xs font-bold border-2 rounded-lg transition-all active:scale-95 ${
                                                    donationAmount === amt 
                                                    ? 'bg-blue-600 border-blue-600 text-white' 
                                                    : 'bg-white border-blue-200 hover:border-blue-500 hover:bg-blue-50'
                                                } disabled:opacity-50`}
                                            >
                                                {amt}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            value={donationAmount}
                                            onChange={(e) => setDonationAmount(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && !isDonating && handleDonate()}
                                            placeholder="Amount in ETH"
                                            step="0.0001"
                                            min="0.0001"
                                            disabled={isDonating}
                                            className="pl-4 pr-16 py-3 w-full border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-lg font-semibold text-slate-700 disabled:opacity-50 disabled:bg-slate-100"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                                            ETH
                                        </span>
                                    </div>
                                    
                                    {/* INSTANT DONATE BUTTON */}
                                    <button
                                        onClick={handleDonate}
                                        disabled={isDonating || !donationAmount || parseFloat(donationAmount) < 0.0001}
                                        className={`w-full py-4 text-lg font-bold rounded-lg transition-all duration-150 shadow-md ${
                                            isDonating || !donationAmount || parseFloat(donationAmount) < 0.0001
                                            ? "bg-blue-300 cursor-not-allowed text-blue-50" 
                                            : "bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg active:scale-[0.98]"
                                        }`}
                                    >
                                        {isDonating ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                                </svg>
                                                Waiting for Wallet...
                                            </span>
                                        ) : (
                                            `⚡ Donate ${donationAmount || '0'} ETH`
                                        )}
                                    </button>

                                    <p className="text-xs text-blue-400 text-center">
                                        Direct transaction • No extra modals • Instant wallet popup
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* REFUND CARD - INSTANT VERSION */}
                    {status === 2 && (
                        <div className="bg-red-50 p-6 rounded-lg border border-red-100 text-center shadow-sm">
                            <h3 className="text-lg font-bold text-red-800 mb-2">Campaign Failed</h3>
                            <p className="text-sm text-red-600 mb-4">
                                The funding goal was not met. Claim your refund below.
                            </p>
                            <button
                                onClick={handleRefund}
                                disabled={isDonating || !account}
                                className={`w-full py-3 font-bold rounded-lg transition-all ${
                                    isDonating || !account
                                    ? "bg-red-300 cursor-not-allowed text-red-50"
                                    : "bg-red-600 hover:bg-red-700 text-white"
                                }`}
                            >
                                {isDonating ? "Processing..." : "⚡ Claim Refund"}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                .animate-slideIn {
                    animation: slideIn 0.3s ease-out;
                }
            `}</style>
        </div>
    );
}