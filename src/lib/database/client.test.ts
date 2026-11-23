import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createDatabase, type Database } from './client';
import type { SqlPool, SqlConnection, SqlResult } from './types';
import { WalletService } from '../../services/wallet.service';
import { parseUtcTimestamp } from './timestamps';
import vm from 'node:vm';
import ts from 'typescript';
import { NextResponse } from 'next/server';
import { getTemplateVariables } from '../template-utils';

let postgres: PGlite;
let database: Database;
const statements: { text: string; values: unknown[] }[] = [];
let releases = 0;
const query = async (text: string, values: unknown[] = []): Promise<SqlResult> => {
  statements.push({ text, values });
  const result = await postgres.query<Record<string, unknown>>(text, values);
  return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
};
const pool: SqlPool = {
  query,
  connect: async () => ({ query, release: () => { releases++; } }),
  end: async () => {},
};
let owner: number, other: number, contact: number, account: number;

before(async () => {
  postgres = new PGlite({ parsers: { 1114: parseUtcTimestamp } });
  await postgres.exec(await readFile(new URL('../../../db/schema.sql', import.meta.url), 'utf8'));
  database = createDatabase(pool, 'public', pool);
});
after(async () => { await postgres.close(); });

test('existing PostgreSQL schema supports authentication rows, defaults and restricted selection', async () => {
  const user = await database.user.create({ data: { name: 'Owner', email: 'owner@example.invalid', password: 'synthetic hash', status: 'ACTIVE' } });
  const second = await database.user.create({ data: { name: 'Other', email: 'other@example.invalid', password: 'synthetic hash', status: 'ACTIVE' } });
  owner = user.id; other = second.id;
  assert.equal(user.role, 'USER');
  assert.equal(user.walletBalance, 0);
  assert.equal(user.companyId, null);
  assert.ok(user.createdAt instanceof Date);
  const selected = await database.user.findUnique({ where: { email: user.email }, select: { id: true, role: true, companyId: true, email: true } });
  assert.deepEqual(Object.keys(selected!).sort(), ['companyId', 'email', 'id', 'role']);
  assert.equal('password' in selected!, false);
  assert.equal(await database.user.findUnique({ where: { email: 'missing@example.invalid' } }), null);
});

test('mapped contact table, logical filters and malicious values remain parameterized and tenant scoped', async () => {
  const phone = "+919900000001'); DROP TABLE contacts; --";
  const row = await database.contact.create({ data: { name: 'Contact', phone, userId: owner } });
  contact = row.id;
  await database.contact.create({ data: { name: 'Foreign contact', phone, userId: other } });
  const rows = await database.contact.findMany({ where: { userId: owner, OR: [{ phone }, { id: -1 }] } });
  assert.equal(rows.length, 1); assert.equal(rows[0].id, row.id);
  assert.equal(statements.at(-1)!.text.includes(phone), false);
  assert.ok(statements.at(-1)!.values.includes(phone));
  assert.equal((await database.contact.findUnique({ where: { userId_phone: { userId: owner, phone } } }))?.id, row.id);
  assert.deepEqual(await database.contact.findMany({ where: { id: { in: [] } } }), []);
  await assert.rejects(database.contact.findMany({ where: { unknown_column: 1 } }), /Unknown filter/);
  await assert.rejects(database.contact.update({ where: { userId: owner }, data: { name: 'Unsafe bulk write' } }), /unique selector/);
});

test('compound upserts return a stable conversation and atomically update existing rows', async () => {
  const input = { where: { userId_phone: { userId: owner, phone: '+919900000001' } }, create: { userId: owner, phone: '+919900000001', contactId: contact }, update: { name: 'Updated contact' } };
  const rows = await Promise.all(Array.from({ length: 5 }, () => database.conversation.upsert(input)));
  assert.equal(new Set(rows.map(row => row.id)).size, 1);
  assert.equal(rows.at(-1)?.name, 'Updated contact');
  assert.equal(await database.conversation.count({ where: { userId: owner } }), 1);
  assert.match(statements.find(s => s.text.startsWith('INSERT INTO "public"."Conversation"'))!.text, /ON CONFLICT \("userId", "phone"\)/);
});

