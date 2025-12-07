'use client';
import { useReadContract } from "thirdweb/react";
import { client } from "@/app/client"; 
import { getContract } from "thirdweb";
import { CROWDFUNDING_FACTORY } from "@/app/constants/contracts";
import { useState, useEffect } from "react";
import { useNetwork } from '../contexts/NetworkContext';
import dynamic from 'next/dynamic'; // 1. IMPORT DYNAMIC

// 2. LAZY LOAD THE CARD COMPONENT (Huge RAM Saver)
const CampaignWithStatus = dynamic(() => Promise.resolve(CampaignWithStatusInternal), {
    loading: () => <div className="h-96 bg-slate-100 rounded-lg animate-pulse" />, 
    ssr: false // Render only on client
});

// Import the actual component for the dynamic loader to use
import { MyCampaignCard } from "../components/MyCampaignCard"; 

export default function CampaignsPage() {
  const { selectedChain } = useNetwork();
  const contract = getContract({
    client: client,
    chain: selectedChain,
    address: CROWDFUNDING_FACTORY,
  });

  const { data: campaigns, isLoading: isLoadingCampaigns } = useReadContract({
    contract: contract,
    method: "function getAllCampaigns() view returns ((address campaignAddress, address owner, string name, uint256 creationTime)[])",
    params: []
  });

  const [showEmergencyFirst, setShowEmergencyFirst] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'active' | 'successful' | 'failed'>('active');
  
  // 3. PAGINATION STATE
  const [visibleCount, setVisibleCount] = useState(9); 

  useEffect(() => {
    const saved = localStorage.getItem('showEmergencyFirst');
    if (saved) setShowEmergencyFirst(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('showEmergencyFirst', JSON.stringify(showEmergencyFirst));
  }, [showEmergencyFirst]);

  // Sort logic
  const sortedCampaigns = campaigns ? [...campaigns].sort((a, b) => {
    if (showEmergencyFirst) {
        const aIsEmergency = a.name.toLowerCase().includes('emergency');
        const bIsEmergency = b.name.toLowerCase().includes('emergency');
        if (aIsEmergency && !bIsEmergency) return -1;
        if (!aIsEmergency && bIsEmergency) return 1;
    }
    return Number(b.creationTime) - Number(a.creationTime);
  }) : [];

  // 4. PAGINATION SLICING
  const visibleCampaigns = sortedCampaigns.slice(0, visibleCount);

  return (
    <main className="mx-auto max-w-7xl px-4 mt-4 sm:px-6 lg:px-8">
      <div className="py-10">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-4xl font-bold text-slate-800">Campaigns</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center bg-white border border-slate-300 rounded-md px-3 py-1">
              <label className="mr-2 text-sm font-bold text-slate-500">Filter:</label>
              <select value={selectedFilter} onChange={(e) => setSelectedFilter(e.target.value as any)} className="bg-transparent outline-none py-1 text-slate-700">
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="successful">Successful</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <button onClick={() => setShowEmergencyFirst(!showEmergencyFirst)} className={`px-4 py-2 rounded-md font-bold transition-colors shadow-sm ${showEmergencyFirst ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {showEmergencyFirst ? 'EMERGENCY: ON' : 'EMERGENCY: OFF'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {!isLoadingCampaigns && visibleCampaigns && (
            visibleCampaigns.map((campaign) => (
              <CampaignWithStatus
                key={campaign.campaignAddress}
                campaignAddress={campaign.campaignAddress}
                showEmergencyFirst={showEmergencyFirst}
                selectedFilter={selectedFilter}
                creationTime={campaign.creationTime}
              />
            ))
          )}
          {isLoadingCampaigns && <p className="col-span-3 text-center py-10 text-slate-500">Loading...</p>}
        </div>

        {/* 5. LOAD MORE BUTTON */}
        {!isLoadingCampaigns && sortedCampaigns && visibleCount < sortedCampaigns.length && (
            <div className="flex justify-center mt-10">
                <button 
                    onClick={() => setVisibleCount(prev => prev + 9)}
                    className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Load More Campaigns
                </button>
            </div>
        )}
      </div>
    </main>
  );
}

// --- INTERNAL HELPER FOR FILTERING ---
// Moved logic here. It fetches data to check if it matches filter.
const CampaignWithStatusInternal = ({ campaignAddress, showEmergencyFirst, selectedFilter, creationTime }: any) => {
  const { selectedChain } = useNetwork();
  const contract = getContract({ client, chain: selectedChain, address: campaignAddress });

  const { data: state } = useReadContract({ contract, method: "function state() view returns (uint8)", params: [] });
  const { data: deadline } = useReadContract({ contract, method: "function deadline() view returns (uint256)", params: [] });
  const { data: balance } = useReadContract({ contract, method: "function getContractBalance() view returns (uint256)", params: [] });
  const { data: goal } = useReadContract({ contract, method: "function goal() view returns (uint256)", params: [] });

  let derivedStatus = 'unknown';

  if (state !== undefined && deadline && balance !== undefined && goal !== undefined) {
      const now = Date.now() / 1000;
      const isExpired = now >= Number(deadline);
      const isGoalMet = balance >= goal;

      if (state === 2 || (state === 0 && isExpired && !isGoalMet)) derivedStatus = 'failed';
      else if (state === 1 || (state === 0 && isGoalMet)) derivedStatus = 'successful';
      else if (state === 0 && !isExpired && !isGoalMet) derivedStatus = 'active';
  }

  // Hide if doesn't match filter
  if (selectedFilter !== 'all' && derivedStatus !== selectedFilter) return null;
  if (derivedStatus === 'unknown') return null; // Wait for data

  return <MyCampaignCard campaignAddress={campaignAddress} showEmergencyFirst={showEmergencyFirst} creationTime={creationTime} />;
};