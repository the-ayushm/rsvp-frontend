import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export class FacebookError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

function encryptionKey() {
  const key = process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY || '';
  if (!/^[a-f\d]{64}$/i.test(key)) throw new FacebookError('Facebook token encryption is not configured. Contact your administrator.', 503);
  return Buffer.from(key, 'hex');
}

export function encrypt(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(v => v.toString('base64url')).join('.');
}

export function decrypt<T>(value: string): T {
  const [iv, tag, data] = value.split('.').map(v => Buffer.from(v, 'base64url'));
  const cipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8')) as T;
}

export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function matchesHash(value: string, expected: string) {
  const a = Buffer.from(hash(value), 'hex'), b = Buffer.from(expected, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export type AppCredentials = { appId: string; appSecret: string; configId?: string };
export type SavedCredentials = AppCredentials & { accessToken: string };

export function settings() {
  encryptionKey();
  if (!process.env.DATABASE_URL) throw new FacebookError('Facebook storage is not configured. Contact your administrator.', 503);
  const uri = process.env.FACEBOOK_REDIRECT_URI || '';
  let redirect: URL;
  try { redirect = new URL(uri); } catch { throw new FacebookError('FACEBOOK_REDIRECT_URI must be configured.', 503); }
  if (redirect.protocol !== 'https:' || redirect.pathname !== '/api/integrations/facebook/oauth/callback' || redirect.search || redirect.hash || redirect.username || redirect.password) {
    throw new FacebookError('Configure an HTTPS Facebook callback at /api/integrations/facebook/oauth/callback.', 503);
  }
  const version = process.env.FACEBOOK_GRAPH_VERSION || 'v25.0';
  if (!/^v\d+\.\d+$/.test(version)) throw new FacebookError('FACEBOOK_GRAPH_VERSION is invalid.', 503);
  return { redirectUri: redirect.href, origin: redirect.origin, version };
}

export function appCredentials(custom?: Partial<AppCredentials>): AppCredentials {
  const appId = custom?.appId?.trim() || process.env.FACEBOOK_APP_ID || '';
  const appSecret = custom?.appSecret?.trim() || process.env.FACEBOOK_APP_SECRET || '';
  const configId = custom?.configId?.trim() || (custom?.appId ? undefined : process.env.FACEBOOK_LOGIN_CONFIG_ID);
  if (!/^\d+$/.test(appId) || !appSecret || appSecret.length > 512 || (configId && !/^\d+$/.test(configId))) {
    throw new FacebookError('A valid Facebook App ID and App Secret are required.', 503);
  }
  return { appId, appSecret, configId };
}

export const FACEBOOK_SCOPES = ['pages_show_list', 'pages_read_engagement', 'pages_manage_ads', 'leads_retrieval', 'ads_management'];
