import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import { pipeline } from "node:stream/promises";

const [mode, input, output] = process.argv.slice(2);
const passphrase = process.env.HERSEMITA_BACKUP_PASSPHRASE;
const magic = Buffer.from("HSBKUP01");
if (!passphrase || passphrase.length < 16) throw new Error("Backup passphrase must contain at least 16 characters");
if (!input || !output || !new Set(["encrypt", "decrypt"]).has(mode)) throw new Error("Usage: encrypt|decrypt input output");

if (mode === "encrypt") {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const handle = await fsPromises.open(output, "wx");
  await handle.write(Buffer.concat([magic, salt, iv]));
  await handle.close();
  await pipeline(fs.createReadStream(input), cipher, fs.createWriteStream(output, { flags: "a" }));
  await fsPromises.appendFile(output, cipher.getAuthTag());
} else {
  const handle = await fsPromises.open(input, "r");
  const header = Buffer.alloc(36);
  await handle.read(header, 0, header.length, 0);
  const stats = await handle.stat();
  const tag = Buffer.alloc(16);
  await handle.read(tag, 0, tag.length, stats.size - tag.length);
  await handle.close();
  if (!header.subarray(0, 8).equals(magic)) throw new Error("Not a Hersemita backup archive");
  const key = scryptSync(passphrase, header.subarray(8, 24), 32);
  const decipher = createDecipheriv("aes-256-gcm", key, header.subarray(24, 36));
  decipher.setAuthTag(tag);
  await pipeline(
    fs.createReadStream(input, { start: 36, end: stats.size - tag.length - 1 }),
    decipher,
    fs.createWriteStream(output, { flags: "wx" })
  );
}

console.log(`${mode === "encrypt" ? "Encrypted" : "Decrypted"} backup written successfully.`);
