# Facebook Lead Ads OAuth

Open **App Marketplace → Facebook Lead Ads → Connect**, or
`/user/integrations/facebook`. The connection dialog opens Facebook login in a
popup. After consent, choose a Facebook Page and an Instant Form, then save the
connection. **Sync Facebook Leads** imports all available form leads, 100 at a
time, and displays the latest 10. Repeated syncs skip existing lead IDs.

This is a manual sync integration. Imported leads are stored in its own tables;
they are not automatically added to WhatsApp Contacts, enrolled in flows, or
treated as WhatsApp opt-ins. Webhook subscriptions and automatic background
sync are not included.

## Server setup

1. Copy the settings in [`.env.facebook.example`](../.env.facebook.example) into
   `.env.local`. These values belong on the **dashboard server**, because the new
   endpoints run in Next.js under `/api/integrations/facebook/*`. Keep all App
   Secrets and encryption keys out of `NEXT_PUBLIC_*` variables.
2. Set `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_GRAPH_VERSION`, and
   `FACEBOOK_REDIRECT_URI` for your Meta app. An optional
   `FACEBOOK_LOGIN_CONFIG_ID` supports Facebook Login for Business: configure the
   required permissions in that Meta login configuration. With no configuration
   ID, the OAuth dialog requests the scopes directly.
3. Generate a persistent encryption key:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Save the result as `FACEBOOK_TOKEN_ENCRYPTION_KEY`. Changing it invalidates
   encrypted existing connections; retain it across restarts and deployments.
4. Use the dashboard's existing `DATABASE_URL`. Apply the additive migration
   explicitly, against the intended database:

   ```powershell
   npx tsx scripts/database/setup-facebook.ts
   ```

   This command reads `.env` and process environment variables. If the database
   URL is only in `.env.local`, load that file in your shell before running it.
   No database tables are created automatically during application requests.
5. The dashboard verifies every authenticated integration request through the
   existing `SOCKET_AUTH_API_URL`, which defaults to
   `https://hostapi.soft7.in//v1/auth/socket-session`. Set this server-only URL when
   the backend runs elsewhere. The endpoint must validate the dashboard bearer
   token and browser origin and return the existing socket-session contract.
   Company and user IDs come from that verified response, not client input.
6. Restart the dashboard after setting environment variables.

## Meta configuration

Enable Facebook Login (or Facebook Login for Business) on your Meta app and
register the **exact** callback as a Valid OAuth Redirect URI, for example:

```text
https://your-dashboard.example/api/integrations/facebook/oauth/callback
```

Use HTTPS, including for local tests through your existing ngrok tunnel. Open
the dashboard on that same public origin before clicking Connect so the
HttpOnly browser-binding cookie reaches the callback. The callback is served by
the dashboard; `/v1` proxy settings do not change it.

The integration requests `pages_show_list`, `pages_read_engagement`,
`pages_manage_ads`, `leads_retrieval`, and `ads_management`. Configure these
permissions in a Facebook Login for Business configuration if using its ID.
Complete Meta's applicable App Review, access, and business verification steps
before onboarding external customers. During development, use accounts with
the appropriate app roles and Page/lead access. Check Leads Access in Meta
Business settings if Pages appear but form or lead requests are denied.

Users can choose **I would like to use my own App Credentials** in the dialog.
Their app must register the same callback. Custom secrets are sent over HTTPS
and encrypted on the server; they are never stored in browser storage or
returned in API responses. The server encryption key, redirect URI, database,
and session verification endpoint are still required.

Provider references:
[manual login flow](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/),
[retrieving leads](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving/),
[Page lead forms](https://developers.facebook.com/docs/graph-api/reference/page/leadgen_forms/).

## Behavior and recovery

- Login state is random, expires after 10 minutes, is browser-bound, and is
  consumed once. Callback errors and denied consent appear in the dialog.
- User and Page tokens and App Secrets are encrypted with AES-256-GCM.
  Tokens never reach the browser. Graph calls use app-secret proof.
- Page IDs are checked against the user's authorized Pages. Form IDs are checked
  against the selected Page before saving. Responses and leads are scoped to
  the verified company/user pair.
- If sync fails partway through, previously committed batches remain saved.
  Retry sync to fetch the remaining leads; duplicates are skipped. Saving a
  different form or reconnecting invalidates an in-flight sync cursor.
- Reconnect to renew expired/revoked access or grant different Pages. Reconnect
  clears the selected Page and form; choose and save them again. Imported leads
  remain available when their Page/form is selected again.
- Disconnect removes the local tokens, saved selection, and all imported leads
  for this connection. It also cancels pending login attempts. Users can remove
  provider permissions separately in Facebook Business Integrations.

## Validation

```powershell
npx tsx --test src/lib/facebook/facebook.test.ts
npm run typecheck
```

The automated tests use an isolated in-memory PostgreSQL database and mocked
Meta/session responses; they do not read or write production data. Complete an
end-to-end test with your actual Meta app: connect, approve Pages, select a form,
save, create a test lead with Meta's Lead Ads Testing Tool, sync twice, verify
the count stays stable, then reconnect or disconnect.
