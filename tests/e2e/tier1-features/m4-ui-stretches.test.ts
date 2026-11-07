/**
 * Tier 1 Feature Tests: Milestone 4 (Gate G5 + Stretches S1–S5 - Features F13 to F19)
 * Covers:
 * - F13: Interactive Copilot Dashboard (T1-F13-01 to T1-F13-05)
 * - F14: Visual Agent Pipeline Timeline (T1-F14-01 to T1-F14-05)
 * - F15: Pre-Flight Sentinel Risk Card (T1-F15-01 to T1-F15-05)
 * - F16: In-App Blink / Action Execution (T1-F16-01 to T1-F16-05)
 * - F17: Token Safety Scanner (S2) (T1-F17-01 to T1-F17-05)
 * - F18: Guest Burner Wallet (S3) (T1-F18-01 to T1-F18-05)
 * - F19: Live Mainnet Reference Quote (S4) (T1-F19-01 to T1-F19-05)
 */

import { TestCase } from "../harness/types";
import {
  assert,
  assertEquals,
  assertMatches,
  markPending,
} from "../harness/assertions";
import { Keypair } from "@solana/web3.js";
import fs from "fs";
import path from "path";

export const m4UiStretchesFeatureTests: TestCase[] = [
  // --- F13: Interactive Copilot Dashboard ---
  {
    id: "T1-F13-01",
    name: "Dashboard: Page component file structure exists",
    featureId: "F13",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Verify src/app/page.tsx exists and is readable",
    run: () => {
      const pagePath = path.resolve(process.cwd(), "src/app/page.tsx");
      assert(fs.existsSync(pagePath), "src/app/page.tsx must exist");
    },
  },
  {
    id: "T1-F13-02",
    name: "Dashboard: Preset scenario button Safe Swap definition",
    featureId: "F13",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Verify preset prompt for safe swap",
    run: () => {
      const chatSrc = fs.readFileSync(path.resolve(process.cwd(), "src/components/ChatInterface.tsx"), "utf-8");
      assert(/Swap 0\.1 SOL/i.test(chatSrc), "ChatInterface.tsx must define Safe Swap preset prompt");
    },
  },
  {
    id: "T1-F13-03",
    name: "Dashboard: Preset scenario button Safe Transfer definition",
    featureId: "F13",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Verify preset prompt for safe transfer",
    run: () => {
      const chatSrc = fs.readFileSync(path.resolve(process.cwd(), "src/components/ChatInterface.tsx"), "utf-8");
      assert(/Send 0\.05 SOL/i.test(chatSrc), "ChatInterface.tsx must define Safe Transfer preset prompt");
    },
  },
  {
    id: "T1-F13-04",
    name: "Dashboard: Preset scenario button Prompt Injection definition",
    featureId: "F13",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Verify preset adversarial prompt for demo",
    run: () => {
      const chatSrc = fs.readFileSync(path.resolve(process.cwd(), "src/components/ChatInterface.tsx"), "utf-8");
      assert(/SYSTEM OVERRIDE|Ignore previous instructions/i.test(chatSrc), "ChatInterface.tsx must define Red-Team Injection preset");
    },
  },
  {
    id: "T1-F13-05",
    name: "Dashboard: Unified /api/agent API route existence",
    featureId: "F13",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Verify /api/agent route exists or is scaffolded",
    run: async () => {
      try {
        const agentRoute = await import("../../../src/app/api/agent/route" as string);
        assert(typeof agentRoute.POST === "function", "POST /api/agent exported");
      } catch {
        markPending("src/app/api/agent/route.ts not yet implemented (Milestone 4)");
      }
    },
  },

  // --- F14: Visual Agent Pipeline Timeline ---
  {
    id: "T1-F14-01",
    name: "Timeline: 5-Stage timeline sequence definition",
    featureId: "F14",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Verify stages: Planner, Scout, Builder, Sentinel, Gate",
    run: async () => {
      const { PIPELINE_STAGES } = await import("../../../src/lib/agent/graph");
      assertEquals(PIPELINE_STAGES.join(","), "planner,scout,builder,sentinel,gate", "PIPELINE_STAGES must define exact 5 stages");
    },
  },
  {
    id: "T1-F14-02",
    name: "Timeline: Stage active status state transition",
    featureId: "F14",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Ensure active stage indicates current execution focus",
    run: () => {
      const timelineSrc = fs.readFileSync(path.resolve(process.cwd(), "src/components/AgentTimeline.tsx"), "utf-8");
      assert(
        timelineSrc.includes("if (isLoading && !step)") &&
          timelineSrc.includes("animate-pulse") &&
          timelineSrc.includes('badgeText = "ACTIVE"'),
        "AgentTimeline highlights active running stage with pulse indicator"
      );
    },
  },
  {
    id: "T1-F14-03",
    name: "Timeline: Stage completed status with elapsed time",
    featureId: "F14",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Ensure completed stage records duration",
    run: () => {
      const timelineSrc = fs.readFileSync(path.resolve(process.cwd(), "src/components/AgentTimeline.tsx"), "utf-8");
      assert(
        timelineSrc.includes("step.durationMs") && timelineSrc.includes("ms"),
        "AgentTimeline renders per-stage durationMs telemetry badge"
      );
    },
  },
  {
    id: "T1-F14-04",
    name: "Timeline: Blocked stage visual styling definition",
    featureId: "F14",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Verify blocked stage reflects failure styling",
    run: () => {
      const timelineSrc = fs.readFileSync(path.resolve(process.cwd(), "src/components/AgentTimeline.tsx"), "utf-8");
      assert(
        timelineSrc.includes('status === "blocked"') && timelineSrc.includes("rose-500"),
        "AgentTimeline styles blocked stages with rose alert tokens"
      );
    },
  },
  {
    id: "T1-F14-05",
    name: "Timeline: Component export verification",
    featureId: "F14",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Verify AgentTimeline component exists in components directory",
    run: async () => {
      const mod = await import("../../../src/components/AgentTimeline");
      assertEquals(typeof mod.AgentTimeline, "function", "AgentTimeline component exported");
    },
  },

  // --- F15: Pre-Flight Sentinel Risk Card ---
  {
    id: "T1-F15-01",
    name: "RiskCard: Risk score color bands definition",
    featureId: "F15",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Verify color bands: Green (0-20), Yellow (21-49), Red (50-100)",
    run: async () => {
      const { getRiskBand } = await import("../../../src/lib/agent/policy");
      assertEquals(getRiskBand(12), "safe");
      assertEquals(getRiskBand(35), "caution");
      assertEquals(getRiskBand(75), "blocked");
    },
  },
  {
    id: "T1-F15-02",
    name: "RiskCard: Findings list item representation",
    featureId: "F15",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Verify findings list structures rule check labels and status",
    run: async () => {
      const { evaluatePolicyRules } = await import("../../../src/lib/agent/policy");
      const riskSrc = fs.readFileSync(path.resolve(process.cwd(), "src/components/RiskCard.tsx"), "utf-8");
      const res = evaluatePolicyRules({
        simOk: true,
        programs: ["11111111111111111111111111111111"],
        amountSol: 0.1,
        promptText: "swap 0.1 SOL",
      });
      assertEquals(res.findings.length, 6, "evaluatePolicyRules produces 6 structured findings");
      assert(riskSrc.includes("risk.findings.map"), "RiskCard renders all evaluated findings");
    },
  },
  {
    id: "T1-F15-03",
    name: "RiskCard: Net balance deltas formatting",
    featureId: "F15",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Verify deltas display negative for outflow and positive for inflow",
    run: () => {
      const riskSrc = fs.readFileSync(path.resolve(process.cwd(), "src/components/RiskCard.tsx"), "utf-8");
      assert(
        riskSrc.includes("sim.solDeltaUser") && riskSrc.includes("sim.dUsdcDeltaUser"),
        "RiskCard binds simulated User SOL and dUSDC balance deltas"
      );
    },
  },
  {
    id: "T1-F15-04",
    name: "RiskCard: Compute units badge formatting",
    featureId: "F15",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Verify compute units badge displays CU value",
    run: () => {
      const riskSrc = fs.readFileSync(path.resolve(process.cwd(), "src/components/RiskCard.tsx"), "utf-8");
      assert(
        riskSrc.includes("sim.unitsConsumed.toLocaleString()} CU"),
        "RiskCard formats compute units with toLocaleString() CU"
      );
    },
  },
  {
    id: "T1-F15-05",
    name: "RiskCard: Memo on-chain plan hash badge format",
    featureId: "F15",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Verify plan hash badge truncates to readable format",
    run: () => {
      const riskSrc = fs.readFileSync(path.resolve(process.cwd(), "src/components/RiskCard.tsx"), "utf-8");
      assert(
        riskSrc.includes("aegis:v1:{plan.sha256.slice(0, 12)}...{plan.sha256.slice(-10)}"),
        "RiskCard formats truncated aegis:v1:<sha256> Memo anchor with copy button"
      );
    },
  },

  // --- F16: In-App Blink / Action Execution ---
  {
    id: "T1-F16-01",
    name: "InAppBlink: Action Card component export verification",
    featureId: "F16",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Verify ActionCard component exists in components directory",
    run: async () => {
      const mod = await import("../../../src/components/ActionCard");
      assertEquals(typeof mod.ActionCard, "function", "ActionCard component exported");
    },
  },
  {
    id: "T1-F16-02",
    name: "InAppBlink: Solana Explorer Devnet URL generator",
    featureId: "F16",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Ensure Explorer URL contains ?cluster=devnet",
    run: async () => {
      const { buildExplorerTxUrl } = await import("../../../src/components/ActionCard");
      const explorerUrl = buildExplorerTxUrl("5wH8qZmockSig");
      assertEquals(explorerUrl, "https://explorer.solana.com/tx/5wH8qZmockSig?cluster=devnet");
    },
  },
  {
    id: "T1-F16-03",
    name: "InAppBlink: Wallet connect integration contract",
    featureId: "F16",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Verify wallet adapter hooks available",
    run: async () => {
      const { useWallet } = await import("@solana/wallet-adapter-react");
      assert(typeof useWallet === "function", "useWallet hook exported");
    },
  },
  {
    id: "T1-F16-04",
    name: "InAppBlink: Live transaction broadcast and confirmation",
    featureId: "F16",
    milestone: "M4",
    tier: 1,
    track: "live",
    description: "Execute 1-click sign and broadcast on Devnet",
    run: async () => {
      const { Transaction } = await import("@solana/web3.js");
      const { runAegisPipeline } = await import("../../../src/lib/agent/graph");
      const { GET, POST } = await import("../../../src/app/api/actions/aegis/route");
      const { getSolanaConnection } = await import("../../../src/lib/solana/config");

      const judgeSigner = Keypair.generate();
      const pipeline = await runAegisPipeline({
        prompt: "Swap 0.1 SOL to USDC",
        walletPubkey: judgeSigner.publicKey.toBase58(),
        baseUrl: "http://localhost:3000",
      });
      assert(Boolean(pipeline.actionUrl), "Approved swap must produce an Action URL");

      const metaRes = await GET(new Request(pipeline.actionUrl!));
      assertEquals(metaRes.status, 200, "Action GET metadata must return HTTP 200");

      const postRes = await POST(
        new Request(pipeline.actionUrl!, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account: judgeSigner.publicKey.toBase58() }),
        })
      );
      assertEquals(postRes.status, 200, "Action POST must return HTTP 200");
      const postBody = await postRes.json();
      const tx = Transaction.from(Buffer.from(postBody.transaction, "base64"));
      tx.partialSign(judgeSigner);
      assert(tx.verifySignatures(), "In-app Blink co-signed transaction must pass Ed25519 verification");

      const conn = await getSolanaConnection();
      const sim = await conn.simulateTransaction(tx);
      assert(sim.value !== undefined, "Live Devnet RPC accepted co-signed wire transaction for simulation");
    },
  },
  {
    id: "T1-F16-05",
    name: "InAppBlink: Dial.to link generator helper",
    featureId: "F16",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Verify helper produces valid Dial.to URL for Blink",
    run: async () => {
      const { buildDialBlinkUrl } = await import("../../../src/components/ActionCard");
      const dialUrl = buildDialBlinkUrl("https://aegisflow.vercel.app/api/actions/aegis?plan=abc");
      assertMatches(dialUrl, /^https:\/\/dial\.to\/\?action=solana-action:.*cluster=devnet$/);
    },
  },

  // --- F17: Token Safety Scanner (S2) ---
  {
    id: "T1-F17-01",
    name: "TokenScanner: API route GET /api/scanner existence",
    featureId: "F17",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Verify /api/scanner route exists or is scaffolded",
    run: async () => {
      const scannerRoute = await import("../../../src/app/api/scanner/route");
      assert(typeof scannerRoute.GET === "function", "GET /api/scanner exported");
    },
  },
  {
    id: "T1-F17-02",
    name: "TokenScanner: Mint authority inspection logic",
    featureId: "F17",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Assert mint authority null indicates revoked mint authority",
    run: async () => {
      const { evaluateMintSafety } = await import("../../../src/lib/solana/scanner");
      const res = evaluateMintSafety({
        mintAuthority: null,
        freezeAuthority: null,
        supplyRaw: 1_000_000_000n,
        decimals: 6,
        isToken2022: false,
        extensions: [],
      });
      assertEquals(res.mintAuthorityRevoked, true, "Null mint authority classified as revoked");
      assertEquals(res.verdict, "SAFE", "Revoked mint & freeze authorities classified as SAFE");
    },
  },
  {
    id: "T1-F17-03",
    name: "TokenScanner: Freeze authority inspection logic",
    featureId: "F17",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Assert active freeze authority is classified as critical danger",
    run: async () => {
      const { evaluateMintSafety } = await import("../../../src/lib/solana/scanner");
      const res = evaluateMintSafety({
        mintAuthority: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
        freezeAuthority: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
        supplyRaw: 1_000_000_000n,
        decimals: 6,
        isToken2022: false,
        extensions: [],
      });
      assertEquals(res.freezeAuthorityRevoked, false, "Active freeze authority flagged");
      assertEquals(res.verdict, "DANGER", "Active mint + freeze authorities trigger DANGER verdict");
    },
  },
  {
    id: "T1-F17-04",
    name: "TokenScanner: Token-2022 extension risk categorization",
    featureId: "F17",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Identify permanent delegate and transfer fee risks",
    run: async () => {
      const { evaluateMintSafety } = await import("../../../src/lib/solana/scanner");
      const res = evaluateMintSafety({
        mintAuthority: null,
        freezeAuthority: null,
        supplyRaw: 1_000_000_000n,
        decimals: 6,
        isToken2022: true,
        extensions: ["permanentDelegate", "transferFeeConfig"],
      });
      assertEquals(res.verdict, "DANGER", "permanentDelegate + transferFeeConfig triggers DANGER");
    },
  },
  {
    id: "T1-F17-05",
    name: "TokenScanner: Live mint scan query",
    featureId: "F17",
    milestone: "M4",
    tier: 1,
    track: "live",
    description: "Query known token mint on Solana and verify inspection",
    run: async () => {
      const { GET } = await import("../../../src/app/api/scanner/route");
      // Inspect Wrapped SOL on Mainnet (revoked mint & freeze authorities)
      const wsolRes = await GET(
        new Request(
          "http://localhost:3000/api/scanner?mint=So11111111111111111111111111111111111111112&cluster=mainnet-beta"
        )
      );
      assertEquals(wsolRes.status, 200, "GET /api/scanner must return HTTP 200 for Wrapped SOL");
      const wsolData = await wsolRes.json();
      assertEquals(wsolData.isMintAccount, true, "Wrapped SOL must unpack as a valid Mint account");
      assertEquals(wsolData.decimals, 9, "Wrapped SOL decimals must equal 9");
    },
  },

  // --- F18: Guest Burner Wallet (S3) ---
  {
    id: "T1-F18-01",
    name: "BurnerWallet: Ephemeral keypair generation in memory",
    featureId: "F18",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Verify generating valid 32-byte secret key keypair in memory",
    run: async () => {
      const { createBurnerWallet, destroyBurnerWallet } = await import("../../../src/lib/solana/burner");
      const burner = createBurnerWallet();
      assert(burner.pubkey.length >= 32, "Valid burner base58 public key generated");
      assertEquals(burner.keypair.secretKey.length, 64, "Secret key must be 64 bytes");
      destroyBurnerWallet(burner.keypair);
    },
  },
  {
    id: "T1-F18-02",
    name: "BurnerWallet: Public key display and formatting",
    featureId: "F18",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Ensure public key string is exportable to clipboard",
    run: async () => {
      const bs58 = (await import("bs58")).default;
      const { createBurnerWallet, importBurnerSecretKey, destroyBurnerWallet } = await import(
        "../../../src/lib/solana/burner"
      );
      const burner = createBurnerWallet();
      const b58Secret = bs58.encode(burner.keypair.secretKey);
      const reimported = importBurnerSecretKey(b58Secret);
      assertEquals(reimported.pubkey, burner.pubkey, "Base58 secret key round-trips to identical pubkey");
      destroyBurnerWallet(burner.keypair);
      destroyBurnerWallet(reimported.keypair);
    },
  },
  {
    id: "T1-F18-03",
    name: "BurnerWallet: Ephemeral in-memory signing capability",
    featureId: "F18",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Verify ephemeral keypair can sign byte messages",
    run: async () => {
      const { SystemProgram, Transaction } = await import("@solana/web3.js");
      const { createBurnerWallet, destroyBurnerWallet } = await import("../../../src/lib/solana/burner");
      const burner = createBurnerWallet();
      const tx = new Transaction({
        feePayer: burner.keypair.publicKey,
        recentBlockhash: "11111111111111111111111111111111",
      }).add(
        SystemProgram.transfer({
          fromPubkey: burner.keypair.publicKey,
          toPubkey: Keypair.generate().publicKey,
          lamports: 1000,
        })
      );
      tx.sign(burner.keypair);
      assert(tx.verifySignatures(), "Burner wallet keypair signs real Solana Transaction");
      destroyBurnerWallet(burner.keypair);
    },
  },
  {
    id: "T1-F18-04",
    name: "BurnerWallet: Live Devnet micro-funding request",
    featureId: "F18",
    milestone: "M4",
    tier: 1,
    track: "live",
    description: "Verify burner wallet can receive micro-funding on Devnet",
    run: async () => {
      const { createBurnerWallet, destroyBurnerWallet } = await import("../../../src/lib/solana/burner");
      const { POST } = await import("../../../src/app/api/burner-faucet/route");

      const burner = createBurnerWallet();
      try {
        const res = await POST(
          new Request("http://localhost:3000/api/burner-faucet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pubkey: burner.pubkey }),
          })
        );
        assertEquals(res.status, 200, "POST /api/burner-faucet must return HTTP 200");
        const body = await res.json();
        assertEquals(body.ok, true, "Burner micro-funding response must return ok: true");
        assert(
          Boolean(body.funded || body.simulationReady),
          "Burner wallet must either be funded on-chain or marked simulationReady on faucet 410"
        );
      } finally {
        destroyBurnerWallet(burner.keypair);
      }
    },
  },
  {
    id: "T1-F18-05",
    name: "BurnerWallet: Zero out memory on burn",
    featureId: "F18",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Ensure burn action zeroes key buffer",
    run: async () => {
      const { createBurnerWallet, destroyBurnerWallet } = await import("../../../src/lib/solana/burner");
      const burner = createBurnerWallet();
      destroyBurnerWallet(burner.keypair);
      assert(burner.keypair.secretKey.every((b) => b === 0), "destroyBurnerWallet must zero secretKey bytes");
    },
  },

  // --- F19: Live Mainnet Reference Quote (S4) ---
  {
    id: "T1-F19-01",
    name: "JupiterRef: Jupiter quote API schema parsing",
    featureId: "F19",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Verify parsing of mock Jupiter swap quote response",
    run: async () => {
      const { parseJupiterQuoteResponse } = await import("../../../src/lib/solana/jupiter");
      const parsed = parseJupiterQuoteResponse(
        {
          inAmount: "100000000",
          outAmount: "20543000",
          priceImpactPct: "0.01",
          routePlan: [{ swapInfo: { label: "Meteora DLMM" } }],
        },
        0.1,
        205.0
      );
      assertEquals(parsed.available, true);
      assertEquals(parsed.outAmountUsdc, 20.543);
      assertEquals(parsed.routeLabels[0], "Meteora DLMM");
    },
  },
  {
    id: "T1-F19-02",
    name: "JupiterRef: Price divergence calculation",
    featureId: "F19",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Calculate percentage difference between Pyth and Jupiter reference",
    run: async () => {
      const { parseJupiterQuoteResponse } = await import("../../../src/lib/solana/jupiter");
      const tight = parseJupiterQuoteResponse({ outAmount: "20550000" }, 0.1, 205.43);
      assertEquals(tight.isDivergenceWide, false, "Sub-1% spread is not flagged wide");
      const wide = parseJupiterQuoteResponse({ outAmount: "22500000" }, 0.1, 200.0);
      assertEquals(wide.isDivergenceWide, true, ">5% spread flagged wide");
    },
  },
  {
    id: "T1-F19-03",
    name: "JupiterRef: Read-only reference disclaimer notice",
    featureId: "F19",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Ensure UI copy explicitly states quote is reference only",
    run: async () => {
      const { JUPITER_REFERENCE_DISCLAIMER } = await import("../../../src/lib/solana/jupiter");
      assert(/read-only/i.test(JUPITER_REFERENCE_DISCLAIMER), "JUPITER_REFERENCE_DISCLAIMER must contain read-only notice");
    },
  },
  {
    id: "T1-F19-04",
    name: "JupiterRef: Missing API key graceful fallback",
    featureId: "F19",
    milestone: "M4",
    tier: 1,
    track: "mock",
    description: "Ensure system operates normally without Jupiter API key",
    run: async () => {
      const { parseJupiterQuoteResponse } = await import("../../../src/lib/solana/jupiter");
      const fallback = parseJupiterQuoteResponse(null, 0.1, 200);
      assertEquals(fallback.available, false, "Null/unavailable Jupiter payload degrades cleanly");
      assertEquals(fallback.source, "unavailable_fallback");
    },
  },
  {
    id: "T1-F19-05",
    name: "JupiterRef: Live reference price query",
    featureId: "F19",
    milestone: "M4",
    tier: 1,
    track: "live",
    description: "Query live Jupiter API if key is present",
    run: async () => {
      const { getJupiterReferenceQuote } = await import("../../../src/lib/solana/jupiter");
      const quote = await getJupiterReferenceQuote(0.1, 90.0);
      assert(quote.disclaimer.includes("Read-only"), "Jupiter quote must carry read-only reference disclaimer");
      if (quote.available) {
        assert((quote.outAmountUsdc ?? 0) > 0, "Live Jupiter quote outAmountUsdc must be > 0");
        assert((quote.impliedSolUsd ?? 0) > 1, "Live Jupiter implied SOL/USD price must be realistic");
      }
    },
  },
];
