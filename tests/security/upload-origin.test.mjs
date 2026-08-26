import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { compressScreenshot } from "../../lib/image-compression.ts";
import { originMatchesRequest } from "../../lib/request-origin-core.ts";

test("upload processing rejects MIME/signature mismatches", async () => {
  const fake = new File([Buffer.from("not an image")], "attack.jpg", { type: "image/jpeg" });
  await assert.rejects(() => compressScreenshot(fake), /contents do not match/);
});

test("upload processing rejects unsupported executable-like types", async () => {
  const fake = new File([Buffer.from("<svg><script/></svg>")], "attack.svg", { type: "image/svg+xml" });
  await assert.rejects(() => compressScreenshot(fake), /Only JPEG and PNG/);
});

test("upload processing rejects files over the byte limit before decoding", async () => {
  const oversized = Buffer.alloc(8 * 1024 * 1024 + 1);
  oversized.set([0xff, 0xd8, 0xff]);
  const fake = new File([oversized], "oversized.jpg", { type: "image/jpeg" });
  await assert.rejects(() => compressScreenshot(fake), /no larger than 8 MB/);
});

test("upload processing rejects truncated images inside the isolated worker", async () => {
  const truncated = new File([Buffer.from([0xff, 0xd8, 0xff, 0xdb])], "truncated.jpg", { type: "image/jpeg" });
  await assert.rejects(() => compressScreenshot(truncated), /could not be processed/);
});

test("upload processing rejects decompression-bomb dimensions", async () => {
  const input = await sharp({
    create: { width: 5001, height: 5001, channels: 3, background: "#ffffff" },
  }).png({ compressionLevel: 9 }).toBuffer();
  const bomb = new File([input], "oversized-dimensions.png", { type: "image/png" });
  await assert.rejects(() => compressScreenshot(bomb), /dimensions are too large|could not be processed/);
});

test("upload processing strips input metadata and emits a bounded JPEG", async () => {
  const input = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#00a7ff" },
  }).png().withMetadata({ comment: "sensitive metadata" }).toBuffer();
  const result = await compressScreenshot(new File([input], "proof.png", { type: "image/png" }));
  assert.equal(result.contentType, "image/jpeg");
  assert.equal(result.extension, "jpg");
  const metadata = await sharp(result.buffer).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.equal(metadata.width, 20);
  assert.equal(metadata.height, 20);
});

test("state-changing request origins reject cross-site and missing origins", () => {
  const requestUrl = "https://www.hersemita.com/api/runner-login";
  assert.equal(originMatchesRequest(requestUrl, "https://www.hersemita.com", "https://www.hersemita.com"), true);
  assert.equal(originMatchesRequest(requestUrl, "https://attacker.example", "https://www.hersemita.com"), false);
  assert.equal(originMatchesRequest(requestUrl, null, "https://www.hersemita.com"), false);
  assert.equal(originMatchesRequest("not-a-url", "https://www.hersemita.com", "https://www.hersemita.com"), false);
});
