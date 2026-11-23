# Frontend and API on one ngrok domain

Keep the API on port 8001 and the dashboard on port 3001. Point the single ngrok
tunnel at port 3001. The dashboard proxies `/v1/*` and `/uploads/*` to the API;
`/live` checks API liveness. Dashboard pages and sockets stay on port 3001.

Set these local dashboard values in `.env.local`:

```env
NEXT_PUBLIC_API_URL=/v1
API_PROXY_TARGET=http://127.0.0.1:8001
DEV_TUNNEL_HOST=waving-waving-albatross.ngrok-free.dev
# Optional: hostname used in team invite links (hostname only, no https:// or port).
# Needed when you create invites from http://localhost, which can't be opened by others.
NEXT_PUBLIC_TEAM_INVITE_HOST=waving-waving-albatross.ngrok-free.dev
```

Set these API values in `.env`:

```env
GOOGLE_REDIRECT_URI=https://hostapi.soft7.in//v1/integrations/google/callback
GOOGLE_FRONTEND_URL=https://hostapi.soft7.in/
SHOPIFY_REDIRECT_URI=https://hostapi.soft7.in//v1/integrations/shopify/callback
SHOPIFY_FRONTEND_URL=https://hostapi.soft7.in/
AUTOMATION_PUBLIC_BASE_URL=https://hostapi.soft7.in/
```

Restart the API and dashboard after changing these settings, then run:

```powershell
ngrok http --url=waving-waving-albatross.ngrok-free.dev 3001
```

Open the dashboard at `https://hostapi.soft7.in/`. Register
the exact Google callback above in the OAuth client's authorized redirect URIs
in Google Cloud. Add the ngrok origin to the Google Picker browser API key's
allowed referrers, if that key is restricted. Register the Shopify callback
in the Shopify app when using its OAuth connection.

Cancel any OAuth popup opened before a configuration change and start Connect
Google again from the ngrok dashboard. Its start request and callback must use
the same host, so the callback receives the browser-binding cookie. Do not
disable the cookie, state or PKCE checks to work around a host mismatch.

Changing ngrok domains requires updating these callback/provider settings.
Previously registered flow webhook URLs must also be re-registered for the new
origin. The proxy is enabled only when `API_PROXY_TARGET` is set.
