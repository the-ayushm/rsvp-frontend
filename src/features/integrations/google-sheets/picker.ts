/* eslint-disable @typescript-eslint/no-explicit-any */
import { googleSheetsApi, type GoogleSheetsSetup } from "./api";

let pickerReady: Promise<void> | null = null;

function loadPickerApi(): Promise<void> {
  if (pickerReady) return pickerReady;
  pickerReady = new Promise<void>((resolve, reject) => {
    const w = window as any;
    const onGapi = () => w.gapi.load("picker", { callback: () => resolve(), onerror: () => reject(new Error("Google Picker failed to load.")) });
    if (w.gapi?.load) return onGapi();
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onload = onGapi;
    script.onerror = () => reject(new Error("Couldn't load Google Picker."));
    document.head.appendChild(script);
  }).catch((err) => {
    pickerReady = null;
    throw err;
  });
  return pickerReady;
}

/**
 * Opens Google Picker restricted to spreadsheets. With the drive.file scope,
 * picking a file here is what grants the app access to it.
 * Resolves null when the user cancels.
 */
export async function pickSpreadsheet(setup: GoogleSheetsSetup | null): Promise<{ id: string; name: string } | null> {
  const picker = setup?.picker;
  if (!picker?.ready || !picker.api_key || !picker.app_id) {
    throw new Error("Google Picker isn't configured on the server yet (missing API key or project number).");
  }
  // Fetched per use and kept only in this closure.
  const { access_token } = await googleSheetsApi.pickerToken();
  if (!access_token) throw new Error("Google Sheets isn't connected. Connect it first.");
  await loadPickerApi();
  const g = (window as any).google;
  return new Promise((resolve) => {
    const view = new g.picker.DocsView(g.picker.ViewId.SPREADSHEETS)
      .setMimeTypes("application/vnd.google-apps.spreadsheet")
      .setMode(g.picker.DocsViewMode.LIST);
    new g.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(access_token)
      .setDeveloperKey(picker.api_key)
      .setAppId(String(picker.app_id))
      .setOrigin(window.location.origin)
      .setTitle("Choose a spreadsheet")
      .setCallback((res: any) => {
        if (res.action === g.picker.Action.PICKED) {
          const doc = res.docs?.[0];
          resolve(doc?.id ? { id: String(doc.id), name: String(doc.name ?? doc.id) } : null);
        } else if (res.action === g.picker.Action.CANCEL) resolve(null);
      })
      .build()
      .setVisible(true);
  });
}
