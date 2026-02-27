import type { WalletBalance } from '@solagent/vault-core';

/**
 * Fetches market context for an agent to make decisions
 */
export async function fetchMarketContext(
  walletAddress: string,
  balance: WalletBalance
): Promise<Record<string, unknown>> {
  const [solPrice, jupiterQuote] = await Promise.all([
    fetchSolPrice(),
    fetchJupiterQuote('So11111111111111111111111111111111111111112', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1', Math.min(balance.sol * 1e9, 0.1 * 1e9)),
  ]);

  return {
    timestamp: new Date().toISOString(),
    wallet: {
      address: walletAddress,
      solBalance: balance.sol,
      tokens: balance.tokens,
    },
    market: {
      solPriceUsd: solPrice.usd,
      solChange1h: solPrice.usd_1h_change,
      solChange24h: solPrice.usd_24h_change,
      bestSwapRoute: jupiterQuote,
    },
  };
}

/**
 * Fetch SOL price from CoinGecko
 */
async function fetchSolPrice(): Promise<{
  usd: number;
  usd_1h_change: number;
  usd_24h_change: number;
}> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_1hr_change=true&include_24hr_change=true'
    );
    const data = await response.json();
    return {
      usd: data.solana.usd,
      usd_1h_change: data.solana.usd_1h_change || 0,
      usd_24h_change: data.solana.usd_24h_change || 0,
    };
  } catch (error) {
    console.warn('[MarketContext] Failed to fetch SOL price:', error);
    // Return mock data for devnet testing
    return {
      usd: 100,
      usd_1h_change: 0,
      usd_24h_change: 0,
    };
  }
}

/**
 * Fetch Jupiter quote for SOL -> USDC swap
 */
async function fetchJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: number
): Promise<unknown | null> {
  try {
    const response = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippage=0.5`
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.warn('[MarketContext] Failed to fetch Jupiter quote:', error);
    return null;
  }
}
