# AegisFlow 🛡️⚡

> **AI DeFi Copilot with Pre-Flight Guardrails, Verifiable On-Chain Memo Proofs & Solana Blinks**  
> *Built for the MLH Solana Hackathon — AI Track · Top 3 Overall · Best Beginner Hack*

AegisFlow turns plain-English Solana DeFi intents into simulated, policy-audited transactions and shareable **Solana Actions / Blinks (`v2.2.1`)** on **Solana Devnet**. Instead of asking users to blind-sign opaque hex payloads—or letting an LLM touch private keys—AegisFlow routes every request through a **5-stage LangGraph Sentinel pipeline** backed by a **deterministic TypeScript risk engine** that an LLM can never override.

---

## System Architecture

```text
User Prompt ("Swap 0.1 SOL to USDC with 50bps slippage")
     │
     ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                5-Stage LangGraph.js Sentinel Pipeline                     │
│                                                                           │
│  [1. Planner]  ──► Gemini Flash Lite + Zod (DeFiIntentSchema)             │
│       │            + Deterministic multilingual prompt-injection filter   │
│       ▼                                                                   │
│  [2. Scout]    ──► Live SOL/USD Oracle Cascade + Read-Only Jupiter Quote  │
│       │                                                                   │
│  [3. Builder]  ──► Deterministic @solana/web3.js (v1.99.0) Tx Assembly    │
│       │            4-leg Atomic Swap OR SOL Transfer + SPL Memo           │
│       │            Memo payload: "aegis:v1:<sha256-of-canonical-plan>"    │
│       ▼                                                                   │
│  [4. Sentinel] ──► Live Devnet simulateTransaction + Balance Delta Parser │
│       │            + Pure TypeScript 6-Rule Risk Engine (Score 0–100)     │
│       │            + Plain-English 3–5 Bullet Summary                     │
│       ▼                                                                   │
│  [5. Gate]     ──► Score >= 50: HARD BLOCK (actionUrl = null)             │
│                    Score <  50: Mint HMAC-Signed Solana Action / Blink    │
└───────────────────────────────────────────────────────────────────────────┘
     │
     ▼
Solana Actions v2.2.1 (/api/actions/aegis + /actions.json)
  • GET  -> Blink card metadata (icon, title, risk badge, plain-English summary)
  • POST -> Fetches FRESH confirmed blockhash, verifies SHA-256 plan hash,
            applies Devnet Vault partial signature, returns base64 transaction
     │
     ▼
Non-Custodial Co-Signing (Phantom / Solflare OR 1-Click Judge Burner Wallet)
```

---

## Where AI and Solana each do real work

Judges righteously scrutinize AI + Web3 projects where either the AI is a wrapper or the blockchain is an afterthought. In AegisFlow, both sides perform irreplaceable technical work:

| Layer | Component | Concrete Work Performed |
| :--- | :--- | :--- |
| **AI Layer** | **LangGraph `Planner` (`gemini-flash-lite-latest` + Zod)** | Translates unstructured natural language into strict `DeFiIntentSchema` (`swap`, `transfer`, `portfolio_query`, `unsupported`) while flagging jailbreaks and adversarial overrides. Includes full deterministic offline fallback when `GEMINI_API_KEY` is absent. |
| **AI Layer** | **LangGraph `Sentinel` Narrator** | Translates raw Solana simulation logs, lamport/micro-token deltas, and compute units into 3–5 plain-English bullets before the user signs. |
| **Deterministic Boundary** | **6-Rule Policy Engine (`src/lib/agent/policy.ts`)** | Pure TypeScript scoring (`0–100`): verifies RPC simulation success, enforces a strict 5-program allow-list (`System`, `Token`, `ATA`, `Memo`, `ComputeBudget`), checks spending caps, checks oracle/slippage bounds, screens against drainer blocklists, and blocks prompt-injection signals. **The LLM cannot alter or override this score.** |
| **Solana Layer** | **Atomic Multi-Signer Swap + `Memo` (`src/lib/solana/swap.ts`)** | Assembles a single 572-byte atomic transaction combining: (1) Idempotent User ATA creation, (2) `SystemProgram.transfer` (`SOL` User → Vault), (3) `SPL Token` transfer (`dUSDC` Vault → User), and (4) `SPL Memo` anchoring `aegis:v1:<sha256(plan)>` on-chain for verifiable AI auditability. |
| **Solana Layer** | **Pre-Flight RPC Simulation (`src/lib/solana/simulation.ts`)** | Executes `connection.simulateTransaction` on Solana Devnet, decodes binary `AccountLayout` token balances & instruction layouts, and extracts exact user/vault deltas + compute units (`42,350 CU`). |
| **Solana Layer** | **Solana Actions & Blinks (`src/app/api/actions/aegis/route.ts`)** | Implements `@solana/actions` `v2.2.1` (`GET`/`POST`/`OPTIONS` + `/actions.json` with `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` Devnet headers), fetching a **fresh confirmed blockhash on `POST`** so Blinks never expire while a user reads the risk card. |
| **Solana Layer** | **SPL Token & Token-2022 Scanner (`src/lib/solana/scanner.ts`)** | Unpacks live on-chain binary `Mint` accounts and Token-2022 TLV extensions (`PermanentDelegate`, `TransferHook`, `TransferFeeConfig`, active `FreezeAuthority`, top-holder concentration). |

