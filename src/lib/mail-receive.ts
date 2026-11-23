/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/mail-receive.ts
import imaps, { ImapSimple, ImapSimpleOptions } from 'imap-simple';

if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
  throw new Error("SMTP_USER and SMTP_PASS must be defined in .env");
}
if (!process.env.IMAP_HOST || !process.env.IMAP_PORT) {
  throw new Error("IMAP_HOST and IMAP_PORT must be defined in .env");
}

// ✅ TypeScript-safe config
const config: ImapSimpleOptions = {
  imap: {
    user: process.env.SMTP_USER as string,          // assert string
    password: process.env.SMTP_PASS as string,      // assert string
    host: process.env.IMAP_HOST as string,
    port: Number(process.env.IMAP_PORT),
    tls: true,
    authTimeout: 3000,
  }
};

export async function getInboxEmails() {
  // Connect to IMAP server
  const connection: ImapSimple = await imaps.connect(config);

  // Open INBOX folder
  await connection.openBox('INBOX');

  // Search for unseen emails
  const searchCriteria = ['UNSEEN'];
  const fetchOptions = { bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)'], markSeen: true };

  const messages = await connection.search(searchCriteria, fetchOptions);

  // Map emails
  const emails = messages.map((item: any) => {
    const all = item.parts.find((p: any) => p.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)');
    return {
      from: all?.body.from[0],
      to: all?.body.to[0],
      subject: all?.body.subject[0],
      date: all?.body.date[0],
    };
  });

  // Close connection
  connection.end();

  return emails;
}
