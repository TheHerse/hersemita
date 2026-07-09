import { supabaseAdmin } from "@/lib/supabase-admin";

const ACTIVITY_SCREENSHOT_BUCKET = "activity-screenshots";

function pathFromStorageUrl(url: string) {
  try {
    const parsed = new URL(url);
    const publicPrefix = `/storage/v1/object/public/${ACTIVITY_SCREENSHOT_BUCKET}/`;
    const signedPrefix = `/storage/v1/object/sign/${ACTIVITY_SCREENSHOT_BUCKET}/`;
    const publicIndex = parsed.pathname.indexOf(publicPrefix);
    const signedIndex = parsed.pathname.indexOf(signedPrefix);

    if (publicIndex >= 0) {
      return decodeURIComponent(parsed.pathname.slice(publicIndex + publicPrefix.length));
    }

    if (signedIndex >= 0) {
      return decodeURIComponent(parsed.pathname.slice(signedIndex + signedPrefix.length));
    }
  } catch {
    if (url.startsWith(`${ACTIVITY_SCREENSHOT_BUCKET}/`)) {
      return url.slice(ACTIVITY_SCREENSHOT_BUCKET.length + 1);
    }

    return null;
  }

  return null;
}

export async function removeActivityScreenshots(urls?: string[] | null) {
  const paths = Array.from(
    new Set((urls || []).map(pathFromStorageUrl).filter((path): path is string => Boolean(path)))
  );

  if (paths.length === 0) return;

  const { error } = await supabaseAdmin.storage
    .from(ACTIVITY_SCREENSHOT_BUCKET)
    .remove(paths);

  if (error) {
    throw new Error(error.message);
  }
}
