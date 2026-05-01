export async function sendMassSMS(
  parentPhones: string[],
  message: string
) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  
  if (!accountSid || !authToken || !fromNumber) {
    console.log('Twilio not configured - would send to', parentPhones.length, 'parents:');
    console.log('Message:', message);
    return { success: false, error: 'Twilio not configured', mock: true };
  }

  try {
    const twilioModule = await import('twilio');
    const twilio = twilioModule.default;
    const client = twilio(accountSid, authToken);

    const normalizedPhones = parentPhones
      .map(formatPhoneForSms)
      .filter((phone): phone is string => Boolean(phone));

    if (normalizedPhones.length === 0) {
      return { success: false, error: 'No valid parent phone numbers' };
    }

    const results = await Promise.all(
      normalizedPhones.map(phone => 
        client.messages.create({
          body: message,
          from: fromNumber,
          to: phone,
        })
      )
    );
    
    console.log("Mass SMS sent:", results.length, "messages");
    return { success: true, count: results.length };
  } catch (error) {
    console.error('Mass SMS failed:', error);
    return { success: false, error: String(error) };
  }
}

function formatPhoneForSms(phone: string) {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) return trimmed;

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;

  return null;
}
