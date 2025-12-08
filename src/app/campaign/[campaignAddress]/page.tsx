'use client';

import { client } from "@/app/client";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Image from "next/image";
import { getContract, prepareContractCall, sendTransaction } from "thirdweb";
import {
    useActiveAccount,
    useReadContract,
    useActiveWalletChain,
    useSwitchActiveWalletChain,
    useWalletBalance,
    lightTheme
} from "thirdweb/react";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { useNetwork } from '../../contexts/NetworkContext';
import { db } from "@/app/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { ConnectButton } from "../../components/LazyConnectButton";

const wallets = [
    inAppWallet({ auth: { options: ["email", "google", "apple", "facebook"] } }),
    createWallet("io.metamask"),
    createWallet("com.coinbase.wallet"),
];

export default function CampaignPage() {
    const { selectedChain } = useNetwork();
    const account = useActiveAccount();
    const activeChain = useActiveWalletChain();
    const switchChain = useSwitchActiveWalletChain();
    const { campaignAddress } = useParams();

    // State
    const [donationAmount, setDonationAmount] = useState<string>("");
    const [imageUrl, setImageUrl] = useState<string>("");
    const [creatorFullName, setCreatorFullName] = useState<string>("");
    const [createdTimestamp, setCreatedTimestamp] = useState<number | null>(null); // New State

    const [isProcessing, setIsProcessing] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const contract = getContract({ client, chain: selectedChain, address: campaignAddress as string });
    const { data: userBalance } = useWalletBalance({ chain: selectedChain, address: account?.address, client });

    const showToast = (message: string, type: 'success' | 'error' | 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const formatCurrency = (val: bigint | undefined) => val ? val.toString() : "0";

    // --- CONTRACT READS ---
    const { data: name } = useReadContract({ contract, method: "function name() view returns (string)", params: [] });
    const { data: description } = useReadContract({ contract, method: "function description() view returns (string)", params: [] });
    const { data: deadline } = useReadContract({ contract, method: "function deadline() view returns (uint256)", params: [] });
    const { data: goal } = useReadContract({ contract, method: "function goal() view returns (uint256)", params: [] });
    const { data: balance, refetch: refetchBalance } = useReadContract({ contract, method: "function getContractBalance() view returns (uint256)", params: [] });
    const { data: owner } = useReadContract({ contract, method: "function owner() view returns (address)", params: [] });
    const { data: status } = useReadContract({ contract, method: "function state() view returns (uint8)", params: [] });

    // --- DATE LOGIC ---
    // Blockchain returns seconds, JS uses milliseconds
    const deadlineDate = deadline ? new Date(Number(deadline) * 1000) : null;
    const createdDate = createdTimestamp ? new Date(createdTimestamp) : null;
    const hasDeadlinePassed = deadlineDate ? deadlineDate < new Date() : false;

    // Helper to format dates nicely
    const formatDate = (date: Date | null) => {
        if (!date) return "Loading...";
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    // --- CALCULATION LOGIC ---
    const totalBalance = balance ? Number(balance) : 0;
    const totalGoal = goal ? Number(goal) : 0;
    let percentage = totalGoal > 0 ? (totalBalance / totalGoal) * 100 : 0;
    if (percentage > 100) percentage = 100;

    const isGoalMet = Boolean(balance !== undefined && goal !== undefined && balance >= goal);
    const isSuccessful = Boolean(status === 1 || (status === 0 && isGoalMet));
    const isFundsWithdrawn = Boolean(isSuccessful && balance !== undefined && balance === 0n);
    const canWithdraw = Boolean(owner === account?.address && isSuccessful && balance !== undefined && balance > 0n);

    // --- FETCH FIREBASE METADATA ---
    useEffect(() => {
        const fetchMetadata = async () => {
            if (!name) return;
            try {
                const q = query(collection(db, "campaigns"), where("name", "==", name));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    const data = snapshot.docs[0].data();
                    setImageUrl(data.imageUrl);
                    setCreatorFullName(data.fullName || "");
                    setCreatedTimestamp(data.createdAt || null); // Fetch created date
                }
            } catch (err) { console.error(err); }
        };
        fetchMetadata();
    }, [name]);

    // --- DONATE HANDLER ---
    const handleDonate = async () => {
        if (!donationAmount || donationAmount.includes(".") || isNaN(Number(donationAmount)) || Number(donationAmount) < 1) {
            showToast("Invalid amount. Integers only (Wei).", 'error');
            return;
        }
        if (!account) return showToast("Please connect your wallet", 'error');
        if (activeChain?.id !== selectedChain.id) { try { await switchChain(selectedChain); } catch { return showToast("Switch network failed", 'error'); } }

        setIsProcessing(true);
        showToast("Confirming donation...", 'info');

        try {
            let val = BigInt(donationAmount);
            if (goal && balance) {
                const remaining = goal - balance;
                if (val > remaining) {
                    val = remaining;
                    setDonationAmount(remaining.toString());
                    showToast(`⚠️ Adjusted to ₱${remaining}`, 'info');
                    if (remaining <= 0n) { setIsProcessing(false); return showToast("Goal Reached!", 'success'); }
                }
            }
            if (userBalance && userBalance.value < val) { setIsProcessing(false); return showToast("Insufficient Funds", 'error'); }

            const transaction = prepareContractCall({ contract, method: "function donate()", params: [], value: val });
            const result = await sendTransaction({ transaction, account });
            setTxHash(result.transactionHash);
            showToast("🎉 Donation Successful!", 'success');
            setDonationAmount("");
            setTimeout(() => refetchBalance(), 3000);
        } catch (e: any) {
            if (!e?.message?.includes("rejected")) showToast("Transaction Failed", 'error');
        } finally { setIsProcessing(false); }
    };

    const handleWithdraw = async () => {
        if (!account) return;
        if (userBalance && userBalance.value === 0n) return showToast(" Need gas for fees", 'error');
        setIsProcessing(true);
        showToast("⏳ Confirming withdrawal...", 'info');
        try {
            const transaction = prepareContractCall({ contract, method: "function withdraw()", params: [] });
            await sendTransaction({ transaction, account });
            showToast("✅ Withdrawn! Updating...", 'success');
            setTimeout(async () => { await refetchBalance(); }, 4000);
        } catch (e: any) {
            if (!e?.message?.includes("rejected")) showToast("Failed", 'error');
        } finally { setIsProcessing(false); }
    };

    const handleRefund = async () => {
        if (!account) return;
        setIsProcessing(true);
        try {
            const transaction = prepareContractCall({ contract, method: "function refund()", params: [] });
            await sendTransaction({ transaction, account });
            showToast("✅ Refunded!", 'success');
        } catch { showToast("Failed", 'error'); } finally { setIsProcessing(false); }
    };

    const presetAmounts = ["10", "50", "100", "500"];

    return (
        <div className="mx-auto max-w-7xl px-4 mt-8 sm:px-6 lg:px-8 pb-20">
            {toast && <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-xl text-white font-bold ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>{toast.message}</div>}

            {/* HERO IMAGE */}
            <div className="max-w-2xl mx-auto h-56 md:h-80 bg-slate-100 rounded-xl overflow-hidden mb-8 shadow-sm relative">
                {imageUrl ? (
                    <Image
                        src={imageUrl}
                        alt={name || ""}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        priority
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-400">No Cover Image</div>
                )}

                {status !== undefined && (
                    <div className="absolute top-4 right-4 px-4 py-2 text-sm font-bold rounded-full shadow-md text-white bg-blue-600 uppercase z-10">
                        {status === 0 ? "Active" : status === 1 ? "Successful" : "Failed"}
                    </div>
                )}
            </div>

            {/* HEADER: Title & Creator Info */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-4xl font-bold text-slate-900">{name || "Loading..."}</h1>
                    <div className="flex flex-col gap-1 mt-1">
                        <h2 className="text-xl text-slate-700">Creator: <span className="font-semibold">{creatorFullName}</span></h2>
                        {owner && (
                            <p className="text-xs text-slate-400 font-mono flex items-center gap-1">
                                <span>{owner}</span>
                                <a href={`https://sepolia.etherscan.io/address/${owner}`} target="_blank" className="hover:text-blue-500">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                </a>
                            </p>
                        )}
                    </div>
                </div>
                {canWithdraw && (
                    <button onClick={handleWithdraw} disabled={isProcessing} className={`px-6 py-3 font-bold rounded-lg shadow-md text-white ${isProcessing ? "bg-green-400" : "bg-green-600 hover:bg-green-700"}`}>
                        {isProcessing ? "Processing..." : "⚡ Withdraw Funds"}
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* LEFT COLUMN: About & Details */}
                <div className="md:col-span-2 space-y-6">

                    {/* NEW: DETAILS GRID */}
                    <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                        <div>
                            <p className="text-slate-500 font-bold mb-1 uppercase text-xs tracking-wider">Created On</p>
                            <p className="text-slate-800 font-medium">{formatDate(createdDate)}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 font-bold mb-1 uppercase text-xs tracking-wider">Deadline</p>
                            <p className={`font-medium ${hasDeadlinePassed ? 'text-red-600' : 'text-slate-800'}`}>
                                {formatDate(deadlineDate)}
                            </p>
                        </div>
                        <div className="sm:col-span-2 pt-4 border-t border-slate-200">
                            <p className="text-slate-500 font-bold mb-1 uppercase text-xs tracking-wider">Smart Contract Address (Sepolia)</p>
                            <a
                                href={`https://sepolia.etherscan.io/address/${campaignAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-mono break-all"
                            >
                                {campaignAddress}
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                            </a>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold mb-4 border-b pb-2">About</h3>
                        <p className="text-slate-600 whitespace-pre-wrap">{description}</p>
                    </div>

                    {txHash && <p className="mt-4 text-sm text-green-600 break-all bg-green-50 p-2 rounded border border-green-100">Last Transaction: {txHash}</p>}
                </div>

                {/* RIGHT COLUMN: Stats & Action */}
                <div className="flex flex-col gap-6">
                    {!isFundsWithdrawn && !isSuccessful && (
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                            <div className="mb-4">
                                <p className="text-4xl font-extrabold text-blue-600">₱{formatCurrency(balance)}</p>
                                <p className="text-sm text-slate-500">raised of <b>₱{formatCurrency(goal)}</b> goal</p>
                            </div>
                            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
                                <div className="h-full bg-blue-600 transition-all" style={{ width: `${percentage}%` }} />
                            </div>
                            <div className="flex justify-between text-xs text-slate-500 font-bold">
                                <span>{percentage.toFixed(0)}% Funded</span>
                                <span>{hasDeadlinePassed ? "Ended" : "Active"}</span>
                            </div>
                        </div>
                    )}

                    {isFundsWithdrawn && <div className="bg-gray-100 p-6 rounded-lg text-center border border-gray-300"><h3 className="text-xl font-bold text-gray-600"> Campaign Finished</h3><p className="text-sm text-gray-500">Funds withdrawn.</p></div>}
                    {!isFundsWithdrawn && isSuccessful && <div className="bg-green-100 p-6 rounded-lg text-center border border-green-200"><h3 className="text-xl font-bold text-green-800">Goal Reached!</h3></div>}

                    {!isSuccessful && !hasDeadlinePassed && status === 0 && (
                        <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 shadow-sm">
                            <h3 className="text-lg font-bold text-blue-900 mb-4">Quick Donate</h3>
                            {!account ? (
                                <div className="text-center"><ConnectButton client={client} wallets={wallets} theme={lightTheme()} connectButton={{ label: "Connect Wallet" }} /></div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-4 gap-2">
                                        {presetAmounts.map((amt) => (
                                            <button key={amt} onClick={() => setDonationAmount(amt)} disabled={isProcessing} className={`px-3 py-2 text-xs font-bold border-2 rounded transition-colors ${donationAmount === amt ? 'bg-blue-600 text-white' : 'bg-white hover:bg-blue-50'}`}>{amt}</button>
                                        ))}
                                    </div>
                                    <div className="relative">
                                        <input type="number" value={donationAmount} onChange={(e) => setDonationAmount(e.target.value)} placeholder="Amount in PHP" disabled={isProcessing} className="pl-4 py-3 w-full border rounded text-lg font-bold" />
                                        <span className="absolute right-6 top-3 font-bold text-slate-400">PHP</span>
                                    </div>
                                    <button onClick={handleDonate} disabled={isProcessing || !donationAmount || donationAmount.includes(".") || isNaN(Number(donationAmount)) || Number(donationAmount) < 1} className={`w-full py-3 text-lg font-bold rounded shadow text-white transition-all ${isProcessing || !donationAmount ? "bg-blue-300" : "bg-blue-600 hover:bg-blue-700"}`}>
                                        {isProcessing ? "Processing..." : `Donate ₱${donationAmount || '0'}`}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {status === 2 && (
                        <div className="bg-red-50 p-6 rounded-lg text-center border border-red-100">
                            <h3 className="text-red-800 font-bold mb-2">Campaign Failed</h3>
                            <button onClick={handleRefund} disabled={isProcessing} className="w-full py-3 bg-red-600 text-white font-bold rounded hover:bg-red-700">{isProcessing ? "Processing..." : "Claim Refund"}</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}