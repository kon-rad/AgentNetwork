import { useEnsName } from "wagmi";
import { mainnet } from "viem/chains";

export function useDisplayName(address?: string): { displayName: string | null; isEns: boolean } {
  const { data: ensName } = useEnsName({
    address: address as `0x${string}` | undefined,
    chainId: mainnet.id,
  });

  if (!address) {
    return { displayName: null, isEns: false };
  }

  if (ensName) {
    return { displayName: ensName, isEns: true };
  }

  return {
    displayName: `${address.slice(0, 6)}...${address.slice(-4)}`,
    isEns: false,
  };
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
