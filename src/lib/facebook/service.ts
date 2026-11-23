import { randomBytes, randomUUID } from 'node:crypto';
import { database } from '@/lib/database';
import { quoteIdentifier } from '@/lib/database/client';
import type { Database } from '@/lib/database/client';
import { graph, getPages, getForms, exchangeCode, extendToken, type FacebookLead, type GraphList } from './graph';
import { appCredentials, decrypt, encrypt, FacebookError, FACEBOOK_SCOPES, hash, matchesHash, settings, type AppCredentials, type SavedCredentials } from './security';

const table = (name: string) => `${quoteIdentifier(database.schema)}.${quoteIdentifier(`dashboard_facebook_${name}`)}`;
type Connection = {
  owner_key: string; revision: string; credentials: string; facebook_user_id: string; account_name: string; expires_at: Date;
  page_id: string | null; page_name: string | null; page_token: string | null;
  form_id: string | null; form_name: string | null; last_synced_at: Date | null; updated_at: Date;
};
type Attempt = { id: string; owner_key: string; browser_hash: string; credentials: string; status: string };
export const OAUTH_COOKIE = 'facebook_oauth_browser';

export async function connection(owner: string, db: Database = database) {
  const result = await db.execute(`SELECT * FROM ${table('connections')} WHERE owner_key = $1`, [owner]);
  return (result.rows[0] as unknown as Connection | undefined) ?? null;
}

async function requireConnection(owner: string) {
  const row = await connection(owner);
  if (!row || new Date(row.expires_at).getTime() <= Date.now()) throw new FacebookError('Connect or reconnect your Facebook account first.', 409);
  return row;
}

export async function connectionStatus(owner: string) {
  const row = await connection(owner);
  const count = row ? await database.execute(`SELECT count(*)::int AS count FROM ${table('leads')} WHERE owner_key=$1 AND page_id=$2 AND form_id=$3`, [owner, row.page_id, row.form_id]) : null;
  return {
    connected: Boolean(row && new Date(row.expires_at).getTime() > Date.now()),
    connection: row ? {
      account_name: row.account_name, page_id: row.page_id, page_name: row.page_name,
      form_id: row.form_id, form_name: row.form_name, last_synced_at: row.last_synced_at,
      updated_at: row.updated_at, expires_at: row.expires_at, lead_count: Number(count?.rows[0]?.count ?? 0),
    } : null,
  };
}

export async function startOAuth(owner: string, custom?: Partial<AppCredentials>) {
  const config = settings(), app = appCredentials(custom);
  const id = randomUUID(), state = `${id}.${randomBytes(32).toString('base64url')}`, browser = randomBytes(32).toString('base64url');
  await database.transaction(async db => {
    await db.execute(`DELETE FROM ${table('oauth_attempts')} WHERE expires_at < now()`);
    await db.execute(`UPDATE ${table('oauth_attempts')} SET status='cancelled', credentials=NULL WHERE owner_key=$1 AND status IN ('pending','processing')`, [owner]);
    await db.execute(`INSERT INTO ${table('oauth_attempts')} (id,owner_key,state_hash,browser_hash,credentials,expires_at) VALUES ($1,$2,$3,$4,$5,now()+interval '10 minutes')`, [id, owner, hash(state), hash(browser), encrypt(app)]);
  });
  const url = new URL(`https://www.facebook.com/${config.version}/dialog/oauth`);
  url.search = new URLSearchParams({ client_id: app.appId, redirect_uri: config.redirectUri, state, response_type: 'code',
    ...(app.configId ? { config_id: app.configId } : { scope: FACEBOOK_SCOPES.join(','), auth_type: 'rerequest' }),
  }).toString();
  return { attempt_id: id, authorization_url: url.href, browser };
}

