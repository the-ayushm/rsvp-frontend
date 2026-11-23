import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import http from 'node:http';
import ts from 'typescript';
import { io as connect } from 'socket.io-client';
import { pause } from './cdp.mjs';

const require = createRequire(import.meta.url);
const read = file => fs.readFileSync(file, 'utf8');
const transpile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const results = { isolation: 'Actual auth/socket/server source evaluated with Next, cookie and PostgreSQL boundaries mocked; sockets and HTTP loopback real; no Redis, database, workers or providers.', auth: [], sockets: [], configuration: {} };
const unsigned = payload => [Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url'), Buffer.from(JSON.stringify(payload)).toString('base64url'), 'audit-invalid-signature'].join('.');
let cookiePayload;
let databaseCalls = 0;
const authExports = {};
const authContext = {
  exports: authExports, TextEncoder, process: { env: { ACCESS_TOKEN_SECRET: 'audit-isolated-key-not-production' } }, console: { error() {} },
  require: specifier => {
    if (specifier === 'jose') return require('jose');
    if (specifier === 'next/headers') return { cookies: async () => ({ get: key => key === 'consoleAccessToken' ? { value: unsigned(cookiePayload) } : undefined }) };
    if (specifier === '@/lib/database') return { database: { user: { findUnique: async () => { databaseCalls++; throw Error('Audit blocks database calls.'); } } } };
    throw Error(`Unexpected auth dependency: ${specifier}`);
  },
};
vm.runInNewContext(transpile(read('src/lib/auth.ts')), authContext);
for (const payload of [{ id: 999999, role: 'USER', email: 'audit@example.invalid' }, { id: 999999, role: 'USER', email: 'audit@example.invalid', exp: 1 }, { id: 999999, role: 'VIEWER', companyId: 'tenant-B' }]) {
  cookiePayload = payload;
  const value = await authExports.getCurrentUser();
  results.auth.push({ case: payload.exp === 1 ? 'Expired unsigned external cookie' : 'Unsigned external cookie with numeric identity', forgedRole: payload.role, accepted: !!value, returnedId: value?.id, databaseCalls: databaseCalls, expected: 'Reject unsigned, expired, or unverified cookies.' });
}

const socketExports = {};
vm.runInNewContext(transpile(read('src/lib/socket.ts')), { exports: socketExports, require, console: { log() {} } });
const server = http.createServer((req, res) => { res.writeHead(404); res.end(); });
const io = socketExports.initSocket(server);
await new Promise(resolve => server.listen(3144, '127.0.0.1', resolve));
const attacker = connect('http://127.0.0.1:3144', { transports: ['websocket'], reconnection: false });
try {
  await new Promise((resolve, reject) => { attacker.once('connect', resolve); attacker.once('connect_error', reject); });
  attacker.emit('join_room', 'audit-victim');
  await pause(100);
  const received = new Promise(resolve => { const timer = setTimeout(() => resolve(false), 1000); attacker.once('audit-private-event', payload => { clearTimeout(timer); resolve(payload); }); });
  io.to('user_audit-victim').emit('audit-private-event', { marker: 'AUDIT_SYNTHETIC_PRIVATE_MESSAGE' });
  results.sockets.push({ case: 'Unauthenticated client joins another user room', connectionHadCredentials: false, victimRoom: 'user_audit-victim', receivedSyntheticPrivateEvent: await received, expected: 'Authenticate the connection and derive permitted rooms from verified identity.' });
} finally { attacker.disconnect(); await io.close(); server.close(); }

// Execute the real custom-server request handler, replacing only Next preparation and Redis startup.
let nextHandlerCalls = 0;
let listeningServer;
const isolatedHttp = { ...http, createServer: (...args) => { const created = http.createServer(...args); listeningServer = created; return created; } };
const serverContext = {
  exports: {}, process: { env: { USER_PORT: '3145', NODE_ENV: 'production', REDIS_URL: '', UPSTASH_REDIS_URL: '' } }, console: { log() {}, error() {} },
  require: specifier => {
    if (specifier === 'http') return isolatedHttp;
    if (specifier === 'next') return { __esModule: true, default: () => ({ prepare: async () => {}, getRequestHandler: () => (req, res) => { nextHandlerCalls++; res.writeHead(404); res.end(); } }) };
    if (specifier === './src/lib/socket') return socketExports;
    if (specifier === './src/lib/socket-bridge') return { initSocketBridge: () => { throw Error('Audit forbids Redis connections.'); } };
    throw Error(`Unexpected server dependency: ${specifier}`);
  },
};
// New socket module context so its module-level singleton is isolated from the closed server.
vm.runInNewContext(transpile(read('src/lib/socket.ts')), { exports: socketExports, require, console: { log() {} } });
vm.runInNewContext(transpile(read('server-user.ts')), serverContext);
await pause(150);
try {
  const response = await fetch('http://127.0.0.1:3145/internal/socket-emit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'audit-synthetic-injection', data: { userId: 'audit-victim', message: 'AUDIT_SYNTHETIC_ONLY' } }) });
  results.sockets.push({ case: 'Unsigned direct internal emit request', requestHadCredentials: false, status: response.status, response: await response.json(), nextMiddlewareRan: nextHandlerCalls > 0, expected: 'Require a server-to-server credential before accepting event injection.' });
} finally { await socketExports.getIO()?.close(); listeningServer?.close(); }

// Inspect only names/presence and public URL classifications. Never save private values.
for (const file of fs.readdirSync('.').filter(name => /^\.env(?:\..*)?$/.test(name))) {
  const keys = [];
  for (const line of read(file).split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([\w]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, raw] = match;
    const item = { key, configured: !!raw.trim() };
    if (/^NEXT_PUBLIC_(API_URL|NGROK_BASE_URL|SOCKET_URL)$/.test(key)) {
      try { const value = new URL(raw.trim().replace(/^['"]|['"]$/g, '')); item.publicEndpoint = value.origin + value.pathname; item.local = ['localhost', '127.0.0.1', '::1'].includes(value.hostname); } catch { item.publicEndpoint = 'Unparseable or unset'; }
    }
    keys.push(item);
  }
  results.configuration[file] = keys;
}
results.configuration.defaultApi = ' https://hostapi.soft7.in///v1';
results.configuration.userConfirmedNoIsolatedBackendOrRoleAccounts = true;
fs.writeFileSync('audit/local-probes.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify({ authCases: results.auth.length, socketCases: results.sockets.length, unsignedIdentitiesAccepted: results.auth.filter(x => x.accepted).length, publicEndpoints: Object.values(results.configuration).flat().filter(x => x?.publicEndpoint).map(x => x.publicEndpoint) }));
