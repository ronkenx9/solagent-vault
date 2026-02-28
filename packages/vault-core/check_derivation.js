import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { Keypair } from '@solana/web3.js';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

const MASTER_SEED = process.env.VAULT_MASTER_SEED;

function hash_djb2(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash) % 2147483647;
}

function derive(index) {
    const path = `m/44'/501'/${index}'/0'`;
    const seed = bip39.mnemonicToSeedSync(MASTER_SEED);
    const { key } = derivePath(path, seed.toString('hex'));
    return Keypair.fromSeed(key).publicKey.toBase58();
}

const id = 'agent-momentum-01';
console.log(`Testing id: ${id}`);
console.log(`djb2 index: ${hash_djb2(id)} -> ${derive(hash_djb2(id))}`);
// My funded address for momentum was A6KZGh72wLntQxCrjYbMMfixM1nRzBWDufa1it4uM2JN
