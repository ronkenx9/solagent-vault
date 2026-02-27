// Solana program IDs
export const SOLANA_PROGRAMS = {
  JUPITER_V6: 'JUP6LkbZbjS1jKKwapdHNy74zaZWiGdp52teN2pLr',
  RAYDIUM_AMM: 'RVKd61ztZW9GUwhRbbLoYVRE5Xf1ktQaacEEzebSB',
  TOKEN: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  SYSTEM: '11111111111111111111111111111111',
} as const;

// Token mints
export const TOKEN_MINTS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
} as const;

// RPC URLs
export const RPC_URLS = {
  DEVNET: 'https://api.devnet.solana.com',
  TESTNET: 'https://api.testnet.solana.com',
  MAINNET: 'https://api.mainnet-beta.solana.com',
} as const;

// Network configuration
export const NETWORK = {
  DEFAULT: 'devnet' as const,
  DISABLED: false, // Hardcoded guard against mainnet
} as const;
