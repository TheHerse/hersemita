import { supabaseAdmin } from "@/lib/supabase-admin";

type MessageRecipient = {
  runnerId: string;
  runnerName: string;
  parentPhone: string | null;
};

type LogParentMessageInput = {
  teamId?: string | null;
  coachId?: string | null;
  messageType: string;
  body: string;
  status: "sent" | "mock" | "error";
  mock: boolean;
  errorMessage?: string | null;
  runnerCount: number;
  recipients: MessageRecipient[];
};

function phoneLast4(phone: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

export async function logParentMessage(input: LogParentMessageInput) {
  if (!input.teamId) return;

  const { data: batch, error: batchError } = await supabaseAdmin
    .from("parent_message_batches")
    .insert({
      team_id: input.teamId,
      coach_id: input.coachId || null,
      message_type: input.messageType || "general",
      body: input.body,
      status: input.status,
      provider: "twilio",
      mock: input.mock,
      runner_count: input.runnerCount,
      recipient_count: input.recipients.length,
      error_message: input.errorMessage || null,
    })
    .select("id")
    .single();

  if (batchError || !batch?.id) {
    console.error("Parent message batch log failed:", batchError?.message);
    return;
  }

  if (input.recipients.length === 0) return;

  const { error: recipientError } = await supabaseAdmin.from("parent_message_recipients").insert(
    input.recipients.map((recipient) => ({
      batch_id: batch.id,
      team_id: input.teamId,
      runner_id: recipient.runnerId,
      runner_name: recipient.runnerName,
      phone_last4: phoneLast4(recipient.parentPhone),
      status: input.status,
    }))
  );

  if (recipientError) {
    console.error("Parent message recipient log failed:", recipientError.message);
  }
}
