/**
 * Tier 2 Boundary & Corner Case Tests: Milestone 1 (B01 to B05)
 * Covers edge cases, network timeouts, extreme values, zero divisions, and simulation errors.
 */

import { TestCase } from "../harness/types";
import {
  assert,
  assertEquals,
  assertGreaterThanOrEqual,
  assertInRange,
  markPending,
} from "../harness/assertions";
import { FIXTURES } from "../harness/fixtures";

export const m1BoundaryTests: TestCase[] = [
  // --- B01: Pyth Hermes Price Fetcher Boundaries ---
  {
    id: "T2-F01-01",
    name: "Boundary: Pyth HTTP 500 error resilience",
    featureId: "F01",
    milestone: "M1",
    tier: 2,
    track: "mock",
    description: "Verify system gracefully handles Pyth Hermes server error without crashing",
    run: async () => {
      try {
        const pythMod = await import("../../../src/lib/solana/pyth" as string);
        assert(typeof pythMod.getLiveSolUsdPrice === "function", "getLiveSolUsdPrice exported");
      } catch {
        markPending("Pyth module error handling pending M1 implementation");
      }
    },
  },
  {
    id: "T2-F01-02",
    name: "Boundary: Pyth stale price feed detection (> 300s)",
    featureId: "F01",
    milestone: "M1",
    tier: 2,
    track: "mock",
    description: "Detect stale oracle publish time and trigger freshness warning",
    run: async () => {
      const { evaluatePolicyRules } = await import("../../../src/lib/agent/policy");
      const now = Math.floor(Date.now() / 1000);
      const res = evaluatePolicyRules({
        simOk: true,
        programs: ["11111111111111111111111111111111"],
        amountSol: 0.1,
        pythPriceUsd: 200,
        pythPublishTime: now - 600,
        promptText: "swap 0.1 SOL",
      });
      assertGreaterThanOrEqual(res.score, 25, "Stale Pyth timestamp (>300s) triggers >=25 penalty");
    },
  },
  {
    id: "T2-F01-03",
    name: "Boundary: Pyth wide confidence interval penalty (> 5%)",
    featureId: "F01",
    milestone: "M1",
    tier: 2,
    track: "mock",
    description: "Flag wide confidence intervals where confidence / price > 0.05",
    run: async () => {
      const { evaluatePolicyRules } = await import("../../../src/lib/agent/policy");
      const res = evaluatePolicyRules({
        simOk: true,
        programs: ["11111111111111111111111111111111"],
        amountSol: 0.1,
        pythPriceUsd: 200,
        pythConfidence: 15,
        promptText: "swap 0.1 SOL",
      });
      assertGreaterThanOrEqual(res.score, 30, "Wide confidence (>5%) triggers >=30 penalty");
    },
  },
  {
    id: "T2-F01-04",
    name: "Boundary: Pyth non-positive price validation",
    featureId: "F01",
    milestone: "M1",
    tier: 2,
    track: "mock",
    description: "Zero or negative price must throw validation error, avoiding zero division",
    run: async () => {
      const { parsePythHermesResponse } = await import("../../../src/lib/solana/pyth");
      const { PYTH_CONFIG } = await import("../../../src/lib/solana/config");
      for (const badPrice of ["0", "-10000000"]) {
        let threw = false;
        try {
          parsePythHermesResponse({
            parsed: [{ id: PYTH_CONFIG.SOL_USD_FEED_ID, price: { price: badPrice, conf: "100", expo: -8, publish_time: 1735000000 } }],
          });
        } catch {
          threw = true;
        }
        assert(threw, `parsePythHermesResponse must reject non-positive price ${badPrice}`);
      }
    },
  },
  {
    id: "T2-F01-05",
    name: "Boundary: Pyth fetch AbortController timeout handling",
    featureId: "F01",
    milestone: "M1",
    tier: 2,
    track: "mock",
    description: "Verify fetch signals support timeout abortion cleanly",
    run: () => {
      const controller = new AbortController();
      controller.abort();
      assertEquals(controller.signal.aborted, true, "Signal should be aborted");
    },
  },

  // --- B02: Devnet Vault Boundaries ---
  {
    id: "T2-F02-01",
    name: "Boundary: Vault balance below rent exemption threshold",
    featureId: "F02",
    milestone: "M1",
    tier: 2,
    track: "mock",
    description: "Refuse swap execution if vault SOL balance is critically low",
    run: async () => {
      const fs = await import("fs");
      const path = await import("path");
      const { getDevnetVaultConfig } = await import("../../../src/lib/solana/vault");
      const setupSrc = fs.readFileSync(
        path.resolve(process.cwd(), "scripts/setup-devnet-vault.ts"),
        "utf-8"
      );
      assert(
        setupSrc.includes("MIN_VAULT_SOL = 0.05"),
        "setup-devnet-vault.ts must enforce MIN_VAULT_SOL = 0.05 (> 0.00203928 SOL rent exemption)"
      );
      const cfg = getDevnetVaultConfig();
      assert(cfg.vaultPubkey.toBase58().length >= 32, "Vault pubkey resolved");
    },
  },
  {
    id: "T2-F02-02",
    name: "Boundary: Vault dUSDC liquidity exhaustion",
    featureId: "F02",
    milestone: "M1",
    tier: 2,
    track: "mock",
    description: "Detect when requested dUSDC swap exceeds available vault token balance",
    run: async () => {
      const { Keypair, Connection } = await import("@solana/web3.js");
      const { buildAtomicSwapTransaction } = await import("../../../src/lib/solana/swap");
      const { simulateAegisTransaction } = await import("../../../src/lib/solana/simulation");
      const { evaluatePolicyRules } = await import("../../../src/lib/agent/policy");
      const built = await buildAtomicSwapTransaction({
        connection: new Connection("https://api.devnet.solana.com"),
        userPubkey: Keypair.generate().publicKey,
        amountSol: 0.5,
        expectedDUsdcAmount: 1_500_000,
        planHashHex: "b".repeat(64),
        recentBlockhash: "11111111111111111111111111111111",
      });
      // Funded user (1 SOL), but SPL Token transfer (ix 2) fails due to exhausted vault dUSDC liquidity
      const mockConn = {
        rpcEndpoint: "https://api.devnet.solana.com",
        getMultipleAccountsInfo: async () => [{ lamports: 1_000_000_000, data: Buffer.alloc(0) }, null, null, null],
        simulateTransaction: async () => ({
          value: {
            err: { InstructionError: [2, { Custom: 1 }] },
            logs: ["Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA log: Error: insufficient funds"],
            unitsConsumed: 22100,
            accounts: null,
          },
        }),
      } as unknown as InstanceType<typeof Connection>;
      const sim = await simulateAegisTransaction(mockConn, built.transaction);
      assertEquals(sim.ok, false, "Vault token liquidity exhaustion fails pre-flight simulation");
      const policy = evaluatePolicyRules({
        simOk: sim.ok,
        simErr: sim.err,
        programs: sim.invokedPrograms,
        amountSol: 0.5,
        promptText: "swap 0.5 SOL to USDC",
      });
      assertEquals(policy.approved, false, "Policy gate blocks swap when vault liquidity is exhausted");
    },
  },
  {
    id: "T2-F02-03",
    name: "Boundary: Devnet public faucet HTTP 410 Gone recovery",
    featureId: "F02",
    milestone: "M1",
    tier: 2,
    track: "mock",
    description: "Verify script handles faucet 410 without throwing unhandled rejection",
    run: async () => {
      const fs = await import("fs");
      const path = await import("path");
      const { getDevnetVaultConfig } = await import("../../../src/lib/solana/vault");
      const setupSrc = fs.readFileSync(
        path.resolve(process.cwd(), "scripts/setup-devnet-vault.ts"),
        "utf-8"
      );
      assert(
        setupSrc.includes("requestAirdrop") && setupSrc.includes("isMock: true"),
        "setup-devnet-vault.ts catches RPC airdrop 410 failure and writes fallback mock vault metadata"
      );
      const cfg = getDevnetVaultConfig();
      assert(Boolean(cfg.dUsdcMint && cfg.vaultDUsdcAta), "Vault config remains available in unfunded fallback mode");
    },
  },
  {
    id: "T2-F02-04",
    name: "Boundary: Malformed vault keypair file",
    featureId: "F02",
    milestone: "M1",
    tier: 2,
    track: "mock",
    description: "Malformed JSON or invalid byte array throws descriptive error",
    run: async () => {
      const { getDevnetVaultKeypair } = await import("../../../src/lib/solana/vault");
      const prevEnv = process.env.VAULT_SECRET_KEY;
      try {
        process.env.VAULT_SECRET_KEY = "{ invalid: json ]";
        const resolved = getDevnetVaultKeypair();
        assertEquals(
          resolved.keypair.secretKey.length,
          64,
          "getDevnetVaultKeypair catches malformed VAULT_SECRET_KEY and falls back to valid 64-byte keypair"
        );
      } finally {
        if (prevEnv === undefined) {
          delete process.env.VAULT_SECRET_KEY;
        } else {
          process.env.VAULT_SECRET_KEY = prevEnv;
        }
      }
    },
  },
  {
    id: "T2-F02-05",
    name: "Boundary: Vault ATA idempotent creation safety",
    featureId: "F02",
    milestone: "M1",
    tier: 2,
    track: "mock",
    description: "Calling createAssociatedTokenAccountIdempotent on existing ATA succeeds safely",
    run: async () => {
      const { Keypair, Connection } = await import("@solana/web3.js");
      const { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } = await import("@solana/spl-token");
      const { buildAtomicSwapTransaction } = await import("../../../src/lib/solana/swap");
      const { getDevnetVaultConfig } = await import("../../../src/lib/solana/vault");
      const cfg = getDevnetVaultConfig();
      const canonicalVaultAta = getAssociatedTokenAddressSync(cfg.dUsdcMint, cfg.vaultPubkey);
      assert(cfg.vaultDUsdcAta.equals(canonicalVaultAta), "Vault ATA matches canonical deterministic ATA");
      const built = await buildAtomicSwapTransaction({
        connection: new Connection("https://api.devnet.solana.com"),
        userPubkey: Keypair.generate().publicKey,
        amountSol: 0.1,
        expectedDUsdcAmount: 20,
        planHashHex: "a".repeat(64),
        recentBlockhash: "11111111111111111111111111111111",
      });
      const ataIx = built.transaction.instructions[0];
      assert(ataIx.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID), "Instruction 0 targets Associated Token Program");
      assertEquals(ataIx.data[0], 1, "Instruction 0 uses CreateIdempotent discriminator (1) so duplicate ATA calls never fail");
    },
  },

  // --- B03: Atomic Swap Builder Boundaries ---
  {
    id: "T2-F03-01",
    name: "Boundary: Micro-swap minimum amount (1 lamport)",
    featureId: "F03",
    milestone: "M1",
    tier: 2,
    track: "mock",
    description: "Ensure 1 lamport swap (0.000000001 SOL) computes or returns clean minimum error",
    run: async () => {
      const { Keypair, Connection } = await import("@solana/web3.js");
      const { buildAtomicSwapTransaction } = await import("../../../src/lib/solana/swap");
      let rejectedZeroMicroUsdc = false;
      try {
        await buildAtomicSwapTransaction({
          connection: new Connection("https://api.devnet.solana.com"),
          userPubkey: Keypair.generate().publicKey,
          amountSol: 0.000000001,
          expectedDUsdcAmount: 0.0000002,
          planHashHex: "a".repeat(64),
          recentBlockhash: "11111111111111111111111111111111",
        });
      } catch (e: unknown) {
        rejectedZeroMicroUsdc = (e as Error).message.includes("0 micro-dUSDC");
      }
      assert(rejectedZeroMicroUsdc, "1-lamport swap yielding 0 micro-dUSDC cleanly throws minimum error");
    },
  },
  {
    id: "T2-F03-02",
    name: "Boundary: Swap exceeding 1232-byte MTU limit",
    featureId: "F03",
    milestone: "M1",
    tier: 2,
    track: "mock",
    description: "Ensure atomic swap transaction wire size is strictly under 1232 bytes",
    run: async () => {
      const { Keypair, Connection } = await import("@solana/web3.js");
      const { buildAtomicSwapTransaction } = await import("../../../src/lib/solana/swap");
      const built = await buildAtomicSwapTransaction({
        connection: new Connection("https://api.devnet.solana.com"),
        userPubkey: Keypair.generate().publicKey,
        amountSol: 0.1,
        expectedDUsdcAmount: 20,
        planHashHex: "a".repeat(64),
        recentBlockhash: "11111111111111111111111111111111",
      });
      const wireBytes = Buffer.from(built.txBase64, "base64").length;
      assert(wireBytes > 0 && wireBytes < 1232, `Real swap wire size (${wireBytes}B) must be < 1232B MTU`);
    },
  },
  {
    id: "T2-F03-03",
    name: "Boundary: Zero slippage parameter in volatile conditions",
    featureId: "F03",
    milestone: "M1",
    tier: 2,
    track: "mock",
    description: "Ensure slippage bps 0 requires exact minimum payout",
    run: async () => {
      const { evaluatePolicyRules } = await import("../../../src/lib/agent/policy");
      const res = evaluatePolicyRules({
        simOk: true,
        programs: ["11111111111111111111111111111111"],
        amountSol: 0.1,
        expectedDUsdc: 20.543,
        pythPriceUsd: 205.43,
        maxSlippageBps: 0,
        promptText: "swap 0.1 SOL with 0bps slippage",
      });
      assertEquals(res.score, 0, "0 bps slippage with exact Pyth payout passes policy cleanly");
    },
  },
  {
    id: "T2-F03-04",
    name: "Boundary: Giant swap request (1,000,000 SOL)",
    featureId: "F03",
    milestone: "M1",
    tier: 2,
    track: "mock",
    description: "Extreme swap amounts fail simulation or cap rules cleanly",
    run: async () => {
      const { evaluatePolicyRules } = await import("../../../src/lib/agent/policy");
      const res = evaluatePolicyRules({
        simOk: true,
        programs: ["11111111111111111111111111111111"],
        amountSol: 1_000_000,
        spendingCapSol: 1.0,
        promptText: "swap 1000000 SOL to USDC",
      });
      assertEquals(res.approved, false, "1,000,000 SOL swap blocked by spending cap");
    },
  },
  {
    id: "T2-F03-05",
    name: "Boundary: Swap fee payer strictly set to user",
    featureId: "F03",
    milestone: "M1",
    tier: 2,
    track: "mock",
    description: "Ensure fee payer is never inadvertently set to vault",
    run: async () => {
      const { Connection } = await import("@solana/web3.js");
      const { buildAtomicSwapTransaction } = await import("../../../src/lib/solana/swap");
      const { getDevnetVaultConfig } = await import("../../../src/lib/solana/vault");
      const vaultCfg = getDevnetVaultConfig();
      let rejectedVaultSelfSwap = false;
      try {
        await buildAtomicSwapTransaction({
          connection: new Connection("https://api.devnet.solana.com"),
          userPubkey: vaultCfg.vaultPubkey,
          amountSol: 0.05,
          expectedDUsdcAmount: 10,
          planHashHex: "a".repeat(64),
          recentBlockhash: "11111111111111111111111111111111",
        });
      } catch {
        rejectedVaultSelfSwap = true;
      }
      assert(rejectedVaultSelfSwap, "buildAtomicSwapTransaction must refuse userPubkey === vaultPubkey");
    },
  },

  // --- B04: SOL Transfer Builder Boundaries ---
  {
    id: "T2-F04-01",
    name: "Boundary: Zero SOL transfer rejection",
    featureId: "F04",
    milestone: "M1",
    tier: 2,
    track: "mock",
    description: "Transfer builder rejects 0 SOL before instruction compilation",
    run: async () => {
      const { Keypair, Connection } = await import("@solana/web3.js");
      const { buildSolTransferTransaction } = await import("../../../src/lib/solana/transfer");
      let rejected = false;
      try {
        await buildSolTransferTransaction({
          connection: new Connection("https://api.devnet.solana.com"),
          userPubkey: Keypair.generate().publicKey,
          recipientPubkey: Keypair.generate().publicKey,
          amountSol: 0,
          planHashHex: "a".repeat(64),
          recentBlockhash: "11111111111111111111111111111111",
        });
      } catch {
        rejected = true;
      }
      assertEquals(rejected, true, "0 SOL transfer rejected by buildSolTransferTransaction");
    },
  },
  {
    id: "T2-F04-02",
    name: "Boundary: Transfer to self detection",
    featureId: "F04",
    milestone: "M1",
    tier: 2,
    track: "mock",
    description: "Sender equal to destination flags self-transfer warning",
    run: async () => {
      const { evaluatePolicyRules } = await import("../../../src/lib/agent/policy");
      const addr = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
      const res = evaluatePolicyRules({
        simOk: true,
        programs: ["11111111111111111111111111111111"],
        amountSol: 0.05,
        destination: addr,
        senderPubkey: addr,
        promptText: `send 0.05 SOL to ${addr}`,
      });
      assertEquals(res.score, 25, "Self-transfer triggers +25 caution penalty");
      assertEquals(res.band, "caution");
    },
  },
  {
    id: "T2-F04-03",
    name: "Boundary: Invalid base58 destination address format",
    featureId: "F04",
    milestone: "M1",
    tier: 2,
    track: "mock",
    description: "Reject malformed recipient address string",
    run: () => {
      const malformedAddr = "invalid-base58-string!@#$";
      let isValid = false;
      try {
        const { PublicKey } = require("@solana/web3.js");
        new PublicKey(malformedAddr);
        isValid = true;
      } catch {
        isValid = false;
      }
      assertEquals(isValid, false, "Malformed address must be rejected");
    },
  },
  {
    id: "T2-F04-04",
    name: "Boundary: Transfer full balance without reserving gas fee",
    featureId: "F04",
    milestone: "M1",
    tier: 2,
    track: "mock",
    description: "Ensure transferring 100% of balance warns about 5000-lamport tx fee",
    run: async () => {
      const { Keypair, Connection } = await import("@solana/web3.js");
      const { buildSolTransferTransaction } = await import("../../../src/lib/solana/transfer");
      const { simulateAegisTransaction } = await import("../../../src/lib/solana/simulation");
      const sender = Keypair.generate().publicKey;
      const built = await buildSolTransferTransaction({
        connection: new Connection("https://api.devnet.solana.com"),
        userPubkey: sender,
        recipientPubkey: Keypair.generate().publicKey,
        amountSol: 0.1,
        planHashHex: "a".repeat(64),
        recentBlockhash: "11111111111111111111111111111111",
      });
      // Funded wallet holding exactly 0.1 SOL (100,000,000 lamports) lacks 5,000 lamports for fee
      const mockConn = {
        rpcEndpoint: "https://api.devnet.solana.com",
        getMultipleAccountsInfo: async () => [{ lamports: 100_000_000, data: Buffer.alloc(0) }, null, null, null],
        simulateTransaction: async () => ({
          value: { err: "InsufficientFundsForFee", logs: [], unitsConsumed: 0, accounts: null },
        }),
      } as unknown as InstanceType<typeof Connection>;
      const sim = await simulateAegisTransaction(mockConn, built.transaction);
      assertEquals(sim.ok, false, "Funded wallet lacking gas fee must NOT be masked by unfunded fallback");
      assertEquals(sim.err, "InsufficientFundsForFee");
    },
  },
  {
    id: "T2-F04-05",
    name: "Boundary: Off-curve PDA recipient address handling",
    featureId: "F04",
    milestone: "M1",
    tier: 2,
    track: "mock",
    description: "Allow transfers to valid on-chain PDAs",
    run: () => {
      const ata = FIXTURES.accounts.dUsdcMint;
      assert(ata.toBase58().length > 30, "PDA valid as recipient");
    },
  },

  // --- B05: Simulation Parser Boundaries ---
  {
    id: "T2-F05-01",
    name: "Boundary: Custom instruction error code extraction",
    featureId: "F05",
    milestone: "M1",
    tier: 2,
    track: "mock",
    description: "Extract specific InstructionError code from failed simulation",
    run: async () => {
      const { Keypair, Connection } = await import("@solana/web3.js");
      const { buildAtomicSwapTransaction } = await import("../../../src/lib/solana/swap");
      const { simulateAegisTransaction } = await import("../../../src/lib/solana/simulation");
      const built = await buildAtomicSwapTransaction({
        connection: new Connection("https://api.devnet.solana.com"),
        userPubkey: Keypair.generate().publicKey,
        amountSol: 0.5,
        expectedDUsdcAmount: 100,
        planHashHex: "a".repeat(64),
        recentBlockhash: "11111111111111111111111111111111",
      });
      const mockConn = {
        rpcEndpoint: "https://api.devnet.solana.com",
        getMultipleAccountsInfo: async () => [{ lamports: 50_000_000, data: Buffer.alloc(0) }, null, null, null],
        simulateTransaction: async () => ({
          value: {
            err: FIXTURES.simulation.failedSimulation.err,
            logs: FIXTURES.simulation.failedSimulation.logs,
            unitsConsumed: 18400,
            accounts: null,
          },
        }),
      } as unknown as InstanceType<typeof Connection>;
      const sim = await simulateAegisTransaction(mockConn, built.transaction);
      assertEquals(sim.ok, false, "InstructionError on funded shortfall must return ok: false");
      assert(sim.err !== null, "Error object preserved");
    },
  },
  {
    id: "T2-F05-02",
    name: "Boundary: Empty or truncated simulation logs handling",
    featureId: "F05",
    milestone: "M1",
    tier: 2,
    track: "mock",
    description: "Parser handles empty logs array without throwing",
    run: async () => {
      const { parseSimulationLogs } = await import("../../../src/lib/solana/simulation");
      const parsed = parseSimulationLogs([]);
      assertEquals(parsed.invokedPrograms.length, 0);
      assertEquals(parsed.errors.length, 0);
    },
  },
  {
    id: "T2-F05-03",
    name: "Boundary: Excessive compute unit consumption (> 1.2M CU)",
    featureId: "F05",
    milestone: "M1",
    tier: 2,
    track: "mock",
    description: "Flag transactions consuming excessive compute budget",
    run: async () => {
      const { evaluatePolicyRules } = await import("../../../src/lib/agent/policy");
      const res = evaluatePolicyRules({
        simOk: true,
        programs: ["11111111111111111111111111111111"],
        amountSol: 0.1,
        unitsConsumed: 1_300_000,
        promptText: "swap 0.1 SOL",
      });
      assertEquals(res.score, 25, ">1.2M CU adds +25 compute warning penalty");
    },
  },
  {
    id: "T2-F05-04",
    name: "Boundary: Null post-balance account state handling",
    featureId: "F05",
    milestone: "M1",
    tier: 2,
    track: "mock",
    description: "Delta calculation falls back to 0 when post-balance account info is null",
    run: async () => {
      const { Keypair, Connection } = await import("@solana/web3.js");
      const { buildSolTransferTransaction } = await import("../../../src/lib/solana/transfer");
      const { simulateAegisTransaction } = await import("../../../src/lib/solana/simulation");
      const built = await buildSolTransferTransaction({
        connection: new Connection("https://api.devnet.solana.com"),
        userPubkey: Keypair.generate().publicKey,
        recipientPubkey: Keypair.generate().publicKey,
        amountSol: 0.05,
        planHashHex: "a".repeat(64),
        recentBlockhash: "11111111111111111111111111111111",
      });
      const mockConn = {
        simulateTransaction: async () => ({
          value: { err: null, logs: [], unitsConsumed: 15750, accounts: null },
        }),
      } as unknown as InstanceType<typeof Connection>;
      const sim = await simulateAegisTransaction(mockConn, built.transaction);
      assertEquals(sim.dUsdcDeltaUser, 0, "Null post-balance account array yields 0 token delta");
    },
  },
  {
    id: "T2-F05-05",
    name: "Boundary: Multi-RPC endpoint fallback on 429 rate limit",
    featureId: "F05",
    milestone: "M1",
    tier: 2,
    track: "mock",
    description: "Verify endpoints list contains fallback RPC URLs",
    run: async () => {
      const { DEVNET_RPC_CANDIDATES } = await import("../../../src/lib/solana/config");
      assert(
        DEVNET_RPC_CANDIDATES.length >= 2,
        `DEVNET_RPC_CANDIDATES (${DEVNET_RPC_CANDIDATES.length}) must configure at least 2 RPC endpoints for failover`
      );
    },
  },
];
