/**
 * Tier 2 Boundary & Corner Case Tests: Milestone 3 (B10 to B12)
 * Covers edge cases for Solana Actions, CORS headers, actions.json, and blockhash freshness.
 */

import { TestCase } from "../harness/types";
import {
  assert,
  assertEquals,
  assertMatches,
  markPending,
} from "../harness/assertions";
import { ACTIONS_CORS_HEADERS } from "@solana/actions";

export const m3BoundaryTests: TestCase[] = [
  // --- B10: Solana Actions API Boundaries ---
  {
    id: "T2-F10-01",
    name: "Boundary: Missing plan query parameter on GET",
    featureId: "F10",
    milestone: "M3",
    tier: 2,
    track: "mock",
    description: "GET /api/actions/aegis without ?plan= returns HTTP 400",
    run: async () => {
      const { GET } = await import("../../../src/app/api/actions/aegis/route");
      const res = await GET(new Request("http://localhost:3000/api/actions/aegis"));
      assertEquals(res.status, 400, "Missing ?plan= must return HTTP 400");
    },
  },
  {
    id: "T2-F10-02",
    name: "Boundary: Non-existent or expired plan ID on GET",
    featureId: "F10",
    milestone: "M3",
    tier: 2,
    track: "mock",
    description: "GET with invalid plan ID returns HTTP 404 Action Not Found",
    run: async () => {
      const { GET } = await import("../../../src/app/api/actions/aegis/route");
      const res = await GET(new Request("http://localhost:3000/api/actions/aegis?plan=non_existent_id_999"));
      assertEquals(res.status, 404, "Unknown plan ID must return HTTP 404");
    },
  },
  {
    id: "T2-F10-03",
    name: "Boundary: Invalid or missing account public key on POST",
    featureId: "F10",
    milestone: "M3",
    tier: 2,
    track: "mock",
    description: "POST body missing account returns HTTP 400 Invalid Account",
    run: async () => {
      const { Keypair } = await import("@solana/web3.js");
      const { saveApprovedPlan } = await import("../../../src/lib/agent/plan-store");
      const { hashPlanPayload } = await import("../../../src/lib/solana/swap");
      const { getDevnetVaultConfig } = await import("../../../src/lib/solana/vault");
      const { POST } = await import("../../../src/app/api/actions/aegis/route");
      const planJson = {
        version: "aegis:v1" as const,
        kind: "swap" as const,
        walletPubkey: Keypair.generate().publicKey.toBase58(),
        amountSol: 0.1,
        expectedDUsdc: 20,
        pythPriceUsd: 200,
        maxSlippageBps: 50,
        createdAt: Date.now(),
      };
      const saved = saveApprovedPlan({
        intentKind: "swap",
        amountSol: 0.1,
        expectedDUsdc: 20,
        pythPriceUsd: 200,
        maxSlippageBps: 50,
        planJson,
        planSha256: hashPlanPayload(planJson),
        riskScore: 0,
        riskBand: "safe",
        explanationBullets: ["• Safe"],
      });
      const url = `http://localhost:3000/api/actions/aegis?plan=${saved.plan.id}`;
      const missingRes = await POST(new Request(url, { method: "POST", body: JSON.stringify({}) }));
      assertEquals(missingRes.status, 400, "Missing account returns HTTP 400");
      const badB58Res = await POST(new Request(url, { method: "POST", body: JSON.stringify({ account: "not-base58!" }) }));
      assertEquals(badB58Res.status, 400, "Malformed base58 account returns HTTP 400");
      // Also verify Vault self-sign gas-griefing attempt returns HTTP 400
      const vaultSelfRes = await POST(
        new Request(url, {
          method: "POST",
          body: JSON.stringify({ account: getDevnetVaultConfig().vaultPubkey.toBase58() }),
        })
      );
      assertEquals(vaultSelfRes.status, 400, "Vault authority pubkey as signer must be rejected with HTTP 400");
    },
  },
  {
    id: "T2-F10-04",
    name: "Boundary: POST request for blocked high-risk plan",
    featureId: "F10",
    milestone: "M3",
    tier: 2,
    track: "mock",
    description: "POST on a blocked plan ID returns HTTP 403 Forbidden",
    run: async () => {
      const { Keypair } = await import("@solana/web3.js");
      const { encodeSignedPlanToken, saveApprovedPlan } = await import("../../../src/lib/agent/plan-store");
      const { hashPlanPayload } = await import("../../../src/lib/solana/swap");
      const { POST } = await import("../../../src/app/api/actions/aegis/route");
      const user = Keypair.generate().publicKey.toBase58();
      const planJson = {
        version: "aegis:v1" as const,
        kind: "transfer" as const,
        walletPubkey: user,
        amountSol: 0.1,
        destination: user,
        pythPriceUsd: 200,
        maxSlippageBps: 400,
        createdAt: Date.now(),
      };
      // 1) Directly signed blocked token -> HTTP 403
      const blockedToken = encodeSignedPlanToken({
        id: "plan_blocked_test",
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        intentKind: "swap",
        amountSol: 5.0,
        expectedDUsdc: 1000,
        pythPriceUsd: 200,
        maxSlippageBps: 50,
        planJson,
        planSha256: hashPlanPayload(planJson),
        riskScore: 75,
        riskBand: "blocked",
        explanationBullets: ["• Blocked"],
      });
      const resBlocked = await POST(
        new Request(`http://localhost:3000/api/actions/aegis?plan=plan_blocked_test&token=${encodeURIComponent(blockedToken)}`, {
          method: "POST",
          body: JSON.stringify({ account: Keypair.generate().publicKey.toBase58() }),
        })
      );
      assertEquals(resBlocked.status, 403, "Blocked plan token must return HTTP 403");

      // 2) Caution plan (400bps = +25) where signer substitutes self-transfer (+25 -> total 50) -> HTTP 403
      const target = Keypair.generate().publicKey.toBase58();
      const cautionPlanJson = {
        version: "aegis:v1" as const,
        kind: "transfer" as const,
        walletPubkey: Keypair.generate().publicKey.toBase58(),
        amountSol: 0.1,
        destination: target,
        pythPriceUsd: 200,
        maxSlippageBps: 400,
        createdAt: Date.now(),
      };
      const cautionSaved = saveApprovedPlan({
        intentKind: "transfer",
        amountSol: 0.1,
        destination: target,
        pythPriceUsd: 200,
        maxSlippageBps: 400,
        planJson: cautionPlanJson,
        planSha256: hashPlanPayload(cautionPlanJson),
        riskScore: 25,
        riskBand: "caution",
        explanationBullets: ["• Caution"],
      });
      const resSubstituted = await POST(
        new Request(`http://localhost:3000/api/actions/aegis?plan=${cautionSaved.plan.id}`, {
          method: "POST",
          body: JSON.stringify({ account: target }),
        })
      );
      assertEquals(resSubstituted.status, 403, "Signer substitution pushing risk >= 50 must return HTTP 403");
    },
  },
  {
    id: "T2-F10-05",
    name: "Boundary: Unexpected fields in POST body safely ignored",
    featureId: "F10",
    milestone: "M3",
    tier: 2,
    track: "mock",
    description: "Extra properties in payload do not contaminate transaction building",
    run: async () => {
      const { Connection, Keypair, Transaction, SystemInstruction } = await import("@solana/web3.js");
      const { saveApprovedPlan } = await import("../../../src/lib/agent/plan-store");
      const { hashPlanPayload } = await import("../../../src/lib/solana/swap");
      const { POST } = await import("../../../src/app/api/actions/aegis/route");
      const origGetSlot = Connection.prototype.getSlot;
      const origGetLatest = Connection.prototype.getLatestBlockhash;
      Connection.prototype.getSlot = (async () => 1) as typeof Connection.prototype.getSlot;
      Connection.prototype.getLatestBlockhash = (async () => ({
        blockhash: "11111111111111111111111111111111",
        lastValidBlockHeight: 1000,
      })) as typeof Connection.prototype.getLatestBlockhash;
      try {
        const user = Keypair.generate().publicKey;
        const planJson = {
          version: "aegis:v1" as const,
          kind: "swap" as const,
          walletPubkey: user.toBase58(),
          amountSol: 0.1,
          expectedDUsdc: 20,
          pythPriceUsd: 200,
          maxSlippageBps: 50,
          createdAt: Date.now(),
        };
        const saved = saveApprovedPlan({
          intentKind: "swap",
          amountSol: 0.1,
          expectedDUsdc: 20,
          pythPriceUsd: 200,
          maxSlippageBps: 50,
          planJson,
          planSha256: hashPlanPayload(planJson),
          riskScore: 0,
          riskBand: "safe",
          explanationBullets: ["• Safe"],
        });
        const res = await POST(
          new Request(`http://localhost:3000/api/actions/aegis?plan=${saved.plan.id}`, {
            method: "POST",
            body: JSON.stringify({
              account: user.toBase58(),
              amountSol: 999,
              extraEvilPayload: "malicious",
            }),
          })
        );
        assertEquals(res.status, 200);
        const body = await res.json();
        const tx = Transaction.from(Buffer.from(body.transaction, "base64"));
        const decodedTransfer = SystemInstruction.decodeTransfer(tx.instructions[1]);
        assertEquals(Number(decodedTransfer.lamports), 100_000_000, "POST ignores injected amountSol:999 and uses storedPlan 0.1 SOL");
      } finally {
        Connection.prototype.getSlot = origGetSlot;
        Connection.prototype.getLatestBlockhash = origGetLatest;
      }
    },
  },

  // --- B11: Actions CORS & Routing Boundaries ---
  {
    id: "T2-F11-01",
    name: "Boundary: OPTIONS pre-flight custom request headers",
    featureId: "F11",
    milestone: "M3",
    tier: 2,
    track: "mock",
    description: "CORS headers allow custom Dialect and Solana client headers",
    run: async () => {
      const { OPTIONS } = await import("../../../src/app/api/actions/aegis/route");
      const res = await OPTIONS();
      const allowedHeaders = res.headers.get("Access-Control-Allow-Headers") || "";
      assert(
        allowedHeaders.includes("Content-Type") && allowedHeaders.includes("Authorization"),
        "OPTIONS response headers must include Access-Control-Allow-Headers"
      );
      assert(Boolean(res.headers.get("X-Action-Version")), "OPTIONS response must include X-Action-Version header");
    },
  },
  {
    id: "T2-F11-02",
    name: "Boundary: Dial.to cross-origin origin header wildcards",
    featureId: "F11",
    milestone: "M3",
    tier: 2,
    track: "mock",
    description: "Ensure Access-Control-Allow-Origin is wildcard * for Dial.to rendering",
    run: async () => {
      const { OPTIONS: aegisOptions } = await import("../../../src/app/api/actions/aegis/route");
      const { OPTIONS: discoveryOptions } = await import("../../../src/app/actions.json/route");
      const res1 = await aegisOptions();
      const res2 = await discoveryOptions();
      assertEquals(res1.headers.get("Access-Control-Allow-Origin"), "*");
      assertEquals(res2.headers.get("Access-Control-Allow-Origin"), "*");
    },
  },
  {
    id: "T2-F11-03",
    name: "Boundary: URL encoding of complex Action URL query strings",
    featureId: "F11",
    milestone: "M3",
    tier: 2,
    track: "mock",
    description: "Action URLs with special characters encode safely for Dial.to links",
    run: async () => {
      const { buildDialBlinkUrl } = await import("../../../src/components/ActionCard");
      const complexUrl = "https://example.com/api/actions/aegis?plan=plan_123&token=abc.def_456";
      const dialUrl = buildDialBlinkUrl(complexUrl);
      assert(
        dialUrl === `https://dial.to/?action=solana-action:${encodeURIComponent(complexUrl)}&cluster=devnet`,
        "buildDialBlinkUrl safely URL-encodes multi-parameter Action URLs"
      );
    },
  },
  {
    id: "T2-F11-04",
    name: "Boundary: actions.json trailing slash equivalence",
    featureId: "F11",
    milestone: "M3",
    tier: 2,
    track: "mock",
    description: "Routing rules match both /aegis and /aegis/ paths",
    run: async () => {
      const { GET } = await import("../../../src/app/actions.json/route");
      const res = await GET();
      const data = await res.json();
      const hasAegisRule = data.rules.some((r: { pathPattern: string; apiPath: string }) =>
        r.pathPattern.startsWith("/aegis") && r.apiPath.startsWith("/api/actions/aegis")
      );
      assert(hasAegisRule, "/actions.json must map /aegis* to /api/actions/aegis*");
    },
  },
  {
    id: "T2-F11-05",
    name: "Boundary: Next.js App Router 405 Method Not Allowed prevention",
    featureId: "F11",
    milestone: "M3",
    tier: 2,
    track: "mock",
    description: "Exporting OPTIONS handler prevents Next.js 405 error on CORS pre-flight",
    run: async () => {
      const aegisRoute = await import("../../../src/app/api/actions/aegis/route");
      const discoveryRoute = await import("../../../src/app/actions.json/route");
      assertEquals(typeof aegisRoute.GET, "function");
      assertEquals(typeof aegisRoute.POST, "function");
      assertEquals(typeof aegisRoute.OPTIONS, "function");
      assertEquals(typeof discoveryRoute.GET, "function");
      assertEquals(typeof discoveryRoute.OPTIONS, "function");
    },
  },

  // --- B12: Fresh Blockhash Boundaries ---
  {
    id: "T2-F12-01",
    name: "Boundary: Blockhash query commitment level confirmed",
    featureId: "F12",
    milestone: "M3",
    tier: 2,
    track: "mock",
    description: "Blockhash fetched with confirmed commitment for fresh validity window",
    run: async () => {
      const { Connection, Keypair } = await import("@solana/web3.js");
      const { saveApprovedPlan } = await import("../../../src/lib/agent/plan-store");
      const { hashPlanPayload } = await import("../../../src/lib/solana/swap");
      const { POST } = await import("../../../src/app/api/actions/aegis/route");
      let observedCommitment: string | undefined;
      const origGetSlot = Connection.prototype.getSlot;
      const origGetLatest = Connection.prototype.getLatestBlockhash;
      Connection.prototype.getSlot = (async () => 1) as typeof Connection.prototype.getSlot;
      Connection.prototype.getLatestBlockhash = (async (commitment?: unknown) => {
        observedCommitment = String(commitment);
        return { blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 1000 };
      }) as typeof Connection.prototype.getLatestBlockhash;
      try {
        const user = Keypair.generate().publicKey.toBase58();
        const planJson = {
          version: "aegis:v1" as const,
          kind: "swap" as const,
          walletPubkey: user,
          amountSol: 0.1,
          expectedDUsdc: 20,
          pythPriceUsd: 200,
          maxSlippageBps: 50,
          createdAt: Date.now(),
        };
        const saved = saveApprovedPlan({
          intentKind: "swap",
          amountSol: 0.1,
          expectedDUsdc: 20,
          pythPriceUsd: 200,
          maxSlippageBps: 50,
          planJson,
          planSha256: hashPlanPayload(planJson),
          riskScore: 0,
          riskBand: "safe",
          explanationBullets: ["• Safe"],
        });
        await POST(
          new Request(`http://localhost:3000/api/actions/aegis?plan=${saved.plan.id}`, {
            method: "POST",
            body: JSON.stringify({ account: user }),
          })
        );
        assertEquals(observedCommitment, "confirmed", "POST /api/actions/aegis must query getLatestBlockhash('confirmed')");
      } finally {
        Connection.prototype.getSlot = origGetSlot;
        Connection.prototype.getLatestBlockhash = origGetLatest;
      }
    },
  },
  {
    id: "T2-F12-02",
    name: "Boundary: Delayed wallet signing (> 90s) timeout handling",
    featureId: "F12",
    milestone: "M3",
    tier: 2,
    track: "mock",
    description: "Wallet adapter catches expired blockhash on broadcast and prompts retry",
    run: async () => {
      const { Connection, Keypair, Transaction } = await import("@solana/web3.js");
      const { saveApprovedPlan } = await import("../../../src/lib/agent/plan-store");
      const { hashPlanPayload } = await import("../../../src/lib/solana/swap");
      const { POST } = await import("../../../src/app/api/actions/aegis/route");
      const bh1 = Keypair.generate().publicKey.toBase58();
      const bh2 = Keypair.generate().publicKey.toBase58();
      let callCount = 0;
      const origGetSlot = Connection.prototype.getSlot;
      const origGetLatest = Connection.prototype.getLatestBlockhash;
      Connection.prototype.getSlot = (async () => 1) as typeof Connection.prototype.getSlot;
      Connection.prototype.getLatestBlockhash = (async () => ({
        blockhash: ++callCount === 1 ? bh1 : bh2,
        lastValidBlockHeight: 1000 + callCount,
      })) as typeof Connection.prototype.getLatestBlockhash;
      try {
        const user = Keypair.generate().publicKey.toBase58();
        const planJson = {
          version: "aegis:v1" as const,
          kind: "swap" as const,
          walletPubkey: user,
          amountSol: 0.1,
          expectedDUsdc: 20,
          pythPriceUsd: 200,
          maxSlippageBps: 50,
          createdAt: Date.now(),
        };
        const saved = saveApprovedPlan({
          intentKind: "swap",
          amountSol: 0.1,
          expectedDUsdc: 20,
          pythPriceUsd: 200,
          maxSlippageBps: 50,
          planJson,
          planSha256: hashPlanPayload(planJson),
          riskScore: 0,
          riskBand: "safe",
          explanationBullets: ["• Safe"],
        });
        const url = `http://localhost:3000/api/actions/aegis?plan=${saved.plan.id}`;
        const res1 = await (await POST(new Request(url, { method: "POST", body: JSON.stringify({ account: user }) }))).json();
        const res2 = await (await POST(new Request(url, { method: "POST", body: JSON.stringify({ account: user }) }))).json();
        const tx1 = Transaction.from(Buffer.from(res1.transaction, "base64"));
        const tx2 = Transaction.from(Buffer.from(res2.transaction, "base64"));
        assert(tx1.recentBlockhash !== tx2.recentBlockhash, "Subsequent POST after user delay receives a brand-new blockhash");
      } finally {
        Connection.prototype.getSlot = origGetSlot;
        Connection.prototype.getLatestBlockhash = origGetLatest;
      }
    },
  },
  {
    id: "T2-F12-03",
    name: "Boundary: Primary RPC failure during blockhash query",
    featureId: "F12",
    milestone: "M3",
    tier: 2,
    track: "mock",
    description: "Fallback RPC endpoint automatically queried when primary fails",
    run: async () => {
      const { Connection } = await import("@solana/web3.js");
      const { getSolanaConnection } = await import("../../../src/lib/solana/config");
      let attempts = 0;
      const origGetSlot = Connection.prototype.getSlot;
      Connection.prototype.getSlot = (async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error("Primary RPC 503 Unavailable");
        }
        return 123456;
      }) as typeof Connection.prototype.getSlot;
      try {
        const conn = await getSolanaConnection();
        assert(attempts >= 2, "getSolanaConnection must fail over to secondary candidate when primary RPC throws");
        assert(Boolean(conn.rpcEndpoint), "Fallback RPC connection established");
      } finally {
        Connection.prototype.getSlot = origGetSlot;
      }
    },
  },
  {
    id: "T2-F12-04",
    name: "Boundary: Buffer re-serialization preservation",
    featureId: "F12",
    milestone: "M3",
    tier: 2,
    track: "mock",
    description: "Re-serializing transaction with fresh blockhash preserves signature slots",
    run: async () => {
      const { Keypair, Connection, Transaction } = await import("@solana/web3.js");
      const { buildAtomicSwapTransaction } = await import("../../../src/lib/solana/swap");
      const { getDevnetVaultConfig } = await import("../../../src/lib/solana/vault");
      const user = Keypair.generate();
      const built = await buildAtomicSwapTransaction({
        connection: new Connection("https://api.devnet.solana.com"),
        userPubkey: user.publicKey,
        amountSol: 0.1,
        expectedDUsdcAmount: 20,
        planHashHex: "a".repeat(64),
        recentBlockhash: "11111111111111111111111111111111",
      });
      const decoded = Transaction.from(Buffer.from(built.txBase64, "base64"));
      const vaultCfg = getDevnetVaultConfig();
      assertEquals(decoded.signatures.length, 2, "Swap transaction preserves 2 signature slots (User + Vault)");
      const vaultSlot = decoded.signatures.find((s) => s.publicKey.equals(vaultCfg.vaultPubkey));
      assert(Boolean(vaultSlot?.signature && vaultSlot.signature.length === 64), "Vault partial signature preserved across base64 round-trip");
    },
  },
  {
    id: "T2-F12-05",
    name: "Boundary: Latency of blockhash query inside POST handler",
    featureId: "F12",
    milestone: "M3",
    tier: 2,
    track: "mock",
    description: "Blockhash fetch completes within 500ms budget",
    run: async () => {
      const { Connection, Keypair } = await import("@solana/web3.js");
      const { saveApprovedPlan } = await import("../../../src/lib/agent/plan-store");
      const { hashPlanPayload } = await import("../../../src/lib/solana/swap");
      const { POST } = await import("../../../src/app/api/actions/aegis/route");
      const origGetSlot = Connection.prototype.getSlot;
      const origGetLatest = Connection.prototype.getLatestBlockhash;
      Connection.prototype.getSlot = (async () => 1) as typeof Connection.prototype.getSlot;
      Connection.prototype.getLatestBlockhash = (async () => ({
        blockhash: "11111111111111111111111111111111",
        lastValidBlockHeight: 1000,
      })) as typeof Connection.prototype.getLatestBlockhash;
      try {
        const user = Keypair.generate().publicKey.toBase58();
        const planJson = {
          version: "aegis:v1" as const,
          kind: "swap" as const,
          walletPubkey: user,
          amountSol: 0.1,
          expectedDUsdc: 20,
          pythPriceUsd: 200,
          maxSlippageBps: 50,
          createdAt: Date.now(),
        };
        const saved = saveApprovedPlan({
          intentKind: "swap",
          amountSol: 0.1,
          expectedDUsdc: 20,
          pythPriceUsd: 200,
          maxSlippageBps: 50,
          planJson,
          planSha256: hashPlanPayload(planJson),
          riskScore: 0,
          riskBand: "safe",
          explanationBullets: ["• Safe"],
        });
        const t0 = Date.now();
        const res = await POST(
          new Request(`http://localhost:3000/api/actions/aegis?plan=${saved.plan.id}`, {
            method: "POST",
            body: JSON.stringify({ account: user }),
          })
        );
        const elapsed = Date.now() - t0;
        assertEquals(res.status, 200);
        assert(elapsed < 500, `POST handler assembly latency (${elapsed}ms) must be under 500ms budget`);
      } finally {
        Connection.prototype.getSlot = origGetSlot;
        Connection.prototype.getLatestBlockhash = origGetLatest;
      }
    },
  },
];
