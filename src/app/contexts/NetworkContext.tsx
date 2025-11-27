'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { polygonAmoy, sepolia } from 'thirdweb/chains';

type NetworkContextType = {
selectedChain: typeof polygonAmoy;
setSelectedChain: (chain: typeof polygonAmoy) => void;
};

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider = ({ children }: { children: ReactNode }) => {
const [selectedChain, setSelectedChain] = useState(polygonAmoy);  // Default to Polygon Amoy

return (
<NetworkContext.Provider value={{ selectedChain, setSelectedChain }}>
{children}
</NetworkContext.Provider>
);
};

export const useNetwork = () => {
const context = useContext(NetworkContext);
if (!context) {
throw new Error('useNetwork must be used within a NetworkProvider');
}
return context;
};