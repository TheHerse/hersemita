import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const MAX_SCANNED_FILE_BYTES = 2 * 1024 * 1024;
const excludedExtensions = new Set([
  ".gif", ".ico", ".jpeg", ".jpg", ".lock", ".pdf", ".png", ".webp", ".woff", ".woff2",
]);
const patterns = [
  { name: "AWS access key", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { name: "Clerk secret key", pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{20,}\b/g },
  { name: "GitHub token", pattern: /\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}\b/g },
  { name: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: "Stripe secret key", pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{20,}\b/g },
  { name: "Twilio API key", pattern: /\bSK[a-fA-F0-9]{32}\b/g },
];

function extension(path) {
  const match = path.toLowerCase().match(/\.[^.\\/]+$/);
  return match?.[0] || "";
}

const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);
const findings = [];

for (const file of files) {
  if (excludedExtensions.has(extension(file))) continue;
  let content;
  try {
    const buffer = readFileSync(file);
    if (buffer.byteLength > MAX_SCANNED_FILE_BYTES || buffer.includes(0)) continue;
    content = buffer.toString("utf8");
  } catch {
    continue;
  }

  for (const { name, pattern } of patterns) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      const line = content.slice(0, match.index).split("\n").length;
      const lineText = content.split(/\r?\n/)[line - 1] || "";
      if (lineText.includes("ci-placeholder")) continue;
      findings.push(`${file}:${line}: possible ${name}`);
    }
  }
}

if (findings.length > 0) {
  console.error("Potential committed secrets found:\n" + findings.join("\n"));
  process.exit(1);
}

console.log(`Secret scan passed (${files.length} repository files checked).`);
