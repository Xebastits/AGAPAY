import { polygonAmoy, sepolia } from "thirdweb/chains";

export const getCrowdfundingFactory = (chain: typeof polygonAmoy) => {
  if (chain.id === sepolia.id) {
    return "0x0f3429A6eC46AD1C440F23Be9AB477904EDa7e30";  // Sepolia
  } else if (chain.id === polygonAmoy.id) {
    return "0x9f41C64d4a8C0111bF023072606548dDD9f8871c";  // Polygon Amoy (default)
  }
  throw new Error("Unsupported chain for Crowdfunding Factory");
};
// Optional: Keep old exports for backward compatibility if needed
export const CROWDFUNDING_FACTORY = "0x9f41C64d4a8C0111bF023072606548dDD9f8871c";  // Polygon
export const CROWDFUNDING_FACTORY_SEPOLIA = "0x0f3429A6eC46AD1C440F23Be9AB477904EDa7e30";  // Sepolia
