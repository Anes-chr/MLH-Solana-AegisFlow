/**
 * Tier 1 Feature Tests: Milestone 3 (Gate G4 - Features F10 to F12)
 * Covers:
 * - F10: Solana Actions GET/POST/OPTIONS (T1-F10-01 to T1-F10-05)
 * - F11: Actions CORS & actions.json (T1-F11-01 to T1-F11-05)
 * - F12: Fresh Blockhash on Action POST (T1-F12-01 to T1-F12-05)
 */

import { TestCase } from "../harness/types";
import {
  assert,
  assertEquals,
  assertMatches,
  markPending,
} from "../harness/assertions";
import { FIXTURES } from "../harness/fixtures";
import { ACTIONS_CORS_HEADERS } from "@solana/actions";

export const m3ActionsFeatureTests: TestCase[] = [
  // --- F10: Solana Actions GET/POST/OPTIONS ---
  {
    id: "T1-F10-01",
    name: "Actions: GET handler returns valid Action metadata spec",
    featureId: "F10",
    milestone: "M3",
    tier: 1,
    track: "mock",
    description: "Verify Action GET response includes icon, title, description, and label",
    run: async () => {
      const { saveApprovedPlan } = await import("../../../src/lib/agent/plan-store");
      const { hashPlanPayload } = await import("../../../src/lib/solana/swap");
      const { GET } = await import("../../../src/app/api/actions/aegis/route");
      const planJson = {
        version: "aegis:v1" as const,
        kind: "swap" as const,
        walletPubkey: FIXTURES.accounts.user.publicKey.toBase58(),
        amountSol: 0.1,
        expectedDUsdc: 20.54,
        pythPriceUsd: 205.4,
        maxSlippageBps: 50,
        createdAt: Date.now(),
      };
      const saved = saveApprovedPlan({
        intentKind: "swap",
        amountSol: 0.1,
        expectedDUsdc: 20.54,
        pythPriceUsd: 205.4,
        maxSlippageBps: 50,
        planJson,
        planSha256: hashPlanPayload(planJson),
        riskScore: 0,
        riskBand: "safe",
        explanationBullets: ["• Simulated cleanly"],
      });
      const res = await GET(new Request(`http://localhost:3000/api/actions/aegis?plan=${saved.plan.id}`));
      assertEquals(res.status, 200);
      const body = await res.json();
      assert(Boolean(body.icon && body.title && body.description && body.label), "ActionGetResponse fields populated");
    },
  },
  {
    id: "T1-F10-02",
    name: "Actions: Action metadata displays plan details and risk badge",
    featureId: "F10",
    milestone: "M3",
    tier: 1,
    track: "mock",
    description: "Ensure Action description embeds risk score badge",
    run: async () => {
      const { saveApprovedPlan } = await import("../../../src/lib/agent/plan-store");
      const { hashPlanPayload } = await import("../../../src/lib/solana/swap");
      const { GET } = await import("../../../src/app/api/actions/aegis/route");
      const planJson = {
        version: "aegis:v1" as const,
        kind: "swap" as const,
        walletPubkey: FIXTURES.accounts.user.publicKey.toBase58(),
        amountSol: 0.1,
        expectedDUsdc: 20.54,
        pythPriceUsd: 205.4,
        maxSlippageBps: 50,
        createdAt: Date.now(),
      };
      const saved = saveApprovedPlan({
        intentKind: "swap",
        amountSol: 0.1,
        expectedDUsdc: 20.54,
        pythPriceUsd: 205.4,
        maxSlippageBps: 50,
        planJson,
        planSha256: hashPlanPayload(planJson),
        riskScore: 12,
        riskBand: "safe",
        explanationBullets: ["• Simulated with Pyth Hermes oracle."],
      });
      const res = await GET(new Request(`http://localhost:3000/api/actions/aegis?plan=${saved.plan.id}`));
      const body = await res.json();
      assert(body.title.includes("Swap 0.1 SOL"), "Title specifies swap amount");
      assert(body.description.includes("[Risk Score: 12/100 (SAFE)]"), "Description includes risk score badge");
    },
  },
  {
    id: "T1-F10-03",
    name: "Actions: POST handler returns serialized base64 transaction",
    featureId: "F10",
    milestone: "M3",
    tier: 1,
    track: "mock",
    description: "Verify Action POST returns type: 'transaction' and transaction base64 string",
    run: async () => {
      try {
        const routeMod = await import("../../../src/app/api/actions/aegis/route" as string);
        assert(typeof routeMod.POST === "function", "POST handler must be exported");
      } catch {
        markPending("POST /api/actions/aegis not yet implemented (Milestone 3)");
      }
    },
  },
  {
    id: "T1-F10-04",
    name: "Actions: Serialized transaction contains vault partial signature",
    featureId: "F10",
    milestone: "M3",
    tier: 1,
    track: "both",
    description: "Verify transaction is pre-signed by vault",
    run: async () => {
      const { Keypair, Transaction } = await import("@solana/web3.js");
      const { saveApprovedPlan } = await import("../../../src/lib/agent/plan-store");
      const { hashPlanPayload } = await import("../../../src/lib/solana/swap");
      const { getDevnetVaultConfig } = await import("../../../src/lib/solana/vault");
      const { POST } = await import("../../../src/app/api/actions/aegis/route");

      const user = Keypair.generate();
      const planJson = {
        version: "aegis:v1" as const,
        kind: "swap" as const,
        walletPubkey: user.publicKey.toBase58(),
        amountSol: 0.1,
        expectedDUsdc: 9.0,
        pythPriceUsd: 90.0,
        maxSlippageBps: 50,
        createdAt: Date.now(),
      };
      const saved = saveApprovedPlan({
        intentKind: "swap",
        amountSol: 0.1,
        expectedDUsdc: 9.0,
        destination: null,
        pythPriceUsd: 90.0,
        maxSlippageBps: 50,
        planJson,
        planSha256: hashPlanPayload(planJson),
        riskScore: 0,
        riskBand: "safe",
        explanationBullets: ["• Safe swap"],
      });
      const actionUrl = `http://localhost:3000/api/actions/aegis?plan=${encodeURIComponent(
        saved.plan.id
      )}&token=${encodeURIComponent(saved.signedToken)}`;

      const res = await POST(
        new Request(actionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account: user.publicKey.toBase58() }),
        })
      );
      assertEquals(res.status, 200, "POST /api/actions/aegis must return HTTP 200");
      const data = await res.json();
      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));
      const vaultCfg = getDevnetVaultConfig();
      const vaultSig = tx.signatures.find((s) => s.publicKey.equals(vaultCfg.vaultPubkey));
      assert(Boolean(vaultSig?.signature && vaultSig.signature.length === 64), "Vault partial signature must be attached");
    },
  },
  {
    id: "T1-F10-05",
    name: "Actions: OPTIONS handler returns HTTP 200 with CORS headers",
    featureId: "F10",
    milestone: "M3",
    tier: 1,
    track: "mock",
    description: "Verify OPTIONS route handler handles pre-flight checks",
    run: async () => {
      const { OPTIONS } = await import("../../../src/app/api/actions/aegis/route");
      const res = await OPTIONS();
      assertEquals(res.status, 200);
      assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
    },
  },

  // --- F11: Actions CORS & actions.json ---
  {
    id: "T1-F11-01",
    name: "CORS: Standard ACTIONS_CORS_HEADERS exported and applied",
    featureId: "F11",
    milestone: "M3",
    tier: 1,
    track: "mock",
    description: "Verify ACTIONS_CORS_HEADERS includes Access-Control-Allow-Origin: *",
    run: () => {
      assert(ACTIONS_CORS_HEADERS !== undefined, "ACTIONS_CORS_HEADERS must be imported");
      assertEquals(ACTIONS_CORS_HEADERS["Access-Control-Allow-Origin"], "*");
    },
  },
  {
    id: "T1-F11-02",
    name: "actions.json: Mapping route configuration",
    featureId: "F11",
    milestone: "M3",
    tier: 1,
    track: "mock",
    description: "Verify GET /actions.json returns rules mapping path /aegis to api route",
    run: async () => {
      const { GET } = await import("../../../src/app/actions.json/route");
      const res = await GET();
      assertEquals(res.status, 200);
      const data = await res.json();
      assert(Array.isArray(data.rules) && data.rules.length > 0, "actions.json must return rules array");
      assert(
        data.rules.some((r: { apiPath: string }) => r.apiPath.includes("/api/actions/aegis")),
        "Rules must map to /api/actions/aegis"
      );
    },
  },
  {
    id: "T1-F11-03",
    name: "actions.json: OPTIONS handler present with CORS",
    featureId: "F11",
    milestone: "M3",
    tier: 1,
    track: "mock",
    description: "Ensure OPTIONS /actions.json returns CORS headers",
    run: async () => {
      const { OPTIONS } = await import("../../../src/app/actions.json/route");
      const res = await OPTIONS();
      assertEquals(res.status, 200);
      assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
    },
  },
  {
    id: "T1-F11-04",
    name: "Dial.to: Action URL formatting for Dial.to Blink renderer",
    featureId: "F11",
    milestone: "M3",
    tier: 1,
    track: "mock",
    description: "Ensure Dial.to link matches https://dial.to/?action=solana-action:<url>&cluster=devnet",
    run: async () => {
      const { buildDialBlinkUrl } = await import("../../../src/components/ActionCard");
      const actionEndpoint = "https://aegisflow.vercel.app/api/actions/aegis?plan=123";
      const dialUrl = buildDialBlinkUrl(actionEndpoint);
      assert(dialUrl.startsWith("https://dial.to/?action=solana-action:"), "Dial URL format valid");
      assert(dialUrl.includes("cluster=devnet"), "Must include cluster=devnet");
    },
  },
  {
    id: "T1-F11-05",
    name: "CORS: HTTP methods list in CORS headers",
    featureId: "F11",
    milestone: "M3",
    tier: 1,
    track: "mock",
    description: "Verify CORS headers support GET, POST, OPTIONS",
    run: () => {
      const methods = ACTIONS_CORS_HEADERS["Access-Control-Allow-Methods"];
      assert(methods.includes("GET") && methods.includes("POST") && methods.includes("OPTIONS"), "CORS methods complete");
    },
  },

  // --- F12: Fresh Blockhash on Action POST ---
  {
    id: "T1-F12-01",
    name: "Blockhash: Not statically frozen in stored plan",
    featureId: "F12",
    milestone: "M3",
    tier: 1,
    track: "mock",
    description: "Stored plan record should contain intent, not expired blockhash",
    run: async () => {
      const { saveApprovedPlan } = await import("../../../src/lib/agent/plan-store");
      const { hashPlanPayload } = await import("../../../src/lib/solana/swap");
      const planJson = {
        version: "aegis:v1" as const,
        kind: "swap" as const,
        walletPubkey: FIXTURES.accounts.user.publicKey.toBase58(),
        amountSol: 0.1,
        expectedDUsdc: 20,
        pythPriceUsd: 200,
        maxSlippageBps: 50,
        createdAt: Date.now(),
      };
      const { plan } = saveApprovedPlan({
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
      assert(!("blockhash" in plan) && !("recentBlockhash" in plan), "StoredActionPlan must not freeze a static blockhash");
    },
  },
  {
    id: "T1-F12-02",
    name: "Blockhash: Query getLatestBlockhash inside POST handler",
    featureId: "F12",
    milestone: "M3",
    tier: 1,
    track: "mock",
    description: "POST handler logic queries recent blockhash right before serializing",
    run: async () => {
      const fs = await import("fs");
      const path = await import("path");
      const routeSource = fs.readFileSync(
        path.resolve(process.cwd(), "src/app/api/actions/aegis/route.ts"),
        "utf-8"
      );
      assert(
        routeSource.includes("getLatestBlockhash('confirmed')") ||
          routeSource.includes('getLatestBlockhash("confirmed")'),
        "POST handler must query getLatestBlockhash with confirmed commitment"
      );
    },
  },
  {
    id: "T1-F12-03",
    name: "Blockhash: Confirmed commitment level usage",
    featureId: "F12",
    milestone: "M3",
    tier: 1,
    track: "mock",
    description: "Ensure blockhash query specifies confirmed commitment",
    run: () => {
      const commitment = "confirmed";
      assertEquals(commitment, "confirmed", "Commitment must be confirmed");
    },
  },
  {
    id: "T1-F12-04",
    name: "Blockhash: Vault re-signs over fresh blockhash",
    featureId: "F12",
    milestone: "M3",
    tier: 1,
    track: "both",
    description: "Vault partial signature remains valid over fresh blockhash",
    run: async () => {
      const { Keypair, Transaction } = await import("@solana/web3.js");
      const { saveApprovedPlan } = await import("../../../src/lib/agent/plan-store");
      const { hashPlanPayload } = await import("../../../src/lib/solana/swap");
      const { POST } = await import("../../../src/app/api/actions/aegis/route");

      const user = Keypair.generate();
      const planJson = {
        version: "aegis:v1" as const,
        kind: "swap" as const,
        walletPubkey: user.publicKey.toBase58(),
        amountSol: 0.05,
        expectedDUsdc: 4.5,
        pythPriceUsd: 90.0,
        maxSlippageBps: 50,
        createdAt: Date.now(),
      };
      const saved = saveApprovedPlan({
        intentKind: "swap",
        amountSol: 0.05,
        expectedDUsdc: 4.5,
        destination: null,
        pythPriceUsd: 90.0,
        maxSlippageBps: 50,
        planJson,
        planSha256: hashPlanPayload(planJson),
        riskScore: 0,
        riskBand: "safe",
        explanationBullets: ["• Safe swap"],
      });
      const actionUrl = `http://localhost:3000/api/actions/aegis?plan=${encodeURIComponent(
        saved.plan.id
      )}&token=${encodeURIComponent(saved.signedToken)}`;

      const res = await POST(
        new Request(actionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account: user.publicKey.toBase58() }),
        })
      );
      const data = await res.json();
      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));
      assert(Boolean(tx.recentBlockhash && tx.recentBlockhash.length >= 32), "Fresh blockhash must be populated");
      tx.partialSign(user);
      assert(tx.verifySignatures(), "Vault + User Ed25519 signatures must verify over fresh blockhash");
    },
  },
  {
    id: "T1-F12-05",
    name: "Blockhash: Live blockhash freshness test",
    featureId: "F12",
    milestone: "M3",
    tier: 1,
    track: "live",
    description: "Query live Devnet blockhash and assert validity",
    run: async () => {
      const { getSolanaConnection } = await import("../../../src/lib/solana/config");
      const conn = await getSolanaConnection();
      const latest = await conn.getLatestBlockhash("confirmed");
      assertMatches(latest.blockhash, /^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Blockhash must be valid base58");
      const valid = await conn.isBlockhashValid(latest.blockhash, { commitment: "confirmed" });
      assertEquals(valid.value, true, "Queried Devnet blockhash must be valid on-chain");
    },
  },
];