export async function finishOAuth(state: string, browser: string, code: string | null, denied: boolean) {
  const found = await database.execute(`SELECT id,owner_key,browser_hash,credentials,status FROM ${table('oauth_attempts')} WHERE state_hash=$1 AND expires_at>now()`, [hash(state)]);
  const attempt = found.rows[0] as unknown as Attempt | undefined;
  if (!attempt || attempt.status !== 'pending' || !browser || !matchesHash(browser, attempt.browser_hash)) {
    throw new FacebookError('This Facebook login has expired or belongs to another browser. Return to the dashboard and try again.');
  }
  const claimed = await database.execute(`UPDATE ${table('oauth_attempts')} SET status='processing' WHERE id=$1 AND status='pending' RETURNING id`, [attempt.id]);
  if (!claimed.rows.length) throw new FacebookError('This Facebook login has already been used. Start a new connection.');
  try {
    if (denied || !code) throw new FacebookError('Facebook login was cancelled or access was declined. Try again and approve the requested access.');
    const app = decrypt<AppCredentials>(attempt.credentials);
    const short = await exchangeCode(code, app);
    const token = await extendToken(short.access_token, app);
    const profile = await graph<{ id: string; name: string }>('me', { fields: 'id,name' }, token.access_token, app.appSecret);
    // Ensure Page access is usable before reporting a successful connection.
    const pages = await getPages(token.access_token, app.appSecret);
    if (!pages.length) throw new FacebookError('No Facebook Pages were granted. Reconnect, select your Pages, and check that you have Page access.');
    await database.transaction(async db => {
      const current = await db.execute(`SELECT status FROM ${table('oauth_attempts')} WHERE id=$1 AND expires_at>now() FOR UPDATE`, [attempt.id]);
      if (current.rows[0]?.status !== 'processing') throw new FacebookError('This connection attempt was cancelled. Start a new connection.');
      await db.execute(`INSERT INTO ${table('connections')} (owner_key,credentials,facebook_user_id,account_name,expires_at,revision)
        VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (owner_key) DO UPDATE SET credentials=EXCLUDED.credentials,revision=EXCLUDED.revision,
        facebook_user_id=EXCLUDED.facebook_user_id,account_name=EXCLUDED.account_name,expires_at=EXCLUDED.expires_at,
        page_id=NULL,page_name=NULL,page_token=NULL,form_id=NULL,form_name=NULL,last_synced_at=NULL,updated_at=now()`,
      [attempt.owner_key, encrypt({ ...app, accessToken: token.access_token }), profile.id, profile.name, new Date(Date.now() + (token.expires_in || 3600) * 1000), randomUUID()]);
      await db.execute(`UPDATE ${table('oauth_attempts')} SET status='connected',credentials=NULL WHERE id=$1`, [attempt.id]);
    });
  } catch (error) {
    const message = error instanceof FacebookError ? error.message : 'Facebook connection failed. Please try again.';
    await database.execute(`UPDATE ${table('oauth_attempts')} SET status='error',error=$2,credentials=NULL WHERE id=$1 AND status='processing'`, [attempt.id, message]);
    throw new FacebookError(message);
  }
}

export async function oauthStatus(owner: string, id: string) {
  if (!/^[a-f\d-]{36}$/i.test(id)) throw new FacebookError('Invalid connection attempt.');
  const result = await database.execute(`SELECT status,error,expires_at FROM ${table('oauth_attempts')} WHERE id=$1 AND owner_key=$2`, [id, owner]);
  const row = result.rows[0];
  if (!row) throw new FacebookError('Connection attempt was not found. Start again.', 404);
  if (['pending', 'processing'].includes(String(row.status)) && new Date(String(row.expires_at)).getTime() <= Date.now()) return { status: 'error', error: 'Facebook login expired. Please try again.' };
  return { status: row.status, error: row.error };
}

export async function cancelOAuth(owner: string, id: string) {
  if (!/^[a-f\d-]{36}$/i.test(id)) throw new FacebookError('Invalid connection attempt.');
  await database.execute(`UPDATE ${table('oauth_attempts')} SET status='cancelled',credentials=NULL WHERE id=$1 AND owner_key=$2 AND status IN ('pending','processing')`, [id, owner]);
}

export async function listPages(owner: string) {
  const row = await requireConnection(owner), app = decrypt<SavedCredentials>(row.credentials);
  return (await getPages(app.accessToken, app.appSecret)).map(p => ({ id: p.id, name: p.name }));
}

