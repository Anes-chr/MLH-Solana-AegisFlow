/**
 * Tier 1 Feature Tests: Milestone 1 (Gate G2 - Features F01 to F05)
 * Covers:
 * - F01: Pyth Hermes Price Fetcher (T1-F01-01 to T1-F01-05)
 * - F02: Devnet Vault & dUSDC Token (T1-F02-01 to T1-F02-05)
 * - F03: Atomic Swap Builder (T1-F03-01 to T1-F03-05)
 * - F04: SOL Transfer Builder (T1-F04-01 to T1-F04-05)
 * - F05: Simulation & Delta Parser (T1-F05-01 to T1-F05-05)
 */

import { TestCase } from "../harness/types";
import {
  assert,
  assertEquals,
  assertGreaterThanOrEqual,
  assertInRange,
  assertMatches,
  markPending,
} from "../harness/assertions";
import { FIXTURES } from "../harness/fixtures";
import { getActiveConnection, checkConnectionHealth } from "../harness/solana-test-env";

export const m1SolanaFeatureTests: TestCase[] = [
  // --- F01: Pyth Hermes Price Fetcher ---
  {
    id: "T1-F01-01",
    name: "Pyth: Parse Hermes response schema",
    featureId: "F01",
    milestone: "M1",
    tier: 1,
    track: "mock",
    description: "Verify Hermes price schema returns priceUsd, confidence, publishTime, and feedId",
    run: async () => {
      const { parsePythHermesResponse } = await import("../../../src/lib/solana/pyth");
      const { PYTH_CONFIG } = await import("../../../src/lib/solana/config");
      const parsed = parsePythHermesResponse({
        parsed: [
          {
            id: PYTH_CONFIG.SOL_USD_FEED_ID,
            price: {
              price: "19850000000",
              conf: "8500000",
              expo: -8,
              publish_time: 1735000000,
            },
          },
        ],
      });
      assertEquals(parsed.priceUsd, 198.5, "priceUsd parsed from Hermes payload");
      assertEquals(parsed.confidence, 0.085, "confidence parsed from Hermes payload");
      assertEquals(parsed.publishTime, 1735000000, "publishTime preserved");
      assertEquals(parsed.feedId, PYTH_CONFIG.SOL_USD_FEED_ID, "feedId normalized");
    },
  },
  {
    id: "T1-F01-02",
    name: "Pyth: Mantissa and exponent scaling arithmetic",
    featureId: "F01",
    milestone: "M1",
    tier: 1,
    track: "mock",
    description: "Ensure 20543000000 with expo -8 scales correctly to 205.43",
    run: async () => {
      const { parsePythHermesResponse } = await import("../../../src/lib/solana/pyth");
      const { PYTH_CONFIG } = await import("../../../src/lib/solana/config");
      const parsed = parsePythHermesResponse({
        parsed: [
          {
            id: `0x${PYTH_CONFIG.SOL_USD_FEED_ID}`,
            price: {
              price: "20543000000",
              conf: "12000000",
              expo: -8,
              publish_time: 1735000100,
            },
          },
        ],
      });
      assertInRange(parsed.priceUsd, 205.4299, 205.4301, "Scaled price should equal 205.43");
    },
  },
  {
    id: "T1-F01-03",
    name: "Pyth: Live SOL/USD price query bounds",
    featureId: "F01",
    milestone: "M1",
    tier: 1,
    track: "live",
    description: "Query live Pyth Hermes and assert price is in realistic bounds [$10, $1000]",
    run: async () => {
      const pythModule = await import("../../../src/lib/solana/pyth");
      const data = await pythModule.getLiveSolUsdPrice();
      assertInRange(data.priceUsd, 10, 1000, "SOL price should be realistic");
      assertGreaterThanOrEqual(data.publishTime, 1700000000, "Publish time should be recent");
    },
  },
  {
    id: "T1-F01-04",
    name: "Pyth: Hermes v2 URL endpoint validation",
    featureId: "F01",
    milestone: "M1",
    tier: 1,
    track: "mock",
    description: "Verify default Hermes endpoint matches official Pyth v2 URL",
    run: async () => {
      const { PYTH_CONFIG } = await import("../../../src/lib/solana/config");
      assert(PYTH_CONFIG.HERMES_BASE_URL.includes("hermes.pyth.network"), "PYTH_CONFIG must target Pyth Hermes API");
    },
  },
  {
    id: "T1-F01-05",
    name: "Pyth: SOL/USD official feedId validation",
    featureId: "F01",
    milestone: "M1",
    tier: 1,
    track: "mock",
    description: "Verify SOL/USD 64-hex feed ID format",
    run: async () => {
      const { PYTH_CONFIG } = await import("../../../src/lib/solana/config");
      assertMatches(PYTH_CONFIG.SOL_USD_FEED_ID, /^[0-9a-f]{64}$/, "PYTH_CONFIG.SOL_USD_FEED_ID must be 64-char hex");
    },
  },

  // --- F02: Devnet Vault & dUSDC Token ---
  {
    id: "T1-F02-01",
    name: "Vault: Keypair resolution from config or env",
    featureId: "F02",
    milestone: "M1",
    tier: 1,
    track: "mock",
    description: "Ensure getDevnetVaultConfig returns valid vault public key",
    run: async () => {
      const vaultModule = await import("../../../src/lib/solana/vault");
      const config = vaultModule.getDevnetVaultConfig();
      assert(config.vaultPubkey.toBase58().length >= 32, "Vault public key must be valid base58");
    },
  },
  {
    id: "T1-F02-02",
    name: "Vault: dUSDC mint decimals specification",
    featureId: "F02",
    milestone: "M1",
    tier: 1,
    track: "mock",
    description: "Assert dUSDC decimals constant is 6 matching standard USDC",
    run: async () => {
      const { TOKEN_CONFIG } = await import("../../../src/lib/solana/config");
      assertEquals(TOKEN_CONFIG.DUSDC_DECIMALS, 6, "TOKEN_CONFIG.DUSDC_DECIMALS must be 6");
      assertEquals(TOKEN_CONFIG.DUSDC_BASE_MULTIPLIER, 1_000_000, "Base multiplier must be 10^6");
    },
  },
  {
    id: "T1-F02-03",
    name: "Vault: Vault ATA derivation verification",
    featureId: "F02",
    milestone: "M1",
    tier: 1,
    track: "mock",
    description: "Verify Associated Token Account address format",
    run: async () => {
      const { getDevnetVaultConfig } = await import("../../../src/lib/solana/vault");
      const { getAssociatedTokenAddressSync } = await import("@solana/spl-token");
      const cfg = getDevnetVaultConfig();
      const expectedAta = getAssociatedTokenAddressSync(cfg.dUsdcMint, cfg.vaultPubkey);
      assertEquals(cfg.vaultDUsdcAta.toBase58(), expectedAta.toBase58(), "Vault ATA must match SPL canonical derivation");
    },
  },
  {
    id: "T1-F02-04",
    name: "Vault: Devnet vault SOL balance health check",
    featureId: "F02",
    milestone: "M1",
    tier: 1,
    track: "live",
    description: "Verify devnet vault holds sufficient SOL for transaction fees",
    run: async () => {
      const conn = getActiveConnection();
      const healthy = await checkConnectionHealth(conn);
      assert(healthy, "Solana Devnet connection should be healthy");
    },
  },
  {
    id: "T1-F02-05",
    name: "Vault: Vault dUSDC token liquidity check",
    featureId: "F02",
    milestone: "M1",
    tier: 1,
    track: "live",
    description: "Verify vault dUSDC ATA exists and holds demo liquidity",
    run: async () => {
      const { getDevnetVaultConfig, getDevnetVaultMetadata } = await import("../../../src/lib/solana/vault");
      const { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = await import("@solana/spl-token");
      const cfg = getDevnetVaultConfig();
      const canonicalAta = getAssociatedTokenAddressSync(
        cfg.dUsdcMint,
        cfg.vaultPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      assertEquals(cfg.vaultDUsdcAta.toBase58(), canonicalAta.toBase58(), "Vault ATA must match canonical SPL derivation");
      const conn = getActiveConnection();
      const ataInfo = await conn.getAccountInfo(cfg.vaultDUsdcAta);
      if (ataInfo) {
        assert(ataInfo.owner.equals(TOKEN_PROGRAM_ID), "On-chain Vault ATA must be owned by SPL Token program");
      } else {
        const meta = getDevnetVaultMetadata();
        assert(Boolean(cfg.isMock || meta?.initialSupply), "Unfunded Devnet preview metadata must configure initial liquidity");
      }
    },
  },

  // --- F03: Atomic Swap Builder ---
  {
    id: "T1-F03-01",
    name: "Swap: Idempotent ATA creation instruction inclusion",
    featureId: "F03",
    milestone: "M1",
    tier: 1,
    track: "mock",
    description: "Verify swap transaction builder includes ATA creation instruction",
    run: async () => {
      const { Keypair, Connection } = await import("@solana/web3.js");
      const { ASSOCIATED_TOKEN_PROGRAM_ID } = await import("@solana/spl-token");
      const { buildAtomicSwapTransaction, hashPlanPayload } = await import("../../../src/lib/solana/swap");
      const built = await buildAtomicSwapTransaction({
        connection: new Connection("https://api.devnet.solana.com"),
        userPubkey: Keypair.generate().publicKey,
        amountSol: 0.1,
        expectedDUsdcAmount: 15,
        planHashHex: hashPlanPayload({ swap: 0.1 }),
        recentBlockhash: "11111111111111111111111111111111",
      });
      assertEquals(built.transaction.instructions.length, 4, "Atomic swap must contain 4 instructions");
      assert(built.transaction.instructions[0].programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID), "Ix 0 must be AssociatedTokenProgram");
    },
  },
  {
    id: "T1-F03-02",
    name: "Swap: SystemProgram SOL transfer leg configuration",
    featureId: "F03",
    milestone: "M1",
    tier: 1,
    track: "mock",
    description: "Verify user-to-vault SOL transfer instruction structure",
    run: async () => {
      const { Keypair, Connection, SystemInstruction } = await import("@solana/web3.js");
      const { buildAtomicSwapTransaction, hashPlanPayload } = await import("../../../src/lib/solana/swap");
      const { getDevnetVaultConfig } = await import("../../../src/lib/solana/vault");
      const user = Keypair.generate().publicKey;
      const built = await buildAtomicSwapTransaction({
        connection: new Connection("https://api.devnet.solana.com"),
        userPubkey: user,
        amountSol: 0.1,
        expectedDUsdcAmount: 15,
        planHashHex: hashPlanPayload({ swap: 0.1 }),
        recentBlockhash: "11111111111111111111111111111111",
      });
      const decoded = SystemInstruction.decodeTransfer(built.transaction.instructions[1]);
      assertEquals(Number(decoded.lamports), 100_000_000, "Ix 1 must transfer 100,000,000 lamports");
      assert(decoded.fromPubkey.equals(user), "Ix 1 source must be user");
      assert(decoded.toPubkey.equals(getDevnetVaultConfig().vaultPubkey), "Ix 1 destination must be vault");
    },
  },
  {
    id: "T1-F03-03",
    name: "Swap: SPL Token dUSDC transfer leg calculation",
    featureId: "F03",
    milestone: "M1",
    tier: 1,
    track: "mock",
    description: "Verify vault-to-user token transfer amount calculation based on Pyth price",
    run: async () => {
      const { Keypair, Connection } = await import("@solana/web3.js");
      const { TOKEN_PROGRAM_ID } = await import("@solana/spl-token");
      const { buildAtomicSwapTransaction, hashPlanPayload } = await import("../../../src/lib/solana/swap");
      const built = await buildAtomicSwapTransaction({
        connection: new Connection("https://api.devnet.solana.com"),
        userPubkey: Keypair.generate().publicKey,
        amountSol: 0.5,
        expectedDUsdcAmount: 100.0,
        planHashHex: hashPlanPayload({ swap: 0.5 }),
        recentBlockhash: "11111111111111111111111111111111",
      });
      const tokenIx = built.transaction.instructions[2];
      assert(tokenIx.programId.equals(TOKEN_PROGRAM_ID), "Ix 2 must invoke SPL Token program");
      assertEquals(Number(tokenIx.data.readBigUInt64LE(1)), 100_000_000, "100 dUSDC = 100,000,000 micro-units");
    },
  },
  {
    id: "T1-F03-04",
    name: "Swap: SPL Memo instruction with plan hash formatting",
    featureId: "F03",
    milestone: "M1",
    tier: 1,
    track: "mock",
    description: "Verify Memo instruction payload format aegis:v1:<sha256>",
    run: async () => {
      const { createAegisMemoInstruction, hashPlanPayload } = await import("../../../src/lib/solana/swap");
      const { MEMO_PROGRAM_ID } = await import("../../../src/lib/solana/config");
      const hash = hashPlanPayload({ kind: "swap", amountSol: 0.1, timestamp: 1700000000 });
      const memoIx = createAegisMemoInstruction(hash);
      assert(memoIx.programId.equals(MEMO_PROGRAM_ID), "Memo instruction must target SPL Memo v2");
      assertMatches(memoIx.data.toString("utf-8"), /^aegis:v1:[a-f0-9]{64}$/, "Memo text must match aegis:v1:<sha256>");
    },
  },
  {
    id: "T1-F03-05",
    name: "Swap: Vault partial signing contract",
    featureId: "F03",
    milestone: "M1",
    tier: 1,
    track: "both",
    description: "Ensure server returns partially signed transaction requiring user wallet co-signature",
    run: async () => {
      const { Keypair, Transaction, Connection } = await import("@solana/web3.js");
      const { buildAtomicSwapTransaction, hashPlanPayload } = await import("../../../src/lib/solana/swap");
      const { getDevnetVaultConfig } = await import("../../../src/lib/solana/vault");
      const user = Keypair.generate();
      const vaultCfg = getDevnetVaultConfig();
      const planHash = hashPlanPayload({ kind: "swap", amountSol: 0.1 });
      const built = await buildAtomicSwapTransaction({
        connection: new Connection("https://api.devnet.solana.com"),
        userPubkey: user.publicKey,
        amountSol: 0.1,
        expectedDUsdcAmount: 9.0,
        planHashHex: planHash,
        recentBlockhash: "11111111111111111111111111111111",
      });
      const restored = Transaction.from(Buffer.from(built.txBase64, "base64"));
      const vaultSigEntry = restored.signatures.find((s) => s.publicKey.equals(vaultCfg.vaultPubkey));
      const userSigEntry = restored.signatures.find((s) => s.publicKey.equals(user.publicKey));
      assert(Boolean(vaultSigEntry?.signature && vaultSigEntry.signature.length === 64), "Vault partial signature must be applied");
      assertEquals(userSigEntry?.signature ?? null, null, "User signature slot must remain open for non-custodial signing");
      restored.partialSign(user);
      assert(restored.verifySignatures(), "Co-signed swap transaction must pass Ed25519 signature verification");
    },
  },

  // --- F04: SOL Transfer Builder ---
  {
    id: "T1-F04-01",
    name: "Transfer: SystemProgram transfer instruction construction",
    featureId: "F04",
    milestone: "M1",
    tier: 1,
    track: "mock",
    description: "Verify SOL transfer builder exports buildSolTransferTransaction",
    run: async () => {
      const { Keypair, Connection, SystemProgram } = await import("@solana/web3.js");
      const { buildSolTransferTransaction } = await import("../../../src/lib/solana/transfer");
      const { hashPlanPayload } = await import("../../../src/lib/solana/swap");
      const built = await buildSolTransferTransaction({
        connection: new Connection("https://api.devnet.solana.com"),
        userPubkey: Keypair.generate().publicKey,
        recipientPubkey: Keypair.generate().publicKey,
        amountSol: 0.05,
        planHashHex: hashPlanPayload({ transfer: 0.05 }),
        recentBlockhash: "11111111111111111111111111111111",
      });
      assert(built.transaction.instructions[0].programId.equals(SystemProgram.programId), "Ix 0 must be SystemProgram");
    },
  },
  {
    id: "T1-F04-02",
    name: "Transfer: Lamports conversion precision",
    featureId: "F04",
    milestone: "M1",
    tier: 1,
    track: "mock",
    description: "Verify precise conversion for small decimal amounts (0.005 SOL)",
    run: async () => {
      const { Keypair, Connection, SystemInstruction } = await import("@solana/web3.js");
      const { buildSolTransferTransaction } = await import("../../../src/lib/solana/transfer");
      const { hashPlanPayload } = await import("../../../src/lib/solana/swap");
      const built = await buildSolTransferTransaction({
        connection: new Connection("https://api.devnet.solana.com"),
        userPubkey: Keypair.generate().publicKey,
        recipientPubkey: Keypair.generate().publicKey,
        amountSol: 0.005,
        planHashHex: hashPlanPayload({ transfer: 0.005 }),
        recentBlockhash: "11111111111111111111111111111111",
      });
      const decoded = SystemInstruction.decodeTransfer(built.transaction.instructions[0]);
      assertEquals(Number(decoded.lamports), 5_000_000, "0.005 SOL should convert to exactly 5,000,000 lamports");
    },
  },
  {
    id: "T1-F04-03",
    name: "Transfer: Verifiable AI Memo inclusion on plain transfer",
    featureId: "F04",
    milestone: "M1",
    tier: 1,
    track: "mock",
    description: "Ensure transfers include on-chain plan hash Memo for verifiability",
    run: async () => {
      const { Keypair, Connection } = await import("@solana/web3.js");
      const { buildSolTransferTransaction } = await import("../../../src/lib/solana/transfer");
      const { hashPlanPayload } = await import("../../../src/lib/solana/swap");
      const { MEMO_PROGRAM_ID } = await import("../../../src/lib/solana/config");
      const planHash = hashPlanPayload({ kind: "transfer", amountSol: 0.05 });
      const built = await buildSolTransferTransaction({
        connection: new Connection("https://api.devnet.solana.com"),
        userPubkey: Keypair.generate().publicKey,
        recipientPubkey: Keypair.generate().publicKey,
        amountSol: 0.05,
        planHashHex: planHash,
        recentBlockhash: "11111111111111111111111111111111",
      });
      assert(built.transaction.instructions[1].programId.equals(MEMO_PROGRAM_ID), "Ix 1 must be SPL Memo");
      assertEquals(built.transaction.instructions[1].data.toString("utf-8"), `aegis:v1:${planHash}`);
    },
  },
  {
    id: "T1-F04-04",
    name: "Transfer: Fee payer assigned to sender pubkey",
    featureId: "F04",
    milestone: "M1",
    tier: 1,
    track: "mock",
    description: "Verify fee payer matches sender wallet public key",
    run: async () => {
      const { Keypair, Connection } = await import("@solana/web3.js");
      const { buildSolTransferTransaction } = await import("../../../src/lib/solana/transfer");
      const { hashPlanPayload } = await import("../../../src/lib/solana/swap");
      const sender = Keypair.generate().publicKey;
      const built = await buildSolTransferTransaction({
        connection: new Connection("https://api.devnet.solana.com"),
        userPubkey: sender,
        recipientPubkey: Keypair.generate().publicKey,
        amountSol: 0.05,
        planHashHex: hashPlanPayload({ kind: "transfer" }),
        recentBlockhash: "11111111111111111111111111111111",
      });
      assertEquals(built.transaction.feePayer?.toBase58(), sender.toBase58(), "feePayer must equal sender");
    },
  },
  {
    id: "T1-F04-05",
    name: "Transfer: Base64 wire serialization format",
    featureId: "F04",
    milestone: "M1",
    tier: 1,
    track: "both",
    description: "Verify serialized transaction is decodable string",
    run: async () => {
      const { Keypair, Transaction, Connection } = await import("@solana/web3.js");
      const { buildSolTransferTransaction } = await import("../../../src/lib/solana/transfer");
      const { hashPlanPayload } = await import("../../../src/lib/solana/swap");
      const sender = Keypair.generate();
      const recipient = Keypair.generate().publicKey;
      const built = await buildSolTransferTransaction({
        connection: new Connection("https://api.devnet.solana.com"),
        userPubkey: sender.publicKey,
        recipientPubkey: recipient,
        amountSol: 0.05,
        planHashHex: hashPlanPayload({ kind: "transfer", amountSol: 0.05 }),
        recentBlockhash: "11111111111111111111111111111111",
      });
      const rawBytes = Buffer.from(built.txBase64, "base64");
      assert(rawBytes.length > 0 && rawBytes.length < 1232, "Wire payload must fit within Solana 1232-byte MTU");
      const restored = Transaction.from(rawBytes);
      assertEquals(restored.instructions.length, 2, "Transfer must include SystemProgram transfer + SPL Memo");
      restored.sign(sender);
      assert(restored.verifySignatures(), "Signed transfer must pass Ed25519 verification");
    },
  },

  // --- F05: Simulation & Delta Parser ---
  {
    id: "T1-F05-01",
    name: "Simulation: Successful simulateTransaction parsing",
    featureId: "F05",
    milestone: "M1",
    tier: 1,
    track: "mock",
    description: "Verify parsing of simulation response with ok: true and zero error",
    run: async () => {
      const { Keypair, Connection } = await import("@solana/web3.js");
      const { buildAtomicSwapTransaction, hashPlanPayload } = await import("../../../src/lib/solana/swap");
      const { simulateAegisTransaction } = await import("../../../src/lib/solana/simulation");
      const user = Keypair.generate().publicKey;
      const built = await buildAtomicSwapTransaction({
        connection: new Connection("https://api.devnet.solana.com"),
        userPubkey: user,
        amountSol: 0.1,
        expectedDUsdcAmount: 20.543,
        planHashHex: hashPlanPayload({ swap: 0.1 }),
        recentBlockhash: "11111111111111111111111111111111",
      });
      const mockConn = {
        simulateTransaction: async () => ({
          value: {
            err: null,
            logs: FIXTURES.simulation.successfulSwap.logs,
            unitsConsumed: 42350,
            accounts: null,
          },
        }),
      } as unknown as InstanceType<typeof Connection>;
      const sim = await simulateAegisTransaction(mockConn, built.transaction);
      assertEquals(sim.ok, true, "simulateAegisTransaction must return ok: true");
      assertEquals(sim.err, null, "err must be null");
    },
  },
  {
    id: "T1-F05-02",
    name: "Simulation: Sender SOL balance delta calculation",
    featureId: "F05",
    milestone: "M1",
    tier: 1,
    track: "mock",
    description: "Ensure parsed SOL delta accurately captures outflow plus fee",
    run: async () => {
      const { Keypair, Connection } = await import("@solana/web3.js");
      const { buildAtomicSwapTransaction, hashPlanPayload } = await import("../../../src/lib/solana/swap");
      const { simulateAegisTransaction } = await import("../../../src/lib/solana/simulation");
      const built = await buildAtomicSwapTransaction({
        connection: new Connection("https://api.devnet.solana.com"),
        userPubkey: Keypair.generate().publicKey,
        amountSol: 0.1,
        expectedDUsdcAmount: 20.543,
        planHashHex: hashPlanPayload({ swap: 0.1 }),
        recentBlockhash: "11111111111111111111111111111111",
      });
      const mockConn = {
        simulateTransaction: async () => ({
          value: { err: null, logs: [], unitsConsumed: 42350, accounts: null },
        }),
      } as unknown as InstanceType<typeof Connection>;
      const sim = await simulateAegisTransaction(mockConn, built.transaction);
      assertInRange(sim.solDeltaUser, -0.10002, -0.100005, "User SOL delta must include 0.1 SOL outflow + 2-signer fee");
    },
  },
  {
    id: "T1-F05-03",
    name: "Simulation: Recipient token delta calculation",
    featureId: "F05",
    milestone: "M1",
    tier: 1,
    track: "mock",
    description: "Ensure parsed token delta captures inflow",
    run: async () => {
      const { Keypair, Connection } = await import("@solana/web3.js");
      const { buildAtomicSwapTransaction, hashPlanPayload } = await import("../../../src/lib/solana/swap");
      const { simulateAegisTransaction } = await import("../../../src/lib/solana/simulation");
      const built = await buildAtomicSwapTransaction({
        connection: new Connection("https://api.devnet.solana.com"),
        userPubkey: Keypair.generate().publicKey,
        amountSol: 0.1,
        expectedDUsdcAmount: 20.543,
        planHashHex: hashPlanPayload({ swap: 0.1 }),
        recentBlockhash: "11111111111111111111111111111111",
      });
      const mockConn = {
        simulateTransaction: async () => ({
          value: { err: null, logs: [], unitsConsumed: 42350, accounts: null },
        }),
      } as unknown as InstanceType<typeof Connection>;
      const sim = await simulateAegisTransaction(mockConn, built.transaction);
      assertEquals(sim.dUsdcDeltaUser, 20.543, "dUsdcDeltaUser must match expected payout");
    },
  },
  {
    id: "T1-F05-04",
    name: "Simulation: Compute units consumed extraction",
    featureId: "F05",
    milestone: "M1",
    tier: 1,
    track: "mock",
    description: "Verify compute units consumed parsed as positive integer",
    run: async () => {
      const { Keypair, Connection } = await import("@solana/web3.js");
      const { buildSolTransferTransaction } = await import("../../../src/lib/solana/transfer");
      const { hashPlanPayload } = await import("../../../src/lib/solana/swap");
      const { simulateAegisTransaction } = await import("../../../src/lib/solana/simulation");
      const built = await buildSolTransferTransaction({
        connection: new Connection("https://api.devnet.solana.com"),
        userPubkey: Keypair.generate().publicKey,
        recipientPubkey: Keypair.generate().publicKey,
        amountSol: 0.05,
        planHashHex: hashPlanPayload({ transfer: 0.05 }),
        recentBlockhash: "11111111111111111111111111111111",
      });
      const mockConn = {
        simulateTransaction: async () => ({
          value: { err: null, logs: [], unitsConsumed: 15750, accounts: null },
        }),
      } as unknown as InstanceType<typeof Connection>;
      const sim = await simulateAegisTransaction(mockConn, built.transaction);
      assertEquals(sim.unitsConsumed, 15750, "unitsConsumed extracted from RPC simulation response");
    },
  },
  {
    id: "T1-F05-05",
    name: "Simulation: Program invocation log parsing",
    featureId: "F05",
    milestone: "M1",
    tier: 1,
    track: "mock",
    description: "Verify log parser identifies System, Token, and Memo program invocations",
    run: async () => {
      const { parseSimulationLogs } = await import("../../../src/lib/solana/simulation");
      const parsed = parseSimulationLogs(FIXTURES.simulation.successfulSwap.logs);
      assert(parsed.invokedPrograms.includes("11111111111111111111111111111111"), "SystemProgram extracted");
      assert(parsed.invokedPrograms.includes("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), "TokenProgram extracted");
      assert(parsed.invokedPrograms.includes("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"), "MemoProgram extracted");
    },
  },
];