test('template JSON arrays, account relations, compound keys and owner filters retain their shapes', async () => {
  const wa = await database.whatsAppAccount.create({ data: { userId: owner, accessToken: 'synthetic-token', phoneNumberId: 'test-phone', status: 'ACTIVE' } });
  account = wa.id;
  const template = await database.whatsAppTemplate.upsert({
    where: { whatsappAccountId_name: { whatsappAccountId: account, name: 'welcome' } },
    create: { whatsappAccountId: account, name: 'welcome', language: 'en', category: 'UTILITY', status: 'ACTIVE', components: [{ type: 'BODY', text: 'Hello' }] },
    update: { components: [] },
  });
  assert.deepEqual(template.components, [{ type: 'BODY', text: 'Hello' }]);
  await database.whatsAppTemplate.update({ where: { id: template.id }, data: { components: [], headerMediaUrl: undefined } });
  const selected = await database.whatsAppTemplate.findFirst({ where: { name: 'welcome', whatsappAccount: { userId: owner, isActive: true } }, include: { whatsappAccount: true } });
  assert.deepEqual(selected?.components, []); assert.equal(selected?.whatsappAccount.userId, owner);
  assert.equal(await database.whatsAppTemplate.findFirst({ where: { whatsappAccount: { userId: other } } }), null);
  const jsonString = await database.whatsAppTemplate.update({ where: { id: template.id }, data: { components: 'legacy JSON string' } });
  assert.equal(jsonString.components, 'legacy JSON string');
});

test('chatbot nodes, edges and nested session relations load with generated text IDs', async () => {
  const bot = await database.chatbot.create({ data: { userId: owner, name: 'Test bot', status: 'ACTIVE', published: true, whatsappAccountId: account } });
  assert.match(bot.id, /^c[a-f0-9]{24}$/);
  const node = await database.chatbotNode.create({ data: { chatbotId: bot.id, type: 'trigger', data: { keyword: 'Hi' }, position: { x: 1, y: 2 } } });
  await database.chatbotEdge.create({ data: { chatbotId: bot.id, source: node.id, target: node.id, data: { test: true } } });
  await database.chatSession.create({ data: { chatbotId: bot.id, userKey: 'test-user', memory: { items: ['one', 2] }, lastNodeId: node.id } });
  const sessions = await database.chatSession.findMany({ where: { lastNodeId: { not: null }, chatbot: { userId: owner, published: true } }, include: { chatbot: { include: { nodes: true, edges: true } } } });
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].chatbot.nodes[0].type, 'trigger');
  assert.equal(sessions[0].chatbot.edges[0].source, node.id);
  assert.deepEqual(sessions[0].memory, { items: ['one', 2] });
});

test('reminder date/time predicates, relation includes and defaults match existing worker queries', async () => {
  await database.contactReminder.create({ data: { userId: owner, contactId: contact, message: 'Test', scheduleType: 'once', onDate: '2026-10-12', fromTime: '10:00' } });
  await database.contactReminder.create({ data: { userId: owner, contactId: contact, message: 'Future', scheduleType: 'once', onDate: '2026-10-14', fromTime: '10:00' } });
  const rows = await database.contactReminder.findMany({ where: { delivered: false, triggered: false, OR: [{ onDate: { lt: '2026-10-13' } }, { AND: [{ onDate: '2026-10-13' }, { OR: [{ fromTime: { lte: '11:00' } }, { allDay: true }] }] }] }, include: { user: true, contact: true }, orderBy: { id: 'asc' } });
  assert.equal(rows.length, 1); assert.equal(rows[0].status, 'PENDING');
  assert.equal(rows[0].contact.id, contact); assert.equal(rows[0].user.id, owner);
});

test('wallet deductions commit once, rollback insufficient funds and keep SQL on one transaction client', async () => {
  await database.user.update({ where: { id: owner }, data: { walletBalance: 100 } });
  const start = statements.length, beforeRelease = releases;
  const first = await WalletService.deductWallet(owner, 10, 'synthetic-message', database);
  const repeat = await WalletService.deductWallet(owner, 10, 'synthetic-message', database);
  assert.equal(first?.id, repeat?.id);
  assert.equal((await database.user.findUnique({ where: { id: owner } }))?.walletBalance, 90);
  assert.equal(await database.walletTransaction.count({ where: { messageId: 'synthetic-message' } }), 1);
  await assert.rejects(WalletService.deductWallet(owner, 100, 'insufficient-message', database), /Insufficient wallet balance/);
  assert.equal((await database.user.findUnique({ where: { id: owner } }))?.walletBalance, 90);
  assert.equal(await database.walletTransaction.count({ where: { messageId: 'insufficient-message' } }), 0);
  const transactionSql = statements.slice(start).map(s => s.text);
  assert.ok(transactionSql.some(s => s.includes('FOR UPDATE')));
  assert.ok(transactionSql.includes('BEGIN ISOLATION LEVEL SERIALIZABLE'));
  assert.ok(transactionSql.includes('ROLLBACK'));
  assert.equal(releases - beforeRelease, 3);
});

