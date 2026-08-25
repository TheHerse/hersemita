import { supabaseAdmin } from "@/lib/supabase-admin";

const ACTIVITY_SCREENSHOT_BUCKET = "activity-screenshots";
const STORAGE_LIST_LIMIT = 1000;
const SIGNED_URL_TTL_SECONDS = 60;

export function storagePathFromActivityScreenshotUrl(url: string) {
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

export function activityScreenshotReference(path: string) {
  return `${ACTIVITY_SCREENSHOT_BUCKET}/${path}`;
}

export function runnerOwnsActivityScreenshotReference(reference: string, runnerId: string) {
  const path = storagePathFromActivityScreenshotUrl(reference);
  return Boolean(path && path.startsWith(`${runnerId}/`) && !path.includes(".."));
}

export async function createActivityScreenshotSignedUrl(reference: string) {
  const path = storagePathFromActivityScreenshotUrl(reference);
  if (!path || path.includes("..")) return null;

  const { data, error } = await supabaseAdmin.storage
    .from(ACTIVITY_SCREENSHOT_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function removeActivityScreenshots(urls?: string[] | null) {
  const paths = Array.from(
    new Set((urls || []).map(storagePathFromActivityScreenshotUrl).filter((path): path is string => Boolean(path)))
  );

  if (paths.length === 0) return;

  const { error } = await supabaseAdmin.storage
    .from(ACTIVITY_SCREENSHOT_BUCKET)
    .remove(paths);

  if (error) {
    throw new Error(error.message);
  }
}

type StorageObject = {
  name: string;
  id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

async function listStorageObjects(prefix = ""): Promise<StorageObject[]> {
  const bucket = supabaseAdmin.storage.from(ACTIVITY_SCREENSHOT_BUCKET);
  const objects: StorageObject[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await bucket.list(prefix, {
      limit: STORAGE_LIST_LIMIT,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) throw new Error(error.message);
    const entries = (data || []) as StorageObject[];

    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      const looksLikeFolder = !entry.id && !entry.metadata;

      if (looksLikeFolder) {
        objects.push(...(await listStorageObjects(path)));
      } else {
        objects.push({ ...entry, name: path });
      }
    }

    if (entries.length < STORAGE_LIST_LIMIT) break;
    offset += STORAGE_LIST_LIMIT;
  }

  return objects;
}

async function referencedScreenshotPaths() {
  const paths = new Set<string>();
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("activities")
      .select("screenshot_urls")
      .not("screenshot_urls", "is", null)
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);

    for (const activity of data || []) {
      for (const url of activity.screenshot_urls || []) {
        const path = typeof url === "string" ? storagePathFromActivityScreenshotUrl(url) : null;
        if (path) paths.add(path);
      }
    }

    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return paths;
}

export async function cleanupUnreferencedActivityScreenshots({
  olderThanHours = 24,
  dryRun = false,
}: {
  olderThanHours?: number;
  dryRun?: boolean;
} = {}) {
  const referenced = await referencedScreenshotPaths();
  const objects = await listStorageObjects();
  const cutoff = Date.now() - olderThanHours * 60 * 60 * 1000;
  const removable = objects
    .filter((object) => {
      if (referenced.has(object.name)) return false;
      const createdAt = object.created_at || object.updated_at;
      if (!createdAt) return false;
      return new Date(createdAt).getTime() < cutoff;
    })
    .map((object) => object.name);

  if (!dryRun && removable.length > 0) {
    for (let index = 0; index < removable.length; index += 100) {
      const chunk = removable.slice(index, index + 100);
      const { error } = await supabaseAdmin.storage.from(ACTIVITY_SCREENSHOT_BUCKET).remove(chunk);
      if (error) throw new Error(error.message);
    }
  }

  return {
    scanned: objects.length,
    referenced: referenced.size,
    deleted: dryRun ? 0 : removable.length,
    removable: removable.length,
    dryRun,
  };
}
