'use client';
import { useReadContract } from "thirdweb/react";
import { client } from "./client";
import { getContract } from "thirdweb";
import { CampaignCard } from "./components/CampaignCard";
import { CROWDFUNDING_FACTORY } from "./constants/contracts";
import { sepolia } from "thirdweb/chains";
import { useState, useEffect } from "react";

export default function Home() {
  const contract = getContract({
    client: client,
    chain: sepolia,
    address: CROWDFUNDING_FACTORY,
  });

  const {data: campaigns, isLoading: isLoadingCampaigns, refetch: refetchCampaigns } = useReadContract({
    contract: contract,
    method: "function getAllCampaigns() view returns ((address campaignAddress, address owner, string name)[])",
    params: []
  });

  const [showEmergencyFirst, setShowEmergencyFirst] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'active' | 'successful' | 'failed'>('all');

  useEffect(() => {
    const saved = localStorage.getItem('showEmergencyFirst');
    if (saved) {
      setShowEmergencyFirst(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('showEmergencyFirst', JSON.stringify(showEmergencyFirst));
  }, [showEmergencyFirst]);

  const isEmergencyCampaign = (name: string, description: string) => {
    const combinedText = (name + ' ' + description).toLowerCase();
    return combinedText.includes('emergency');
  };

  const sortedCampaigns = campaigns ? [...campaigns].sort((a, b) => {
    if (!showEmergencyFirst) return 0;


    const aIsEmergency = a.name.toLowerCase().includes('emergency');
    const bIsEmergency = b.name.toLowerCase().includes('emergency');

    if (aIsEmergency && !bIsEmergency) return -1;
    if (!aIsEmergency && bIsEmergency) return 1;
    return 0;
  }) : [];

  return (
    <main className="mx-auto max-w-7xl px-4 mt-4 sm:px-6 lg:px-8">
      <div className="py-10">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-4xl font-bold">Campaigns:</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <label className="mr-2 text-sm font-medium">Filter by Status:</label>
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value as 'all' | 'active' | 'successful' | 'failed')}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="successful">Successful</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <button
              onClick={() => setShowEmergencyFirst(!showEmergencyFirst)}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                showEmergencyFirst
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {showEmergencyFirst ? 'Emergency First: ON' : 'Emergency First: OFF'}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {!isLoadingCampaigns && sortedCampaigns && (
            sortedCampaigns.length > 0 ? (
              sortedCampaigns.map((campaign) => (
                <CampaignWithStatus
                  key={campaign.campaignAddress}
                  campaignAddress={campaign.campaignAddress}
                  showEmergencyFirst={showEmergencyFirst}
                  selectedFilter={selectedFilter}
                />
              ))
            ) : (
              <p>No Campaigns</p>
            )
          )}
        </div>
      </div>
    </main>
  );
}

type CampaignWithStatusProps = {
  campaignAddress: string;
  showEmergencyFirst: boolean;
  selectedFilter: 'all' | 'active' | 'successful' | 'failed';
};

const CampaignWithStatus: React.FC<CampaignWithStatusProps> = ({ campaignAddress, showEmergencyFirst, selectedFilter }) => {
  const contract = getContract({
    client: client,
    chain: sepolia,
    address: campaignAddress,
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

  return <CampaignCard campaignAddress={campaignAddress} showEmergencyFirst={showEmergencyFirst} />;
};
