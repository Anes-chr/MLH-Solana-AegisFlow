import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import * as crypto from 'crypto';
import { MEMO_PROGRAM_ID, TOKEN_CONFIG } from './config';
import { getDevnetVaultConfig } from './vault';

export interface BuildSwapParams {
  connection: Connection;
  userPubkey: PublicKey;
  amountSol: number;
  expectedDUsdcAmount: number;
  planHashHex: string;
  recentBlockhash?: string;
}

export interface BuildSwapResult {
  transaction: Transaction;
  txBase64: string;
  userAta: PublicKey;
  vaultAta: PublicKey;
}

/**
 * Creates the SPL Memo instruction embedding the AegisFlow cryptographic plan hash.
 * Format: "aegis:v1:<sha256(plan JSON)>"
 */
export function createAegisMemoInstruction(
  planHashHex: string
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(`aegis:v1:${planHashHex}`, 'utf-8'),
  });
}

function canonicalizePayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizePayload);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = canonicalizePayload((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Computes deterministic SHA-256 hash string for an arbitrary plan payload.
 */
export function hashPlanPayload(payload: unknown): string {
  const serialized =
    typeof payload === 'string'
      ? payload
      : JSON.stringify(canonicalizePayload(payload));
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

/**
 * Builds an atomic 4-instruction Devnet swap transaction:
 * 1. Idempotent User ATA creation
 * 2. User SOL transfer to Vault
 * 3. Vault dUSDC SPL token transfer to User ATA
 * 4. Aegis Memo instruction with plan hash
 *
 * Partially signed by Devnet Vault keypair; feePayer set to userPubkey.
 */
export async function buildAtomicSwapTransaction(
  params: BuildSwapParams
): Promise<BuildSwapResult> {
  const {
    connection,
    userPubkey,
    amountSol,
    expectedDUsdcAmount,
    planHashHex,
    recentBlockhash,
  } = params;

  if (!Number.isFinite(amountSol) || amountSol <= 0) {
    throw new Error(`Invalid swap amountSol: ${amountSol}. Must be > 0.`);
  }
  if (!Number.isFinite(expectedDUsdcAmount) || expectedDUsdcAmount <= 0) {
    throw new Error(
      `Invalid expectedDUsdcAmount: ${expectedDUsdcAmount}. Must be > 0.`
    );
  }

  const vaultConfig = getDevnetVaultConfig();
  const dUsdcMint = vaultConfig.dUsdcMint;
  const vaultPubkey = vaultConfig.vaultPubkey;
  const vaultDUsdcAta = vaultConfig.vaultDUsdcAta;

  if (userPubkey.equals(vaultPubkey)) {
    throw new Error(
      'Invalid swap signer: userPubkey cannot equal the AegisFlow Devnet Vault authority.'
    );
  }

  // 1. Derive User's Associated Token Account
  const userDUsdcAta = getAssociatedTokenAddressSync(
    dUsdcMint,
    userPubkey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // 2. Compute lamports and dUSDC base units
  const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
  if (lamports <= 0) {
    throw new Error(`Swap amount ${amountSol} SOL rounds to 0 lamports.`);
  }
  const dusdcBaseUnits = BigInt(
    Math.floor(expectedDUsdcAmount * TOKEN_CONFIG.DUSDC_BASE_MULTIPLIER)
  );
  if (dusdcBaseUnits <= 0n) {
    throw new Error(
      `Swap amount ${amountSol} SOL yields 0 micro-dUSDC (minimum 1 micro-dUSDC required).`
    );
  }

  // 3. Assemble the 4 atomic instructions
  const transaction = new Transaction();

  // Instruction 0: Idempotent ATA creation for user
  const ix0 = createAssociatedTokenAccountIdempotentInstruction(
    userPubkey, // payer
    userDUsdcAta, // associatedToken
    userPubkey, // owner
    dUsdcMint, // mint
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  transaction.add(ix0);

  // Instruction 1: User SOL transfer to Vault
  const ix1 = SystemProgram.transfer({
    fromPubkey: userPubkey,
    toPubkey: vaultPubkey,
    lamports,
  });
  transaction.add(ix1);

  // Instruction 2: Vault dUSDC transfer to User ATA
  const ix2 = createTransferInstruction(
    vaultDUsdcAta, // source
    userDUsdcAta, // destination
    vaultPubkey, // owner/authority
    dusdcBaseUnits, // amount
    [],
    TOKEN_PROGRAM_ID
  );
  transaction.add(ix2);

  // Instruction 3: Cryptographic Memo plan anchor
  const ix3 = createAegisMemoInstruction(planHashHex);
  transaction.add(ix3);

  // 4. Set Fee Payer and Blockhash
  transaction.feePayer = userPubkey;

  if (recentBlockhash) {
    transaction.recentBlockhash = recentBlockhash;
  } else {
    const latest = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = latest.blockhash;
    transaction.lastValidBlockHeight = latest.lastValidBlockHeight;
  }

  // 5. Server-side partial signing with Vault Keypair
  // Vault signs as authority for Leg 2 (vault ATA transfer)
  transaction.partialSign(vaultConfig.vaultKeypair);

  // 6. Serialize wire format with open user signature slot
  const rawWire = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
  if (rawWire.length > 1232) {
    throw new Error(
      `Swap transaction size (${rawWire.length} bytes) exceeds Solana 1232-byte MTU limit.`
    );
  }
  const txBase64 = Buffer.from(rawWire).toString('base64');

  return {
    transaction,
    txBase64,
    userAta: userDUsdcAta,
    vaultAta: vaultDUsdcAta,
  };
}
