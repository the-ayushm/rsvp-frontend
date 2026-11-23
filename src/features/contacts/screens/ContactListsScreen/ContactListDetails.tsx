import { formatListCount, getContactListStats, type ContactList, type ContactValidationIssue } from '../../utils/contact-list-stats';

function ValidationReasons({ title, rows, showContactNames = false }: {
  title: string;
  rows: ContactValidationIssue[];
  showContactNames?: boolean;
}) {
  return (
    <details open>
      <summary className="font-semibold cursor-pointer text-primary-text">{title} ({rows.length} shown)</summary>
      <div className="overflow-x-auto mt-2 rounded-lg border border-border">
        <table className="w-full text-left" aria-label={title}>
          <thead className="bg-surface-muted">
            <tr>
              <th className="p-2 whitespace-nowrap">{showContactNames ? 'Name' : 'File row'}</th>
              <th className="p-2 whitespace-nowrap">Phone number</th>
              <th className="p-2">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, index) => (
              <tr key={index}>
                <td className="p-2">{showContactNames ? row.name || '—' : row.row ?? '—'}</td>
                <td className="p-2 font-mono whitespace-nowrap">{row.phone_number ?? '—'}</td>
                <td className="p-2 min-w-40 break-words">{row.reason || row.error || row.message || 'No reason provided by the API.'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function CountCards({ items }: { items: { label: string; value: number | null; tone?: string }[] }) {
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map(({ label, value, tone }) => (
        <div key={label} className="bg-surface-muted border border-border rounded-lg p-3">
          <dt className="text-[11px] text-muted-foreground font-medium">{label}</dt>
          <dd className={`text-xl font-bold tabular-nums whitespace-nowrap mt-1 ${tone || 'text-foreground'}`}>
            {formatListCount(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function ContactListDetails({ list, formatDate }: {
  list: ContactList;
  formatDate: (date?: string | null) => string;
}) {
  const stats = getContactListStats(list);
  return (
    <div className="space-y-5 text-xs">
      <div>
        <h4 className="text-sm font-semibold text-foreground break-words">{list.name}</h4>
        {list.description && <p className="text-muted-foreground mt-1 break-words">{list.description}</p>}
      </div>
      <section className="space-y-2" aria-label="Contact validation">
        <h4 className="text-[11px] font-bold text-primary-text uppercase tracking-wider">Contact validation</h4>
        <CountCards items={[
          { label: 'Total contacts', value: stats.total },
          { label: 'Valid', value: stats.valid, tone: 'text-primary-text' },
          { label: 'Invalid', value: stats.invalid, tone: 'text-destructive' },
          { label: 'Missing country code', value: stats.needsCountry },
          { label: 'Importable', value: stats.importable },
          { label: 'Duplicates', value: stats.duplicates },
          { label: 'Unique', value: stats.unique },
        ]} />
      </section>
      {!!list.needs_country_preview?.length ? (
        <ValidationReasons title="Missing country code contacts" rows={list.needs_country_preview} showContactNames />
      ) : stats.needsCountry !== null && stats.needsCountry > 0 && (
        <p className="text-muted-foreground">The API did not include contact details or reasons for the contacts with a missing country code.</p>
      )}
      {!!list.errors?.length ? (
        <ValidationReasons title="Invalid contact reasons" rows={list.errors} />
      ) : stats.invalid !== null && stats.invalid > 0 && (
        <p className="text-muted-foreground">The API reports {formatListCount(stats.invalid)} invalid contacts but did not include their reasons.</p>
      )}
      <section className="space-y-2" aria-label="Import results">
        <h4 className="text-[11px] font-bold text-primary-text uppercase tracking-wider">Import results</h4>
        <CountCards items={[
          { label: 'Imported', value: stats.imported, tone: 'text-primary-text' },
          { label: 'Import failed', value: stats.failed, tone: 'text-destructive' },
          { label: 'Invalid phone numbers', value: stats.invalidPhones },
          { label: 'Created', value: stats.created },
          { label: 'Updated', value: stats.updated },
        ]} />
      </section>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          ['Selected phone column', list.selected_phone_column || '—'],
          ['Detected phone column', list.detected_phone_column || '—'],
          ['Created at', formatDate(list.created_at)],
          ['Updated at', formatDate(list.updated_at)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground mb-1">{label}</dt>
            <dd className="font-medium text-foreground break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <div>
        <h4 className="text-[11px] font-bold text-primary-text uppercase tracking-wider mb-2">File name</h4>
        <p className="font-mono break-all bg-surface-muted p-2 rounded border border-border">{list.file_name || '—'}</p>
      </div>
      {!!list.file_headers?.length && (
        <details>
          <summary className="font-semibold cursor-pointer text-primary-text">File headers ({list.file_headers.length})</summary>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {list.file_headers.map((header, index) => (
              <span key={index} className="px-2 py-1 bg-surface-hover border border-border rounded text-[11px] break-all">{header}</span>
            ))}
          </div>
        </details>
      )}
      {!!list.duplicate_preview?.length && (
        <details open>
          <summary className="font-semibold cursor-pointer text-primary-text">Duplicate examples ({list.duplicate_preview.length} shown)</summary>
          <div className="overflow-x-auto mt-2 rounded-lg border border-border">
            <table className="w-full text-left whitespace-nowrap" aria-label="Duplicate examples">
              <thead className="bg-surface-muted"><tr><th className="p-2">Phone number</th><th className="p-2">Occurrences</th><th className="p-2">Duplicate rows</th></tr></thead>
              <tbody className="divide-y divide-border">
                {list.duplicate_preview.map((row, index) => (
                  <tr key={index}><td className="p-2 font-mono">{row.phone_number}</td><td className="p-2 tabular-nums">{formatListCount(row.occurrences)}</td><td className="p-2 tabular-nums">{formatListCount(row.duplicate_rows)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