---

## Devnet Honesty Note

Transparency matters in security engineering:

1. **Devnet Liquidity Vault vs. Mainnet Aggregators**: Mainnet DEX aggregators (like Jupiter v6) do not maintain deep, reliable liquidity pools across arbitrary Devnet test mints. To make swaps genuinely executable, deterministic, and atomic on **Solana Devnet**, AegisFlow settles `SOL -> dUSDC` swaps against a dedicated **AegisFlow Devnet Liquidity Vault** (`vault` partial-signing over a 6-decimal SPL `dUSDC` mint) priced live in real time via our SOL/USD oracle cascade, while displaying a **live read-only Jupiter Mainnet quote** side-by-side so users can verify real-world Mainnet spread (`~0.12%`).
2. **Public Devnet Faucet Resilience (HTTP 410)**: When Solana's public RPC `requestAirdrop` returns `HTTP 410 Gone` (rate-limited), AegisFlow never fakes an on-chain transaction hash. Instead:
   - Funded Devnet wallets broadcast on-chain and return a live `https://explorer.solana.com/tx/<sig>?cluster=devnet` confirmation link.
   - Unfunded (`0 SOL`) Devnet or Guest Burner wallets execute live Devnet RPC pre-flight checks and verify real 2-of-2 Ed25519 co-signatures (`User + Vault`), clearly labeling unfunded preview mode and linking to the Burner Micro-Faucet / [faucet.solana.com](https://faucet.solana.com).

---

## What I learned about Solana in 30 hours

Building AegisFlow from scratch as a Solana newcomer taught me five foundational lessons that completely changed how I think about blockchain engineering:

1. **Solana's Account & Associated Token Account (ATA) Model**: Unlike EVM where token balances live inside a contract's internal mapping, every Solana wallet holds SPL tokens in a deterministic **Associated Token Account** derived from `(owner, TOKEN_PROGRAM_ID, mint)`. Including `createAssociatedTokenAccountIdempotentInstruction` as Instruction 0 made first-time swaps seamless without failing if the user already held `dUSDC`.
2. **Multi-Signer Atomic Composability**: Packing an ATA creation, native `SystemProgram` SOL transfer, `SPL Token` transfer, and `SPL Memo` SHA-256 commitment into a single **572-byte** transaction—co-signed by both the server vault (`partialSign`) and the user's browser wallet—showed why Solana's parallel account-locking runtime feels purpose-built for atomic DeFi guardrails.
3. **Blockhash Lifetimes in Solana Actions / Blinks**: A Solana blockhash expires after ~150 blocks (~60–90 seconds). Freezing a serialized transaction at AI planning time causes Blinks to fail if a user spends a minute reading the risk report. Storing the HMAC-signed canonical plan and fetching `getLatestBlockhash('confirmed')` inside `POST /api/actions/aegis` solved stale blockhashes permanently.
4. **Token-2022 TLV Binary Extensions**: Unpacking raw mint bytes with `@solana/spl-token` revealed how Token-2022 appends Type-Length-Value (TLV) extensions after byte 82/165—allowing tokens like PayPal USD (`PYUSD`) to embed `PermanentDelegate` and `TransferHook` capabilities that everyday traders rarely realize exist until a scanner surfaces them.
5. **Pinning `@solana/web3.js` `1.99.0`**: Mixing `@solana/web3.js` `1.x` (used by `@solana/wallet-adapter-*` and `@solana/actions`) with `2.x` / `@solana/kit` breaks `PublicKey` and `VersionedTransaction` serialization across boundaries. Enforcing `"@solana/web3.js": "1.99.0"` via `overrides` kept every server and browser boundary rock-solid.

---

## Features & Stretch Goals Implemented

- **Core Gate G1–G5**: 5-stage LangGraph Sentinel, 6-rule deterministic guardrail engine, atomic Devnet swap & transfer builders, SPL `Memo` SHA-256 plan anchoring, and Solana Actions / Blinks (`GET`/`POST`/`OPTIONS` + `/actions.json`).
- **Stretch S1 — Interactive 5-Stage Pipeline Timeline**: Expandable per-node telemetry (`Planner`, `Scout`, `Builder`, `Sentinel`, `Policy Gate`) with millisecond latency badges.
- **Stretch S2 — SPL Token & Token-2022 Safety Scanner**: Live Mainnet & Devnet binary mint unpacking (`/api/scanner`) detecting active Mint/Freeze authorities, `PermanentDelegate`, `TransferHook`, and `TransferFeeConfig`.
- **Stretch S3 — 1-Click Judge / Guest Burner Wallet**: Ephemeral in-browser Ed25519 keypair with RAM-only Incognito fallback, `/api/burner-faucet` micro-funding, 1-click Blink co-signing without browser extensions, and zero-fill key destruction (`secretKey.fill(0)`).
- **Stretch S4 — Live Jupiter Mainnet Reference Quote**: Side-by-side comparison between Devnet execution pricing and live Mainnet Jupiter AMM routing.
- **Stretch S5 — Prompt-Injection Red-Team Suite**: Multilingual (`ES`/`FR`/`EN`), roleplay/DAN, base64-obfuscated, SQL/XSS, unknown-program, and drainer-blocklist attack presets blocked deterministically.

---

## Quick Start & Verification Commands

### 1. Prerequisites & Installation

- **Node.js** `v20+` or `v22+`
- Single pinned `@solana/web3.js` `1.99.0` (enforced via `package.json` `overrides`)

```bash
npm install
npm run verify:deps
```

### 2. Environment Setup

```bash
cp .env.example .env.local
```

> **Zero-Key Offline Resilience**: Even if `.env.local` is omitted or `GEMINI_API_KEY` is left blank, AegisFlow boots, simulates on Solana Devnet, runs all deterministic guardrails, and passes the entire test suite via its deterministic NLP & explanation fallback.

Optional Devnet vault provisioning (mints `dUSDC` if funded, or configures canonical Devnet preview metadata if the public faucet returns HTTP 410):

```bash
npm run setup:vault
```

### 3. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the **Copilot & Sentinel Console**, **1-Click Judge Burner Wallet**, and **Token Safety Scanner**.

### 4. Full Gate & 254-Test E2E Verification Suite

Every subsystem and boundary is verified by automated CLI gates and a 4-tier E2E suite (`254` tests across Feature, Boundary, Pairwise Integration, and End-to-End Persona Scenarios):

```bash
npm run typecheck
npm run lint
npm run build
npm run test:solana-devnet
npm run test:devnet-swap
npm run test:agent-baseline
npm run test:agent-pipeline
npm run test:blinks-api
npm run test:e2e
```

To run both the hermetic mock track and live Solana RPC / oracle track together (`254` total tests):

```bash
npx tsx scripts/run-e2e-suite.ts --track both
```

---

## Project Structure

```text
src/
├── app/
│   ├── actions.json/route.ts         # Solana Actions discovery rules + CORS
│   ├── api/actions/aegis/route.ts    # Solana Blink GET/POST/OPTIONS (fresh blockhash + Vault co-sig)
│   ├── api/agent/route.ts            # Unified 5-stage LangGraph Sentinel API
│   ├── api/burner-faucet/route.ts    # Rate-limited Judge Burner micro-funding endpoint
│   ├── api/scanner/route.ts          # SPL Token & Token-2022 safety scanner API
│   └── page.tsx                      # Responsive Copilot, Risk Card, Blink & Scanner UI
├── components/
│   ├── ActionCard.tsx                # In-app Blink card (Wallet Adapter + Burner co-signing)
│   ├── AgentTimeline.tsx             # 5-stage expandable LangGraph telemetry bar
│   ├── BurnerWalletModal.tsx         # Ephemeral Devnet burner manager + memory zeroing
│   ├── ChatInterface.tsx             # Conversational input + 1-click Red-Team presets
│   ├── RiskCard.tsx                  # 0-100 gauge, simulated deltas, Memo hash & Jupiter quote
│   └── TokenScanner.tsx              # SPL / Token-2022 authority & TLV extension inspector
└── lib/
    ├── agent/                        # schema.ts, policy.ts, prompts.ts, plan-store.ts, graph.ts
    └── solana/                       # config.ts, pyth.ts, jupiter.ts, vault.ts, swap.ts,
                                      # transfer.ts, simulation.ts, scanner.ts, burner.ts
```

---

## License

MIT
