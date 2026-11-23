type ContactId = { id: string };

export async function selectContactCount<T extends ContactId>(
  count: number,
  visibleContacts: readonly T[],
  fetchPage: (page: number) => Promise<{ contacts: readonly T[]; totalPages: number }>,
  signal?: AbortSignal,
): Promise<string[]> {
  const ids = new Set<string>();
  const addContacts = (contacts: readonly T[]) => {
    for (const contact of contacts) {
      if (ids.size >= count) break;
      ids.add(contact.id);
    }
  };

  signal?.throwIfAborted();
  addContacts(visibleContacts);
  let totalPages = 1;
  for (let page = 1; ids.size < count && page <= totalPages; page++) {
    signal?.throwIfAborted();
    const result = await fetchPage(page);
    signal?.throwIfAborted();
    totalPages = result.totalPages;
    addContacts(result.contacts);
  }

  if (ids.size < count) {
    throw new Error('Not enough matching contacts. Refresh contacts and try again.');
  }
  return Array.from(ids);
}
