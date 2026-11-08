import { chromium, Page } from "playwright";
import * as path from "path";
import * as fs from "fs";

const CLIPS_DIR = path.resolve(process.cwd(), "recordings", "clips");
const TARGET_URL = process.env.TARGET_URL || "https://aegisflow.vercel.app";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const smoothMove = async (page: Page, x: number, y: number, steps = 12) => {
  await page.mouse.move(x, y, { steps });
};

async function main() {
  console.log("=== AegisFlow Individual Master Demo Clips Recorder ===");
  console.log(`Target URL: ${TARGET_URL}`);
  console.log(`Output Directory: ${CLIPS_DIR}`);

  if (!fs.existsSync(CLIPS_DIR)) {
    fs.mkdirSync(CLIPS_DIR, { recursive: true });
  }

  // Launch Chromium in 1920x1080 60fps recording mode
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--window-size=1920,1080",
    ],
  });

  // Create single browser context so localStorage and burner keypair persist across all clips!
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: CLIPS_DIR,
      size: { width: 1920, height: 1080 },
    },
  });

  let currentBalanceLamports = 0; // Starts at 0 before faucet funding

  // Helper to attach realistic route mocking to any page
  const attachRoutes = async (p: Page) => {
    await p.route("**/api/burner-faucet", async (route) => {
      console.log("[Route] Intercepted /api/burner-faucet -> Granting 1.00 SOL Devnet Faucet!");
      currentBalanceLamports = 1_000_000_000; // 1.0 SOL
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          success: true,
          funded: true,
          source: "official_solana_faucet",
          balanceSol: 1.0,
          confirmedBalanceSol: 1.0,
          signature: "5KtPz8vM9Y2xR4q1J7L8nW3hF2vB9mC4xK6pD1sA8yE3zN2w",
          message: "Funded Devnet SOL! (Balance: 1.00 SOL)",
        }),
      });
    });

    await p.route(/devnet\.helius-rpc\.com|api\.devnet\.solana\.com/, async (route) => {
      const req = route.request();
      if (req.method() === "POST") {
        try {
          const postData = req.postDataJSON();
          if (postData && postData.method === "getBalance" && currentBalanceLamports > 0) {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                jsonrpc: "2.0",
                result: {
                  context: { slot: 341029100 },
                  value: currentBalanceLamports,
                },
                id: postData.id,
              }),
            });
            return;
          }
          if (postData && postData.method === "simulateTransaction") {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                jsonrpc: "2.0",
                result: {
                  context: { slot: 341029100 },
                  value: {
                    err: null,
                    logs: [
                      "Program 11111111111111111111111111111111 invoke [1]",
                      "Program 11111111111111111111111111111111 success",
                    ],
                    unitsConsumed: 42350,
                  },
                },
                id: postData.id,
              }),
            });
            return;
          }
          if (postData && postData.method === "sendTransaction") {
            currentBalanceLamports = Math.max(0, currentBalanceLamports - 50_000_000);
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                jsonrpc: "2.0",
                result: "5KtPz8vM9Y2xR4q1J7L8nW3hF2vB9mC4xK6pD1sA8yE3zN2w",
                id: postData.id,
              }),
            });
            return;
          }
          if (postData && (postData.method === "getSignatureStatuses" || postData.method === "getTransaction")) {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                jsonrpc: "2.0",
                result: {
                  context: { slot: 341029105 },
                  value: [{ confirmations: 1, confirmationStatus: "confirmed", err: null, slot: 341029105 }],
                },
                id: postData.id,
              }),
            });
            return;
          }
        } catch {
          // pass through
        }
      }
      await route.continue();
    });
  };

  const finalizeClip = async (p: Page, clipName: string) => {
    const video = p.video();
    await p.close();
    if (video) {
      const origPath = await video.path();
      const targetPath = path.join(CLIPS_DIR, clipName);
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
      fs.renameSync(origPath, targetPath);
      const stat = fs.statSync(targetPath);
      console.log(`[Clip Saved] ${clipName} (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);
    }
  };

  try {
    // =========================================================================
    // CLIP 01: 01-guide.webm (~15s)
    // Habits: Load page, hold on 4-step cards for 4s, scroll to checklist, hold 2s.
    // =========================================================================
    console.log("\n[Recording] 01-guide.webm...");
    {
      const page = await context.newPage();
      await attachRoutes(page);
      await page.goto(TARGET_URL, { waitUntil: "networkidle" });
      await sleep(1000);

      // Hold on hero and brand for 2s
      await smoothMove(page, 200, 30);
      await sleep(2000);

      // Smooth scroll down to 4-Step Pipeline cards
      await page.evaluate(() => window.scrollBy({ top: 320, behavior: "smooth" }));
      await smoothMove(page, 520, 400);
      // Hold on 4-step cards for 4s
      await sleep(4000);

      // Scroll to Checklist
      await page.evaluate(() => window.scrollBy({ top: 380, behavior: "smooth" }));
      await smoothMove(page, 600, 350);
      // Hold for 2.5s
      await sleep(2500);

      await finalizeClip(page, "01-guide.webm");
    }

    // =========================================================================
    // CLIP 02: 02-wallet-faucet.webm (~18s)
    // Habits: Click 1-Click Test Wallet, open modal. Hold on address & 0 balance for 2s.
    // Click Fund. Wait for balance update, hold 2s. Close modal, hold on header balance for 2s.
    // =========================================================================
    console.log("\n[Recording] 02-wallet-faucet.webm...");
    {
      const page = await context.newPage();
      await attachRoutes(page);
      await page.goto(TARGET_URL, { waitUntil: "networkidle" });
      await sleep(800);

      // Click 1-Click Test Wallet button in header
      const testWalletBtn = page.locator("header").getByRole("button", { name: /Test Wallet/i }).first();
      if (await testWalletBtn.isVisible()) {
        const bBox = await testWalletBtn.boundingBox();
        if (bBox) {
          await smoothMove(page, bBox.x + bBox.width / 2, bBox.y + bBox.height / 2);
          await sleep(300);
        }
        await testWalletBtn.click();
        await sleep(800);
      }

      // Open Account / Wallet Modal
      const walletTrigger = page.locator("header").getByLabel("Account and Wallet Settings");
      if (await walletTrigger.isVisible()) {
        const wBox = await walletTrigger.boundingBox();
        if (wBox) {
          await smoothMove(page, wBox.x + wBox.width / 2, wBox.y + wBox.height / 2);
          await sleep(300);
        }
        await walletTrigger.click();
        await sleep(800);
      }

      // Inside modal: ensure on Instant Judge Burner tab
      const instantTab = page.getByRole("button", { name: /Instant Judge Burner/i }).first();
      if (await instantTab.isVisible()) {
        await instantTab.click();
        await sleep(400);
      }

      // Hold on address and 0 balance for 2.5s
      await smoothMove(page, 500, 360);
      await sleep(2500);

      // Click "Fund Wallet with Free Devnet SOL"
      const faucetBtn = page.getByRole("button", {
        name: /Fund Wallet with Free Devnet SOL|Requesting Devnet SOL|Free Devnet SOL/i,
      }).first();
      if (await faucetBtn.isVisible()) {
        const fBox = await faucetBtn.boundingBox();
        if (fBox) {
          await smoothMove(page, fBox.x + fBox.width / 2, fBox.y + fBox.height / 2);
          await sleep(300);
        }
        await faucetBtn.click();
        console.log("[Demo] Clicked Fund Wallet with Free Devnet SOL");
        await sleep(2000); // Wait for funding response
      }

      // Hold on the updated 1.0000 SOL balance inside modal for 2.5s
      await sleep(2500);

      // Close modal
      const closeBtn = page.getByLabel("Close Account Modal").first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      } else {
        await page.keyboard.press("Escape");
      }
      await sleep(600);

      // Hold on header balance for 2.5s
      await smoothMove(page, 1500, 30);
      await sleep(2500);

      await finalizeClip(page, "02-wallet-faucet.webm");
    }

    // =========================================================================
    // CLIP 03: 03-safe-swap.webm (~28s)
    // Habits: Open Copilot. Click Generate Fresh Recipient Address. Click Safe Swap.
    // Click Planner, Scout, Builder, Sentinel (hold 1.5s each). Scroll to Sentinel card, hold 3s.
    // Click Sign & Broadcast, wait for confirmation. Click explorer link, hold 3s on confirmed tx.
    // =========================================================================
    console.log("\n[Recording] 03-safe-swap.webm...");
    {
      const page = await context.newPage();
      await attachRoutes(page);
      await page.goto(TARGET_URL, { waitUntil: "networkidle" });
      await sleep(800);

      // Switch to Copilot tab
      const copilotTab = page.locator("nav").getByRole("button", { name: /AI Copilot/i }).first();
      if (await copilotTab.isVisible()) {
        await copilotTab.click();
        await sleep(800);
      }

      // Click "Generate Fresh Recipient Address"
      const randomizeBtn = page.getByRole("button", {
        name: /Generate Fresh Recipient Address/i,
      }).first();
      if (await randomizeBtn.isVisible()) {
        const rBox = await randomizeBtn.boundingBox();
        if (rBox) {
          await smoothMove(page, rBox.x + rBox.width / 2, rBox.y + rBox.height / 2);
          await sleep(300);
        }
        await randomizeBtn.click();
        await sleep(800);
      }

      // Click Scenario 01: Safe Swap (0.1 SOL -> dUSDC)
      const safeSwapChip = page.getByRole("button", { name: /Safe Swap/i }).first();
      if (await safeSwapChip.isVisible()) {
        const sBox = await safeSwapChip.boundingBox();
        if (sBox) {
          await smoothMove(page, sBox.x + sBox.width / 2, sBox.y + sBox.height / 2);
          await sleep(300);
        }
        await safeSwapChip.click();
      }

      // Wait for agent pipeline and sentinel report
      console.log("[Demo] Waiting for simulation & sentinel report...");
      await page.waitForSelector("text=Pre-Flight Sentinel Risk Assessment", {
        timeout: 25000,
      });
      await sleep(800);

      // Click Planner stage box, hold 1.5s
      const plannerStep = page.getByRole("button", { name: /1\. Planner/i }).first();
      if (await plannerStep.isVisible()) {
        await plannerStep.click();
        await sleep(1500);
      }

      // Click Scout stage box, hold 1.5s
      const scoutStep = page.getByRole("button", { name: /2\. Scout/i }).first();
      if (await scoutStep.isVisible()) {
        await scoutStep.click();
        await sleep(1500);
      }

      // Click Builder stage box, hold 1.5s
      const builderStep = page.getByRole("button", { name: /3\. Builder/i }).first();
      if (await builderStep.isVisible()) {
        await builderStep.click();
        await sleep(1500);
      }

      // Click Sentinel stage box, hold 1.5s
      const sentinelStep = page.getByRole("button", { name: /4\. Sentinel/i }).first();
      if (await sentinelStep.isVisible()) {
        await sentinelStep.click();
        await sleep(1500);
      }

      // Scroll smoothly to Sentinel Risk Card and hold for 3s
      await page.evaluate(() => window.scrollBy({ top: 380, behavior: "smooth" }));
      await smoothMove(page, 700, 450);
      await sleep(3000);

      // Click "1-Click Sign & Broadcast"
      const signBtn = page.getByRole("button", {
        name: /1-Click Sign & Broadcast|1-Click Sign with Judge Burner|Sign & Execute Transaction/i,
      }).first();
      if (await signBtn.isVisible()) {
        const signBox = await signBtn.boundingBox();
        if (signBox) {
          await smoothMove(page, signBox.x + signBox.width / 2, signBox.y + signBox.height / 2);
          await sleep(300);
        }
        await signBtn.click();
        console.log("[Demo] Clicked 1-Click Sign & Broadcast!");
        await sleep(2000);
      }

      // Scroll down slightly to make receipt & explorer link prominent
      await page.evaluate(() => window.scrollBy({ top: 220, behavior: "smooth" }));
      await sleep(1500);

      // Click View on Solana Explorer link (intercept popup)
      const explorerLink = page.getByRole("link", { name: /View on Solana Explorer/i }).first();
      if (await explorerLink.isVisible()) {
        const linkBox = await explorerLink.boundingBox();
        if (linkBox) {
          await smoothMove(page, linkBox.x + linkBox.width / 2, linkBox.y + linkBox.height / 2);
          await sleep(300);
        }
        // Hold on the confirmed receipt and explorer link for 3s
        await sleep(3000);
      }

      await finalizeClip(page, "03-safe-swap.webm");
    }

    // =========================================================================
    // CLIP 04: 04-injection-attack.webm (~15s)
    // Habits: Click Prompt Injection Attack, wait for pipeline. Hold 3s on blocked stages,
    // scroll to risk card, show disabled execute button (hold 3s).
    // =========================================================================
    console.log("\n[Recording] 04-injection-attack.webm...");
    {
      const page = await context.newPage();
      await attachRoutes(page);
      await page.goto(TARGET_URL, { waitUntil: "networkidle" });
      await sleep(800);

      // Open Copilot
      const copilotTab = page.locator("nav").getByRole("button", { name: /AI Copilot/i }).first();
      if (await copilotTab.isVisible()) {
        await copilotTab.click();
        await sleep(800);
      }

      // Click Prompt Injection Attack preset
      const injectionChip = page.getByRole("button", {
        name: /Prompt Injection Attack/i,
      }).first();
      if (await injectionChip.isVisible()) {
        const injBox = await injectionChip.boundingBox();
        if (injBox) {
          await smoothMove(page, injBox.x + injBox.width / 2, injBox.y + injBox.height / 2);
          await sleep(300);
        }
        await injectionChip.click();
      }

      // Wait for pipeline to finish
      await sleep(2500);

      // Hold on the blocked stages in timeline for 3s
      await smoothMove(page, 700, 360);
      await sleep(3000);

      // Scroll down to the Risk Card (100/100 Blocked)
      await page.evaluate(() => window.scrollBy({ top: 420, behavior: "smooth" }));
      await smoothMove(page, 700, 480);
      // Hold on blocked card and disabled execute button for 3.5s
      await sleep(3500);

      await finalizeClip(page, "04-injection-attack.webm");
    }

    // =========================================================================
    // CLIP 05: 05-safety-lab.webm (~15s)
    // Habits: Drag slippage slider to 15%, hold 2s. Click Known Drainer, hold 3s on 100/100,
    // click back to Verified.
    // =========================================================================
    console.log("\n[Recording] 05-safety-lab.webm...");
    {
      const page = await context.newPage();
      await attachRoutes(page);
      await page.goto(TARGET_URL, { waitUntil: "networkidle" });
      await sleep(800);

      // Switch to Tab 03: Safety Lab
      const safetyTab = page.locator("nav").getByRole("button", { name: /Safety Lab/i }).first();
      if (await safetyTab.isVisible()) {
        await safetyTab.click();
        await sleep(800);
      }

      // Scroll to simulator controls
      await page.evaluate(() => window.scrollBy({ top: 260, behavior: "smooth" }));
      await sleep(800);

      // Drag slippage slider to 15%
      const slippageSlider = page.locator('input[type="range"]').first();
      if (await slippageSlider.isVisible()) {
        await slippageSlider.fill("15");
        await sleep(500);
      }
      // Hold for 2s
      await sleep(2000);

      // Click "Known Drainer (+100)"
      const drainerBtn = page.getByRole("button", { name: /Known Drainer/i }).first();
      if (await drainerBtn.isVisible()) {
        const dBox = await drainerBtn.boundingBox();
        if (dBox) {
          await smoothMove(page, dBox.x + dBox.width / 2, dBox.y + dBox.height / 2);
          await sleep(300);
        }
        await drainerBtn.click();
        console.log("[Demo] Toggled Known Drainer (+100)");
      }
      // Hold 3s on 100/100 score
      await sleep(3000);

      // Click back to "Verified / Fresh"
      const verifiedBtn = page.getByRole("button", { name: /Verified \/ Fresh/i }).first();
      if (await verifiedBtn.isVisible()) {
        await verifiedBtn.click();
        console.log("[Demo] Clicked Verified / Fresh");
        await sleep(2000);
      }

      await finalizeClip(page, "05-safety-lab.webm");
    }

    // =========================================================================
    // CLIP 06: 06-token-auditor.webm (~16s)
    // Habits: Click Wrapped SOL, hold 3s on SAFE result. Click PayPal USD, hold 3s on PermanentDelegate,
    // scroll to rug-pull simulator and toggle extensions.
    // =========================================================================
    console.log("\n[Recording] 06-token-auditor.webm...");
    {
      const page = await context.newPage();
      await attachRoutes(page);
      await page.goto(TARGET_URL, { waitUntil: "networkidle" });
      await sleep(800);

      // Switch to Tab 04: Token Auditor
      const auditorTab = page.locator("nav").getByRole("button", { name: /Token Auditor/i }).first();
      if (await auditorTab.isVisible()) {
        await auditorTab.click();
        await sleep(800);
      }

      // Click Wrapped SOL (Safe Benchmark)
      const wsolChip = page.getByRole("button", { name: /Wrapped SOL/i }).first();
      if (await wsolChip.isVisible()) {
        await wsolChip.click();
      }
      // Hold 3s on 0/100 SAFE result!
      await smoothMove(page, 700, 380);
      await sleep(3000);

      // Click PayPal USD (Token-2022 PermanentDelegate)
      const pyusdChip = page.getByRole("button", { name: /PayPal USD/i }).first();
      if (await pyusdChip.isVisible()) {
        await pyusdChip.click();
      }
      // Hold 3s on PayPal USD PermanentDelegate audit
      await smoothMove(page, 700, 420);
      await sleep(3000);

      // Scroll down to Interactive Token-2022 Rug-Pull Simulator
      await page.evaluate(() => window.scrollBy({ top: 520, behavior: "smooth" }));
      await sleep(800);

      // Toggle Freeze Authority checkbox
      const freezeToggle = page.getByLabel(/Freeze Authority Active/i).first();
      if (await freezeToggle.isVisible()) {
        await freezeToggle.click();
        await sleep(1500);
      }

      // Hold on the simulator result for 2.5s
      await sleep(2500);

      await finalizeClip(page, "06-token-auditor.webm");
    }

    // =========================================================================
    // CLIP 07: 07-proofs.webm (~15s)
    // Habits: Open Proofs, scroll slowly. Click Ping GET /actions.json, scroll so full
    // response & latency are visible (hold 3s). Show 254/254 scorecard.
    // =========================================================================
    console.log("\n[Recording] 07-proofs.webm...");
    {
      const page = await context.newPage();
      await attachRoutes(page);
      await page.goto(TARGET_URL, { waitUntil: "networkidle" });
      await sleep(800);

      // Switch to Tab 05: Interactive Proofs
      const proofsTab = page.locator("nav").getByRole("button", { name: /Interactive Proofs/i }).first();
      if (await proofsTab.isVisible()) {
        await proofsTab.click();
        await sleep(800);
      }

      // Scroll slowly to Live Backend API Inspector
      await page.evaluate(() => window.scrollBy({ top: 560, behavior: "smooth" }));
      await sleep(1000);

      // Click "Ping GET /actions.json"
      const pingBtn = page.getByRole("button", { name: /Ping GET \/actions\.json/i }).first();
      if (await pingBtn.isVisible()) {
        const pBox = await pingBtn.boundingBox();
        if (pBox) {
          await smoothMove(page, pBox.x + pBox.width / 2, pBox.y + pBox.height / 2);
          await sleep(300);
        }
        await pingBtn.click();
        console.log("[Demo] Clicked Ping GET /actions.json");
        await sleep(1200);
      }

      // Scroll down so full response and latency are clearly visible
      await page.evaluate(() => window.scrollBy({ top: 200, behavior: "smooth" }));
      // Hold 3s on HTTP 200 response
      await sleep(3000);

      // Scroll to 254/254 Scorecard
      await page.evaluate(() => window.scrollBy({ top: 380, behavior: "smooth" }));
      await smoothMove(page, 700, 400);
      // Hold 3s on 254/254 Scorecard
      await sleep(3000);

      await finalizeClip(page, "07-proofs.webm");
    }

    // =========================================================================
    // CLIP 08: 08-dial-blink.webm (~12s) (Bonus / Dial.to Blink Inspector)
    // Habits: Show the Solana Blink URL and Dial.to integration
    // =========================================================================
    console.log("\n[Recording] 08-dial-blink.webm...");
    {
      const page = await context.newPage();
      await attachRoutes(page);
      await page.goto(TARGET_URL, { waitUntil: "networkidle" });
      await sleep(800);

      // Open Copilot and show Blink URL button
      const copilotTab = page.locator("nav").getByRole("button", { name: /AI Copilot/i }).first();
      if (await copilotTab.isVisible()) {
        await copilotTab.click();
        await sleep(800);
      }

      // Click Safe Swap to produce the Blink card
      const safeSwapChip = page.getByRole("button", { name: /Safe Swap/i }).first();
      if (await safeSwapChip.isVisible()) {
        await safeSwapChip.click();
        await page.waitForSelector("text=Share as a Solana Blink", { timeout: 25000 });
        await sleep(800);
      }

      // Scroll down to Blink controls
      await page.evaluate(() => window.scrollBy({ top: 700, behavior: "smooth" }));
      await sleep(1000);

      // Click "Copy Blink URL"
      const copyBlinkBtn = page.getByRole("button", { name: /Copy Blink URL/i }).first();
      if (await copyBlinkBtn.isVisible()) {
        const cBox = await copyBlinkBtn.boundingBox();
        if (cBox) {
          await smoothMove(page, cBox.x + cBox.width / 2, cBox.y + cBox.height / 2);
          await sleep(300);
        }
        await copyBlinkBtn.click();
        console.log("[Demo] Clicked Copy Blink URL");
      }
      // Hold on Blink action card for 3s
      await sleep(3000);

      await finalizeClip(page, "08-dial-blink.webm");
    }

    console.log("\n=== All 8 Individual Demo Clips Successfully Recorded! ===");
    console.log(`Directory: ${CLIPS_DIR}`);
  } catch (err) {
    console.error("[Clips Recording Error]", err);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
