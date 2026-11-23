import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';

export const output = 'audit';
fs.mkdirSync(`${output}/evidence`, { recursive: true });
const normalize = value => value.replaceAll('\\', '/');
const frontendFiles = fs.readdirSync('src', { recursive: true }).filter(file => /\.(tsx?|jsx?|css)$/.test(file)).map(file => 'src/' + normalize(file));
const routes = frontendFiles.filter(file => file.startsWith('src/app/') && file.endsWith('/page.tsx')).map(file => {
  const route = '/' + file.replace(/^src\/app\//, '').replace(/\/page.tsx$/, '').replace(/^page.tsx$/, '');
  const source = fs.readFileSync(file, 'utf8');
  return { route, file, concreteUrl: route.replaceAll('[phoneId]', 'audit-phone').replaceAll('[templateId]', 'audit-template').replaceAll('[id]', 'audit-record'), status: 'Blocked', evidence: [], notes: 'Runtime validation pending; source review is not a pass.', onlyComments: !source.split('\n').some(line => line.trim() && !line.trim().startsWith('//')) };
}).sort((a, b) => a.route.localeCompare(b.route));
const apiCalls = [];
const controls = [];
const navigation = [];
const imports = [];
for (const file of frontendFiles.filter(file => /\.[tj]sx?$/.test(file))) {
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const line = node => ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const call = node.expression.getText(ast);
      if (/(?:AxiosInstance|axios|api|fetch|\.get|\.post|\.put|\.patch|\.delete)/i.test(call) && node.arguments[0] && /(?:\/admin\/|\/api\/|\/auth\/|\/user\/|https?:)/.test(node.arguments[0].getText(ast))) {
        const method = call.match(/\.(get|post|put|patch|delete)$/i)?.[1]?.toUpperCase() || (call === 'fetch' ? 'FETCH (inspect options)' : 'UNKNOWN');
        apiCalls.push({ file, line: line(node), method, endpoint: node.arguments[0].getText(ast), expression: call, status: 'Blocked', evidence: 'Source inventory only; request/result verification pending.' });
      }
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(ast);
      if (/^(button|input|select|textarea|form|dialog|Button|Input|Select|Modal|Dialog|Table|Tabs|Pagination)$/.test(tag)) {
        const attrs = node.attributes.properties.filter(ts.isJsxAttribute).map(a => ({ name: a.name.getText(ast), value: a.initializer?.getText(ast).slice(0, 220) }));
        controls.push({ file, line: line(node), tag, attributes: attrs });
      }
      const href = node.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(ast) === 'href');
      if (href?.initializer) navigation.push({ file, line: line(node), href: href.initializer.getText(ast) });
    }
    if (ts.isImportDeclaration(node)) imports.push({ file, specifier: node.moduleSpecifier.text });
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
const snapshotFiles = [...frontendFiles, 'package.json', 'server-user.ts', 'server-admin.ts', 'next.config.ts', 'eslint.config.mjs', 'README.md'];
const snapshot = Object.fromEntries(snapshotFiles.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
fs.writeFileSync(`${output}/source-snapshot.json`, JSON.stringify(snapshot, null, 2));
const inventory = {
  date: '2026-10-02', scope: 'Entire discovered frontend; source-only items are not passed.',
  routes, apiCalls, controls, navigation, imports,
  roles: ['Unauthenticated', 'USER (account owner)', 'MEMBER', 'VIEWER', 'ADMIN (separate portal)', 'SUPERADMIN / SUPER_ADMIN / MASTER_ADMIN (separate portal)'],
  majorFlows: ['Authentication / registration / OTP / password reset / invitations', 'Contacts CRUD / import / duplicate checks / tags / lists / opt-out / export / deletion', 'Campaign audience / variables / media / scheduling / pause-resume / progress', 'Inbox conversations / composer / attachments / delivery / real-time', 'Templates create / preview / validation / approval', 'Chatbots / FAQ / AI assistant configure-save-execute', 'Dashboard accuracy / date filters / refresh / charts', 'Payments / plans / credits / usage limits', 'Settings / integrations / team roles', 'Reminder scheduling / delivery', 'WhatsApp flows / webhooks / API generation', 'Authorization / tenant isolation / expiry / recovery', 'Uploads / large datasets / duplicate submissions / retry'],
  background: ['Campaign BullMQ worker', 'Webhook workers', 'Reminder worker / minute cron', 'Template-status cron every 15 minutes', 'Hourly cleanup job', 'Redis socket bridge / direct socket emission', 'Frontend polling and socket listeners'],
  counts: { routes: routes.length, apiCalls: apiCalls.length, controls: controls.length, navigationLinks: navigation.length },
};
fs.writeFileSync(`${output}/inventory.json`, JSON.stringify(inventory, null, 2));
console.log(JSON.stringify(inventory.counts));
