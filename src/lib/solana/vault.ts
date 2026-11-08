import { Keypair, PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';
import bs58 from 'bs58';

export interface VaultConfig {
  vaultKeypair: Keypair;
  vaultPubkey: PublicKey;
  dUsdcMint: PublicKey;
  vaultDUsdcAta: PublicKey;
  isMock?: boolean;
}

export interface VaultMetadata {
  network: string;
  vaultPubkey: string;
  dUsdcMint: string;
  vaultDUsdcAta: string;
  decimals: number;
  initialSupply: string;
  isMock?: boolean;
  updatedAt: string;
}

export const VAULT_KEYPAIR_PATH = path.resolve(
  process.cwd(),
  '.devnet-vault-keypair.json'
);
export const VAULT_METADATA_PATH = path.resolve(
  process.cwd(),
  '.devnet-vault.json'
);

/**
 * Deterministic fallback seed for offline / mock testing.
 * Used only when neither environment variables nor local files exist.
 */
const MOCK_SEED = new Uint8Array(32).fill(42);

/**
 * Resolve the Devnet Vault Keypair from environment, local file, or mock fallback.
 */
export function getDevnetVaultKeypair(): { keypair: Keypair; isMock: boolean } {
  // 1. Environment variable: VAULT_SECRET_KEY
  const envSecret = process.env.VAULT_SECRET_KEY?.trim();
  if (envSecret) {
    try {
      if (envSecret.startsWith('[')) {
        const bytes = Uint8Array.from(JSON.parse(envSecret));
        return { keypair: Keypair.fromSecretKey(bytes), isMock: false };
      } else {
        const bytes = bs58.decode(envSecret);
        return { keypair: Keypair.fromSecretKey(bytes), isMock: false };
      }
    } catch (e) {
      console.warn('[VAULT] Failed to parse VAULT_SECRET_KEY from environment');
    }
  }

  // 2. Local cache file: .devnet-vault-keypair.json
  if (fs.existsSync(VAULT_KEYPAIR_PATH)) {
    try {
      const raw = fs.readFileSync(VAULT_KEYPAIR_PATH, 'utf-8');
      const bytes = Uint8Array.from(JSON.parse(raw));
      return { keypair: Keypair.fromSecretKey(bytes), isMock: false };
    } catch (e) {
      console.warn('[VAULT] Failed to read .devnet-vault-keypair.json');
    }
  }

  // 3. Deterministic mock keypair fallback
  const mockKeypair = Keypair.fromSeed(MOCK_SEED);
  return { keypair: mockKeypair, isMock: true };
}

/**
 * Read cached vault metadata (.devnet-vault.json) if present.
 */
export function getDevnetVaultMetadata(): VaultMetadata | null {
  if (fs.existsSync(VAULT_METADATA_PATH)) {
    try {
      const content = fs.readFileSync(VAULT_METADATA_PATH, 'utf-8');
      return JSON.parse(content) as VaultMetadata;
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * Synchronously resolve the complete Devnet Vault configuration.
 * Adheres strictly to PROJECT.md interface contract:
 * export function getDevnetVaultConfig(): VaultConfig;
 */
export function getDevnetVaultConfig(): VaultConfig {
  const { keypair, isMock } = getDevnetVaultKeypair();
  const metadata = getDevnetVaultMetadata();

  let mintPubkey: PublicKey;
  let ataPubkey: PublicKey;

  // Resolve Mint
  const envMint = process.env.NEXT_PUBLIC_DUSDC_MINT || process.env.DUSDC_MINT;
  if (envMint) {
    mintPubkey = new PublicKey(envMint);
  } else if (metadata?.dUsdcMint) {
    mintPubkey = new PublicKey(metadata.dUsdcMint);
  } else {
    // Real on-chain verified dUSDC Devnet mint
    mintPubkey = new PublicKey('9v8dv2aJ7dG9crg699zfsFXBdM7gq8eDyk5t6SnZ8VJZ');
  }

  // Resolve ATA (canonical SPL ATA unless explicitly overridden via env)
  const canonicalAta = getAssociatedTokenAddressSync(
    mintPubkey,
    keypair.publicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const envAta = process.env.DUSDC_VAULT_ATA;
  if (envAta) {
    ataPubkey = new PublicKey(envAta);
  } else if (metadata?.vaultDUsdcAta && !metadata.isMock) {
    ataPubkey = new PublicKey(metadata.vaultDUsdcAta);
  } else {
    ataPubkey = canonicalAta;
  }

  return {
    vaultKeypair: keypair,
    vaultPubkey: keypair.publicKey,
    dUsdcMint: mintPubkey,
    vaultDUsdcAta: ataPubkey,
    isMock: isMock || metadata?.isMock,
  };
}
