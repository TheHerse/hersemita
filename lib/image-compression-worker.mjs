import { parentPort } from "node:worker_threads";
import sharp from "sharp";

const MAX_IMAGE_WIDTH = 1800;
const MAX_IMAGE_HEIGHT = 2400;
const MAX_INPUT_PIXELS = 25_000_000;
const JPEG_QUALITY = 82;

if (!parentPort) throw new Error("Image worker requires a parent port");

parentPort.once("message", async ({ input }) => {
  try {
    const image = sharp(Buffer.from(input), {
      failOn: "error",
      limitInputPixels: MAX_INPUT_PIXELS,
      sequentialRead: true,
    });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_INPUT_PIXELS) {
      parentPort.postMessage({ ok: false, code: "dimensions" });
      return;
    }
    if ((metadata.pages || 1) > 1) {
      parentPort.postMessage({ ok: false, code: "multipage" });
      return;
    }

    const output = await image
      .rotate()
      .resize({
        width: MAX_IMAGE_WIDTH,
        height: MAX_IMAGE_HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .timeout({ seconds: 10 })
      .toBuffer();

    const transferable = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
    parentPort.postMessage({ ok: true, output: transferable }, [transferable]);
  } catch {
    parentPort.postMessage({ ok: false, code: "decode" });
  }
});
