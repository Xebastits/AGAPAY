'use client';

import { useReadContract } from "thirdweb/react";
import { client } from "@/app/client"; 
import { getContract } from "thirdweb";
import { CROWDFUNDING_FACTORY } from "@/app/constants/contracts";
import { useState, useEffect, useMemo } from "react";
import { useNetwork } from '../contexts/NetworkContext';
import dynamic from 'next/dynamic';

// 1. LAZY LOAD CARD (RAM Saver)
const MyCampaignCard = dynamic(() => import('../components/MyCampaignCard').then(mod => mod.MyCampaignCard), {
  loading: () => <div className="h-96 bg-slate-100 rounded-lg animate-pulse" />,
  ssr: false, 
});

// 2. CONFIG
const ITEMS_PER_PAGE = 9; 

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
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const saved = localStorage.getItem('showEmergencyFirst');
    if (saved) setShowEmergencyFirst(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('showEmergencyFirst', JSON.stringify(showEmergencyFirst));
  }, [showEmergencyFirst]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFilter, showEmergencyFirst]);

  // 4. MEMOIZED SORTING
  const sortedCampaigns = useMemo(() => {
      if (!campaigns) return [];
      
      return [...campaigns].sort((a, b) => {
        if (showEmergencyFirst) {
            const aIsEmergency = a.name.toLowerCase().includes('emergency');
            const bIsEmergency = b.name.toLowerCase().includes('emergency');
            if (aIsEmergency && !bIsEmergency) return -1;
            if (!aIsEmergency && bIsEmergency) return 1;
        }
        return Number(b.creationTime) - Number(a.creationTime);
      });
  }, [campaigns, showEmergencyFirst]);

  // 5. PAGINATION SLICING
  const visibleCampaigns = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedCampaigns.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedCampaigns, currentPage]);

  const totalPages = Math.ceil(sortedCampaigns.length / ITEMS_PER_PAGE);

  return (
    <main className="mx-auto max-w-7xl px-4 mt-4 sm:px-6 lg:px-8 pb-20">
      <div className="py-10">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-4xl font-bold text-slate-800">Campaigns</h1>
          
          <div className="flex items-center space-x-4">
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
          {!isLoadingCampaigns && visibleCampaigns.length > 0 ? (
            visibleCampaigns.map((campaign) => (
              <CampaignWithStatus
                key={campaign.campaignAddress}
                campaignAddress={campaign.campaignAddress}
                showEmergencyFirst={showEmergencyFirst}
                selectedFilter={selectedFilter}
                creationTime={campaign.creationTime}
              />
            ))
          ) : (
            !isLoadingCampaigns && <p className="col-span-3 text-center text-slate-400 py-10">No Campaigns Found</p>
          )}
          {isLoadingCampaigns && (
             <p className="col-span-3 text-center py-10 text-slate-500">Loading blockchain data...</p>
          )}
        </div>

        {/* 6. PAGINATION CONTROLS */}
        {!isLoadingCampaigns && totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-12">
                <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 text-sm bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                    Previous
                </button>
                
                <span className="text-sm font-bold text-slate-600">
                    Page {currentPage} of {totalPages}
                </span>
                
                <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 text-sm bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                    Next
                </button>
            </div>
        )}
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
  const { selectedChain } = useNetwork();
  
  const contract = getContract({
    client: client,
    chain: selectedChain,
    address: campaignAddress,
  });

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

  if (selectedFilter !== 'all' && derivedStatus !== selectedFilter) return null;
  if (derivedStatus === 'unknown') return null;

  return (
    <MyCampaignCard 
        campaignAddress={campaignAddress} 
        showEmergencyFirst={showEmergencyFirst} 
        creationTime={creationTime}
    />
  );
};