import fs from 'node:fs';
import { openBrowser, pause } from './cdp.mjs';

const origin = 'http://127.0.0.1:3100';
const inventory = JSON.parse(fs.readFileSync('audit/inventory.json', 'utf8'));
const results = { isolation: 'Real local production Next frontend; API requests are fulfilled in browser. No external sending/payment/customer data access.', http: [], pages: [], interactions: [], unexpectedExternal: [] };
const token = [Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ id: 999999, role: 'USER', email: 'audit-owner@example.invalid', companyId: 'audit-company', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'audit-invalid-signature'].join('.');
fs.mkdirSync('audit/evidence', { recursive: true });
function save() { fs.writeFileSync('audit/runtime-results.json', JSON.stringify(results, null, 2)); }
for (const route of inventory.routes) {
  const path = encodeURI(route.concreteUrl);
  for (const variant of ['anonymous', 'forged-external-token']) {
    const response = await fetch(origin + path, { redirect: 'manual', headers: variant === 'anonymous' ? {} : { Cookie: `consoleAccessToken=${token}` } });
    const html = await response.text();
    results.http.push({ route: route.route, path, variant, status: response.status, location: response.headers.get('location'), length: html.length, serverError: response.status >= 500 });
  }
}
for (const [variant, headers] of [['refresh-only', { Cookie: 'refreshToken=audit-invalid-refresh' }], ['rsc-header', { Accept: 'text/x-component' }], ['expired-forged-token', { Cookie: `consoleAccessToken=${token.replace(token.split('.')[1], Buffer.from(JSON.stringify({ id: 999999, role: 'USER', exp: 1 })).toString('base64url'))}` }]]) {
  const response = await fetch(origin + '/user/dashboard', { redirect: 'manual', headers });
  results.http.push({ route: '/user/dashboard', variant, status: response.status, location: response.headers.get('location'), length: (await response.text()).length });
}
save();
console.log(`HTTP coverage complete: ${results.http.length} requests to local UI routes.`);

