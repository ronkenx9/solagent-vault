import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { TurnkeyClient } from '@turnkey/http';
import { ApiKeyStamper } from '@turnkey/api-key-stamper';
import { TurnkeySigner } from '@turnkey/solana';
import { KeyManager } from './key-manager.js';

export class TurnkeyKeyManager implements KeyManager {
    private signer: TurnkeySigner;

    constructor() {
        const apiKey = process.env.TURNKEY_API_PUBLIC_KEY;
        const apiPrivateKey = process.env.TURNKEY_API_PRIVATE_KEY;
        const organizationId = process.env.TURNKEY_ORGANIZATION_ID;

        if (!apiKey || !apiPrivateKey || !organizationId) {
            throw new Error('Missing Turnkey environment variables. Expected: TURNKEY_API_PUBLIC_KEY, TURNKEY_API_PRIVATE_KEY, TURNKEY_ORGANIZATION_ID');
        }

        const stamper = new ApiKeyStamper({
            apiPublicKey: apiKey,
            apiPrivateKey: apiPrivateKey,
        });

        const client = new TurnkeyClient({ baseUrl: 'https://api.turnkey.com' }, stamper);

        this.signer = new TurnkeySigner({
            organizationId: organizationId,
            client,
        });
    }

    async getPublicKey(agentId: string): Promise<PublicKey> {
        // In a production multi-agent system, this would query a Database (Supabase) 
        // to find the specific Turnkey Wallet ID mapped to this agentId.
        // For the scope of this implementation, we use a single organization wallet.
        const encodedAddress = process.env.TURNKEY_WALLET_PUBLIC_KEY;
        if (!encodedAddress) {
            throw new Error('TURNKEY_WALLET_PUBLIC_KEY not configured in environment variables');
        }
        return new PublicKey(encodedAddress);
    }

    async signTransaction(agentId: string, tx: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction> {
        const address = await this.getPublicKey(agentId);

        // TurnkeySigner abstractly passes the raw hex to the Secure Enclave and awaits the signature
        if (tx instanceof VersionedTransaction) {
            await this.signer.addSignature(tx, address.toBase58());
            return tx;
        } else {
            await this.signer.addSignature(tx, address.toBase58());
            return tx;
        }
    }
}
