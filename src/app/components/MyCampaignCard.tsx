import { client } from "@/app/client";
import Link from "next/link";
import { getContract } from "thirdweb";
import { polygonAmoy } from "thirdweb/chains";
import { useReadContract, useActiveAccount, TransactionButton, lightTheme } from "thirdweb/react";
import { prepareContractCall } from "thirdweb";

type MyCampaignCardProps = {
    contractAddress: string;
};

export const MyCampaignCard: React.FC<MyCampaignCardProps> = ({ contractAddress }) => {
    const account = useActiveAccount();
    const contract = getContract({
        client: client,
        chain: polygonAmoy,
        address: contractAddress,
    });

    const { data: name } = useReadContract({
        contract,
        method: "function name() view returns (string)",
        params: []
    });

    const { data: description } = useReadContract({
        contract,
        method: "function description() view returns (string)",
        params: []
      });

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

    const { data: owner } = useReadContract({
        contract: contract,
        method: "function owner() view returns (address)",
        params: [],
    });

    const { data: state } = useReadContract({
        contract: contract,
        method: "function state() view returns (uint8)",
        params: [],
    });

    const canWithdraw = owner === account?.address && state === 1;

    const totalBalance = balance?.toString();
    const totalGoal = goal?.toString();
    let balancePercentage = (parseInt(totalBalance as string) / parseInt(totalGoal as string)) * 100;

    if (balancePercentage >= 100) {
        balancePercentage = 100;
    }

    return (
            <div className="flex flex-col justify-between max-w-sm p-6 bg-white border border-slate-200 rounded-lg shadow">
                <div>
                    <h5 className="mb-2 text-2xl font-bold tracking-tight">{name}</h5>
                    <p className="mb-3 font-normal text-gray-700 dark:text-gray-400">{description}</p>
                </div>
                
                <div className="flex flex-col space-y-2">
                    <Link
                        href={`/campaign/${contractAddress}`}
                        passHref={true}
                    >
                        <p className="inline-flex items-center px-3 py-2 text-sm font-medium text-center text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
                            View Campaign
                            <svg className="rtl:rotate-180 w-3.5 h-3.5 ms-2" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 10">
                                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 5h12m0 0L9 1m4 4L9 9"/>
                            </svg>
                        </p>
                    </Link>
                    {canWithdraw && (
                        <TransactionButton
                            transaction={() => prepareContractCall({
                                contract: contract,
                                method: "function withdraw()",
                                params: []
                            })}
                            onTransactionConfirmed={() => {
                                alert("Withdrawal successful!");
                                // Optionally refetch balance or state here
                            }}
                            onError={(error) => alert(`Error: ${error.message}`)}
                            theme={lightTheme()}
                        >
                            Withdraw Funds
                        </TransactionButton>
                    )}
                </div>
            </div>
    )
};