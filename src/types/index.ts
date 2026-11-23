/* eslint-disable @typescript-eslint/no-explicit-any */
// src/types/index.ts

/* -----------------------------
   AUTH
----------------------------- */
export type User = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type AuthResponse = {
  user: User;
  token: string;
};

/* -----------------------------
   BILLING
----------------------------- */
export type CreditTransaction = {
  id: string;
  amount: number;
  type: 'credit' | 'debit';
  createdAt: string;
};

export type CreditBalance = {
  balance: number;
};

/* -----------------------------
   WABA / WHATSAPP
----------------------------- */
export type WABAAccount = {
  id: string;
  name: string;
};

export type PhoneNumber = {
  id: string;
  number: string;
};

/* -----------------------------
   TEMPLATE
----------------------------- */
export type Template = {
  id: string;
  name: string;
  status?: string;
};

/* -----------------------------
   WEBHOOK
----------------------------- */
export type Webhook = {
  id: string;
  url: string;
};

/* -----------------------------
   CONTACTS
----------------------------- */
export type Contact = {
  id: string;
  name: string;
  phone: string;
};

export type ContactTag = {
  id: string;
  name: string;
};

export type ContactList = {
  id: string;
  name: string;
};

/* -----------------------------
   CAMPAIGNS
----------------------------- */
export type Campaign = {
  id: string;
  name: string;
};

/* -----------------------------
   GENERIC API TYPES
----------------------------- */
export type APIResponse<T = any> = {
  success: boolean;
  data: T;
  message?: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
};