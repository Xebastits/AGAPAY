'use client';
import { client } from "@/app/client";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { getContract, prepareContractCall, toEther, toWei } from "thirdweb";
import { lightTheme, TransactionButton, useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react";
import { useNetwork } from '../../contexts/NetworkContext';
import { db } from "@/app/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function CampaignPage() {
    const { selectedChain } = useNetwork();
    const account = useActiveAccount();
    const { campaignAddress } = useParams();
    const [donationAmount, setDonationAmount] = useState<string>("");
    const [imageUrl, setImageUrl] = useState<string>("");
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const { mutate: sendTransaction, isPending: isDonating } = useSendTransaction();

    const contract = getContract({
        client: client,
        chain: selectedChain,
        address: campaignAddress as string,
    });

    // --- Toast helper
    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const formatCurrency = (val: bigint | undefined) => {
        if (!val) return "0";
        if (val > 1_000_000_000n) return toEther(val);
        return val.toString();
    };

    // --- Read contract data ---
    const { data: name } = useReadContract({ contract, method: "function name() view returns (string)", params: [] });
    const { data: description } = useReadContract({ contract, method: "function description() view returns (string)", params: [] });
    const { data: deadline } = useReadContract({ contract, method: "function deadline() view returns (uint256)", params: [] });
    const { data: goal } = useReadContract({ contract, method: "function goal() view returns (uint256)", params: [] });
    const { data: balance, refetch: refetchBalance } = useReadContract({ contract, method: "function getContractBalance() view returns (uint256)", params: [] });
    const { data: owner } = useReadContract({ contract, method: "function owner() view returns (address)", params: [] });
    const { data: status } = useReadContract({ contract, method: "function state() view returns (uint8)", params: [] });

    // --- Firebase image fetch ---
    useEffect(() => {
        if (!name) return;
        const fetchImage = async () => {
            try {
                const q = query(collection(db, "campaigns"), where("name", "==", name));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) setImageUrl(snapshot.docs[0].data().imageUrl);
            } catch (err) {
                console.error("Error fetching image:", err);
            }
        };
        fetchImage();
    }, [name]);

    // --- Deadline logic ---
    const deadlineDate = deadline ? new Date(parseInt(deadline.toString()) * 1000) : null;
    const hasDeadlinePassed = deadlineDate ? deadlineDate < new Date() : false;

    const totalBalance = balance ? Number(formatCurrency(balance)) : 0;
    const totalGoal = goal ? Number(formatCurrency(goal)) : 0;
    let balancePercentage = totalGoal > 0 ? (totalBalance / totalGoal) * 100 : 0;
    if (balancePercentage >= 100) balancePercentage = 100;

    const getStatusText = (s: number | undefined) => {
        if (s === 0) return "Active";
        if (s === 1) return "Successful";
        if (s === 2) return "Failed";
        return "Unknown";
    };

    // --- 🔥 Instant donation handler ---
    const handleDonate = async () => {
        const amount = parseFloat(donationAmount);
        if (!amount || amount < 0.0001) {
            showToast("Minimum donation is 0.0001 ETH", "error");
            return;
        }

        try {
            // ✅ await prepareContractCall for instant wallet modal
            const preparedTx = await prepareContractCall({
                contract,
                method: "donate",
                params: [],
                value: toWei(donationAmount)
            });

            sendTransaction(preparedTx, {
                onSuccess: () => {
                    showToast("🎉 Donation successful!", "success");
                    setDonationAmount("");
                    refetchBalance?.();
                },
                onError: (err: any) => {
                    console.error("Donation error:", err);
                    showToast(err?.message || "Transaction failed", "error");
                },
            });
        } catch (err) {
            console.error("Preparation error:", err);
            showToast("Failed to prepare transaction", "error");
        }
    };

    const presetAmounts = ["0.001", "0.01", "0.1", "1"];

    return (
        <div className="mx-auto max-w-7xl px-4 mt-8 sm:px-6 lg:px-8 pb-20">
            
            {/* TOAST */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-xl animate-slideIn ${
                    toast.type === 'success' ? 'bg-green-500 text-white' :
                    toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
                }`}>
                    <p className="font-semibold">{toast.message}</p>
                </div>
            )}

            {/* HERO IMAGE */}
            <div className="max-w-2xl mx-auto h-56 md:h-80 bg-slate-100 rounded-xl overflow-hidden mb-8 shadow-sm relative">
                {imageUrl ? (
                    <img src={imageUrl} alt={name || "Campaign Cover"} className="w-full h-full object-cover" />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 flex-col gap-2">
                        <svg className="w-16 h-16 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span className="font-semibold opacity-50">No Cover Image</span>
                    </div>
                )}
                
                {!status && null}
                {status !== undefined && (
                    <div className="absolute top-4 right-4">
                        <span className={`px-4 py-2 text-sm font-bold rounded-full shadow-md uppercase tracking-wide ${
                            status === 0 ? "bg-green-500 text-white" :
                            status === 1 ? "bg-blue-600 text-white" : "bg-red-600 text-white"
                        }`}>
                            {getStatusText(status)}
                        </span>
                    </div>
                )}
            </div>

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    {name && <h1 className="text-4xl font-bold text-slate-900">{name}</h1>}
                    {description && <p className="text-sm text-slate-400 mt-1 font-mono truncate max-w-xs">Creator: {owner}</p>}
                </div>

                {/* OWNER ACTION */}
                {owner === account?.address && status === 1 && (
                    <TransactionButton
                        transaction={() => prepareContractCall({ contract, method: "withdraw", params: [] })}
                        onTransactionConfirmed={() => showToast("Withdrawal successful!", "success")}
                        onError={(err) => showToast(err.message, "error")}
                        theme={lightTheme()}
                        className="!bg-green-600 !text-white"
                    >
                        Withdraw Funds
                    </TransactionButton>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-slate-200 mb-8">
                    <h3 className="text-lg font-bold mb-4 border-b pb-2">About this Campaign</h3>
                    {description && <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">{description}</p>}
                </div>

                {/* RIGHT COLUMN */}
                <div className="flex flex-col gap-6">

                    {/* PROGRESS */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                        <div className="mb-4">
                            <p className="text-4xl font-extrabold text-blue-600">₱ {formatCurrency(balance)}</p>
                            <p className="text-sm text-slate-500 font-medium mt-1">
                                raised of <span className="text-slate-800 font-bold">₱ {formatCurrency(goal)}</span> goal
                            </p>
                        </div>
                        <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
                            <div className="h-full bg-blue-600 rounded-full transition-all duration-1000 ease-out" style={{ width: `${balancePercentage}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 font-bold">
                            <span>{balancePercentage.toFixed(1)}% Funded</span>
                            <span>{deadlineDate && (hasDeadlinePassed ? <span className="text-red-500">Ended</span> : deadlineDate.toLocaleDateString())}</span>
                        </div>
                    </div>

                    {/* DONATION CARD */}
                    {status === 0 && !hasDeadlinePassed && (
                        <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 shadow-sm">
                            <h3 className="text-lg font-bold text-blue-900 mb-4">Make a Contribution</h3>

                            {/* Preset amounts */}
                            <div className="grid grid-cols-4 gap-2 mb-2">
                                {presetAmounts.map((amt) => (
                                    <button key={amt} onClick={() => setDonationAmount(amt)} className="px-3 py-2 text-xs font-bold bg-white border-2 border-blue-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all active:scale-95">{amt} ETH</button>
                                ))}
                            </div>

                            <input
                                type="number"
                                value={donationAmount}
                                onChange={(e) => setDonationAmount(e.target.value)}
                                placeholder="Custom Amount"
                                step="0.0001"
                                min="0.0001"
                                className="pl-3 pr-3 py-3 w-full border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-lg font-semibold text-slate-700 mb-2 disabled:opacity-50"
                                disabled={isDonating}
                            />

                            <button
                                onClick={handleDonate}
                                disabled={isDonating || !donationAmount}
                                className={`w-full py-4 text-lg font-bold rounded-lg ${isDonating || !donationAmount ? "bg-blue-300 text-blue-50 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
                            >
                                {isDonating ? "Opening Wallet..." : "⚡ Donate Now"}
                            </button>
                        </div>
                    )}

                    {/* REFUND */}
                    {status === 2 && (
                        <TransactionButton
                            transaction={() => prepareContractCall({ contract, method: "refund", params: [] })}
                            onTransactionConfirmed={() => showToast("Refund processed!", "success")}
                            onError={(err) => showToast(err.message, "error")}
                            theme={lightTheme()}
                            className="!bg-red-600 !text-white !w-full"
                        >
                            Claim Refund
                        </TransactionButton>
                    )}
                </div>
            </div>

            <style jsx>{`
                @keyframes slideIn { from { transform: translateX(100%); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
                .animate-slideIn { animation: slideIn 0.3s ease-out; }
            `}</style>
        </div>
    );
}
