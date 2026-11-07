import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const BURNER_STORAGE_KEY = 'aegisflow_devnet_burner_v1';

// Fallback in-memory reference when browser blocks localStorage (Safari Private / Chrome Incognito)
let inMemoryBurnerSecret: Uint8Array | null = null;

export interface BurnerWalletState {
  keypair: Keypair;
  pubkey: string;
  persistedInStorage: boolean;
}

function safeReadStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(BURNER_STORAGE_KEY);
  } catch {
    return null;
  }
}

function safeWriteStorage(value: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(BURNER_STORAGE_KEY, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(BURNER_STORAGE_KEY);
  } catch {
    // Ignore restricted storage errors
  }
}

/**
 * Loads an existing ephemeral Devnet burner wallet if saved in browser session, or returns null.
 */
export function loadExistingBurnerWallet(): BurnerWalletState | null {
  const raw = safeReadStorage();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === 64) {
        const secret = Uint8Array.from(parsed);
        const keypair = Keypair.fromSecretKey(secret);
        inMemoryBurnerSecret = secret;
        return {
          keypair,
          pubkey: keypair.publicKey.toBase58(),
          persistedInStorage: true,
        };
      }
    } catch {
      safeRemoveStorage();
    }
  }

  if (inMemoryBurnerSecret && inMemoryBurnerSecret.length === 64) {
    const keypair = Keypair.fromSecretKey(inMemoryBurnerSecret);
    return {
      keypair,
      pubkey: keypair.publicKey.toBase58(),
      persistedInStorage: false,
    };
  }

  return null;
}

/**
 * Generates a brand-new ephemeral Devnet burner Keypair in browser memory.
 */
export function createBurnerWallet(): BurnerWalletState {
  const keypair = Keypair.generate();
  inMemoryBurnerSecret = new Uint8Array(keypair.secretKey);
  const persisted = safeWriteStorage(
    JSON.stringify(Array.from(keypair.secretKey))
  );
  return {
    keypair,
    pubkey: keypair.publicKey.toBase58(),
    persistedInStorage: persisted,
  };
}

/**
 * Imports a 64-byte JSON array or base58-encoded Devnet secret key with strict validation.
 */
export function importBurnerSecretKey(rawSecret: string): BurnerWalletState {
  const trimmed = (rawSecret || '').trim();
  if (!trimmed) {
    throw new Error('Secret key input cannot be empty.');
  }

  let bytes: Uint8Array;
  if (trimmed.startsWith('[')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error('Invalid JSON byte array format.');
    }
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 64 ||
      !parsed.every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 255)
    ) {
      throw new Error('Secret key JSON array must contain exactly 64 byte integers (0-255).');
    }
    bytes = Uint8Array.from(parsed);
  } else {
    try {
      bytes = bs58.decode(trimmed);
    } catch {
      throw new Error('Invalid base58 secret key string.');
    }
    if (bytes.length !== 64) {
      throw new Error(`Expected 64-byte Ed25519 secret key, got ${bytes.length} bytes.`);
    }
  }

  const keypair = Keypair.fromSecretKey(bytes);
  inMemoryBurnerSecret = new Uint8Array(keypair.secretKey);
  const persisted = safeWriteStorage(JSON.stringify(Array.from(keypair.secretKey)));

  return {
    keypair,
    pubkey: keypair.publicKey.toBase58(),
    persistedInStorage: persisted,
  };
}

/**
 * Cryptographically zeroes out the ephemeral secret key buffer in memory and clears browser storage.
 * Note: In @solana/web3.js v1.99.0, `keypair.secretKey` returns a defensive copy on access,
 * so we explicitly zero the underlying `_keypair.secretKey` buffer as well.
 */
export function destroyBurnerWallet(keypair?: Keypair | null): void {
  if (keypair) {
    keypair.secretKey.fill(0);
    const internal = (
      keypair as unknown as {
        _keypair?: { secretKey?: Uint8Array; publicKey?: Uint8Array };
      }
    )._keypair;
    if (internal?.secretKey instanceof Uint8Array) {
      internal.secretKey.fill(0);
    }
  }
  if (inMemoryBurnerSecret) {
    inMemoryBurnerSecret.fill(0);
    inMemoryBurnerSecret = null;
  }
  safeRemoveStorage();
}
