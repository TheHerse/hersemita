import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const destination = path.resolve(process.argv[2] || "");
if (!process.argv[2]) throw new Error("Storage export destination is required");

async function loadLocalEnvironment() {
  const contents = await fs.readFile(path.resolve(".env.local"), "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

await loadLocalEnvironment();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Supabase URL and service-role key are required in .env.local");

const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const buckets = ["activity-screenshots"];
const manifest = [];

async function exportPrefix(bucketName, prefix = "") {
  let offset = 0;
  while (true) {
    const { data, error } = await client.storage.from(bucketName).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    const entries = data || [];
    for (const entry of entries) {
      const objectName = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (!entry.id && !entry.metadata) {
        await exportPrefix(bucketName, objectName);
        continue;
      }
      if (objectName.split("/").some((part) => part === "..")) throw new Error("Unsafe storage object path");
      const { data: blob, error: downloadError } = await client.storage.from(bucketName).download(objectName);
      if (downloadError) throw downloadError;
      const output = path.join(destination, bucketName, ...objectName.split("/"));
      await fs.mkdir(path.dirname(output), { recursive: true });
      const bytes = Buffer.from(await blob.arrayBuffer());
      await fs.writeFile(output, bytes, { flag: "wx" });
      manifest.push({ bucket: bucketName, object: objectName, bytes: bytes.length });
    }
    if (entries.length < 1000) break;
    offset += 1000;
  }
}

await fs.mkdir(destination, { recursive: true });
for (const bucket of buckets) await exportPrefix(bucket);
await fs.writeFile(
  path.join(destination, "manifest.json"),
  JSON.stringify({ createdAt: new Date().toISOString(), objects: manifest }, null, 2),
  { flag: "wx" }
);
console.log(`Exported ${manifest.length} private storage object(s).`);
