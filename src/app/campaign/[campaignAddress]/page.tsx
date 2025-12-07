'use client';

import { client } from "@/app/client";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { getContract, prepareContractCall, sendTransaction } from "thirdweb";
import {
    useActiveAccount,
    useReadContract,
    useActiveWalletChain,
    useSwitchActiveWalletChain,
    ConnectButton,
    useWalletBalance,
    lightTheme
} from "thirdweb/react";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { useNetwork } from '../../contexts/NetworkContext';

// --- FIREBASE IMPORTS ---
import { db } from "@/app/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

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

    // States
    const [donationAmount, setDonationAmount] = useState<string>("");
    const [imageUrl, setImageUrl] = useState<string>("");
    const [creatorFullName, setCreatorFullName] = useState<string>("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const contract = getContract({
        client: client,
        chain: selectedChain,
        address: campaignAddress as string,
    });

    const { data: userBalance } = useWalletBalance({
        chain: selectedChain,
        address: account?.address,
        client: client,
    });

    // --- HELPER: Show Toast ---
    const showToast = (message: string, type: 'success' | 'error' | 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    // --- HELPER: Strict Wei Display ---
    const formatCurrency = (val: bigint | undefined) => val ? val.toString() : "0";

    // --- CONTRACT READS ---
    const { data: name } = useReadContract({ contract, method: "function name() view returns (string)", params: [] });
    const { data: description } = useReadContract({ contract, method: "function description() view returns (string)", params: [] });
    const { data: deadline } = useReadContract({ contract, method: "function deadline() view returns (uint256)", params: [] });
    const { data: goal } = useReadContract({ contract, method: "function goal() view returns (uint256)", params: [] });
    
    // CRITICAL: We need refetchBalance to verify withdrawal success from blockchain
    const { data: balance, refetch: refetchBalance } = useReadContract({ contract, method: "function getContractBalance() view returns (uint256)", params: [] });
    
    const { data: owner } = useReadContract({ contract, method: "function owner() view returns (address)", params: [] });
    const { data: status } = useReadContract({ contract, method: "function state() view returns (uint8)", params: [] });

    const deadlineDate = deadline ? new Date(parseInt(deadline.toString()) * 1000) : null;
    const hasDeadlinePassed = deadlineDate ? deadlineDate < new Date() : false;

    // --- STRICT LOGIC (No floats, no random "0") ---
    const totalBalance = balance ? Number(balance) : 0;
    const totalGoal = goal ? Number(goal) : 0;
    let percentage = totalGoal > 0 ? (totalBalance / totalGoal) * 100 : 0;
    if (percentage > 100) percentage = 100;

    // 1. Goal Met?
    const isGoalMet = Boolean(balance !== undefined && goal !== undefined && balance >= goal);

    // 2. Successful? (Contract Status 1 OR Math Goal Met)
    const isSuccessful = Boolean(status === 1 || (status === 0 && isGoalMet));

    // 3. Withdrawn? (Successful AND Blockchain Balance is Strictly 0)
    const isFundsWithdrawn = Boolean(isSuccessful && balance !== undefined && balance === 0n);

    // 4. Can Withdraw? (Owner + Successful + Has Money)
    const canWithdraw = Boolean(owner === account?.address && isSuccessful && balance !== undefined && balance > 0n);

    // Metadata
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
                }
            } catch (err) { console.error(err); }
        };
        fetchMetadata();
    }, [name]);

    // --- FUNCTION 1: HANDLE DONATE (STRICT WEI) ---
    const handleDonate = async () => {
        // STRICT STRING/INTEGER CHECK
        if (!donationAmount || donationAmount.includes(".") || isNaN(Number(donationAmount)) || Number(donationAmount) < 1) {
            showToast("Invalid amount. Integers only (Wei).", 'error');
            return;
        }
        if (!account) return showToast("Please connect your wallet", 'error');
        if (activeChain?.id !== selectedChain.id) {
            try { await switchChain(selectedChain); } 
            catch { return showToast("Failed to switch network", 'error'); }
        }

        setIsProcessing(true);
        showToast("⏳ Confirming donation...", 'info');

        try {
            // STRICT CONVERSION TO BIGINT
            let valueInWei = BigInt(donationAmount);

            // AUTO-ADJUST LOGIC
            if (goal && balance) {
                const remaining = goal - balance; // BigInt Math (Wei)
                
                // If user input > remaining needed
                if (valueInWei > remaining) {
                    valueInWei = remaining;
                    setDonationAmount(remaining.toString());
                    
                    // Explicit Message
                    showToast(`⚠️ Adjusted to ₱${remaining.toString()} Wei (Exact Amount Needed)`, 'info');
                    
                    if (remaining <= 0n) {
                        setIsProcessing(false);
                        return showToast("🎉 Goal already reached!", 'success');
                    }
                }
            }

            if (userBalance && userBalance.value < valueInWei) {
                setIsProcessing(false);
                return showToast(`❌ Insufficient Funds.`, 'error');
            }

            const transaction = prepareContractCall({
                contract,
                method: "function donate()",
                params: [],
                value: valueInWei, // Sends Raw Wei
            });

            const result = await sendTransaction({ transaction, account });
            
            setTxHash(result.transactionHash);
            showToast("🎉 Donation Successful!", 'success');
            setDonationAmount("");
            
            // Update Balance
            setTimeout(() => refetchBalance(), 3000);

        } catch (error: any) {
            console.error("Donate Error:", error);
            if (error?.message?.includes("rejected")) showToast("Cancelled", 'info');
            else showToast("Transaction Failed", 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    // --- FUNCTION 2: HANDLE WITHDRAW (Blockchain Sync) ---
    const handleWithdraw = async () => {
        if (!account) return;
        
        if (userBalance && userBalance.value === 0n) {
            return showToast("❌ You need gas ETH to withdraw.", 'error');
        }

        setIsProcessing(true);
        showToast("⏳ Confirm withdrawal...", 'info');

        try {
            const transaction = prepareContractCall({
                contract,
                method: "function withdraw()",
                params: [],
            });

            await sendTransaction({ transaction, account });

            showToast("✅ Funds Withdrawn! Verifying...", 'success');
            
            // WAIT & REFETCH
            // We do NOT reload the page. We fetch the new balance.
            // If balance becomes 0n, 'isFundsWithdrawn' becomes true, and UI updates automatically.
            setTimeout(async () => {
                await refetchBalance();
            }, 4000);

        } catch (error: any) {
            console.error("Withdraw Error:", error);
            if (error?.message?.includes("rejected")) showToast("Cancelled", 'info');
            else showToast("Transaction Failed", 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    // --- FUNCTION 3: REFUND ---
    const handleRefund = async () => {
        if (!account) return;
        setIsProcessing(true);
        try {
            const transaction = prepareContractCall({ contract, method: "function refund()", params: [] });
            await sendTransaction({ transaction, account });
            showToast("✅ Refund processed!", 'success');
        } catch { showToast("Failed", 'error'); } 
        finally { setIsProcessing(false); }
    };

    const presetAmounts = ["10", "50", "100", "500"];

    return (
        <div className="mx-auto max-w-7xl px-4 mt-8 sm:px-6 lg:px-8 pb-20">
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-xl text-white font-bold 
                    ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>
                    {toast.message}
                </div>
            )}

            {/* HERO IMAGE */}
            <div className="max-w-2xl mx-auto h-56 md:h-80 bg-slate-100 rounded-xl overflow-hidden mb-8 shadow-sm relative">
                {imageUrl ? <img src={imageUrl} alt={name || "Cover"} className="w-full h-full object-cover" /> : 
                <div className="flex items-center justify-center h-full text-slate-400">No Cover Image</div>}
                
                {status !== undefined && (
                    <div className="absolute top-4 right-4 px-4 py-2 text-sm font-bold rounded-full shadow-md text-white bg-blue-600 uppercase">
                        {status === 0 ? "Active" : status === 1 ? "Successful" : "Failed"}
                    </div>
                )}
            </div>

            {/* TITLE & WITHDRAW BUTTON */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-4xl font-bold text-slate-900">{name || "Loading..."}</h1>
                    <h2 className="text-xl text-slate-700">Creator: {creatorFullName}</h2>
                </div>
                {canWithdraw && (
                    <button onClick={handleWithdraw} disabled={isProcessing} className={`px-6 py-3 font-bold rounded-lg shadow-md transition-all text-white ${isProcessing ? "bg-green-400" : "bg-green-600 hover:bg-green-700"}`}>
                        {isProcessing ? "Processing..." : "⚡ Withdraw Funds"}
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* LEFT: Description */}
                <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold mb-4 border-b pb-2">About</h3>
                    <p className="text-slate-600 whitespace-pre-wrap">{description}</p>
                    {txHash && <p className="mt-4 text-sm text-green-600 break-all">Last TX: {txHash}</p>}
                </div>

                {/* RIGHT: Stats & Actions */}
                <div className="flex flex-col gap-6">
                    {/* PROGRESS BAR - HIDDEN IF FUNDS WITHDRAWN */}
                    {!isFundsWithdrawn && (
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

                    {/* WITHDRAWN STATE */}
                    {isFundsWithdrawn && (
                        <div className="bg-gray-100 p-6 rounded-lg border border-gray-300 text-center">
                            <h3 className="text-xl font-bold text-gray-600 mb-1">🏁 Campaign Finished</h3>
                            <p className="text-gray-500 text-sm">Funds have been withdrawn.</p>
                        </div>
                    )}
                    
                    {/* SUCCESS STATE (Funds still inside) */}
                    {!isFundsWithdrawn && isSuccessful && (
                        <div className="bg-green-100 p-6 rounded-lg border border-green-200 text-center">
                            <h3 className="text-xl font-bold text-green-800 mb-1">🎉 Goal Reached!</h3>
                            <p className="text-green-700 text-sm">Campaign successful.</p>
                        </div>
                    )}

                    {/* DONATE FORM */}
                    {!isSuccessful && !hasDeadlinePassed && status === 0 && (
                        <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 shadow-sm">
                            <h3 className="text-lg font-bold text-blue-900 mb-4">Quick Donate</h3>
                            {!account ? (
                                <div className="text-center">
                                    <ConnectButton client={client} wallets={wallets} theme={lightTheme()} connectButton={{ label: "Connect Wallet" }} />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-4 gap-2">
                                        {presetAmounts.map((amt) => (
                                            <button key={amt} onClick={() => setDonationAmount(amt)} disabled={isProcessing}
                                                className={`px-3 py-2 text-xs font-bold border-2 rounded transition-all ${donationAmount === amt ? 'bg-blue-600 text-white' : 'bg-white'}`}>
                                                {amt}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={donationAmount}
                                            onChange={(e) => setDonationAmount(e.target.value)}
                                            placeholder="Amount in PHP"
                                            disabled={isProcessing}
                                            className="pl-4 py-3 w-full border rounded text-lg font-bold"
                                            />  
                                    </div>
                                    
                                    <button
                                        onClick={handleDonate}
                                        disabled={isProcessing || !donationAmount || donationAmount.includes(".") || isNaN(Number(donationAmount)) || Number(donationAmount) < 1}
                                        className={`w-full py-4 text-lg font-bold rounded shadow transition-all text-white
                                            ${isProcessing || !donationAmount || donationAmount.includes(".") ? "bg-blue-300" : "bg-blue-600 hover:bg-blue-700"}`}
                                    >
                                        {isProcessing ? "Processing..." : `Donate ₱${donationAmount || '0'}`}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* FAILED / REFUND */}
                    {status === 2 && (
                        <div className="bg-red-50 p-6 rounded text-center border border-red-100">
                            <h3 className="text-red-800 font-bold mb-2">Campaign Failed</h3>
                            <button onClick={handleRefund} disabled={isProcessing} className="w-full py-3 bg-red-600 text-white font-bold rounded hover:bg-red-700">
                                {isProcessing ? "Processing..." : "Claim Refund"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}