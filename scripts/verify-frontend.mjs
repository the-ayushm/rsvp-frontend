import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { compile } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';
import WebSocket from 'ws';

const require = createRequire(import.meta.url);
const read = file => fs.readFileSync(file, 'utf8');
const output = '.tmp/frontend-verification';
fs.mkdirSync(output, { recursive: true });
const source = read('src/features/dashboard/DashboardPage.tsx');
const transpile = source => ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const icons = { exports: {}, require, React };
vm.runInNewContext(transpile(read('src/components/dashboard-icons.tsx')), icons);
const context = { require, React, useState: React.useState, ...icons.exports };
vm.runInNewContext(transpile(source.slice(source.indexOf('const getTrendIcon'), source.indexOf('const StatCard')) + '\n globalThis.Card = MetricCard;'), context);
const utilities = { exports: {}, require };
vm.runInNewContext(transpile(read('src/lib/utils.ts')), utilities);
const sharedFiles = ['Button', 'Badge', 'Input', 'Table'];
const shared = Object.fromEntries(sharedFiles.map(name => {
  const componentModule = { exports: {}, React, require: specifier => specifier === '@/lib/utils' ? utilities.exports : require(specifier) };
  vm.runInNewContext(transpile(read(`src/components/ui/${name}.tsx`)), componentModule);
  return [name, componentModule.exports.default];
}));
const sharedControls = renderToStaticMarkup(React.createElement('section', { className: 'bg-card border border-border rounded-lg p-4 m-4', id: 'shared-controls' },
  React.createElement(shared.Button, { size: 'sm', id: 'shared-primary' }, 'Save'),
  React.createElement(shared.Button, { size: 'sm', disabled: true, id: 'shared-disabled' }, 'Disabled'),
  React.createElement(shared.Badge, { variant: 'success' }, 'Success'),
  React.createElement(shared.Badge, { variant: 'warning' }, 'Warning'),
  React.createElement(shared.Input, { label: 'Contact name', defaultValue: 'Parth Vichare' }),
  React.createElement(shared.Table, { columns: [{ key: 'name', header: 'Name' }, { key: 'status', header: 'Status' }], data: [{ name: 'Contact', status: 'Active' }] })
));
const data = [['Total Messages', '10,524', 'All messages', 'total_messages'], ['Messages Failed', '10,506', '99.8% failed', 'failed'], ['Messages Received', '28', 'Inbound replies', 'received'], ['Total Contacts', '5,161', 'Active leads', 'contacts'], ['Campaigns', '153', 'Total campaigns', 'campaigns']];
const cards = data.map(([title, value, subtitle, type], index) => renderToStaticMarkup(React.createElement(context.Card, { card: { title, value, subtitle, type, trend: 'stable', change: 'Live' }, index }))).join('');
const sidebar = '<aside data-app-sidebar data-rail="true" style="height:100dvh;flex-shrink:0"><div><nav><ul><li class="sidebar-item sidebar-item-active"><svg><circle cx="9" cy="9" r="6" fill="currentColor"/></svg><span>Dashboard</span></li></ul></nav></div></aside>';
const controls = '<section class="contacts-reference"><div class="contacts-actions"><div class="contacts-action-group"><button id="primary-control">Create contact</button><button disabled>Disabled</button></div></div><div class="contacts-search"><input aria-label="Search" value="Contact"></div><table class="contacts-data-table"><thead><tr><th>Name</th><th>Status</th></tr></thead><tbody><tr><td>Contact</td><td>Active</td></tr></tbody></table></section><div class="appearance-control"><button class="appearance-trigger">Theme</button></div>';
const wrapper = `<div style="display:flex">${sidebar}<main id="app-main" style="flex:1;min-width:0"><header class="topbar-main-wrapper">Dashboard</header><div class="dashboard-container"><div class="px-4 py-8"><div class="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">${cards}</div></div></div>${controls}${sharedControls}</main></div>`;
const scanner = new Scanner({});
const candidates = scanner.scanFiles([{ content: source + wrapper + sharedFiles.map(name => read(`src/components/ui/${name}.tsx`)).join('\n'), extension: 'tsx' }]);
const compiler = await compile(read('src/app/globals.css'), { base: path.resolve('src/app'), onDependency() {} });
const css = compiler.build(candidates) + read('src/features/dashboard/dashboard.css') + read('src/features/contacts/contacts-reference.css') + read('src/components/ThemeToggle.css');
fs.writeFileSync(`${output}/preview.html`, `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\n*,*::before,*::after{animation:none!important;transition:none!important}</style></head><body>${wrapper}</body></html>`);

