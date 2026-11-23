import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

export const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function openBrowser({ port = 9244, profile = '.tmp/audit-chrome' } = {}) {
  const browserPath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  if (!fs.existsSync(browserPath)) throw Error('Set CHROME_PATH to an installed Chromium browser.');
  const child = spawn(browserPath, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${path.resolve(profile)}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let pages;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (pages.some(p => p.type === 'page')) break; } catch {}
    await pause(100);
  }
  if (!pages) { child.kill(); throw Error('Local Chromium debugging endpoint unavailable.'); }
  const socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  socket.on('message', raw => {
    const item = JSON.parse(raw);
    const task = pending.get(item.id);
    if (task) { pending.delete(item.id); if (item.error) task.reject(Error(JSON.stringify(item.error))); else task.resolve(item.result); }
    if (item.method) for (const handler of listeners.get(item.method) || []) handler(item.params);
  });
  socket.on('close', () => { for (const task of pending.values()) task.reject(Error('Browser connection closed.')); pending.clear(); });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const next = ++id;
    const timer = setTimeout(() => { pending.delete(next); reject(Error(`CDP timeout: ${method}`)); }, 20000);
    pending.set(next, { resolve: result => { clearTimeout(timer); resolve(result); }, reject: error => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id: next, method, params }));
  });
  const on = (event, callback) => { if (!listeners.has(event)) listeners.set(event, []); listeners.get(event).push(callback); };
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
  };
  const screenshot = async file => { const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(file, Buffer.from(result.data, 'base64')); };
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Log.enable');
  return { send, on, evaluate, screenshot, close: async () => { try { await send('Browser.close'); } catch {} socket.close(); child.kill(); } };
}
