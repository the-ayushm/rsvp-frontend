// lib/mail.ts
import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  return transporter.sendMail({
    from: `"DoveKnot Technologies" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  });
}
