import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
  mintTo,
  getAccount,
  getMint,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { getSolanaConnection, TOKEN_CONFIG } from '../src/lib/solana/config';
import {
  VAULT_KEYPAIR_PATH,
  VAULT_METADATA_PATH,
  VaultMetadata,
} from '../src/lib/solana/vault';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const PAYER_KEYPAIR_PATH = path.resolve(process.cwd(), '.devnet-keypair.json');
const MIN_VAULT_SOL = 0.05;
const INITIAL_DUSDC_MINT_AMOUNT = 1_000_000; // 1,000,000 dUSDC

/**
 * 1. Resolve or Generate Vault Keypair
 */
function getOrCreateVaultKeypair(): Keypair {
  if (fs.existsSync(VAULT_KEYPAIR_PATH)) {
    try {
      const raw = fs.readFileSync(VAULT_KEYPAIR_PATH, 'utf-8');
      const bytes = Uint8Array.from(JSON.parse(raw));
      const kp = Keypair.fromSecretKey(bytes);
      console.log(`[VAULT] Loaded existing vault keypair: ${kp.publicKey.toBase58()}`);
      return kp;
    } catch (e) {
      console.warn('[VAULT] Failed to parse existing vault keypair. Generating new one.');
    }
  }

  const keypair = Keypair.generate();
  fs.writeFileSync(
    VAULT_KEYPAIR_PATH,
    JSON.stringify(Array.from(keypair.secretKey)),
    'utf-8'
  );
  console.log(`[VAULT] Created and saved new vault keypair: ${keypair.publicKey.toBase58()}`);
  return keypair;
}

/**
 * 2. 5-Tier Resilient Funding Strategy
 */
async function fundVaultWithSol(
  connection: Connection,
  vaultKeypair: Keypair
): Promise<boolean> {
  const vaultPubkey = vaultKeypair.publicKey;
  let balance = await connection.getBalance(vaultPubkey);
  console.log(
    `[FUNDING] Vault balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`
  );

  // Tier 1: Existing balance check
  if (balance >= MIN_VAULT_SOL * LAMPORTS_PER_SOL) {
    console.log('[FUNDING] Tier 1: Existing vault balance is sufficient.');
    return true;
  }

  // Tier 2: Transfer from cached test payer (.devnet-keypair.json) if available
  if (fs.existsSync(PAYER_KEYPAIR_PATH)) {
    try {
      const raw = fs.readFileSync(PAYER_KEYPAIR_PATH, 'utf-8');
      const payerKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
      const payerBalance = await connection.getBalance(payerKeypair.publicKey);
      console.log(
        `[FUNDING] Tier 2: Found test payer ${payerKeypair.publicKey.toBase58()} with ${(
          payerBalance / LAMPORTS_PER_SOL
        ).toFixed(4)} SOL`
      );

      if (payerBalance >= 0.06 * LAMPORTS_PER_SOL) {
        console.log('[FUNDING] Transferring 0.05 SOL from test payer to vault...');
        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: payerKeypair.publicKey,
            toPubkey: vaultPubkey,
            lamports: 0.05 * LAMPORTS_PER_SOL,
          })
        );
        const sig = await sendAndConfirmTransaction(connection, tx, [payerKeypair], {
          commitment: 'confirmed',
        });
        console.log(`[FUNDING] Transferred successfully! Signature: ${sig}`);
        balance = await connection.getBalance(vaultPubkey);
        return true;
      }
    } catch (err) {
      console.warn(`[FUNDING] Tier 2 transfer error: ${(err as Error).message}`);
    }
  }

  // Tier 3: Multi-RPC connection.requestAirdrop attempts
  console.log('[FUNDING] Tier 3: Attempting RPC airdrop...');
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const sig = await connection.requestAirdrop(
        vaultPubkey,
        1 * LAMPORTS_PER_SOL
      );
      const latestBlockhash = await connection.getLatestBlockhash('confirmed');
      await connection.confirmTransaction(
        {
          signature: sig,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        'confirmed'
      );
      console.log('[FUNDING] RPC airdrop succeeded!');
      return true;
    } catch (err) {
      console.warn(`[FUNDING] RPC airdrop attempt ${attempt} failed: ${(err as Error).message}`);
      if (attempt < 2) await new Promise((res) => setTimeout(res, 2000));
    }
  }

  // Tier 4: Interactive Manual Prompt + Polling
  const timeoutMs = process.env.DEVNET_FUNDING_TIMEOUT_MS
    ? Number(process.env.DEVNET_FUNDING_TIMEOUT_MS)
    : 5000;
  console.warn('\n============================================================');
  console.warn('[ACTION REQUIRED] Public Devnet Faucet is rate-limited or closed.');
  console.warn('To fund the vault on Devnet:');
  console.warn(`  Vault Address: ${vaultPubkey.toBase58()}`);
  console.warn('  Web Faucet:    https://faucet.solana.com');
  console.warn(`  Solana CLI:    solana airdrop 1 ${vaultPubkey.toBase58()} --url devnet`);
  console.warn(`Polling for up to ${Math.round(timeoutMs / 1000)} seconds...`);
  console.warn('============================================================\n');

  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    await new Promise((res) => setTimeout(res, 3000));
    balance = await connection.getBalance(vaultPubkey);
    if (balance >= 0.02 * LAMPORTS_PER_SOL) {
      console.log(
        `\n[FUNDING] Funds detected! Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`
      );
      return true;
    }
    process.stdout.write('.');
  }

  // Tier 5: Fallback to mock status
  console.warn('\n[FUNDING] Tier 5: Timeout reached. Continuing in mock vault mode.');
  return false;
}

/**
 * Main Setup Execution
 */
