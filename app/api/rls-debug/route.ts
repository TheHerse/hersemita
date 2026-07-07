import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

function decodeJwtPayload(token: string | null) {
  if (!token) return null;

  const payload = token.split(".")[1];
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET() {
  const { userId, getToken } = await auth();

  if (!userId) {
    return NextResponse.json({ signedIn: false }, { status: 401 });
  }

  const token = await getToken();
  const claims = decodeJwtPayload(token);
  const supabase = await createServerSupabaseClient();

  const coachResult = await supabase
    .from("coaches")
    .select("id, email, clerk_id, name")
    .eq("clerk_id", userId)
    .maybeSingle();

  const runnerResult = coachResult.data?.id
    ? await supabase
        .from("runners")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", coachResult.data.id)
    : null;

  return NextResponse.json({
    signedIn: true,
    clerkUserId: userId,
    tokenClaims: claims
      ? {
          sub: claims.sub,
          role: claims.role,
          aud: claims.aud,
          iss: claims.iss,
          exp: claims.exp,
        }
      : null,
    coach: {
      data: coachResult.data,
      error: coachResult.error
        ? {
            message: coachResult.error.message,
            code: coachResult.error.code,
            details: coachResult.error.details,
            hint: coachResult.error.hint,
          }
        : null,
    },
    runners: runnerResult
      ? {
          count: runnerResult.count,
          error: runnerResult.error
            ? {
                message: runnerResult.error.message,
                code: runnerResult.error.code,
                details: runnerResult.error.details,
                hint: runnerResult.error.hint,
              }
            : null,
        }
      : null,
  });
}
