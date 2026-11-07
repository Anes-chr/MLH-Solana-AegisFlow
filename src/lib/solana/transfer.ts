import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { createAegisMemoInstruction } from './swap';

export interface BuildTransferParams {
  connection: Connection;
  userPubkey: PublicKey;
  recipientPubkey: PublicKey;
  amountSol: number;
  planHashHex: string;
  recentBlockhash?: string;
}

export interface BuildTransferResult {
  transaction: Transaction;
  txBase64: string;
}

/**
 * Builds a guarded SOL transfer transaction:
 * 1. Native SOL transfer via System Program
 * 2. Aegis Memo instruction with cryptographic plan hash
 *
 * Fee payer is userPubkey. No server-side signature is applied
 * (only the user's wallet signs).
 */
export async function buildSolTransferTransaction(
  params: BuildTransferParams
): Promise<BuildTransferResult> {
  const {
    connection,
    userPubkey,
    recipientPubkey,
    amountSol,
    planHashHex,
    recentBlockhash,
  } = params;

  if (!Number.isFinite(amountSol) || amountSol <= 0) {
    throw new Error(`Invalid transfer amountSol: ${amountSol}. Must be > 0.`);
  }

  const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
  if (lamports <= 0) {
    throw new Error(`Transfer amount ${amountSol} SOL rounds to 0 lamports.`);
  }
  const transaction = new Transaction();

  // Instruction 0: SystemProgram SOL transfer
  const ix0 = SystemProgram.transfer({
    fromPubkey: userPubkey,
    toPubkey: recipientPubkey,
    lamports,
  });
  transaction.add(ix0);

  // Instruction 1: Cryptographic Memo plan anchor
  const ix1 = createAegisMemoInstruction(planHashHex);
  transaction.add(ix1);

  // Set Fee Payer
  transaction.feePayer = userPubkey;

  // Set Blockhash
  if (recentBlockhash) {
    transaction.recentBlockhash = recentBlockhash;
  } else {
    const latest = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = latest.blockhash;
    transaction.lastValidBlockHeight = latest.lastValidBlockHeight;
  }

  // Wire serialization (user signature slot remains open)
  const rawWire = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
  if (rawWire.length > 1232) {
    throw new Error(
      `Transfer transaction size (${rawWire.length} bytes) exceeds Solana 1232-byte MTU limit.`
    );
  }
  const txBase64 = Buffer.from(rawWire).toString('base64');

  return {
    transaction,
    txBase64,
  };
}
