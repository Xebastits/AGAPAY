'use client';
import { useReadContract } from "thirdweb/react";
import { client } from "@/app/client";
import { getContract } from "thirdweb";
import { CampaignCard } from "@/app/components/CampaignCard";
import { CROWDFUNDING_FACTORY } from "@/app/constants/contracts";
import { polygonAmoy } from "thirdweb/chains";
import { useState, useEffect, useMemo } from "react";

type CampaignData = {
  campaignAddress: string;
  owner: string;
  name: string;
  creationTime: bigint;
  
};

export default function CampaignsPage() {
  const contract = getContract({
    client: client,
    chain: polygonAmoy,
    address: CROWDFUNDING_FACTORY,
  });

  const { data: campaigns, isLoading } = useReadContract({
    contract: contract,
    method: "function getAllCampaigns() view returns ((address campaignAddress, address owner, string name, uint256 creationTime)[])", 
    params: []
  });

  // Filter States
  const [showEmergencyFirst, setShowEmergencyFirst] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'active' | 'successful' | 'failed'>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  
  // Pagination State
  const [visibleCount, setVisibleCount] = useState(6); // Default show 6

  // Reset pagination when ANY filter changes
  useEffect(() => {
    setVisibleCount(6);
  }, [showEmergencyFirst, selectedFilter, selectedYear]);

  // Load preferences
  useEffect(() => {
    const saved = localStorage.getItem('showEmergencyFirst');
    if (saved) setShowEmergencyFirst(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('showEmergencyFirst', JSON.stringify(showEmergencyFirst));
  }, [showEmergencyFirst]);

  // --- MAIN FILTERING LOGIC ---
  const processedCampaigns = useMemo(() => {
    if (!campaigns) return [];

    let result = [...campaigns] as unknown as CampaignData[];

    // 1. Filter by Year
    if (selectedYear !== 'all') {
      result = result.filter(c => {
        const year = new Date(Number(c.creationTime) * 1000).getUTCFullYear().toString();
        return year === selectedYear;
      });
    }

    // 2. Sort by Time (Newest First)
    result.sort((a, b) => Number(b.creationTime) - Number(a.creationTime));

    // 3. Emergency Sort (Priority)
    if (showEmergencyFirst) {
      result.sort((a, b) => {
        const aIsEmergency = a.name.toLowerCase().includes('emergency');
        const bIsEmergency = b.name.toLowerCase().includes('emergency');
        if (aIsEmergency && !bIsEmergency) return -1; // a goes first
        if (!aIsEmergency && bIsEmergency) return 1;  // b goes first
        return 0;
      });
    }

    return result;
  }, [campaigns, selectedYear, showEmergencyFirst]);

  // Pagination Slice
  const visibleCampaigns = processedCampaigns.slice(0, visibleCount);

  // Helper for Years dropdown
  const availableYears = useMemo(() => {
    if (!campaigns) return [];
    const years = new Set(campaigns.map(c => new Date(Number(c.creationTime) * 1000).getUTCFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [campaigns]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 min-h-screen">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-4xl font-bold text-slate-800">Explore Campaigns</h1>
          
          <div className="flex flex-wrap items-center gap-4">
             {/* Year Filter */}
             <div className="flex items-center bg-white border border-slate-300 rounded-md px-3 py-1">
              <label className="mr-2 text-sm font-bold text-slate-500">Year:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-transparent outline-none py-1 text-slate-700"
              >
                <option value="all">All Time</option>
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center bg-white border border-slate-300 rounded-md px-3 py-1">
              <label className="mr-2 text-sm font-bold text-slate-500">Status:</label>
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
              className={`px-3 py-2 rounded-md font-medium transition-colors ${
                showEmergencyFirst
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {showEmergencyFirst ? 'Emergency First: ON' : 'Emergency First: OFF'}
            </button>
          </div>
        </div>

        {/* CAMPAIGN GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {!isLoading && visibleCampaigns.length > 0 ? (
            visibleCampaigns.map((campaign) => (
              <CampaignWithStatus
                key={campaign.campaignAddress}
                campaignAddress={campaign.campaignAddress}
                selectedFilter={selectedFilter} // Only pass filter logic down
                creationTime={campaign.creationTime}
              />
            ))
          ) : (
            !isLoading && <p className="col-span-3 text-center text-slate-400 py-20 border-2 border-dashed rounded-xl">No campaigns found matching your criteria.</p>
          )}
          
          {isLoading && <p className="col-span-3 text-center py-20">Loading blockchain data...</p>}
        </div>

        {/* LOAD MORE BUTTON */}
        {visibleCount < processedCampaigns.length && (
          <div className="mt-12 text-center">
            <button
              onClick={() => setVisibleCount(prev => prev + 6)}
              className="px-8 py-3 bg-blue-600 text-white font-bold rounded-full hover:bg-blue-700 transition shadow-lg transform hover:-translate-y-1"
            >
              Load More Campaigns
            </button>
            <p className="text-xs text-slate-400 mt-3 font-medium">
              Showing {Math.min(visibleCount, processedCampaigns.length)} of {processedCampaigns.length} results
            </p>
          </div>
        )}
    </main>
  );
}

// Helper Component to Fetch Individual Contract Status
const CampaignWithStatus = ({ campaignAddress, selectedFilter, creationTime }: any) => {
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

  if (selectedFilter !== 'all' && statusString !== selectedFilter) return null;

  return <CampaignCard campaignAddress={campaignAddress} creationTime={creationTime} />;
};