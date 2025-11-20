'use client';
import { client } from "@/app/client";
import { CROWDFUNDING_FACTORY } from "@/app/constants/contracts";
import { MyCampaignCard } from "../../components/MyCampaignCard";
import { useState } from "react";
import { getContract } from "thirdweb";
import { defineChain } from "thirdweb/chains";
import { useActiveAccount, useReadContract } from "thirdweb/react";
import { prepareContractCall } from "thirdweb";
import { useSendTransaction } from "thirdweb/react";

export default function DashboardPage() {
    const account = useActiveAccount();
    // debugging
    // console.log("address", account?.address);
    
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

    const contract = getContract({
        client: client,
        chain: defineChain(11155111),
        address: CROWDFUNDING_FACTORY,
    });

    // Get Campaigns
    const { data: myCampaigns, isLoading: isLoadingMyCampaigns, refetch } = useReadContract({
        contract: contract,
        method: "function getUserCampaigns(address _user) view returns ((address campaignAddress, address owner, string name)[])",
        params: [account?.address as string]
    });


    
    return (
        <div className="mx-auto max-w-7xl px-4 mt-16 sm:px-6 lg:px-8">
            <div className="flex flex-row justify-between items-center mb-8">
                <p className="text-4xl font-semibold">Dashboard</p>
                <button
                    className="px-4 py-2 bg-blue-500 text-white rounded-md"
                    onClick={() => setIsModalOpen(true)}
                >Create Campaign</button>
            </div>
            <p className="text-2xl font-semibold mb-4">My Campaigns:</p>
            <div className="grid grid-cols-3 gap-4">
                {!isLoadingMyCampaigns && (
                    myCampaigns && myCampaigns.length > 0 ? (
                        myCampaigns.map((campaign, index) => (
                            <MyCampaignCard
                                key={index}
                                contractAddress={campaign.campaignAddress}
                            />
                        ))
                    ) : (
                        <p>No campaigns</p>
                    )
                )}
            </div>
            
            {isModalOpen && (
                <CreateCampaignModal
                    setIsModalOpen={setIsModalOpen}
                    refetch={refetch}
                />
            )}
        </div>
    );
}

type CreateCampaignModalProps = {
    setIsModalOpen: (value: boolean) => void;
    refetch: () => void;
}

const CreateCampaignModal = (
    { setIsModalOpen, refetch }: CreateCampaignModalProps
) => {
    const account = useActiveAccount();
    const { mutate: sendTransaction, isPending } = useSendTransaction();
    const [isEmergencyMode, setIsEmergencyMode] = useState<boolean>(false);
    const [editableName, setEditableName] = useState<string>("");
    const [editableDescription, setEditableDescription] = useState<string>("");
    const [campaignGoal, setCampaignGoal] = useState<number>(1);
    const [campaignDeadline, setCampaignDeadline] = useState<number>(1);

    const campaignName = isEmergencyMode ? "[EMERGENCY] " + editableName : editableName;
    const campaignDescription = isEmergencyMode ? "[EMERGENCY] " + editableDescription : editableDescription;

    const contract = getContract({
        client: client,
        chain: defineChain(11155111),
        address: CROWDFUNDING_FACTORY,
    });

    const handleDeployContract = () => {
        if (!account) {
            alert("Please connect your wallet first!");
            return;
        }

        const transaction = prepareContractCall({
            contract,  
            method: "function createCampaign(string _name, string _description, uint256 _goal, uint256 _durationInDays)",
            params: [
                campaignName,
                campaignDescription,
                BigInt(campaignGoal),      
                BigInt(campaignDeadline),  
            ],
        });

        sendTransaction(transaction, {
            onSuccess: () => {
                alert("Campaign created successfully!");
                setIsModalOpen(false);
                refetch();
            },
            onError: (error) => {
                console.error("Failed to create campaign:", error);
                alert("Failed to create campaign. Check console for details.");
            },
        });
    };

    const handleCampaignGoal = (value: number) => {
        if (value < 1) {
            setCampaignGoal(1);
        } else {
            setCampaignGoal(value);
        }
    };

    const handleCampaignLengthhange = (value: number) => {
        if (value < 1) {
            setCampaignDeadline(1);
        } else {
            setCampaignDeadline(value);
        }
    };

    const handleNameChange = (value: string) => {
        if (isEmergencyMode) {
            if (value.startsWith("[EMERGENCY] ")) {
                setEditableName(value.slice("[EMERGENCY] ".length));
            } else {
                // Prevent removing the prefix
                return;
            }
        } else {
            setEditableName(value);
        }
    };

    const handleDescriptionChange = (value: string) => {
        if (isEmergencyMode) {
            if (value.startsWith("[EMERGENCY] ")) {
                setEditableDescription(value.slice("[EMERGENCY] ".length));
            } else {
                // Prevent removing the prefix
                return;
            }
        } else {
            setEditableDescription(value);
        }
    };

    const handleEmergencyToggle = (checked: boolean) => {
        setIsEmergencyMode(checked);
        if (checked) {
            // If turning on, remove prefix from editable if present
            if (editableName.startsWith("[EMERGENCY] ")) {
                setEditableName(editableName.slice("[EMERGENCY] ".length));
            }
            if (editableDescription.startsWith("[EMERGENCY] ")) {
                setEditableDescription(editableDescription.slice("[EMERGENCY] ".length));
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center backdrop-blur-md">
            <div className="w-1/2 bg-slate-100 p-6 rounded-md">
                <div className="flex justify-between items-center mb-4">
                    <p className="text-lg font-semibold">Create a Campaign</p>
                    <button
                        className="text-sm px-4 py-2 bg-slate-600 text-white rounded-md"
                        onClick={() => setIsModalOpen(false)}
                    >Close</button>
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center mb-4">
                        <input
                            type="checkbox"
                            id="emergencyMode"
                            checked={isEmergencyMode}
                            onChange={(e) => handleEmergencyToggle(e.target.checked)}
                            className="mr-2"
                        />
                        <label htmlFor="emergencyMode" className="text-sm font-medium">Emergency Mode</label>
                    </div>
                    <label>Campaign Name:</label>
                    <input
                        type="text"
                        value={campaignName}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="Campaign Name"
                        className="mb-4 px-4 py-2 bg-slate-300 rounded-md"
                    />
                    <label>Campaign Description:</label>
                    <textarea
                        value={campaignDescription}
                        onChange={(e) => handleDescriptionChange(e.target.value)}
                        placeholder="Campaign Description"
                        className="mb-4 px-4 py-2 bg-slate-300 rounded-md"
                    ></textarea>
                    <label>Campaign Goal:</label>
                    <input 
                        type="number"
                        value={campaignGoal}
                        onChange={(e) => handleCampaignGoal(parseInt(e.target.value))}
                        className="mb-4 px-4 py-2 bg-slate-300 rounded-md"
                    />
                    <label>{`Campaign Length (Days)`}</label>
                    <div className="flex space-x-4">
                        <input 
                            type="number"
                            value={campaignDeadline}
                            onChange={(e) => handleCampaignLengthhange(parseInt(e.target.value))}
                            className="mb-4 px-4 py-2 bg-slate-300 rounded-md"
                        />
                    </div>

                    <button
                        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md"
                        onClick={handleDeployContract}
                        disabled={isPending} 
                    >{
                        isPending ? "Creating Campaign..." : "Create Campaign"
                    }</button>
                    
                </div>
            </div>
        </div>
    );
};