const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
assert(fs.existsSync(chrome), 'Set CHROME_PATH to a Chromium browser to run visual verification.');
const port = 9233;
const browser = spawn(chrome, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${path.resolve(output, 'chrome')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let pages;
  for (let i = 0; i < 100; i++) {
    try { pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (pages.some(p => p.type === 'page')) break; } catch { /* Browser is starting. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(pages, 'Chromium did not expose its local debugging endpoint.');
  socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  let id = 0;
  const pending = new Map();
  socket.on('close', (code, reason) => { for (const task of pending.values()) task.reject(new Error(`Browser connection closed (${code}): ${reason}`)); pending.clear(); });
  socket.on('message', raw => { const data = JSON.parse(raw); const task = pending.get(data.id); if (task) { pending.delete(data.id); if (data.error) task.reject(data.error); else task.resolve(data.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const next = ++id;
    const timer = setTimeout(() => { pending.delete(next); reject(new Error(`Browser timed out: ${method}`)); }, 10000);
    pending.set(next, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id: next, method, params }));
  });
  const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true }); assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails)); return result.result.value; };
  const antSource = transpile(read('src/theme/antd.ts'));
  const readAntTokens = () => evaluate(`(() => { const exports = {}; ${antSource}; return exports.readAntTokens(); })()`);
  await send('Page.enable');
  await send('Page.navigate', { url: 'file:///' + path.resolve(output, 'preview.html').replaceAll('\\', '/') });
  for (let i = 0; i < 100; i++) { if (await evaluate('!!document.querySelector(".dashboard-statistic-value")')) break; await new Promise(resolve => setTimeout(resolve, 50)); }
  const results = [];
  for (const width of [1440, 390]) for (const mode of ['light', 'dark']) for (const accent of ['emerald', 'blue', 'violet', 'teal', 'amber']) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
    await evaluate(`document.documentElement.classList.toggle('dark',${mode === 'dark'}); document.documentElement.dataset.accent=${JSON.stringify(accent)};`);
    const actual = await evaluate(`(() => {
      const stats = [...document.querySelectorAll('.dashboard-statistic-value')].map(el => {
        const style = getComputedStyle(el), rect = el.getBoundingClientRect(), card = el.closest('.group').getBoundingClientRect();
        return { size: style.fontSize, weight: style.fontWeight, color: style.color, fits: rect.right <= card.right && rect.left >= card.left };
      });
      const body = getComputedStyle(document.body), button = getComputedStyle(document.querySelector('#primary-control'));
      return { stats, bodyFont: body.fontFamily, button: button.backgroundColor, overflow: document.documentElement.scrollWidth > innerWidth, sidebar: document.querySelector('aside').getBoundingClientRect().width };
    })()`);
    assert(actual.stats.every(v => v.size === (width >= 768 ? '40px' : '32px') && v.weight === '700' && v.fits), `${width}/${mode}/${accent}: statistic layout changed`);
    assert(!actual.overflow, `${width}/${mode}/${accent}: horizontal overflow`);
    assert.equal(actual.sidebar, width >= 768 ? 112 : 88);
    const bridge = await readAntTokens();
    assert(bridge.colorPrimary && bridge.colorBgContainer && bridge.fontFamily, 'Ant Design bridge must resolve its CSS tokens.');
    results.push({ width, mode, accent, ...actual });
    if (accent === 'emerald') { const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); fs.writeFileSync(`${output}/${mode}-${width}.png`, Buffer.from(shot.data, 'base64')); }
  }
  // Prove inheritance without changing source files; then restore the intended design.
  await evaluate(`document.documentElement.style.setProperty('--primary','#123456'); document.documentElement.style.setProperty('--font-body','monospace');`);
  const changed = await evaluate(`({color:getComputedStyle(document.querySelector('#primary-control')).backgroundColor,font:getComputedStyle(document.body).fontFamily})`);
  assert.equal(changed.color, 'rgb(18, 52, 86)'); assert.equal(changed.font, 'monospace');
  const sharedChanged = await evaluate(`getComputedStyle(document.getElementById('shared-primary')).backgroundColor`);
  assert.equal(sharedChanged, 'rgb(18, 52, 86)');
  const antChanged = await readAntTokens();
  assert.equal(antChanged.colorPrimary, '#123456'); assert.equal(antChanged.fontFamily, 'monospace');
  await evaluate(`document.documentElement.style.removeProperty('--primary');document.documentElement.style.removeProperty('--font-body');document.documentElement.classList.remove('dark');document.documentElement.dataset.accent='emerald';`);
  fs.writeFileSync(`${output}/results.json`, JSON.stringify({ results, centralTokenPropagation: changed, limitations: 'Rendered actual dashboard cards and representative contacts/layout controls; no authenticated API interaction.' }, null, 2));
  console.log('Passed 20 browser combinations: statistic sizing, compact rail, shared controls, no overflow, and central color/font propagation through DOM and Ant Design.');
} finally {
  socket?.close();
  browser.kill();
}
