/**
 * AegisFlow E2E Test Suite - Solana Environment & Network Utilities
 */

import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import fs from "fs";
import path from "path";

export const DEVNET_RPC_ENDPOINTS = [
  process.env.HELIUS_RPC_URL,
  process.env.SOLANA_DEVNET_RPC_URL,
  "https://api.devnet.solana.com",
].filter((url): url is string => Boolean(url));

export function getActiveConnection(): Connection {
  const url = DEVNET_RPC_ENDPOINTS[0] || "https://api.devnet.solana.com";
  return new Connection(url, "confirmed");
}

export function loadLocalDevnetKeypair(): Keypair {
  const keypairPath = path.resolve(process.cwd(), ".devnet-keypair.json");
  if (fs.existsSync(keypairPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
      return Keypair.fromSecretKey(Uint8Array.from(raw));
    } catch {
      // Fall through to generating fresh ephemeral keypair
    }
  }
  const ephemeral = Keypair.generate();
  return ephemeral;
}

export async function checkConnectionHealth(connection: Connection): Promise<boolean> {
  try {
    const version = await connection.getVersion();
    return Boolean(version["solana-core"]);
  } catch {
    return false;
  }
}

export async function getAccountSolBalance(connection: Connection, keypair: Keypair): Promise<number> {
  try {
    const lamports = await connection.getBalance(keypair.publicKey);
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}
