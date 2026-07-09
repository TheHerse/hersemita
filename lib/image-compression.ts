import sharp from "sharp";

const MAX_IMAGE_WIDTH = 1800;
const MAX_IMAGE_HEIGHT = 2400;
const JPEG_QUALITY = 82;

export async function compressScreenshot(file: File) {
  const input = Buffer.from(await file.arrayBuffer());

  if (!file.type.startsWith("image/")) {
    throw new Error("Only image screenshots can be uploaded here.");
  }

  let output: Buffer;

  try {
    output = await sharp(input, { failOn: "none" })
      .rotate()
      .resize({
        width: MAX_IMAGE_WIDTH,
        height: MAX_IMAGE_HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({
        quality: JPEG_QUALITY,
        mozjpeg: true,
      })
      .toBuffer();
  } catch {
    throw new Error("This screenshot format could not be processed. Please upload a JPEG or PNG screenshot.");
  }

  return {
    buffer: output,
    contentType: "image/jpeg",
    extension: "jpg",
    originalSize: file.size,
    compressedSize: output.length,
  };
}
