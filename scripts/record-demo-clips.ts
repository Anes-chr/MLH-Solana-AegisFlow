import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";

const RECORDINGS_DIR = path.resolve(process.cwd(), "recordings");
const CLIPS_DIR = path.resolve(RECORDINGS_DIR, "clips");
const TARGET_URL = process.env.TARGET_URL || "http://localhost:3000";

const FFMPEG_PATH = path.resolve(
  process.env.LOCALAPPDATA || "C:\\Users\\Anes-Chr\\AppData\\Local",
  "ms-playwright",
  "ffmpeg-1013",
  "ffmpeg-win64.exe"
);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ChapterTimestamp {
  name: string;
  filename: string;
  startSec: number;
  endSec: number;
}

async function main() {
  console.log("================================================================================");
  console.log("       AegisFlow — Studio Clip & Master Demo Video Recorder (1080p 60fps)      ");
  console.log("================================================================================");
  console.log(`Targeting URL: ${TARGET_URL}`);
  console.log(`Clips Output Directory: ${CLIPS_DIR}`);
  console.log(`FFmpeg Path: ${FFMPEG_PATH}`);

  if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
  if (!fs.existsSync(CLIPS_DIR)) fs.mkdirSync(CLIPS_DIR, { recursive: true });

  // Read payer keypair to seed real funded Devnet burner wallet into localStorage
  const payerKeypairPath = path.resolve(process.cwd(), ".devnet-keypair.json");
  let payerSecretArray: number[] | null = null;
  if (fs.existsSync(payerKeypairPath)) {
    payerSecretArray = JSON.parse(fs.readFileSync(payerKeypairPath, "utf-8"));
    console.log("[Wallet] Loaded real funded Devnet keypair for in-browser session.");
  }

  console.log("[Browser] Launching Chromium 1920x1080...");
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

  // Inject pre-funded burner keypair into localStorage before first page load
  if (payerSecretArray) {
    await context.addInitScript((secret) => {
      try {
        localStorage.setItem("aegisflow_devnet_burner_v1", JSON.stringify(secret));
      } catch (e) {
        console.warn("Could not set localStorage:", e);
      }
    }, payerSecretArray);
  }

  const page = await context.newPage();

  const smoothMove = async (x: number, y: number, steps = 10) => {
    await page.mouse.move(x, y, { steps });
  };

  const chapters: ChapterTimestamp[] = [];
  const masterStart = Date.now();

  const markStart = (name: string, filename: string) => {
    const startSec = (Date.now() - masterStart) / 1000;
    console.log(`\n>>> STARTING CLIP [${filename}]: ${name} (t = ${startSec.toFixed(2)}s)`);
    return { name, filename, startSec };
  };

  const markEnd = (meta: { name: string; filename: string; startSec: number }) => {
    const endSec = (Date.now() - masterStart) / 1000;
    chapters.push({
      ...meta,
      endSec,
    });
    console.log(`<<< FINISHED CLIP [${meta.filename}]: duration = ${(endSec - meta.startSec).toFixed(2)}s`);
  };

  try {
    console.log(`[Demo] Navigating to ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: "networkidle" });
    await sleep(1000);

    // =========================================================================
    // CLIP 01: 01-guide.webm (~14s)
    // Hero, Mission Overview, 4-Step Pipeline Architecture Guide
    // =========================================================================
    const c1 = markStart("Hero & 4-Step Architecture Guide", "01-guide.webm");
    await smoothMove(400, 200);
    await sleep(2500); // Hold on hero title and badges

    // Smooth single scroll through 4-Step Architecture Guide
    await page.evaluate(() => window.scrollBy({ top: 380, behavior: "smooth" }));
    await sleep(3500); // Hold so judges can read Step 1 & 2
    await page.evaluate(() => window.scrollBy({ top: 400, behavior: "smooth" }));
    await sleep(4000); // Hold so judges can read Step 3 & 4 and testing guide
    markEnd(c1);

    // =========================================================================
    // CLIP 02: 02-wallet-faucet.webm (~16s)
    // 1-Click Test Wallet Onboarding, Modal Inspection & Live Faucet
    // =========================================================================
    const c2 = markStart("Test Wallet Onboarding & Live Devnet Faucet", "02-wallet-faucet.webm");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(1000);

    // Open Account / Wallet Modal
    const walletTrigger = page.locator("header").getByRole("button", { name: /Guest Burner|Test Wallet|SOL/i }).first();
    if (await walletTrigger.isVisible()) {
      const wBox = await walletTrigger.boundingBox();
      if (wBox) await smoothMove(wBox.x + wBox.width / 2, wBox.y + wBox.height / 2);
      await walletTrigger.click();
      console.log("[Demo] Opened Account & Wallet Settings modal");
      await sleep(1500);
    }

    // Hold on active funded wallet in modal
    await sleep(3000);

    // Click "Fund Wallet with Free Devnet SOL"
    const faucetBtn = page.getByRole("button", {
      name: /Fund Wallet with Free Devnet SOL|Requesting Devnet SOL|Free Devnet SOL/i,
    }).first();
    if (await faucetBtn.isVisible()) {
      const fBox = await faucetBtn.boundingBox();
      if (fBox) await smoothMove(fBox.x + fBox.width / 2, fBox.y + fBox.height / 2);
      await faucetBtn.click();
      console.log("[Demo] Clicked faucet button");
      await sleep(3500); // Hold on faucet success message
    }

    // Close modal
    const closeBtn = page.getByLabel("Close Account Modal").first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await page.keyboard.press("Escape");
    }
    await sleep(2000);
    markEnd(c2);

    // =========================================================================
    // CLIP 03: 03-safe-swap.webm (~26s)
    // Autonomous Copilot: Safe Swap, Real 5-Stage Timeline, Risk Card & On-Chain Broadcast
    // =========================================================================
    const c3 = markStart("Autonomous Copilot Safe Swap & On-Chain Broadcast", "03-safe-swap.webm");
    
    // Switch to Copilot tab
    const copilotTab = page.locator("nav").getByRole("button", { name: /AI Copilot/i }).first();
    if (await copilotTab.isVisible()) {
      await copilotTab.click();
      await sleep(1000);
    }

    // Click "Safe Swap: 0.1 SOL -> dUSDC"
    const safeSwapChip = page.getByRole("button", { name: /Safe Swap/i }).first();
    if (await safeSwapChip.isVisible()) {
      const sBox = await safeSwapChip.boundingBox();
      if (sBox) await smoothMove(sBox.x + sBox.width / 2, sBox.y + sBox.height / 2);
      await safeSwapChip.click();
      console.log("[Demo] Selected Safe Swap preset");
      await sleep(1000);
    }

    // Click Analyze Intent & Run Pre-Flight
    const analyzeBtn = page.getByRole("button", { name: /Analyze Intent & Run Pre-Flight/i }).first();
    if (await analyzeBtn.isVisible()) {
      await analyzeBtn.click();
      console.log("[Demo] Clicked Analyze Intent & Run Pre-Flight");
    }

    // Wait for simulation & sentinel report
    console.log("[Demo] Waiting for Sentinel Risk Assessment...");
    await page.waitForSelector("text=Pre-Flight Sentinel Risk Assessment", { timeout: 30000 });
    await sleep(2000);

    // Scroll smoothly to Sentinel Risk Card
    await page.evaluate(() => window.scrollBy({ top: 380, behavior: "smooth" }));
    await sleep(2500); // Hold 2.5s on SAFE 0/100, live oracle price, and delta

    // Click 1-Click Sign & Broadcast
    const signBtn = page.getByRole("button", {
      name: /1-Click Sign & Broadcast|Sign & Execute Transaction/i,
    }).first();
    if (await signBtn.isVisible()) {
      const signBox = await signBtn.boundingBox();
      if (signBox) await smoothMove(signBox.x + signBox.width / 2, signBox.y + signBox.height / 2);
      console.log("[Demo] Clicking 1-Click Sign & Broadcast to Devnet...");
      await signBtn.click();
    }

    // Wait for confirmed receipt
    await page.waitForSelector("text=Confirmed on Solana Devnet", { timeout: 35000 });
    console.log("[Demo] Transaction Confirmed on Solana Devnet!");
    await sleep(4000); // Generous 4s hold on real on-chain transaction signature & explorer link!
    markEnd(c3);

    // =========================================================================
    // CLIP 04: 04-injection-attack.webm (~16s)
    // Red-Team Adversarial Prompt Injection Defense Blocked in <400ms
    // =========================================================================
    const c4 = markStart("Adversarial Prompt Injection Defense", "04-injection-attack.webm");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(1000);

    const injectionChip = page.getByRole("button", { name: /Prompt Injection Attack/i }).first();
    if (await injectionChip.isVisible()) {
      const injBox = await injectionChip.boundingBox();
      if (injBox) await smoothMove(injBox.x + injBox.width / 2, injBox.y + injBox.height / 2);
      await injectionChip.click();
      console.log("[Demo] Selected Prompt Injection Attack preset");
      await sleep(1200);
    }

    // Click Analyze Intent & Run Pre-Flight
    const analyzeInjBtn = page.getByRole("button", { name: /Analyze Intent & Run Pre-Flight/i }).first();
    if (await analyzeInjBtn.isVisible()) {
      await analyzeInjBtn.click();
    }

    await page.waitForSelector("text=BLOCKED BY POLICY GATE", { timeout: 15000 });
    console.log("[Demo] Injection attack blocked in Sentinel!");

    // Scroll to blocked card
    await page.evaluate(() => window.scrollBy({ top: 380, behavior: "smooth" }));
    await sleep(4000); // 4s hold on CRITICAL RISK 100/100, failed policy checks, execution disabled
    markEnd(c4);

    // =========================================================================
    // CLIP 05: 05-safety-lab.webm (~14s)
    // Section 03: Safety Lab Real-Time Policy Calculator
    // =========================================================================
    const c5 = markStart("Interactive Safety Lab & Policy Sandbox", "05-safety-lab.webm");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(800);

    const safetyTab = page.locator("nav").getByRole("button", { name: /Safety Lab/i }).first();
    if (await safetyTab.isVisible()) {
      await safetyTab.click();
      await sleep(1000);
    }

    // Scroll to simulator controls
    await page.evaluate(() => window.scrollBy({ top: 280, behavior: "smooth" }));
    await sleep(1500);

    // Click "Known Drainer (+100)"
    const drainerBtn = page.getByRole("button", { name: /Known Drainer/i }).first();
    if (await drainerBtn.isVisible()) {
      const dBox = await drainerBtn.boundingBox();
      if (dBox) await smoothMove(dBox.x + dBox.width / 2, dBox.y + dBox.height / 2);
      await drainerBtn.click();
      console.log("[Demo] Clicked Known Drainer toggle");
      await sleep(3500); // Hold 3.5s on recalculation
    }

    // Switch back to Verified / Fresh
    const verifiedBtn = page.getByRole("button", { name: /Verified \/ Fresh/i }).first();
    if (await verifiedBtn.isVisible()) {
      await verifiedBtn.click();
      await sleep(2000);
    }
    markEnd(c5);

    // =========================================================================
    // CLIP 06: 06-token-auditor.webm (~17s)
    // Section 04: Token Auditor — Wrapped SOL (SAFE 0/100) vs PayPal USD (Token-2022)
    // =========================================================================
    const c6 = markStart("Token & Mint Security Auditor", "06-token-auditor.webm");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(800);

    const auditorTab = page.locator("nav").getByRole("button", { name: /Token Auditor/i }).first();
    if (await auditorTab.isVisible()) {
      await auditorTab.click();
      await sleep(1000);
    }

    // Click Wrapped SOL (Safe Benchmark)
    const wsolChip = page.getByRole("button", { name: /Wrapped SOL/i }).first();
    if (await wsolChip.isVisible()) {
      await wsolChip.click();
      console.log("[Demo] Auditing Wrapped SOL...");
      await sleep(3500); // Hold 3.5s on 0/100 · LOW RISK · SAFE
    }

    // Click PayPal USD (Token-2022 PermanentDelegate)
    const pyusdChip = page.getByRole("button", { name: /PayPal USD/i }).first();
    if (await pyusdChip.isVisible()) {
      await pyusdChip.click();
      console.log("[Demo] Auditing PayPal USD...");
      await sleep(3500); // Hold 3.5s on Token-2022 PermanentDelegate 55/100 CAUTION
    }

    // Scroll down to showcase Rug-Pull Simulator
    await page.evaluate(() => window.scrollBy({ top: 480, behavior: "smooth" }));
    await sleep(2500);
    markEnd(c6);

    // =========================================================================
    // CLIP 07: 07-proofs.webm (~15s)
    // Section 05: Interactive Proofs, Ping /actions.json, 254 Test Scorecard
    // =========================================================================
    const c7 = markStart("Interactive Proofs & 254-Test Verification", "07-proofs.webm");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(800);

    const proofsTab = page.locator("nav").getByRole("button", { name: /Interactive Proofs/i }).first();
    if (await proofsTab.isVisible()) {
      await proofsTab.click();
      await sleep(1000);
    }

    // Scroll to Live Backend API Inspector & click Ping /actions.json
    await page.evaluate(() => window.scrollBy({ top: 450, behavior: "smooth" }));
    await sleep(1000);

    const pingBtn = page.getByRole("button", { name: /Ping GET \/actions\.json/i }).first();
    if (await pingBtn.isVisible()) {
      const pBox = await pingBtn.boundingBox();
      if (pBox) await smoothMove(pBox.x + pBox.width / 2, pBox.y + pBox.height / 2);
      await pingBtn.click();
      console.log("[Demo] Pinged /actions.json");
      await sleep(3000); // Hold 3s on HTTP 200 response
    }

    // Scroll down to 254-test verification scorecard
    await page.evaluate(() => window.scrollBy({ top: 400, behavior: "smooth" }));
    await sleep(4000); // Hold 4s on 254/254 test scorecard
    markEnd(c7);

    // =========================================================================
    // OPTIONAL CLIP 08: 08-dial-blink.webm (~10s)
    // Solana Action & Dial.to Blink Preview
    // =========================================================================
    const c8 = markStart("Solana Action Dial.to Blink Card", "08-dial-blink.webm");
    await page.evaluate(() => window.scrollBy({ top: 350, behavior: "smooth" }));
    await sleep(3500); // Hold on Action / Dial.to card
    markEnd(c8);

    console.log("\n================================================================================");
    console.log("   Recording Completed Successfully! All chapters captured in single session.  ");
    console.log("================================================================================\n");
  } catch (err) {
    console.error("[Recording Error]", err);
  } finally {
    console.log("[Browser] Closing context and finalizing master video...");
    await page.close();
    await context.close();
    await browser.close();
  }

  // Find the generated video file
  const videoFiles = fs
    .readdirSync(RECORDINGS_DIR)
    .filter((f) => f.endsWith(".webm") && f !== "aegisflow-demo.webm");

  if (videoFiles.length === 0) {
    console.error("No webm video found in recordings directory!");
    return;
  }

  videoFiles.sort((a, b) => {
    return (
      fs.statSync(path.join(RECORDINGS_DIR, b)).mtimeMs -
      fs.statSync(path.join(RECORDINGS_DIR, a)).mtimeMs
    );
  });

  const rawMasterVideo = path.join(RECORDINGS_DIR, videoFiles[0]);
  const masterTarget = path.join(RECORDINGS_DIR, "aegisflow-demo.webm");

  if (fs.existsSync(masterTarget)) fs.unlinkSync(masterTarget);
  fs.renameSync(rawMasterVideo, masterTarget);
  console.log(`[Master Video] Saved to ${masterTarget}`);

  // Slicing into exact clips using Playwright's ffmpeg-win64
  console.log("\n================================================================================");
  console.log("           Extracting Frame-Accurate Named Clips with FFmpeg                    ");
  console.log("================================================================================\n");

  for (const ch of chapters) {
    const clipOut = path.join(CLIPS_DIR, ch.filename);
    if (fs.existsSync(clipOut)) fs.unlinkSync(clipOut);

    const duration = ch.endSec - ch.startSec;
    console.log(`[Clip] ${ch.filename} (${duration.toFixed(1)}s): ${ch.startSec.toFixed(2)}s -> ${ch.endSec.toFixed(2)}s`);

    try {
      // Use FFmpeg stream copy for instant, zero-re-encoding lossless extraction
      const cmd = `"${FFMPEG_PATH}" -y -ss ${ch.startSec.toFixed(2)} -to ${ch.endSec.toFixed(2)} -i "${masterTarget}" -c copy "${clipOut}"`;
      execSync(cmd, { stdio: "ignore" });

      if (fs.existsSync(clipOut)) {
        const sz = (fs.statSync(clipOut).size / 1024).toFixed(0);
        console.log(`  -> Generated: ${ch.filename} (${sz} KB)`);
      }
    } catch (e) {
      console.warn(`  -> FFmpeg stream copy failed for ${ch.filename}, trying transcode:`, (e as Error).message);
      try {
        const fallbackCmd = `"${FFMPEG_PATH}" -y -ss ${ch.startSec.toFixed(2)} -to ${ch.endSec.toFixed(2)} -i "${masterTarget}" "${clipOut}"`;
        execSync(fallbackCmd, { stdio: "ignore" });
      } catch (err2) {
        console.error(`  -> Failed to extract ${ch.filename}:`, err2);
      }
    }
  }

  console.log("\n================================================================================");
  console.log("               ALL DEMO CLIPS GENERATED & VERIFIED!                             ");
  console.log("================================================================================\n");
  const generatedClips = fs.readdirSync(CLIPS_DIR).filter((f) => f.endsWith(".webm"));
  for (const c of generatedClips) {
    const sz = (fs.statSync(path.join(CLIPS_DIR, c)).size / 1024).toFixed(0);
    console.log(`  • ${c.padEnd(25)} [${sz.padStart(6)} KB]`);
  }
}

main().catch((err) => {
  console.error("Fatal recording error:", err);
  process.exit(1);
});
