import { Worker } from "node:worker_threads";

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);
const WORKER_TIMEOUT_MS = 12_000;

function hasAllowedSignature(input: Buffer, contentType: string) {
  if (contentType === "image/jpeg") {
    return input.length >= 3 && input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff;
  }
  if (contentType === "image/png") {
    return input.length >= 8 && input.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return false;
}

export async function compressScreenshot(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Only JPEG and PNG screenshots are allowed.");
  }
  if (file.size <= 0 || file.size > MAX_INPUT_BYTES) {
    throw new Error("Each screenshot must be no larger than 8 MB.");
  }

  const input = Buffer.from(await file.arrayBuffer());
  if (!hasAllowedSignature(input, file.type)) {
    throw new Error("The file contents do not match a valid JPEG or PNG screenshot.");
  }
  const output = await processScreenshotInWorker(input);

  return {
    buffer: output,
    contentType: "image/jpeg",
    extension: "jpg",
    originalSize: file.size,
    compressedSize: output.length,
  };
}

type WorkerResult =
  | { ok: true; output: Uint8Array }
  | { ok: false; code?: string };

function processScreenshotInWorker(input: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    const worker = new Worker(new URL("./image-compression-worker.mjs", import.meta.url), {
      resourceLimits: {
        maxOldGenerationSizeMb: 96,
        maxYoungGenerationSizeMb: 16,
        stackSizeMb: 4,
      },
    });
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      callback();
    };

    const timer = setTimeout(() => {
      finish(() => reject(new Error("Screenshot processing timed out.")));
    }, WORKER_TIMEOUT_MS);

    worker.once("message", (message: WorkerResult) => {
      if (message.ok) {
        finish(() => resolve(Buffer.from(message.output)));
        return;
      }
      if (message.code === "dimensions") {
        finish(() => reject(new Error("Screenshot dimensions are too large.")));
        return;
      }
      if (message.code === "multipage") {
        finish(() => reject(new Error("Animated or multi-page images are not allowed.")));
        return;
      }
      finish(() => reject(new Error("This screenshot format could not be processed. Please upload a JPEG or PNG screenshot.")));
    });

    worker.once("error", () => {
      finish(() => reject(new Error("This screenshot format could not be processed. Please upload a JPEG or PNG screenshot.")));
    });

    worker.once("exit", (code) => {
      if (!settled && code !== 0) {
        finish(() => reject(new Error("This screenshot format could not be processed. Please upload a JPEG or PNG screenshot.")));
      }
    });

    const transferable = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer;
    worker.postMessage({ input: transferable }, [transferable]);
  });
}