const browser = await openBrowser();
let current = null;
let apiMode = 'error';
let role = 'USER';
const pendingFetches = new Set();
const stats = { campaigns_count: '3', chatbot_count: '2', contacts_count: '7', contact_lists_count: '1', sent_count: '12', failed_count: '2', delivered_count: '10', total_count: '12', received_count: '4', message_template_count: '2', unique_contacts_count: '7', templates_count: '2', total_messages: 16 };
const memberPermissions = ['dashboard', 'contact', 'inbox'];
const apiResponse = (url, method) => {
  if (url.includes('/plan/status')) return { status: 200, data: { success: true, data: { active: true, status: 'ACTIVE', plan_name: 'Audit Test Plan', plan_end_date: '2099-01-01' } }, mock: 'shell-active-plan' };
  if (url.includes('/my-permissions')) return { status: 200, data: { success: true, data: { permissions: role === 'USER' ? [] : memberPermissions } }, mock: 'shell-role-permissions' };
  if (url.includes('/auth/company-details')) return { status: 200, data: { success: true, data: { company: { id: 'audit-company', name: 'Audit Company' } } }, mock: 'shell-company' };
  if (url.includes('/users') && !url.includes('/stats') && !url.includes('/plans')) return { status: 200, data: { success: true, data: { id: 'audit-owner', name: 'Audit Owner', email: 'audit-owner@example.invalid', role, plan_active: true, company_id: 'audit-company', credit_balance: 500, wallet_balance: 500 } }, mock: 'shell-profile' };
  if (apiMode === 'success' && url.includes('/users/stats')) return { status: 200, data: { success: true, data: stats }, mock: 'dashboard-fixture' };
  if (apiMode === 'empty' && method === 'GET') return { status: 200, data: { success: true, data: [], contacts: [], campaigns: [], templates: [], total: 0, totalPages: 0, pagination: { total: 0, totalPages: 0, page: 1 } }, mock: 'generic-empty-unverified-contract' };
  if (apiMode === 'logical-failure') return { status: 200, data: { success: false, message: 'Audit operation rejected', error: 'Audit operation rejected', data: [] }, mock: 'logical-failure' };
  if (apiMode === 'unauthorized') return { status: 401, data: { success: false, message: 'Audit session expired', error: 'Unauthorized' }, mock: 'expired-api-session' };
  return { status: 503, data: { success: false, message: 'Audit test service unavailable', error: 'Audit test service unavailable' }, mock: 'service-unavailable' };
};
browser.on('Runtime.exceptionThrown', event => { if (current) current.exceptions.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text); });
browser.on('Runtime.consoleAPICalled', event => {
  if (!current || !['error', 'warning'].includes(event.type)) return;
  current.console.push({ type: event.type, text: event.args.map(arg => arg.value !== undefined ? String(arg.value) : arg.description || arg.type).join(' ').replace(/[\w-]+\.[\w-]+\.[\w-]+/g, '[token-redacted]').slice(0, 1200) });
});
browser.on('Network.loadingFailed', event => { if (current) current.failedRequests.push({ type: event.type, error: event.errorText, canceled: event.canceled }); });
browser.on('Fetch.requestPaused', event => {
  const task = (async () => {
    const url = new URL(event.request.url);
    const local = url.origin === origin;
    const resource = event.resourceType;
    const isAsset = local && (/^\/_next\/|\.(?:css|js|png|jpg|jpeg|svg|ico|woff2?|webp|mp3|wav)$/.test(url.pathname));
    if (local && ((resource === 'Document' && event.request.method === 'GET') || isAsset)) { await browser.send('Fetch.continueRequest', { requestId: event.requestId }); return; }
    if (!local && ['Stylesheet', 'Font', 'Image'].includes(resource)) {
      await browser.send('Fetch.fulfillRequest', { requestId: event.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: resource === 'Stylesheet' ? 'text/css' : 'application/octet-stream' }], body: '' }); return;
    }
    if (!local && resource === 'Script') { await browser.send('Fetch.fulfillRequest', { requestId: event.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/javascript' }], body: '' }); return; }
    if (event.request.method === 'OPTIONS') { await browser.send('Fetch.fulfillRequest', { requestId: event.requestId, responseCode: 204, responseHeaders: [{ name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Headers', value: '*' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' }] }); return; }
    const response = apiResponse(url.pathname + url.search, event.request.method);
    if (current) current.requests.push({ method: event.request.method, url: url.origin + url.pathname + url.search, payload: (event.request.postData || '').replace(/"(password|token|access_token|refresh_token|api_key)"\s*:\s*"[^"]*"/gi, '"$1":"[REDACTED]"').slice(0, 1600), status: response.status, mock: response.mock });
    await browser.send('Fetch.fulfillRequest', { requestId: event.requestId, responseCode: response.status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Credentials', value: 'true' }], body: Buffer.from(JSON.stringify(response.data)).toString('base64') });
  })().catch(error => { if (current) current.console.push({ type: 'audit-harness', text: error.message }); });
  pendingFetches.add(task); task.finally(() => pendingFetches.delete(task));
});
await browser.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.WebSocket = class AuditBlockedWebSocket { constructor() { throw new Error('AUDIT: external WebSocket disabled; real-time integration not verified'); } };
  window.__auditAlerts=[];window.alert=message=>window.__auditAlerts.push(String(message));window.confirm=()=>false;
  const user={id:'audit-owner',role:'USER',name:'Audit Owner',email:'audit-owner@example.invalid',company_id:'audit-company',plan_active:true,plan_end_date:'2099-01-01'};
  localStorage.setItem('console_access_token',${JSON.stringify(token)});localStorage.setItem('user_data',JSON.stringify(user));localStorage.setItem('company_id','audit-company');
` });
await browser.send('Network.setCookie', { name: 'consoleAccessToken', value: token, url: origin, sameSite: 'Lax' });
async function navigate(route, width, mode) {
  current = { route: route.route, concreteUrl: route.concreteUrl, width, mode, scenario: apiMode, role, exceptions: [], console: [], requests: [], failedRequests: [] };
  await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
  await browser.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }] });
  try { await browser.evaluate('localStorage.setItem(' + JSON.stringify('theme') + ',' + JSON.stringify(mode) + ')'); } catch {}
  await browser.send('Page.navigate', { url: origin + encodeURI(route.concreteUrl) });
  for (let i = 0; i < 50; i++) { try { if (await browser.evaluate('document.readyState === "complete" && !!document.body?.innerText.trim()')) break; } catch {} await pause(100); }
  await pause(800);
  await browser.evaluate(`localStorage.setItem('theme',${JSON.stringify(mode)});document.documentElement.classList.toggle('dark',${mode === 'dark'});`);
  current.dom = await browser.evaluate(`(() => {
    const visible=el=>!!(el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
    const buttons=[...document.querySelectorAll('button')].filter(visible).map(el=>({text:el.innerText.trim().slice(0,80),label:el.getAttribute('aria-label'),title:el.title,disabled:el.disabled}));
    const inputs=[...document.querySelectorAll('input,textarea,select')].filter(visible).map(el=>({tag:el.tagName,type:el.type,name:el.name,id:el.id,required:el.required,label:el.getAttribute('aria-label')||el.labels?.[0]?.innerText||null,placeholder:el.getAttribute('placeholder')}));
    const overflowing=[...document.querySelectorAll('body *')].filter(el=>visible(el)&&el.getBoundingClientRect().right>innerWidth+2&&getComputedStyle(el).position!=='fixed').slice(0,8).map(el=>({tag:el.tagName,class:el.className?.toString().slice(0,100),right:Math.round(el.getBoundingClientRect().right)}));
    return {url:location.pathname,title:document.title,headings:[...document.querySelectorAll('h1,h2,h3')].filter(visible).map(el=>el.innerText.trim()).slice(0,18),text:document.body.innerText.slice(0,5000),buttons,inputs,overflow:document.documentElement.scrollWidth>innerWidth+2,overflowing,unnamedButtons:buttons.filter(el=>!el.text&&!el.label&&!el.title),alerts:window.__auditAlerts||[]};
  })()`);
  const slug = route.route.replaceAll(/[^\w-]/g, '-').replaceAll(/-+/g, '-').slice(0, 95) || 'root';
  current.screenshot = `evidence/${slug}-${mode}-${width}.png`;
  await browser.screenshot('audit/' + current.screenshot);
  current.status = current.exceptions.length || /Application error:|Internal Server Error|404[\\s\\S]*could not be found/i.test(current.dom.text) ? 'Failed' : 'Blocked';
  current.note = current.status === 'Failed' ? 'Reproduced runtime failure under intercepted service-unavailable responses; inspect evidence.' : 'Page rendered under intercepted API failure; business functionality and real persistence remain blocked.';
  results.pages.push(current); save();
  return current;
}
try {
  const protectedRoutes = inventory.routes.filter(route => !['/', '/auth', '/team/setup-password'].includes(route.route));
  for (const route of protectedRoutes) {
    for (const [width, mode] of [[1440, 'light'], [390, 'dark'], [1440, 'dark'], [390, 'light']]) await navigate(route, width, mode);
    console.log(`Inspected ${route.route}: ${results.pages.slice(-4).map(item => `${item.mode}/${item.width}:${item.status}`).join(', ')}`);
  }
  save();
} finally { await Promise.allSettled([...pendingFetches]); await browser.close(); }

