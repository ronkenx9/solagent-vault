// Re-export all public types and classes
export type {
  AgentPolicy,
  Intent,
  IntentAction,
  RuleCheckResult,
  VaultResult,
  WalletBalance,
  VaultEvent,
  EventCallback,
} from './types.js';

export { RuleEngine } from './rule-engine.js';
export { Signer } from './signer.js';
export { Vault, type VaultConfig } from './vault.js';
export { type KeyManager } from './wallet/key-manager.js';
export { LocalKeyManager } from './wallet/local-manager.js';
export { TurnkeyKeyManager } from './wallet/turnkey-key-manager.js';

export {
  deriveAgentKeypair,
  deriveAgentPublicKey,
  generateMnemonic,
  validateMnemonic,
} from './hd-wallet.js';

// Program IDs
export const PROGRAM_IDS = {
  DFLOW_DEX: 'DFLOWxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  JUPITER_V6: 'JUP6LkbZbjS1jKKwapdHNy74zaZWiGdp52teN2pLr',
  RAYDIUM_AMM: 'RVKd61ztZW9GUwhRbbLoYVRE5Xf1ktQaacEEzebSB',
  TOKEN: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  SYSTEM: '11111111111111111111111111111111',
} as const;