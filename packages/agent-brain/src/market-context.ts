import type { WalletBalance } from '@solagent/vault-core';

// ─── Price cache to avoid hammering CoinGecko ───────────────────────────────
let priceCache: {
  usd: number;
  usd_1h_change: number;
  usd_24h_change: number;
  fetchedAt: number;
} | null = null;

const PRICE_CACHE_TTL_MS = 60_000; // 1 minute cache

/**
 * Fetches market context for an agent to make decisions.
 * Includes real SOL price with fallback chain, Jupiter swap quotes,
 * and momentum indicators derived from price movement.
 */
export async function fetchMarketContext(
  walletAddress: string,
  balance: WalletBalance
): Promise<Record<string, unknown>> {
  // Use a meaningful quote amount — at least 0.01 SOL even if balance reads 0
  // This lets us still get a valid swap route quote
  const quoteAmountLamports = balance.sol > 0
    ? Math.floor(Math.min(balance.sol * 0.1, 0.5) * 1e9) // 10% of balance, max 0.5 SOL
    : 10_000_000; // 0.01 SOL fallback

  const [solPrice, jupiterQuote] = await Promise.all([
    fetchSolPrice(),
    fetchJupiterQuote(
      'So11111111111111111111111111111111111111112',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1',
      quoteAmountLamports
    ),
  ]);

  // Derive signal: use 1h change directly; when 1h is flat (<0.1%), use 24h/8 as 3-hour proxy
  const effective1h = Math.abs(solPrice.usd_1h_change) < 0.1
    ? solPrice.usd_24h_change / 8
    : solPrice.usd_1h_change;
  const priceSignal =
    effective1h > 1.0 ? 'STRONG_BULLISH' :
      effective1h > 0.2 ? 'BULLISH' :
        effective1h < -1.0 ? 'STRONG_BEARISH' :
          effective1h < -0.2 ? 'BEARISH' : 'NEUTRAL';
  console.log(`[MarketContext] 1h: ${solPrice.usd_1h_change}%, 24h: ${solPrice.usd_24h_change}%, effective: ${effective1h.toFixed(3)}% → ${priceSignal}`);

  // Portfolio value in USD
  const portfolioValueUsd = balance.sol * solPrice.usd;

  return {
    timestamp: new Date().toISOString(),
    wallet: {
      address: walletAddress,
      solBalance: balance.sol,
      portfolioValueUsd: portfolioValueUsd.toFixed(2),
      tokens: balance.tokens,
      hasTokens: Object.keys(balance.tokens).length > 0,
    },
    market: {
      solPriceUsd: solPrice.usd,
      solChange1h: solPrice.usd_1h_change,
      solChange24h: solPrice.usd_24h_change,
      priceSignal,                    // derived momentum signal for LLM
      bestSwapRoute: jupiterQuote,
      quoteAmountSol: quoteAmountLamports / 1e9,
    },
    tradingHints: {
      canTrade: balance.sol > 0.01,   // need at least 0.01 SOL to trade
      suggestedActionSol: Math.min(balance.sol * 0.1, 0.5), // 10% of bal, max 0.5
      momentumFavorable: solPrice.usd_1h_change > 0.5 || solPrice.usd_24h_change > 2,
    },
  };
}

/**
 * Fetch SOL price from CoinGecko with retry + cache.
 * Falls back to a plausible devnet mock if all attempts fail.
 */
async function fetchSolPrice(): Promise<{
  usd: number;
  usd_1h_change: number;
  usd_24h_change: number;
}> {
  // Return cached value if fresh
  if (priceCache && Date.now() - priceCache.fetchedAt < PRICE_CACHE_TTL_MS) {
    return { usd: priceCache.usd, usd_1h_change: priceCache.usd_1h_change, usd_24h_change: priceCache.usd_24h_change };
  }

  // Try CoinGecko with 2 retries
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_1hr_change=true&include_24hr_change=true',
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json() as any;
      if (!data?.solana?.usd) throw new Error('Bad response shape');

      const result = {
        usd: data.solana.usd,
        // CoinGecko uses 1hr (not 1h) in response fields
        usd_1h_change: data.solana.usd_1hr_change ?? data.solana.usd_1h_change ?? 0,
        usd_24h_change: data.solana.usd_24hr_change ?? data.solana.usd_24h_change ?? 0,
        fetchedAt: Date.now(),
      };
      priceCache = result;
      console.log(`[MarketContext] SOL price: $${result.usd} (1h: ${result.usd_1h_change?.toFixed(2)}%, 24h: ${result.usd_24h_change?.toFixed(2)}%)`);
      return result;
    } catch (error: any) {
      console.warn(`[MarketContext] CoinGecko attempt ${attempt} failed: ${error.message}`);
      if (attempt < 2) await sleep(1500);
    }
  }

  // Try alternative: Binance public API (no rate limits)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=SOLUSDT', { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json() as any;
    if (data?.lastPrice) {
      const usd = parseFloat(data.lastPrice);
      const change24h = parseFloat(data.priceChangePercent);
      const result = {
        usd,
        usd_1h_change: change24h / 24, // rough 1h estimate
        usd_24h_change: change24h,
        fetchedAt: Date.now(),
      };
      priceCache = result;
      console.log(`[MarketContext] SOL price from Binance: $${usd} (24h: ${change24h}%)`);
      return result;
    }
  } catch (e: any) {
    console.warn('[MarketContext] Binance fallback also failed:', e.message);
  }

  // Last resort: return stale cache or a plausible devnet placeholder
  if (priceCache) {
    console.warn('[MarketContext] Using stale price cache');
    return priceCache;
  }

  console.warn('[MarketContext] All price sources failed — using plausible devnet fallback');
  return { usd: 140, usd_1h_change: -0.5, usd_24h_change: -2.1 };  // realistic stand-in, not flat zeros
}

/**
 * Fetch Jupiter quote for SOL -> USDC swap.
 * Returns mock data if Jupiter is unreachable (devnet limitation).
 */
async function fetchJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: number
): Promise<unknown | null> {
  if (amount <= 0) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`Jupiter HTTP ${response.status}`);

    const data = await response.json() as any;
    if (data?.outAmount) {
      const inSol = amount / 1e9;
      const outUsdc = parseInt(data.outAmount) / 1e6;
      console.log(`[MarketContext] Jupiter quote: ${inSol} SOL → ${outUsdc.toFixed(2)} USDC`);
    }
    return data;
  } catch (error: any) {
    console.warn('[MarketContext] Jupiter quote failed (devnet limitation):', error.message);
    // Return a plausible mock so the LLM still gets route info
    const solPrice = priceCache?.usd ?? 140;
    const inSol = amount / 1e9;
    const mockOutUsdc = inSol * solPrice * 0.997; // 0.3% slippage mock
    return {
      inputMint,
      outputMint,
      inAmount: String(amount),
      outAmount: String(Math.floor(mockOutUsdc * 1e6)),
      otherAmountThreshold: String(Math.floor(mockOutUsdc * 0.995 * 1e6)),
      swapMode: 'ExactIn',
      slippageBps: 50,
      priceImpactPct: '0.05',
      routePlan: [{ swapInfo: { label: 'Orca (mock devnet)' } }],
      isDevnetMock: true,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
