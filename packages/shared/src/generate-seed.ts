import * as bip39 from 'bip39';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Generate a new mnemonic and save to .env file
 */
async function generateSeed(): Promise<void> {
  const mnemonic = bip39.generateMnemonic(256);

  console.log('\n========================================');
  console.log('GENERATED MNEMONIC (SAVE THIS!)');
  console.log('========================================\n');
  console.log(mnemonic);
  console.log('\n========================================\n');

  // Create .env file
  const envContent = `VAULT_MASTER_SEED="${mnemonic}"
`;

  const envPath = path.join(process.cwd(), '.env');
  fs.writeFileSync(envPath, envContent);

  console.log(`Saved to ${envPath}`);
  console.log('\nIMPORTANT:');
  console.log('- Keep this mnemonic secret!');
  console.log('- Never commit it to version control');
  console.log('- Use for devnet testing only');
  console.log('- For production, use HSM or MPC wallet\n');
}

generateSeed().catch(console.error);