async function authorizedPage(owner: string, pageId: string) {
  if (!/^\d+$/.test(pageId)) throw new FacebookError('Select a valid Facebook Page.');
  const row = await requireConnection(owner), app = decrypt<SavedCredentials>(row.credentials);
  const page = (await getPages(app.accessToken, app.appSecret)).find(p => p.id === pageId);
  if (!page?.access_token) throw new FacebookError('This Page is not available to your Facebook account. Reconnect and grant access.', 403);
  return { row, app, page };
}

export async function listForms(owner: string, pageId: string) {
  const { app, page } = await authorizedPage(owner, pageId);
  return getForms(page, app.appSecret);
}

export async function saveSelection(owner: string, pageId: string, formId: string) {
  if (!/^\d+$/.test(formId)) throw new FacebookError('Select a valid Facebook form.');
  const { row, app, page } = await authorizedPage(owner, pageId);
  const form = (await getForms(page, app.appSecret)).find(f => f.id === formId);
  if (!form) throw new FacebookError('This form does not belong to the selected Page.', 403);
  const result = await database.execute(`UPDATE ${table('connections')} SET page_id=$2,page_name=$3,page_token=$4,form_id=$5,form_name=$6,
    last_synced_at=CASE WHEN page_id=$2 AND form_id=$5 THEN last_synced_at ELSE NULL END,updated_at=now(),revision=$8
    WHERE owner_key=$1 AND revision=$7 RETURNING owner_key`, [owner, page.id, page.name, encrypt(page.access_token), form.id, form.name, row.revision, randomUUID()]);
  if (!result.rows.length) throw new FacebookError('Your Facebook connection changed. Refresh and try again.', 409);
  return connectionStatus(owner);
}

export async function syncLeads(owner: string, after?: string, selection?: string) {
  const row = await requireConnection(owner);
  if (!row.page_id || !row.form_id || !row.page_token) throw new FacebookError('Save a Facebook Page and form before syncing.', 409);
  const signature = row.revision;
  if (selection && selection !== signature) throw new FacebookError('The selected Page or form changed. Start sync again.', 409);
  if (after && !selection) throw new FacebookError('Start a new lead sync before continuing.');
  const app = decrypt<SavedCredentials>(row.credentials);
  const page = await graph<GraphList<FacebookLead>>(`${row.form_id}/leads`, {
    fields: 'id,created_time,field_data', limit: '100', ...(after ? { after } : {}),
  }, decrypt<string>(row.page_token), app.appSecret);
  const next = page.paging?.next ? page.paging.cursors?.after : null;
  if (page.paging?.next && (!next || next === after)) throw new FacebookError('Facebook returned an invalid lead cursor. Retry syncing.', 502);
  let imported = 0;
  await database.transaction(async db => {
    const current = await db.execute(`SELECT revision FROM ${table('connections')} WHERE owner_key=$1 FOR UPDATE`, [owner]);
    if (current.rows[0]?.revision !== row.revision) throw new FacebookError('Your Facebook connection changed. Start sync again.', 409);
    for (const lead of page.data) {
      const result = await db.execute(`INSERT INTO ${table('leads')} (owner_key,lead_id,page_id,form_id,created_time,fields)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT (owner_key,lead_id) DO NOTHING RETURNING lead_id`,
      [owner, lead.id, row.page_id, row.form_id, lead.created_time, JSON.stringify(lead.field_data || [])]);
      imported += result.rows.length;
    }
    if (!next) await db.execute(`UPDATE ${table('connections')} SET last_synced_at=now() WHERE owner_key=$1`, [owner]);
  });
  return { imported, next_cursor: next || null, selection: signature };
}

export async function recentLeads(owner: string) {
  const row = await requireConnection(owner);
  const result = await database.execute(`SELECT lead_id,created_time,fields FROM ${table('leads')} WHERE owner_key=$1 AND page_id=$2 AND form_id=$3 ORDER BY created_time DESC,lead_id DESC LIMIT 10`, [owner, row.page_id, row.form_id]);
  return result.rows;
}

export async function disconnect(owner: string) {
  await database.transaction(async db => {
    await db.execute(`UPDATE ${table('oauth_attempts')} SET status='cancelled',credentials=NULL WHERE owner_key=$1 AND status IN ('pending','processing')`, [owner]);
    await db.execute(`DELETE FROM ${table('connections')} WHERE owner_key=$1`, [owner]);
  });
  return { connected: false, connection: null };
}
