type SupabaseLikeClient = {
  from: (table: string) => any;
};

export function cleanGuardianPhone(value: string | null | undefined) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 10 ? digits : null;
}

export function cleanGuardianEmail(value: string | null | undefined) {
  const email = String(value || "").trim().toLowerCase();
  return email.includes("@") ? email : null;
}

export async function syncPrimaryRunnerGuardian({
  client,
  teamId,
  runnerId,
  phone,
  email,
}: {
  client: SupabaseLikeClient;
  teamId: string;
  runnerId: string;
  phone?: string | null;
  email?: string | null;
}) {
  const normalizedPhone = cleanGuardianPhone(phone);
  const normalizedEmail = cleanGuardianEmail(email);

  if (!normalizedPhone && !normalizedEmail) {
    await client
      .from("runner_guardians")
      .delete()
      .eq("runner_id", runnerId)
      .eq("relationship", "parent_guardian")
      .eq("is_primary", true);
    return;
  }

  // Parent portal identity should be email-first. Runner phone numbers can be
  // shared in test data or across families, so do not use a shared phone-only
  // contact as the record to mutate when a portal email is provided.
  if (normalizedEmail) {
    const { data: emailContacts } = await client
      .from("guardian_contacts")
      .select("id, email")
      .eq("team_id", teamId);

    const existingEmailContact = (emailContacts || []).find((contact: { email: string | null }) => {
      return String(contact.email || "").trim().toLowerCase() === normalizedEmail;
    });

    const { data: guardian, error } = existingEmailContact?.id
      ? await client
          .from("guardian_contacts")
          .update({
            email: normalizedEmail,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingEmailContact.id)
          .eq("team_id", teamId)
          .select("id")
          .single()
      : await client
          .from("guardian_contacts")
          .insert({
            team_id: teamId,
            email: normalizedEmail,
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();

    if (error || !guardian?.id) {
      throw new Error(error?.message || "Could not save guardian contact.");
    }

    await replacePrimaryGuardianLink({
      client,
      runnerId,
      guardianId: guardian.id,
    });

    return;
  }

  const guardian = await upsertGuardianContact({
    client,
    teamId,
    phone: normalizedPhone,
  });

  await replacePrimaryGuardianLink({
    client,
    runnerId,
    guardianId: guardian.id,
  });
}

async function replacePrimaryGuardianLink({
  client,
  runnerId,
  guardianId,
}: {
  client: SupabaseLikeClient;
  runnerId: string;
  guardianId: string;
}) {
  const { data: currentPrimaryLinks } = await client
    .from("runner_guardians")
    .select("guardian_id")
    .eq("runner_id", runnerId)
    .eq("relationship", "parent_guardian")
    .eq("is_primary", true);

  const oldGuardianIds = (currentPrimaryLinks || [])
    .map((link: { guardian_id: string }) => link.guardian_id)
    .filter((oldGuardianId: string) => oldGuardianId !== guardianId);

  if (oldGuardianIds.length > 0) {
    await client
      .from("runner_guardians")
      .delete()
      .eq("runner_id", runnerId)
      .in("guardian_id", oldGuardianIds);
  }

  await linkGuardianToRunner({
    client,
    runnerId,
    guardianId,
    relationship: "parent_guardian",
    isPrimary: true,
  });
}

export async function upsertGuardianContact({
  client,
  teamId,
  phone,
  email,
  firstName,
  lastName,
}: {
  client: SupabaseLikeClient;
  teamId: string;
  phone?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  const normalizedPhone = cleanGuardianPhone(phone);
  const normalizedEmail = cleanGuardianEmail(email);

  if (!normalizedPhone && !normalizedEmail) {
    throw new Error("Guardian email or phone is required.");
  }

  const { data: contacts } = await client
    .from("guardian_contacts")
    .select("id, phone, email, clerk_id")
    .eq("team_id", teamId);

  const existing = (contacts || []).find((contact: { phone: string | null; email: string | null }) => {
    const contactEmail = String(contact.email || "").trim().toLowerCase();
    return (normalizedEmail && contactEmail === normalizedEmail) || (normalizedPhone && contact.phone === normalizedPhone);
  });

  const payload = {
    first_name: firstName ? firstName.trim() : null,
    last_name: lastName ? lastName.trim() : null,
    phone: normalizedPhone,
    email: normalizedEmail,
    updated_at: new Date().toISOString(),
  };

  const { data: guardian, error } = existing?.id
    ? await client
        .from("guardian_contacts")
        .update(payload)
        .eq("id", existing.id)
        .eq("team_id", teamId)
        .select("id")
        .single()
    : await client
        .from("guardian_contacts")
        .insert({
          team_id: teamId,
          ...payload,
        })
        .select("id")
        .single();

  if (error || !guardian?.id) {
    throw new Error(error?.message || "Could not save guardian contact.");
  }

  return guardian as { id: string };
}

export async function linkGuardianToRunner({
  client,
  runnerId,
  guardianId,
  relationship = "parent_guardian",
  isPrimary = false,
}: {
  client: SupabaseLikeClient;
  runnerId: string;
  guardianId: string;
  relationship?: string;
  isPrimary?: boolean;
}) {
  await client.from("runner_guardians").upsert(
    {
      runner_id: runnerId,
      guardian_id: guardianId,
      relationship,
      is_primary: isPrimary,
    },
    { onConflict: "runner_id,guardian_id" }
  );
}
