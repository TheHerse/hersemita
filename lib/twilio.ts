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

    const results = await Promise.all(
      parentPhones.map(phone => 
        client.messages.create({
          body: message,
          from: fromNumber,
          to: phone.startsWith('+') ? phone : `+1${phone}`,
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