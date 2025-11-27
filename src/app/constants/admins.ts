export const ADMIN_ADDRESSES = [
  "0xb9Cc84c1291aD9441357df5a111145Bf9459107d",
];

export const isAdmin = (address: string | undefined): boolean => {
  if (!address) return false;
  
  return ADMIN_ADDRESSES.some(
    (admin) => admin.toLowerCase() === address.toLowerCase()
  );
};