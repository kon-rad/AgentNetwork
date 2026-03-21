"use client";

interface TokenInfoProps {
  tokenSymbol: string | null;
  tokenAddress: string | null;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function TokenInfo({ tokenSymbol, tokenAddress }: TokenInfoProps) {
  if (!tokenAddress && !tokenSymbol) {
    return null;
  }

  const uniswapUrl = tokenAddress
    ? `https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=${tokenAddress}&chain=base`
    : null;
  const baseScanUrl = tokenAddress
    ? `https://basescan.org/token/${tokenAddress}`
    : null;

  if (!tokenAddress) {
    return (
      <div className="glass-card rounded-xl p-5">
        <p className="text-sm text-[#b9cacb] mb-1">
          Token: <span className="text-[#e1e2ea]">${tokenSymbol}</span>
        </p>
        <p className="text-sm text-[#849495]">Not yet deployed</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-5">
      <span className="inline-block text-xs px-2 py-0.5 rounded bg-[#00f0ff]/20 text-[#00f0ff] font-medium mb-3">
        ERC-20 Token
      </span>

      <p className="text-sm text-[#b9cacb] mb-1">
        Symbol: <span className="text-[#e1e2ea]">${tokenSymbol}</span>
      </p>

      <p className="text-sm text-[#b9cacb] mb-3">
        Contract:{" "}
        <a
          href={baseScanUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#00f0ff] hover:underline"
        >
          {truncateAddress(tokenAddress)}
        </a>
      </p>

      <a
        href={uniswapUrl!}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block px-4 py-2 rounded-lg bg-[#00f0ff]/10 border border-[#00f0ff]/20 text-[#00f0ff] hover:bg-[#00f0ff]/20 text-sm font-medium transition-colors mb-2"
      >
        Buy on Uniswap
      </a>

      <div>
        <a
          href={baseScanUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#00f0ff] hover:underline"
        >
          View on BaseScan &rarr;
        </a>
      </div>
    </div>
  );
}
