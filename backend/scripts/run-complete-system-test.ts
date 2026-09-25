import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type SuiteResult = {
  name: string;
  category: string;
  script: string;
  passed: boolean;
  durationMs: number;
  output: string;
  error?: string;
};

const SUITES = [
  { name: "Authentication & Token Revocation", category: "Auth & Security", script: "scripts/verify-auth.ts" },
  { name: "Auth Password Reset & Remember-Me", category: "Auth & Security", script: "scripts/verify-auth-features.ts" },
  { name: "Admin Email & Role Self-Editing", category: "Auth & Security", script: "scripts/verify-admin-email-edit.ts" },
  { name: "Status PII Filtering", category: "Auth & Security", script: "scripts/verify-status-pii.ts" },
  { name: "CORS & Origin Security Guard", category: "Auth & Security", script: "scripts/verify-cors.ts" },

  { name: "Booking Overlap Concurrency Stress Test", category: "Booking Engine", script: "scripts/verify-overlap-stress.ts" },
  { name: "Booking Business Rules & Hold Duration", category: "Booking Engine", script: "scripts/verify-booking-features.ts" },
  { name: "Calendar Slot Generation & Availability", category: "Booking Engine", script: "scripts/verify-calendar.ts" },
  { name: "Customer Self-Service Lookup, Reschedule & No-Refund Cancel", category: "Booking Engine", script: "scripts/verify-booking-self-service.ts" },
  { name: "Admin Booking Creation & Slot Hold Management", category: "Booking Engine", script: "scripts/verify-admin-booking.ts" },
  { name: "Contact Email Enforcement (Required + No CRM Override)", category: "Booking Engine", script: "scripts/smoke-contact-email.ts" },

  { name: "Bachs Payment Flow & Webhook Idempotency", category: "Payments", script: "scripts/verify-payment-flow.ts" },
  { name: "Payment Blockers (HMAC, Refunds, Cash/POS/Transfer, Split)", category: "Payments", script: "scripts/verify-payments-blockers.ts" },
  { name: "Bachs Webhook Signatures & Sandbox Guard", category: "Payments", script: "scripts/verify-bachs-webhook.ts" },

  { name: "Notifications & Branded Email Pipeline", category: "Notifications", script: "scripts/verify-notifications.ts" },
  { name: "Customer Enquiry Reply Dispatch", category: "Notifications", script: "scripts/verify-enquiry-reply.ts" },

  { name: "Media Optimization & Object Storage", category: "Media & Storage", script: "scripts/verify-storage.ts" },
  { name: "Media Usage Tracking & Safe Deletion Check", category: "Media & Storage", script: "scripts/verify-media-usage.ts" },
  { name: "Service Media Attachments", category: "Media & Storage", script: "scripts/verify-service-media.ts" },
  { name: "Portfolio & Gallery Media Pipeline", category: "Media & Storage", script: "scripts/verify-portfolio-media.ts" },
  { name: "Testimonials Media & Customer Avatars", category: "Media & Storage", script: "scripts/verify-testimonial-media.ts" },

  { name: "Pricing Rules & Lead Time Controls", category: "CMS & Content", script: "scripts/verify-rules.ts" },
  { name: "C1-C4 Deliverables (Provisional Pricing, WYSIWYG, SEO, Cover Picker)", category: "CMS & Content", script: "scripts/verify-c1-c4.ts" },

  // Runs last: intentionally burns login-fail rate-limit capacity
  { name: "Security & Anti-PII Leak Protection", category: "Auth & Security", script: "scripts/verify-security.ts" },
];

function runScript(scriptPath: string): Promise<{ passed: boolean; durationMs: number; output: string; error?: string }> {
  const start = Date.now();
  const tsxBin = path.resolve(__dirname, "..", "node_modules", ".bin", "tsx");
  return new Promise((resolve) => {
    const proc = spawn(tsxBin, [scriptPath], {
      cwd: path.resolve(__dirname, ".."),
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });

    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    proc.on("close", (code) => {
      const durationMs = Date.now() - start;
      const combined = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
      if (code === 0) {
        resolve({ passed: true, durationMs, output: stdout.trim() });
      } else {
        const errLine =
          combined
            .split("\n")
            .reverse()
            .find((line) => /Error|AssertionError|FAIL|failed|❌/i.test(line)) ||
          `Process exited with code ${code}`;
        resolve({ passed: false, durationMs, output: stdout.trim(), error: errLine });
      }
    });

    proc.on("error", (err) => {
      const durationMs = Date.now() - start;
      resolve({ passed: false, durationMs, output: stdout.trim(), error: err.message });
    });
  });
}

