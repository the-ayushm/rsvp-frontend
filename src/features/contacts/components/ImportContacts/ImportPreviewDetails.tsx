import React from "react";
import { previewCellText, type ContactImportPreview, type PreviewContact } from "../../utils/import-preview";

function PreviewTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table aria-label={title} className="w-full text-left text-xs">
        <thead className="bg-muted text-muted-foreground">
          <tr>{headers.map((header, index) => <th key={`${header}-${index}`} scope="col" className="px-3 py-2 font-semibold whitespace-nowrap">{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((value, column) => <td key={column} className="px-3 py-2 text-foreground align-top whitespace-nowrap">{value}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const contactRows = (contacts: PreviewContact[]) => contacts.map((contact) => [
  contact.name || "—", contact.phoneNumber,
  contact.isValid === true ? "Valid" : contact.isValid === false ? "Invalid" : "—",
]);

export default function ImportPreviewDetails({ preview }: { preview: ContactImportPreview }) {
  const counts = [
    { label: "Importable Contacts", value: preview.importableCount },
    { label: "Invalid Contacts", value: preview.invalidCount },
    { label: "Duplicates", value: preview.duplicateCount },
    { label: "Unique Contacts", value: preview.uniqueCount },
  ];
  return (
    <div className="space-y-4 mb-6">
      <dl aria-label="Preview counts" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {counts.map(({ label, value }) => (
          <div key={label} className="rounded-xl p-3 bg-muted border border-border">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-xl font-bold tabular-nums text-foreground mt-1">{value === null ? "—" : value.toLocaleString()}</dd>
          </div>
        ))}
      </dl>

      {(preview.invalidCount > 0 || preview.duplicateCount > 0) && (
        <p className="text-xs text-muted-foreground">
          Review invalid numbers and duplicate entries below before importing.
        </p>
      )}

      {preview.rows.length > 0 && preview.headers.length > 0 && (
        <details open className="space-y-3">
          <summary className="text-sm font-semibold text-foreground cursor-pointer">File preview ({preview.rows.length} rows shown)</summary>
          <PreviewTable title="File preview" headers={preview.headers} rows={preview.rows.map((row) => preview.headers.map((header) => previewCellText(row[header])))} />
        </details>
      )}

      {preview.normalizedContacts.length > 0 && (
        <details className="space-y-3">
          <summary className="text-sm font-semibold text-foreground cursor-pointer">Normalized contacts ({preview.normalizedContacts.length} shown)</summary>
          <PreviewTable title="Normalized contacts" headers={["Name", "Phone number", "Status"]} rows={contactRows(preview.normalizedContacts)} />
        </details>
      )}

      {preview.duplicates.length > 0 && (
        <details className="space-y-3">
          <summary className="text-sm font-semibold text-foreground cursor-pointer">Duplicate examples ({preview.duplicates.length} shown)</summary>
          <PreviewTable title="Duplicate examples" headers={["Phone number", "Occurrences", "Duplicate rows"]} rows={preview.duplicates.map((duplicate) => [duplicate.phoneNumber, previewCellText(duplicate.occurrences), previewCellText(duplicate.duplicateRows)])} />
        </details>
      )}

      {preview.errors.length > 0 && (
        <details open className="space-y-3">
          <summary className="text-sm font-semibold text-error cursor-pointer">Invalid contact details ({preview.errors.length} shown)</summary>
          <PreviewTable title="Invalid contact details" headers={["File row", "Phone number", "Reason"]} rows={preview.errors.map((error) => [previewCellText(error.row), error.phoneNumber, error.message])} />
        </details>
      )}
    </div>
  );
}