test('transactions roll back multiple writes and reject clients retained after completion', async () => {
  const beforeBalance = (await database.user.findUnique({ where: { id: owner } }))!.walletBalance;
  await assert.rejects(database.transaction(async tx => {
    await tx.user.update({ where: { id: owner }, data: { walletBalance: { decrement: 5 } } });
    await tx.walletTransaction.create({ data: { userId: owner, messageId: 'will-rollback', amount: 5, type: 'DEDUCTION' } });
    throw new Error('Synthetic failure');
  }), /Synthetic failure/);
  assert.equal((await database.user.findUnique({ where: { id: owner } }))?.walletBalance, beforeBalance);
  assert.equal(await database.walletTransaction.count({ where: { messageId: 'will-rollback' } }), 0);
  let captured: Database | undefined;
  await database.transaction(async tx => { captured = tx; });
  await assert.rejects(captured!.user.findUnique({ where: { id: owner } }), /already ended/);
});

test('webhook batch updates and support cleanup return counts with no unsafe empty selectors', async () => {
  const webhook = await database.incomingWebhook.create({ data: { payload: { entries: [] }, status: 'PENDING' } });
  assert.deepEqual(await database.incomingWebhook.updateMany({ where: { id: { in: [webhook.id] } }, data: { status: 'PROCESSED', processedAt: new Date() } }), { count: 1 });
  assert.equal((await database.incomingWebhook.findUnique({ where: { id: webhook.id } }))?.status, 'PROCESSED');
  await database.support_tickets.create({ data: { name: 'Test', email: 'test@example.invalid', phone: '0', message: 'Test', userId: owner, status: 'RESOLVED', updatedAt: new Date(), resolvedAt: new Date('2026-10-11T00:00:00Z') } });
  assert.deepEqual(await database.support_tickets.deleteMany({ where: { status: 'RESOLVED', resolvedAt: { lt: new Date('2026-10-12T00:00:00Z') } } }), { count: 1 });
  await assert.rejects(database.user.update({ where: {}, data: { name: 'Unsafe' } }), /selector/);
});

test('rollback failures discard the connection exactly once and preserve the original error', async () => {
  let releaseCount = 0, discarded = false;
  const connection: SqlConnection = {
    query: async text => { if (text === 'ROLLBACK') throw new Error('Lost connection'); return { rows: [], rowCount: 0 }; },
    release: error => { releaseCount++; discarded = !!error; },
  };
  const fake: SqlPool = { query: connection.query, connect: async () => connection, end: async () => {} };
  const client = createDatabase(fake, 'public', fake);
  await assert.rejects(client.transaction(async () => { throw new Error('Original failure'); }), /Original failure/);
  assert.equal(releaseCount, 1); assert.equal(discarded, true);
});

test('UTC timestamp values and partial updates preserve data and update the model timestamp', async () => {
  const timestamp = new Date('2026-10-13T10:30:00+05:30');
  const row = await database.incomingWebhook.create({ data: { payload: { test: true }, status: 'PENDING', createdAt: timestamp } });
  assert.equal(row.createdAt.toISOString(), '2026-10-13T05:00:00.000Z');
  const before = await database.user.findUnique({ where: { id: owner } });
  const changed = await database.user.update({ where: { id: owner }, data: { name: 'Owner updated', email: undefined } });
  assert.equal(changed.email, before!.email);
  assert.ok(changed.updatedAt.getTime() >= before!.updatedAt.getTime());
  await assert.rejects(database.user.create({ data: { name: 'Duplicate', email: changed.email, password: 'synthetic', status: 'ACTIVE' } }), (error: unknown) => (error as { code?: string }).code === '23505');
});

test('wallet row locks use the configured schema instead of the default search path', async () => {
  await postgres.exec('CREATE SCHEMA isolated; CREATE TABLE isolated."User" (id INTEGER PRIMARY KEY, "walletBalance" DOUBLE PRECISION); INSERT INTO isolated."User" VALUES (1, 17);');
  const isolated = createDatabase(pool, 'isolated', pool);
  const selected = await isolated.transaction(tx => tx.user.findUniqueForUpdate({ where: { id: 1 }, select: { id: true, walletBalance: true } }));
  assert.deepEqual(selected, { id: 1, walletBalance: 17 });
  assert.ok(statements.some(s => s.text.includes('FROM "isolated"."User"') && s.text.includes('FOR UPDATE')));
});

test('transaction timeout prevents delayed callbacks from writing after rollback and release', async () => {
  const queries: string[] = [];
  let released = 0;
  const fakePool: SqlPool = {
    query: async text => { queries.push(text); return { rows: [], rowCount: 0 }; },
    connect: async () => ({ query: fakePool.query, release: () => { released++; } }),
    end: async () => {},
  };
  const timeoutDatabase = createDatabase(fakePool, 'public', fakePool);
  let lateWrite: Promise<unknown> | undefined;
  await assert.rejects(timeoutDatabase.transaction(async tx => {
    await new Promise(resolve => setTimeout(resolve, 30));
    lateWrite = tx.user.update({ where: { id: owner }, data: { name: 'Too late' } });
    return await lateWrite;
  }, { timeout: 5 }), /timed out/);
  await new Promise(resolve => setTimeout(resolve, 40));
  await assert.rejects(lateWrite!, /already ended/);
  assert.equal(queries.some(sql => sql.startsWith('UPDATE')), false);
  assert.ok(queries.includes('ROLLBACK'));
  assert.equal(released, 1);
});

