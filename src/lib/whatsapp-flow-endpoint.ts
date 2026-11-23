/**
 * WhatsApp Flows Data Endpoint: decrypt/encrypt and key management.
 * @see https://developers.facebook.com/docs/whatsapp/flows/guides/implementingyourflowendpoint
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/reference/whatsapp-business-encryption
 */

import crypto from "crypto";

const TAG_LENGTH = 16;
const RSA_KEY_BITS = 2048;

export interface DecryptedFlowPayload {
  version?: string;
  action: string;
  screen?: string;
  data?: Record<string, unknown>;
  flow_token?: string;
  flow_token_signature?: string;
}

export interface DecryptResult {
  decryptedBody: DecryptedFlowPayload;
  aesKeyBuffer: Buffer;
  initialVectorBuffer: Buffer;
}

/**
 * Generate a 2048-bit RSA key pair for Flow endpoint encryption.
 * Returns PEM strings (public key can be uploaded to Meta).
 */
export function generateFlowEndpointKeyPair(): {
  publicKeyPem: string;
  privateKeyPem: string;
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: RSA_KEY_BITS,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKeyPem: publicKey, privateKeyPem: privateKey };
}

/**
 * Upload the business public key to Meta for the given phone number.
 * Must be called per phone number; requires whatsapp_business_messaging permission.
 */
export async function uploadFlowEndpointPublicKey(
  phoneNumberId: string,
  accessToken: string,
  publicKeyPem: string,
  apiVersion: string = "v22.0"
): Promise<{ success: boolean }> {
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/whatsapp_business_encryption`;
  const body = new URLSearchParams({
    business_public_key: publicKeyPem,
  }).toString();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = (await res.json()) as { success?: boolean; error?: { message?: string } };
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `Upload public key failed: ${res.status}`);
  }
  return { success: !!data.success };
}

/**
 * Decrypt the incoming Flow endpoint request body (data_api_version 3.0).
 * Uses RSA/OAEP to decrypt the AES key, then AES-128-GCM to decrypt the payload.
 */
export function decryptFlowEndpointRequest(
  body: {
    encrypted_flow_data: string;
    encrypted_aes_key: string;
    initial_vector: string;
  },
  privateKeyPem: string
): DecryptResult {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;
  if (!encrypted_aes_key || !encrypted_flow_data || !initial_vector) {
    throw new Error("Missing encrypted_flow_data, encrypted_aes_key, or initial_vector");
  }

  const decryptedAesKey = crypto.privateDecrypt(
    {
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(encrypted_aes_key, "base64")
  );

  const flowDataBuffer = Buffer.from(encrypted_flow_data, "base64");
  const initialVectorBuffer = Buffer.from(initial_vector, "base64");
  const encryptedBody = flowDataBuffer.subarray(0, -TAG_LENGTH);
  const authTag = flowDataBuffer.subarray(-TAG_LENGTH);

  const decipher = crypto.createDecipheriv(
    "aes-128-gcm",
    decryptedAesKey,
    initialVectorBuffer
  );
  decipher.setAuthTag(authTag);

  const decryptedJSONString = Buffer.concat([
    decipher.update(encryptedBody),
    decipher.final(),
  ]).toString("utf-8");

  return {
    decryptedBody: JSON.parse(decryptedJSONString) as DecryptedFlowPayload,
    aesKeyBuffer: decryptedAesKey,
    initialVectorBuffer,
  };
}

/**
 * Encrypt the response payload for the Flow endpoint (data_api_version 3.0).
 * Flip the IV bits and encrypt with AES-128-GCM, then return base64.
 */
export function encryptFlowEndpointResponse(
  response: object,
  aesKeyBuffer: Buffer,
  initialVectorBuffer: Buffer
): string {
  const flippedIv = Buffer.from(
    Array.from(initialVectorBuffer).map((b) => ~b & 0xff)
  );
  const cipher = crypto.createCipheriv(
    "aes-128-gcm",
    aesKeyBuffer,
    flippedIv
  );
  return Buffer.concat([
    cipher.update(JSON.stringify(response), "utf-8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
}

/**
 * Validate X-Hub-Signature-256 from Meta (optional but recommended).
 * Uses app secret; sign payload with HMAC-SHA256 and compare.
 */
export function validateFlowEndpointSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = signatureHeader.slice(7);
  const hmac = crypto.createHmac("sha256", appSecret);
  hmac.update(rawBody);
  const actual = hmac.digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));
}
