/* eslint-disable @typescript-eslint/no-explicit-any */
import { soft7AxiosInstance } from "@/lib/axiosInstance";

/**
 * Google Sheets OAuth integration (account owner only).
 * soft7AxiosInstance's baseURL already ends in /v1 and attaches the dashboard JWT.
 * OAuth start sets a browser-binding cookie, so every call sends credentials.
 */
const BASE = "/admin/google-sheets";
const enc = encodeURIComponent;
const opts = { withCredentials: true };

export interface GoogleSheetsSetup {
  ready: boolean;
  issue: string | null;
  scope?: string;
  max_rows?: number;
  max_columns?: number;
  picker: { ready: boolean; api_key: string | null; app_id: string | null };
}

export interface GoogleSheetsConnection {
  connected: boolean;
  connection: { id: string; created_at?: string; updated_at?: string } | null;
}

export interface GoogleSpreadsheet {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface GoogleSheetTab {
  sheetId: number;
  title: string;
  rowCount?: number;
  columnCount?: number;
}

export interface GoogleSheetPreview {
  sheet_id: number;
  title: string;
  headers: string[];
  sample_rows: string[][];
}

const FALLBACK: Record<number, string> = {
  401: "Your session has ended. Please sign in again.",
  403: "Only the account owner can manage the Google Sheets connection.",
  404: "That spreadsheet or tab is no longer available.",
  409: "Connect Google before selecting a spreadsheet.",
  413: "Use a tab with at most 100 columns.",
};

export function googleSheetsErrorMessage(err: unknown): string {
  const e = err as any;
  const status: number | undefined = e?.response?.status;
  const body = e?.response?.data;
  const server = (typeof body?.message === "string" && body.message) || (typeof body?.error === "string" && body.error) || null;
  if (!e?.response) return e instanceof Error && e.message ? e.message : "Network error — check your connection and try again.";
  return server ?? (status && FALLBACK[status]) ?? "Something went wrong. Please try again.";
}

const data = <T>(res: { data: any }): T => res.data?.data as T;

export const googleSheetsApi = {
  setup: async () => data<GoogleSheetsSetup>(await soft7AxiosInstance.get(`${BASE}/setup`, opts)),

  connection: async () => data<GoogleSheetsConnection>(await soft7AxiosInstance.get(`${BASE}/connection`, opts)),

  startOAuth: async () =>
    data<{ authorization_url: string }>(await soft7AxiosInstance.post(`${BASE}/oauth/start`, {}, opts)),

  disconnect: async () => data<{ connected: false }>(await soft7AxiosInstance.delete(`${BASE}/connection`, opts)),

  /** Short-lived token for Google Picker only. Keep it in memory; never persist it. */
  pickerToken: async () => data<{ access_token: string }>(await soft7AxiosInstance.get(`${BASE}/picker-token`, opts)),

  /** Spreadsheets already authorized for this app (drive.file) — empty until one is picked. */
  spreadsheets: async (pageToken?: string) => {
    const res = data<any>(await soft7AxiosInstance.get(`${BASE}/spreadsheets`, { ...opts, params: { page_token: pageToken } }));
    const files: any[] = res?.files ?? (Array.isArray(res) ? res : []);
    return {
      items: files.map((f) => ({ ...f, id: String(f.id), name: String(f.name ?? f.id) })) as GoogleSpreadsheet[],
      nextPageToken: (res?.nextPageToken as string | undefined) ?? null,
    };
  },

  tabs: async (spreadsheetId: string) => {
    const res = data<any>(await soft7AxiosInstance.get(`${BASE}/spreadsheets/${enc(spreadsheetId)}/tabs`, opts));
    const sheets: any[] = res?.sheets ?? [];
    return {
      title: String(res?.properties?.title ?? spreadsheetId),
      tabs: sheets.map((s) => ({
        sheetId: Number(s.properties?.sheetId),
        title: String(s.properties?.title ?? ""),
        rowCount: s.properties?.gridProperties?.rowCount,
        columnCount: s.properties?.gridProperties?.columnCount,
      })) as GoogleSheetTab[],
    };
  },

  preview: async (spreadsheetId: string, sheetId: number) =>
    data<GoogleSheetPreview>(
      await soft7AxiosInstance.get(`${BASE}/spreadsheets/${enc(spreadsheetId)}/tabs/${enc(String(sheetId))}/preview`, opts),
    ),
};
