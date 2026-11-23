import { createHmac } from 'node:crypto';
import { FacebookError, settings, type AppCredentials } from './security';

type GraphParams = Record<string, string>;
export type GraphList<T> = { data: T[]; paging?: { cursors?: { after?: string }; next?: string } };
export type FacebookPage = { id: string; name: string; access_token: string };
export type FacebookForm = { id: string; name: string; status: string; leads_count?: number };
export type FacebookLead = { id: string; created_time: string; field_data?: { name: string; values: string[] }[] };

async function graphRequest<T>(path: string, params: GraphParams, token?: string, appSecret?: string, post = false): Promise<T> {
  const url = new URL(`https://graph.facebook.com/${settings().version}/${path}`);
  const values = new URLSearchParams(params);
  if (token && appSecret) values.set('appsecret_proof', createHmac('sha256', appSecret).update(token).digest('hex'));
  if (!post) url.search = values.toString();
  const response = await fetch(url, {
    method: post ? 'POST' : 'GET',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(post ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: post ? values.toString() : undefined,
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000),
  });
  const body = await response.json();
  if (!response.ok || body.error) {
    const code = Number(body.error?.code);
    // Provider messages may contain tokens or submitted credentials; never echo them.
    if (code === 190) throw new FacebookError('Facebook access has expired or was revoked. Reconnect your Facebook account.', 409);
    if ([10, 200, 294].includes(code)) throw new FacebookError('Facebook denied access. Grant the requested permissions and check your Page and Leads Access in Meta Business settings.', 403);
    if ([4, 17, 32, 613].includes(code)) throw new FacebookError('Facebook is limiting requests. Try again later.', 429);
    throw new FacebookError('Facebook could not complete this request. Check your app configuration and try again.', 502);
  }
  return body as T;
}

export const graph = <T>(path: string, params: GraphParams, token: string, secret: string) => graphRequest<T>(path, params, token, secret);
export const exchangeCode = (code: string, app: AppCredentials) => graphRequest<{ access_token: string; expires_in?: number }>('oauth/access_token', {
  client_id: app.appId, client_secret: app.appSecret, redirect_uri: settings().redirectUri, code,
}, undefined, undefined, true);
export const extendToken = (token: string, app: AppCredentials) => graphRequest<{ access_token: string; expires_in?: number }>('oauth/access_token', {
  grant_type: 'fb_exchange_token', client_id: app.appId, client_secret: app.appSecret, fb_exchange_token: token,
}, undefined, undefined, true);

export async function graphList<T>(path: string, fields: string, token: string, secret: string) {
  const items: T[] = [];
  let after = '';
  for (let n = 0; n < 100; n++) {
    const page = await graph<GraphList<T>>(path, { fields, limit: '100', ...(after ? { after } : {}) }, token, secret);
    items.push(...page.data);
    if (!page.paging?.next) return items;
    const next = page.paging.cursors?.after;
    if (!next || next === after) throw new FacebookError('Facebook returned an invalid pagination cursor. Please retry.', 502);
    after = next;
  }
  throw new FacebookError('Too many Facebook results to load. Reduce the Pages granted to this app and retry.', 413);
}

export const getPages = (token: string, secret: string) => graphList<FacebookPage>('me/accounts', 'id,name,access_token', token, secret);
export const getForms = (page: FacebookPage, secret: string) => graphList<FacebookForm>(`${page.id}/leadgen_forms`, 'id,name,status,leads_count', page.access_token, secret);