function writeReport(results: SuiteResult[], startedAt: Date, totalPassed: number, totalFailed: number) {
  const endedAt = new Date();
  const totalMs = endedAt.getTime() - startedAt.getTime();
  const categories = Array.from(new Set(SUITES.map((s) => s.category)));
  const pct = results.length ? Math.round((totalPassed / results.length) * 100) : 0;
  const verdict =
    totalFailed === 0 ? "PASS" : totalPassed === 0 ? "FAIL" : "PARTIAL";

  const lines: string[] = [];
  lines.push("# Photo Arena — Complete System Test Report");
  lines.push("");
  lines.push(`- **Verdict:** ${verdict}`);
  lines.push(`- **Started:** ${startedAt.toISOString()}`);
  lines.push(`- **Finished:** ${endedAt.toISOString()}`);
  lines.push(`- **Duration:** ${(totalMs / 1000).toFixed(1)}s`);
  lines.push(`- **Suites:** ${totalPassed}/${results.length} passed (${pct}%)`);
  lines.push(`- **Failed:** ${totalFailed}`);
  lines.push(`- **API:** \`${process.env.API_BASE ?? "http://127.0.0.1:3001/api"}\``);
  lines.push("");
  lines.push("## Summary by domain");
  lines.push("");
  lines.push("| Domain | Passed | Total |");
  lines.push("| --- | ---: | ---: |");
  for (const cat of categories) {
    const items = results.filter((r) => r.category === cat);
    lines.push(`| ${cat} | ${items.filter((r) => r.passed).length} | ${items.length} |`);
  }
  lines.push("");
  lines.push("## Suite results");
  lines.push("");
  lines.push("| Status | Suite | Domain | Duration |");
  lines.push("| --- | --- | --- | ---: |");
  for (const r of results) {
    lines.push(
      `| ${r.passed ? "PASS" : "FAIL"} | ${r.name} | ${r.category} | ${r.durationMs}ms |`,
    );
  }

  const failures = results.filter((r) => !r.passed);
  if (failures.length) {
    lines.push("");
    lines.push("## Failures");
    lines.push("");
    for (const f of failures) {
      lines.push(`### ${f.name}`);
      lines.push("");
      lines.push(`- **Script:** \`${f.script}\``);
      lines.push(`- **Duration:** ${f.durationMs}ms`);
      if (f.error) {
        lines.push(`- **Error:**`);
        lines.push("```");
        lines.push(f.error.slice(0, 4000));
        lines.push("```");
      }
      if (f.output) {
        lines.push(`- **Output (tail):**`);
        lines.push("```");
        lines.push(f.output.slice(-2000));
        lines.push("```");
      }
      lines.push("");
    }
  }

  lines.push("## Notes");
  lines.push("");
  lines.push("- Live Bachs E2E (`verify-bachs-e2e`) is excluded; it needs manual sandbox payment.");
  lines.push("- Email delivery depends on `RESEND_API_KEY` / SMTP; notification suites assert templates + logging.");
  lines.push("- Contact-email suite asserts required email, `booking.contactEmail` snapshot, and no CRM email overwrite on phone match.");
  lines.push("");

  const outDir = path.resolve(__dirname, "..", "..", "docs");
  const outPath = path.join(outDir, "SYSTEM-TEST-REPORT.md");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");
  return outPath;
}

async function main() {
  const startedAt = new Date();
  console.log("================================================================================");
  console.log("PHOTO ARENA COMPLETE SYSTEM INTEGRATION & VERIFICATION TEST SUITE");
  console.log("================================================================================\n");

  const results: SuiteResult[] = [];
  let totalPassed = 0;
  let totalFailed = 0;

  for (let i = 0; i < SUITES.length; i++) {
    const suite = SUITES[i];
    process.stdout.write(`[${i + 1}/${SUITES.length}] Running: ${suite.name} (${suite.script})... `);
    const res = await runScript(suite.script);

    const resultItem: SuiteResult = {
      ...suite,
      passed: res.passed,
      durationMs: res.durationMs,
      output: res.output,
      error: res.error,
    };
    results.push(resultItem);

    if (res.passed) {
      totalPassed++;
      console.log(`PASS (${res.durationMs}ms)`);
    } else {
      totalFailed++;
      console.log(`FAIL (${res.durationMs}ms)`);
      if (res.error) console.error(`   Error: ${res.error.split("\n")[0]}`);
    }

    // Brief pause to avoid login / hold rate-limit bleed across suites
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log("\n================================================================================");
  console.log("SYSTEM TEST SUMMARY BY DOMAIN");
  console.log("================================================================================");

  const categories = Array.from(new Set(SUITES.map((s) => s.category)));
  for (const cat of categories) {
    const catItems = results.filter((r) => r.category === cat);
    const catPassed = catItems.filter((r) => r.passed).length;
    console.log(`\n${cat}: ${catPassed}/${catItems.length} passed`);
    for (const item of catItems) {
      const statusIcon = item.passed ? "  PASS" : "  FAIL";
      console.log(`${statusIcon}  ${item.name.padEnd(55)} (${item.durationMs}ms)`);
    }
  }

  const reportPath = writeReport(results, startedAt, totalPassed, totalFailed);

  console.log("\n================================================================================");
  console.log(`TOTAL SUITES EXECUTED: ${results.length}`);
  console.log(`PASSED: ${totalPassed} / ${results.length} (${Math.round((totalPassed / results.length) * 100)}%)`);
  console.log(`FAILED: ${totalFailed} / ${results.length}`);
  console.log(`REPORT: ${reportPath}`);
  console.log("================================================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("System test runner encountered a fatal error:", err);
  process.exit(1);
});
