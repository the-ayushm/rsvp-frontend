import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectContactCount } from './select-contact-count';

const contacts = (start: number, count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: String(start + index) }));

test('zero clears selection and ten selects only the ten visible contacts', async () => {
  const fetchPage = async () => { throw new Error('No page request expected'); };
  assert.deepEqual(await selectContactCount(0, contacts(1, 10), fetchPage), []);
  assert.deepEqual(await selectContactCount(10, contacts(1, 10), fetchPage),
    contacts(1, 10).map(c => c.id));
});

test('100 selects exactly 100 of 2188 contacts instead of selecting everyone', async () => {
  const pages: number[] = [];
  const selected = await selectContactCount(100, contacts(1, 10), async page => {
    pages.push(page);
    return { contacts: contacts((page - 1) * 500 + 1, 500), totalPages: 5 };
  });
  assert.deepEqual(selected, contacts(1, 100).map(c => c.id));
  assert.deepEqual(pages, [1]);
});

test('handles server page limits and duplicate IDs without overselecting', async () => {
  const pages: number[] = [];
  const selected = await selectContactCount(25, contacts(1, 10), async page => {
    pages.push(page);
    return { contacts: contacts((page - 1) * 9 + 1, 10), totalPages: 4 };
  });
  assert.deepEqual(selected, contacts(1, 25).map(c => c.id));
  assert.deepEqual(pages, [1, 2, 3]);
});

test('includes the current visible page and fills from matching contacts on other pages', async () => {
  const selected = await selectContactCount(12, contacts(21, 10), async () => ({
    contacts: [{ id: '21' }, { id: '1' }, { id: '3' }, { id: '5' }], totalPages: 3,
  }));
  assert.deepEqual(selected, [...contacts(21, 10).map(c => c.id), '1', '3']);
});

test('fails instead of silently choosing an incorrect audience when too few contacts match', async () => {
  await assert.rejects(selectContactCount(15, contacts(1, 10), async () => ({
    contacts: contacts(1, 12), totalPages: 1,
  })), /Not enough matching contacts/);
  await assert.rejects(selectContactCount(15, contacts(1, 10), async () => {
    throw new Error('Request failed');
  }), /Request failed/);
});

test('cancels stale selections before returning IDs', async () => {
  const controller = new AbortController();
  await assert.rejects(selectContactCount(15, contacts(1, 10), async () => {
    controller.abort();
    return { contacts: contacts(1, 20), totalPages: 1 };
  }, controller.signal), { name: 'AbortError' });
});
