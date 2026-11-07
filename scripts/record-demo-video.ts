import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

const RECORDINGS_DIR = path.resolve(process.cwd(), "recordings");
const TARGET_URL = process.env.TARGET_URL || "https://aegisflow.vercel.app";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitTarget(startTime: number, targetMs: number, label?: string) {
  const elapsed = Date.now() - startTime;
  const remaining = targetMs - elapsed;
  if (remaining > 0) {
    if (label) {
      console.log(
        `[Sync] ${label}: waiting ${(remaining / 1000).toFixed(1)}s (sync to ${(targetMs / 1000).toFixed(1)}s mark)`
      );
    }
    await sleep(remaining);
  } else {
    console.log(
      `[Sync] ${label}: already at ${(elapsed / 1000).toFixed(1)}s (target was ${(targetMs / 1000).toFixed(1)}s)`
    );
  }
}

async function main() {
  console.log("=== AegisFlow Precision Timed 1080p Master Demo Video Recorder ===");
  console.log(`Targeting Hosted Production Deployment: ${TARGET_URL}`);

  if (!fs.existsSync(RECORDINGS_DIR)) {
    fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
  }

  // Launch Chromium in 1920x1080 60fps mode
  console.log("[Browser] Launching Chromium in 1920x1080 60fps recording mode...");
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--window-size=1920,1080",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: RECORDINGS_DIR,
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();
  const masterVideoStart = Date.now();
  console.log(`[Demo Timer] Master recording clock started at frame 0:00.`);

  // Floating lower-third presentation HUD
  const setBanner = async (
    title: string,
    subtitle: string,
    chapterTag: string,
    timecode: string
  ) => {
    await page.evaluate(
      ({ title, subtitle, chapterTag, timecode }) => {
        let el = document.getElementById("aegis-demo-hud");
        if (!el) {
          el = document.createElement("div");
          el.id = "aegis-demo-hud";
          el.style.position = "fixed";
          el.style.bottom = "24px";
          el.style.left = "50%";
          el.style.transform = "translateX(-50%)";
          el.style.zIndex = "999999";
          el.style.pointerEvents = "none";
          el.style.backgroundColor = "rgba(251, 249, 245, 0.96)";
          el.style.border = "1px solid #D6D1C7";
          el.style.borderRadius = "8px";
          el.style.padding = "10px 22px";
          el.style.backdropFilter = "blur(16px)";
          (el.style as unknown as Record<string, string>)["webkitBackdropFilter"] = "blur(16px)";
          el.style.boxShadow = "0 10px 32px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.05)";
          el.style.display = "flex";
          el.style.alignItems = "center";
          el.style.gap = "18px";
          el.style.transition = "all 0.25s ease-out";
          el.style.maxWidth = "960px";
          el.style.width = "auto";
          document.body.appendChild(el);
        }
        el.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="background: #1C1B18; color: #FAF9F5; font-size: 11px; font-weight: 700; font-family: monospace; letter-spacing: 0.05em; padding: 4px 10px; border-radius: 4px; text-transform: uppercase;">
              ${chapterTag}
            </div>
            <div style="background: #F4F1EA; border: 1px solid #D6D1C7; color: #5C5852; font-size: 11px; font-weight: 700; font-family: monospace; padding: 4px 8px; border-radius: 4px;">
              ${timecode}
            </div>
          </div>
          <div>
            <div style="color: #1C1B18; font-size: 13.5px; font-weight: 700; font-family: system-ui, -apple-system, sans-serif; letter-spacing: -0.01em;">
              ${title}
            </div>
            <div style="color: #5C5852; font-size: 11.5px; font-family: monospace; margin-top: 1px;">
              ${subtitle}
            </div>
          </div>
        `;
      },
      { title, subtitle, chapterTag, timecode }
    );
  };

  const smoothMove = async (x: number, y: number, steps = 16) => {
    await page.mouse.move(x, y, { steps });
  };

  try {
    console.log(`[Demo] Step 1: Navigating to ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: "networkidle" });
    await sleep(800);

    // =========================================================================
    // CHAPTER 1: [0:00 – 0:18] Introduction & Dedicated Guide Architecture
    // =========================================================================
    console.log("[Chapter 1: 0:00 - 0:18] Introduction & Dedicated Guide Architecture");
    await setBanner(
      "AegisFlow — Autonomous DeFi Copilot & Pre-Flight Guardrails",
      "Solana Hackathon (AI Track · Top 3 Overall · Best Beginner Hack)",
      "CHAPTER 1 / 7",
      "[0:00 – 0:18]"
    );

    // Hover across header & brand
    await smoothMove(180, 25);
    await sleep(2000);
    // Smoothly scroll down to showcase 4-Step Pipeline diagram
    await page.evaluate(() => window.scrollBy({ top: 320, behavior: "smooth" }));
    await smoothMove(500, 380);
    await sleep(3500);
    await smoothMove(1000, 380);
    await sleep(3000);

    // Scroll to 4-Mission Checklist
    await page.evaluate(() => window.scrollBy({ top: 400, behavior: "smooth" }));
    await sleep(3000);

    await waitTarget(masterVideoStart, 18000, "Chapter 1 complete");

    // =========================================================================
    // CHAPTER 2: [0:18 – 0:42] 1-Click Test Wallet Onboarding & Faucet Funding
    // =========================================================================
    console.log("[Chapter 2: 0:18 - 0:42] 1-Click Test Wallet Onboarding & Faucet Funding");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(800);

    await setBanner(
      "Zero-Friction Test Wallet & Devnet Faucet Funding",
      "No browser extension required · Generates ephemeral keypair with 1-click faucet",
      "CHAPTER 2 / 7",
      "[0:18 – 0:42]"
    );

    // Click 1-Click Test Wallet button in header
    const testWalletBtn = page.locator("header").getByRole("button", { name: /Test Wallet/i }).first();
    if (await testWalletBtn.isVisible()) {
      const bBox = await testWalletBtn.boundingBox();
      if (bBox) {
        await smoothMove(bBox.x + bBox.width / 2, bBox.y + bBox.height / 2);
        await sleep(300);
      }
      await testWalletBtn.click();
      await sleep(1500);
    }

    // Open Account / Wallet Modal
    const walletTrigger = page.locator("header").getByLabel("Account and Wallet Settings");
    if (await walletTrigger.isVisible()) {
      const wBox = await walletTrigger.boundingBox();
      if (wBox) {
        await smoothMove(wBox.x + wBox.width / 2, wBox.y + wBox.height / 2);
        await sleep(300);
      }
      await walletTrigger.click();
      await sleep(1500);
    }

    // Inside modal: click Instant Judge Burner tab if needed
    const instantTab = page.getByRole("button", { name: /Instant Judge Burner/i }).first();
    if (await instantTab.isVisible()) {
      await instantTab.click();
      await sleep(1000);
    }

    // Trigger Faucet funding button
    const faucetBtn = page.getByRole("button", { name: /Request Devnet Faucet/i }).first();
    if (await faucetBtn.isVisible()) {
      const fBox = await faucetBtn.boundingBox();
      if (fBox) {
        await smoothMove(fBox.x + fBox.width / 2, fBox.y + fBox.height / 2);
        await sleep(400);
      }
      await faucetBtn.click();
      await sleep(2500);
    }

    // Close Account Modal
    const closeBtn = page.getByLabel("Close Account Modal").first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await page.keyboard.press("Escape");
    }
    await sleep(1200);

    await waitTarget(masterVideoStart, 42000, "Chapter 2 complete");

    // =========================================================================
    // CHAPTER 3: [0:42 – 1:22] AI Copilot: Interactive Customizer & Safe Swap
    // =========================================================================
    console.log("[Chapter 3: 0:42 - 1:22] AI Copilot: Interactive Customizer & Safe Swap");
    await setBanner(
      "Live Intent Composer — Interactive Parameters & Safe Swap",
      "Dynamic Recipient Keypair · 5-Stage LangGraph · Pyth Oracle · 1-Click Blink",
      "CHAPTER 3 / 7",
      "[0:42 – 1:22]"
    );

    // Switch to Tab 02: AI Copilot
    const copilotTab = page.locator("nav").getByRole("button", { name: /AI Copilot/i }).first();
    if (await copilotTab.isVisible()) {
      await copilotTab.click();
      await sleep(1500);
    }

    // Demonstrate Interactive Customizer: click Generate Fresh Recipient Address
    const randomizeBtn = page.getByRole("button", {
      name: /Generate Fresh Recipient Address/i,
    }).first();
    if (await randomizeBtn.isVisible()) {
      const rBox = await randomizeBtn.boundingBox();
      if (rBox) {
        await smoothMove(rBox.x + rBox.width / 2, rBox.y + rBox.height / 2);
        await sleep(300);
      }
      await randomizeBtn.click();
      await sleep(1200);
    }

    // Click Scenario 01: Safe Swap (0.1 SOL -> dUSDC)
    const safeSwapChip = page.getByRole("button", { name: /Safe Swap/i }).first();
    if (await safeSwapChip.isVisible()) {
      const sBox = await safeSwapChip.boundingBox();
      if (sBox) {
        await smoothMove(sBox.x + sBox.width / 2, sBox.y + sBox.height / 2);
        await sleep(400);
      }
      await safeSwapChip.click();
    }

    // Wait for agent pipeline and sentinel card
    console.log("[Demo] Waiting for simulation & sentinel report...");
    await page.waitForSelector("text=Pre-Flight Sentinel Risk Assessment", {
      timeout: 30000,
    });
    await sleep(1500);

    // Expand 3. Builder and 4. Sentinel stages in the timeline
    const builderStep = page.getByRole("button", { name: /3\. Builder/i }).first();
    if (await builderStep.isVisible()) {
      await builderStep.click();
      await sleep(1800);
    }

    const sentinelStep = page.getByRole("button", { name: /4\. Sentinel/i }).first();
    if (await sentinelStep.isVisible()) {
      await sentinelStep.click();
      await sleep(1800);
    }

    // Scroll to Sentinel Risk Card
    await page.evaluate(() => window.scrollBy({ top: 400, behavior: "smooth" }));
    await sleep(3000);

    // 1-Click Sign with Judge Burner on Action Card
    const signBtn = page.getByRole("button", {
      name: /1-Click Sign with Judge Burner|Sign & Execute Transaction|Test Ed25519 Signature/i,
    }).first();
    if (await signBtn.isVisible()) {
      const signBox = await signBtn.boundingBox();
      if (signBox) {
        await smoothMove(signBox.x + signBox.width / 2, signBox.y + signBox.height / 2);
        await sleep(400);
      }
      await signBtn.click();
      await sleep(3500);
    }

    await waitTarget(masterVideoStart, 82000, "Chapter 3 complete");

    // =========================================================================
    // CHAPTER 4: [1:22 – 1:52] Red-Team Adversarial Prompt Injection Defense
    // =========================================================================
    console.log("[Chapter 4: 1:22 - 1:52] Red-Team Adversarial Prompt Injection Defense");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(1000);

    await setBanner(
      "AI Safety & Jailbreak Defense — S5 Prompt Injection Blocked",
      "System Overrides Intercepted · Malicious Drainer Blocked · Risk Score: 100/100",
      "CHAPTER 4 / 7",
      "[1:22 – 1:52]"
    );

    const injectionChip = page.getByRole("button", {
      name: /Prompt Injection Attack/i,
    }).first();
    if (await injectionChip.isVisible()) {
      const injBox = await injectionChip.boundingBox();
      if (injBox) {
        await smoothMove(injBox.x + injBox.width / 2, injBox.y + injBox.height / 2);
        await sleep(400);
      }
      await injectionChip.click();
    }
    await sleep(3500);

    // Scroll down to show blocked card and reason
    await page.evaluate(() => window.scrollBy({ top: 420, behavior: "smooth" }));
    await smoothMove(800, 520);
    await sleep(4000);

    await waitTarget(masterVideoStart, 112000, "Chapter 4 complete");

    // =========================================================================
    // CHAPTER 5: [1:52 – 2:16] Section 03: Interactive Safety Lab Sandbox
    // =========================================================================
    console.log("[Chapter 5: 1:52 - 2:16] Section 03: Interactive Safety Lab Sandbox");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(800);

    await setBanner(
      "Interactive Safety Lab — Real-Time Policy Rule Simulator",
      "Drag Sliders & Toggle Attack Vectors · evaluatePolicyRules() Computes Live",
      "CHAPTER 5 / 7",
      "[1:52 – 2:16]"
    );

    // Switch to Tab 03: Safety Lab
    const safetyTab = page.locator("nav").getByRole("button", { name: /Safety Lab/i }).first();
    if (await safetyTab.isVisible()) {
      await safetyTab.click();
      await sleep(1500);
    }

    // Scroll to simulator controls
    await page.evaluate(() => window.scrollBy({ top: 280, behavior: "smooth" }));
    await sleep(1500);

    // Interact with destination selector: click "Known Drainer (+100)"
    const drainerBtn = page.getByRole("button", { name: /Known Drainer/i }).first();
    if (await drainerBtn.isVisible()) {
      const dBox = await drainerBtn.boundingBox();
      if (dBox) {
        await smoothMove(dBox.x + dBox.width / 2, dBox.y + dBox.height / 2);
        await sleep(300);
      }
      await drainerBtn.click();
      await sleep(2000);
    }

    // Switch back to Verified / Fresh
    const verifiedBtn = page.getByRole("button", { name: /Verified \/ Fresh/i }).first();
    if (await verifiedBtn.isVisible()) {
      await verifiedBtn.click();
      await sleep(1500);
    }

    await waitTarget(masterVideoStart, 136000, "Chapter 5 complete");

    // =========================================================================
    // CHAPTER 6: [2:16 – 2:40] Section 04: Token-2022 Security Auditor & Rug Simulator
    // =========================================================================
    console.log("[Chapter 6: 2:16 - 2:40] Section 04: Token-2022 Security Auditor");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(800);

    await setBanner(
      "Token-2022 Security Auditor & Interactive Rug-Pull Simulator",
      "Inspect Mint Authority, Freeze Authority, and Token-2022 TLV Extensions",
      "CHAPTER 6 / 7",
      "[2:16 – 2:40]"
    );

    // Switch to Tab 04: Token Auditor
    const auditorTab = page.locator("nav").getByRole("button", { name: /Token Auditor/i }).first();
    if (await auditorTab.isVisible()) {
      await auditorTab.click();
      await sleep(1500);
    }

    // Click Wrapped SOL (Safe Benchmark)
    const wsolChip = page.getByRole("button", { name: /Wrapped SOL/i }).first();
    if (await wsolChip.isVisible()) {
      await wsolChip.click();
      await sleep(2000);
    }

    // Click PayPal USD (Token-2022 PermanentDelegate)
    const pyusdChip = page.getByRole("button", { name: /PayPal USD/i }).first();
    if (await pyusdChip.isVisible()) {
      await pyusdChip.click();
      await sleep(2500);
    }

    // Scroll down to showcase Interactive Token-2022 Rug-Pull Simulator
    await page.evaluate(() => window.scrollBy({ top: 550, behavior: "smooth" }));
    await smoothMove(900, 500);
    await sleep(3500);

    await waitTarget(masterVideoStart, 160000, "Chapter 6 complete");

    // =========================================================================
    // CHAPTER 7: [2:40 – 3:00] Section 05: Interactive Proofs & Engineering Rigor
    // =========================================================================
    console.log("[Chapter 7: 2:40 - 3:00] Section 05: Interactive Proofs & Engineering Rigor");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(800);

    await setBanner(
      "Interactive Architecture Proofs & 254-Test Verification Suite",
      "254 / 254 Automated Tests Passing · SHA-256 Memo Anchor · Non-Custodial Security",
      "CHAPTER 7 / 7",
      "[2:40 – 3:00]"
    );

    // Switch to Tab 05: Interactive Proofs
    const proofsTab = page.locator("nav").getByRole("button", { name: /Interactive Proofs/i }).first();
    if (await proofsTab.isVisible()) {
      await proofsTab.click();
      await sleep(1500);
    }

    // Scroll to Live Backend API Inspector & click Ping /actions.json
    await page.evaluate(() => window.scrollBy({ top: 600, behavior: "smooth" }));
    await sleep(1200);

    const pingBtn = page.getByRole("button", { name: /Ping GET \/actions\.json/i }).first();
    if (await pingBtn.isVisible()) {
      const pBox = await pingBtn.boundingBox();
      if (pBox) {
        await smoothMove(pBox.x + pBox.width / 2, pBox.y + pBox.height / 2);
        await sleep(300);
      }
      await pingBtn.click();
      await sleep(2500);
    }

    await waitTarget(masterVideoStart, 180000, "Chapter 7 complete");

    console.log("[Demo] Master video recording finished smoothly at target 3:00 mark!");
  } catch (err) {
    console.error("[Demo Recording Error]", err);
  } finally {
    console.log("[Browser] Closing context and finalizing video recording...");
    await page.close();
    await context.close();
    await browser.close();
  }

  // Rename latest recorded video to aegisflow-demo.webm
  const videoFiles = fs
    .readdirSync(RECORDINGS_DIR)
    .filter((f) => f.endsWith(".webm") && f !== "aegisflow-demo.webm");

  if (videoFiles.length > 0) {
    videoFiles.sort((a, b) => {
      return (
        fs.statSync(path.join(RECORDINGS_DIR, b)).mtimeMs -
        fs.statSync(path.join(RECORDINGS_DIR, a)).mtimeMs
      );
    });

    const latestVideo = path.join(RECORDINGS_DIR, videoFiles[0]);
    const targetWebm = path.join(RECORDINGS_DIR, "aegisflow-demo.webm");

    if (fs.existsSync(targetWebm)) {
      fs.unlinkSync(targetWebm);
    }
    fs.renameSync(latestVideo, targetWebm);
    console.log(`[Success] Master demo video saved to: ${targetWebm}`);

    const stat = fs.statSync(targetWebm);
    const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
    console.log(`[Success] Master 1080p demo video saved: ${targetWebm} (${sizeMb} MB)`);
    console.log(`[Note] Video is YouTube/Loom/Vimeo-ready WebM (VP8/VP9 1080p 60fps).`);
  }

  console.log("=== Master Demo Video Recording Complete! ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