async function main() {
  console.log('\n========================================================');
  console.log(' AegisFlow: Devnet Vault & dUSDC Token Setup Script     ');
  console.log('========================================================\n');

  const connection = await getSolanaConnection();
  const vaultKeypair = getOrCreateVaultKeypair();
  const isFunded = await fundVaultWithSol(connection, vaultKeypair);

  // Check if existing metadata exists and is valid on-chain
  if (fs.existsSync(VAULT_METADATA_PATH)) {
    try {
      const existingMeta: VaultMetadata = JSON.parse(
        fs.readFileSync(VAULT_METADATA_PATH, 'utf-8')
      );
      if (existingMeta.dUsdcMint && !existingMeta.isMock && isFunded) {
        const mintPubkey = new PublicKey(existingMeta.dUsdcMint);
        const mintInfo = await connection.getAccountInfo(mintPubkey);
        if (mintInfo) {
          console.log(`[VAULT] Existing dUSDC mint verified on-chain: ${existingMeta.dUsdcMint}`);
          const ataPubkey = new PublicKey(existingMeta.vaultDUsdcAta);
          const ataInfo = await connection.getAccountInfo(ataPubkey);
          if (ataInfo) {
            console.log(`[VAULT] Existing vault ATA verified on-chain: ${existingMeta.vaultDUsdcAta}`);
            console.log('\n✅ Devnet Vault is already fully initialized!');
            return;
          }
        }
      }
    } catch (e) {
      // Continue with fresh setup
    }
  }

  if (isFunded) {
    console.log('[MINT] Creating 6-decimal dUSDC mint with vault as mint authority...');
    const dUsdcMint = await createMint(
      connection,
      vaultKeypair,
      vaultKeypair.publicKey,
      null, // Non-freezable
      TOKEN_CONFIG.DUSDC_DECIMALS,
      undefined,
      { commitment: 'confirmed' },
      TOKEN_PROGRAM_ID
    );
    console.log(`[MINT] dUSDC Mint created: ${dUsdcMint.toBase58()}`);

    console.log('[ATA] Creating vault Associated Token Account...');
    const vaultAta = await getOrCreateAssociatedTokenAccount(
      connection,
      vaultKeypair,
      dUsdcMint,
      vaultKeypair.publicKey,
      false,
      'confirmed',
      { commitment: 'confirmed' },
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    console.log(`[ATA] Vault dUSDC ATA: ${vaultAta.address.toBase58()}`);

    const baseAmount =
      BigInt(INITIAL_DUSDC_MINT_AMOUNT) *
      BigInt(TOKEN_CONFIG.DUSDC_BASE_MULTIPLIER);
    console.log(`[MINT] Minting ${INITIAL_DUSDC_MINT_AMOUNT.toLocaleString()} dUSDC to vault ATA...`);
    const mintTxSig = await mintTo(
      connection,
      vaultKeypair,
      dUsdcMint,
      vaultAta.address,
      vaultKeypair,
      baseAmount,
      [],
      { commitment: 'confirmed' },
      TOKEN_PROGRAM_ID
    );
    console.log(`[MINT] Mint confirmed! Signature: ${mintTxSig}`);

    // Verify token balance
    const tokenAccount = await getAccount(connection, vaultAta.address, 'confirmed');
    console.log(
      `[VERIFICATION] Vault dUSDC Balance: ${Number(tokenAccount.amount) / TOKEN_CONFIG.DUSDC_BASE_MULTIPLIER} dUSDC`
    );

    const metadata: VaultMetadata = {
      network: 'devnet',
      vaultPubkey: vaultKeypair.publicKey.toBase58(),
      dUsdcMint: dUsdcMint.toBase58(),
      vaultDUsdcAta: vaultAta.address.toBase58(),
      decimals: TOKEN_CONFIG.DUSDC_DECIMALS,
      initialSupply: INITIAL_DUSDC_MINT_AMOUNT.toString(),
      isMock: false,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(VAULT_METADATA_PATH, JSON.stringify(metadata, null, 2), 'utf-8');
    console.log(`[METADATA] Saved vault configuration to ${VAULT_METADATA_PATH}`);

    console.log('\n========================================================');
    console.log(' ✅ DEVNET VAULT SETUP COMPLETE (ON-CHAIN VERIFIED)     ');
    console.log('========================================================');
    console.log(`Vault Pubkey:  ${vaultKeypair.publicKey.toBase58()}`);
    console.log(`dUSDC Mint:    ${dUsdcMint.toBase58()}`);
    console.log(`Vault ATA:     ${vaultAta.address.toBase58()}`);
    console.log(`Explorer URL:  https://explorer.solana.com/address/${dUsdcMint.toBase58()}?cluster=devnet\n`);
  } else {
    // Unfunded fallback setup (mock metadata)
    console.warn('[FALLBACK] Setting up mock vault configuration for simulation testing.');
    const mockMint = Keypair.fromSeed(new Uint8Array(32).fill(88)).publicKey;
    const mockAta = getAssociatedTokenAddressSync(
      mockMint,
      vaultKeypair.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const metadata: VaultMetadata = {
      network: 'devnet',
      vaultPubkey: vaultKeypair.publicKey.toBase58(),
      dUsdcMint: mockMint.toBase58(),
      vaultDUsdcAta: mockAta.toBase58(),
      decimals: TOKEN_CONFIG.DUSDC_DECIMALS,
      initialSupply: INITIAL_DUSDC_MINT_AMOUNT.toString(),
      isMock: true,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(VAULT_METADATA_PATH, JSON.stringify(metadata, null, 2), 'utf-8');
    console.log(`[METADATA] Saved fallback mock vault configuration to ${VAULT_METADATA_PATH}`);
  }
}

main().catch((err) => {
  console.error('\n❌ Devnet Vault Setup Failed:', err);
  process.exit(1);
});
