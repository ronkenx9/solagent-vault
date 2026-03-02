import { PublicKey } from '@solana/web3.js';
/**
 * TurnkeyKeyManager is an enterprise-grade MPC (Multi-Party Computation)
 * key manager integration.
 *
 * It proxies transaction signing requests to the Turnkey API enclave.
 * This guarantees the Solana Private Keys are geographically distributed
 * and never touch the Vercel or Node container memory.
 */
export class TurnkeyKeyManager {
    config;
    constructor(config) {
        this.config = config;
        // In production, you would initialize the @turnkey/http or @turnkey/solana SDK here.
        // Example: init({ apiPublicKey: config.apiPublicKey, apiPrivateKey: config.apiPrivateKey, ... })
    }
    /**
     * Retrieves the public key for an agent by fetching the wallet address
     * mapped to this agent via Turnkey's Sub-Organizations.
     */
    async getPublicKey(agentId) {
        // Scaffold: Fetch the assigned Turnkey Wallet Address for this sub-org
        console.log(`[Turnkey HSM] Fetching wallet address for agent: ${agentId}`);
        // Dummy response for compilation scaffold
        return new PublicKey('11111111111111111111111111111111');
    }
    /**
     * Proxies the transaction payload string to the Turnkey Enclave to be signed
     * and subsequently returns the fully signed object without ever revealing the private key.
     */
    async signTransaction(agentId, tx) {
        console.log(`[Turnkey HSM] Requesting Secure MPC Signature for agent: ${agentId}...`);
        // In production, we serialize the transaction and pass it to Turnkey:
        // const serializedTx = tx.serialize({ requireAllSignatures: false }).toString('hex');
        // const response = await turnkeySignTransaction({ unsignedTransaction: serializedTx, ... });
        // const signedTxBuffer = Buffer.from(response.signedTransaction, 'hex');
        // return VersionedTransaction.deserialize(signedTxBuffer);
        throw new Error('TurnkeySignerBackend: Production credentials required to execute remote signing.');
    }
}
//# sourceMappingURL=turnkey-manager.js.map