'use client';
import { useReadContract } from "thirdweb/react";
import { client } from "@/app/client"; // Adjust path if needed
import { getContract } from "thirdweb";
import { CampaignCard } from "../components/CampaignCard"; // Adjust path if needed
import { CROWDFUNDING_FACTORY } from "@/app/constants/contracts";
import { polygonAmoy } from "thirdweb/chains";
import { useState, useEffect } from "react";

export default function CampaignsPage() {
  const contract = getContract({
    client: client,
    chain: polygonAmoy,
    address: CROWDFUNDING_FACTORY,
  });

  // Fetch campaigns including creationTime
  const { data: campaigns, isLoading: isLoadingCampaigns } = useReadContract({
    contract: contract,
    method: "function getAllCampaigns() view returns ((address campaignAddress, address owner, string name, uint256 creationTime)[])",
    params: []
  });

  const [showEmergencyFirst, setShowEmergencyFirst] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'active' | 'successful' | 'failed'>('all');

  // Load Preference
  useEffect(() => {
    const saved = localStorage.getItem('showEmergencyFirst');
    if (saved) {
      setShowEmergencyFirst(JSON.parse(saved));
    }
  }, []);

  // Save Preference
  useEffect(() => {
    localStorage.setItem('showEmergencyFirst', JSON.stringify(showEmergencyFirst));
  }, [showEmergencyFirst]);

  // --- REVISED SORTING LOGIC ---
  const sortedCampaigns = campaigns ? [...campaigns].sort((a, b) => {
    
    // 1. PRIORITY SORT: Emergency (Only if toggle is ON)
    if (showEmergencyFirst) {
        const aIsEmergency = a.name.toLowerCase().includes('emergency');
        const bIsEmergency = b.name.toLowerCase().includes('emergency');

        // If A is emergency and B is not -> A goes first
        if (aIsEmergency && !bIsEmergency) return -1;
        // If B is emergency and A is not -> B goes first
        if (!aIsEmergency && bIsEmergency) return 1;
        
        // If both are Emergency (or both are NOT), we fall through to step 2...
    }

    // 2. TIME SORT: Most Recent First (Descending)
    // We compare the timestamps (bigint) directly.
    return Number(b.creationTime) - Number(a.creationTime);

  }) : [];

  return (
    <main className="mx-auto max-w-7xl px-4 mt-4 sm:px-6 lg:px-8">
      <div className="py-10">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-4xl font-bold text-slate-800">Campaigns</h1>
          
          <div className="flex items-center space-x-4">
            {/* Filter Dropdown */}
            <div className="flex items-center bg-white border border-slate-300 rounded-md px-3 py-1">
              <label className="mr-2 text-sm font-bold text-slate-500">Filter:</label>
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value as any)}
                className="bg-transparent outline-none py-1 text-slate-700"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="successful">Successful</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Emergency Toggle */}
            <button
              onClick={() => setShowEmergencyFirst(!showEmergencyFirst)}
              className={`px-4 py-2 rounded-md font-bold transition-colors shadow-sm ${
                showEmergencyFirst
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {showEmergencyFirst ? 'EMERGENCY: ON' : 'EMERGENCY: OFF'}
            </button>
          </div>
        </div>

        {/* Grid Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {!isLoadingCampaigns && sortedCampaigns && (
            sortedCampaigns.length > 0 ? (
              sortedCampaigns.map((campaign) => (
                <CampaignWithStatus
                  key={campaign.campaignAddress}
                  campaignAddress={campaign.campaignAddress}
                  showEmergencyFirst={showEmergencyFirst}
                  selectedFilter={selectedFilter}
                  creationTime={campaign.creationTime}
                />
              ))
            ) : (
              <p className="col-span-3 text-center text-slate-400 py-10">No Campaigns Found</p>
            )
          )}
          {isLoadingCampaigns && (
             <p className="col-span-3 text-center py-10 text-slate-500">Loading blockchain data...</p>
          )}
        </div>
      </div>
    </main>
  );
}

// --- HELPER COMPONENT ---
type CampaignWithStatusProps = {
  campaignAddress: string;
  showEmergencyFirst: boolean;
  selectedFilter: 'all' | 'active' | 'successful' | 'failed';
  creationTime: bigint;
};

const CampaignWithStatus: React.FC<CampaignWithStatusProps> = ({ campaignAddress, showEmergencyFirst, selectedFilter, creationTime }) => {
  const contract = getContract({
    client: client,
    chain: polygonAmoy,
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

  return (
    <CampaignCard 
        campaignAddress={campaignAddress} 
        showEmergencyFirst={showEmergencyFirst} 
        creationTime={creationTime}
    />
  );
};