test('the actual local campaign route reads and writes PostgreSQL while outbound sends are isolated', async () => {
  const recipient = await database.contact.create({ data: { userId: owner, name: 'Recipient', phone: '+919900000009' } });
  const noPhone = await database.contact.create({ data: { userId: owner, name: 'No phone' } });
  const template = await database.whatsAppTemplate.create({ data: { whatsappAccountId: account, name: 'campaign-test', language: 'en', category: 'UTILITY', status: 'ACTIVE', components: [{ type: 'BODY', text: 'Hello' }] } });
  const campaign = await database.campaign.create({ data: { userId: owner, name: 'Synthetic campaign', type: 'template', selectedTemplate: String(template.id), audienceData: { contacts: [recipient.id, noPhone.id] }, whatsappAccountId: account } });
  const source = await readFile(new URL('../../app/user/campaigns/execute/api/route.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: { POST?: (request: { json: () => Promise<unknown> }) => Promise<Response> } = {};
  const sent: unknown[][] = [];
  let currentUser: { id: number } | null = null;
  vm.runInNewContext(compiled, {
    exports, Date, console: { warn() {}, error() {} },
    require: (specifier: string) => {
      if (specifier === 'next/server') return { NextResponse };
      if (specifier === '@/lib/auth') return { getCurrentUser: async () => currentUser };
      if (specifier === '@/lib/database') return { database };
      if (specifier === '@/lib/whatsapp') return { sendWhatsAppTemplate: async (...args: unknown[]) => { sent.push(args); } };
      if (specifier === '@/lib/template-utils') return { getTemplateVariables };
      throw new Error(`Unexpected campaign dependency ${specifier}`);
    },
  });
  const request = { json: async () => ({ campaignId: campaign.id }) };
  assert.equal((await exports.POST!(request)).status, 401);
  currentUser = { id: other };
  assert.equal((await exports.POST!(request)).status, 404);
  currentUser = { id: owner };
  const response = await exports.POST!(request);
  assert.deepEqual(await response.json(), { success: true, sent: 1, failed: 1 });
  assert.equal(sent.length, 1); assert.equal(sent[0][0], recipient.phone);
  const result = await database.campaign.findUnique({ where: { id: campaign.id } });
  assert.equal(result?.status, 'completed'); assert.equal(result?.sentCount, 1); assert.equal(result?.failedCount, 1);
  await exports.POST!(request);
  assert.equal(sent.length, 1, 'A completed campaign sent its messages again');
});

test('the actual webhook worker persists processed/failed jobs without contacting Redis or providers', async () => {
  type Job = { id: string; data: { internalId: number; payload: unknown } };
  let processJob: ((job: Job) => Promise<unknown>) | undefined;
  let failHandler = false;
  class Worker {
    constructor(_name: string, callback: (job: Job) => Promise<unknown>) { processJob = callback; }
    on() {}
  }
  const source = await readFile(new URL('../../workers/webhooks.worker.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, {
    exports: {}, Date, process: { env: {} }, console: { log() {}, warn() {}, error() {} },
    require: (specifier: string) => {
      if (specifier === 'bullmq') return { Worker };
      if (specifier === '@/lib/redisConnection') return { default: {} };
      if (specifier === '@/lib/database') return { database };
      if (specifier === '../services/message.service') return { MessageService: { handleStatusUpdate: async () => { if (failHandler) throw new Error('Synthetic handler failure'); }, handleInbound: async () => {} } };
      throw new Error(`Unexpected worker dependency ${specifier}`);
    },
  });
  const payload = { entry: [{ changes: [{ value: { statuses: [{ id: 'synthetic-wamid', status: 'delivered' }] } }] }] };
  const row = await database.incomingWebhook.create({ data: { payload, status: 'PENDING' } });
  await processJob!({ id: 'test-job', data: { internalId: row.id, payload } });
  const completed = await database.incomingWebhook.findUnique({ where: { id: row.id } });
  assert.equal(completed?.status, 'PROCESSED'); assert.ok(completed?.processedAt instanceof Date);
  failHandler = true;
  await assert.rejects(processJob!({ id: 'failed-job', data: { internalId: row.id, payload } }), /Synthetic handler failure/);
  const failed = await database.incomingWebhook.findUnique({ where: { id: row.id } });
  assert.equal(failed?.status, 'FAILED'); assert.equal(failed?.error, 'Synthetic handler failure');
});
