/**
 * WhatsApp Cloud API - Phone Number Registration
 *
 * Per Meta docs: After embedded signup you MUST call the register API.
 * The PIN is system-generated (6-digit) and stored in DB for the account.
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/reference/registration
 */

/**
 * Generate a random 6-digit PIN for two-step verification.
 * Used when registering a phone number for Cloud API use.
 */
export function generateSixDigitPin(): string {
  const min = 100000;
  const max = 999999;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

/**
 * Register a phone number for WhatsApp Cloud API use.
 * Required per Meta docs after embedded signup.
 *
 * @param phoneNumberId - The business phone number ID
 * @param accessToken - Bearer token with whatsapp_business_management permission
 * @param pin - 6-digit two-step verification PIN (system-generated)
 */
export async function registerPhoneForCloudApi(
  phoneNumberId: string,
  accessToken: string,
  pin: string,
): Promise<{ success: boolean; error?: unknown }> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/register`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          pin,
        }),
      },
    );
    const data = await res.json();

    if (data.success) {
      return { success: true };
    }
    return { success: false, error: data.error };
  } catch (err) {
    return { success: false, error: err };
  }
}
