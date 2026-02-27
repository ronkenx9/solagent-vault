import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import type { Intent, WalletBalance } from './types.js';
import { deriveAgentKeypair } from './hd-wallet.js';

const JUPITER_V6_PROGRAM_ID = 'JUP6LkbZbjS1jKKwapdHNy74zaZWiGdp52teN2pLr'
const RAYDIUM_AMM_PROGRAM_ID = 'RVKd61ztZW9GUwhRbbLoYVRE5Xf1ktQaacEEzebSB'
const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'

export interface SignerConfig {
  rpcUrl: string;
  confirmOptions?: {
    commitment?: 'confirmed' | 'finalized' | 'processed';
    skipPreflight?: boolean;
  };
}

/**
 * Handles transaction construction, signing, and broadcasting
 */
export class Signer {
  private connection: Connection;
  private confirmOptions: SignerConfig['confirmOptions'];

  constructor(config: SignerConfig) {
    this.connection = new Connection(config.rpcUrl, 'confirmed');
    this.confirmOptions = config.confirmOptions || {
      commitment: 'confirmed',
      skipPreflight: false,
    };
  }

  /**
   * Get connection instance
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Send SOL from agent wallet to a destination
   */
  async sendSol(
    agentId: string,
    destination: string,
    lamports: number
  ): Promise<string> {
    const keypair = deriveAgentKeypair(agentId);
    const destinationPubkey = new PublicKey(destination);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: destinationPubkey,
        lamports,
      })
    );

    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [keypair],
      this.confirmOptions
    );

    return signature;
  }

  /**
   * Execute a token swap via Jupiter (placeholder - returns mock for devnet)
   * In production, this would call Jupiter's swap API and build the tx
   */
  async swapTokens(
    agentId: string,
    inputMint: string,
    outputMint: string,
    amount: number
  ): Promise<string> {
    // For devnet, we'll do a simple SOL transfer as a placeholder
    // In production: call Jupiter API, build swap transaction, sign and send
    const keypair = deriveAgentKeypair(agentId);

    // Devnet placeholder: just transfer a small amount to self
    // This simulates the swap flow for demo purposes
    console.log(`[Signer] Simulating swap: ${inputMint} -> ${outputMint}, amount: ${amount}`);

    // In real implementation:
    // 1. Call Jupiter API to get quote
    // 2. Build swap transaction
    // 3. Sign and send

    // For now, return a mock signature
    return `devnet-swap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get wallet balance for an agent
   */
  async getBalance(agentId: string): Promise<WalletBalance> {
    const keypair = deriveAgentKeypair(agentId);

    try {
      const solBalance = await this.connection.getBalance(keypair.publicKey);

      // Get token balances
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        keypair.publicKey,
        { programId: new PublicKey(TOKEN_PROGRAM_ID) }
      );

      const tokens: Record<string, number> = {};
      for (const account of tokenAccounts.value) {
        const mint = account.account.data.parsed.info.mint;
        const amount = account.account.data.parsed.info.tokenAmount.uiAmount;
        tokens[mint] = amount;
      }

      return {
        sol: solBalance / 1e9, // Convert lamports to SOL
        tokens,
      };
    } catch (error) {
      // Return empty balance on error (wallet might not exist yet)
      return { sol: 0, tokens: {} };
    }
  }

  /**
   * Get wallet address for an agent
   */
  getWalletAddress(agentId: string): PublicKey {
    const keypair = deriveAgentKeypair(agentId);
    return keypair.publicKey;
  }

  /**
   * Request airdrop for devnet testing
   */
  async requestAirdrop(agentId: string, amount: number = 2): Promise<string> {
    const keypair = deriveAgentKeypair(agentId);
    const signature = await this.connection.requestAirdrop(
      keypair.publicKey,
      amount * 1e9 // Convert SOL to lamports
    );
    await this.connection.confirmTransaction(signature, 'confirmed');
    return signature;
  }

  /**
   * Check if a transaction was confirmed
   */
  async isConfirmed(signature: string): Promise<boolean> {
    try {
      const tx = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
      });
      return tx !== null;
    } catch {
      return false;
    }
  }
}
