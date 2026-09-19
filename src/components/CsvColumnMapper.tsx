import {
  COLUMN_ROLE_LABELS,
  type ColumnRole,
  type ParsedCsv,
  validateImportMapping,
  mappingFromAssignments,
} from "../lib/fetyCsvImport";

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  fontSize: 11,
  fontFamily: "inherit",
  background: "var(--surface)",
};

const ROLES: ColumnRole[] = [
  "ignore",
  "date",
  "description",
  "amount",
  "inflow",
  "outflow",
  "debit",
  "credit",
  "category",
];

export function CsvColumnMapper({
  parsed,
  headerRowIndex,
  onHeaderRowIndexChange,
  columnAssignments,
  onColumnAssignmentsChange,
  maxPreviewRows = 4,
}: {
  parsed: ParsedCsv;
  headerRowIndex: number;
  onHeaderRowIndexChange: (n: number) => void;
  columnAssignments: ColumnRole[];
  onColumnAssignmentsChange: (next: ColumnRole[]) => void;
  maxPreviewRows?: number;
}) {
  const mapping = mappingFromAssignments(columnAssignments);
  const validationErrors = validateImportMapping(mapping);
  const preview = parsed.rows.slice(0, maxPreviewRows);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, color: "var(--ink-2)" }}>
          Header row{" "}
          <input
            type="number"
            min={1}
            value={headerRowIndex + 1}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (Number.isFinite(n) && n >= 1) onHeaderRowIndexChange(n - 1);
            }}
            style={{ width: 56, marginLeft: 6, padding: "4px 8px", borderRadius: 8, border: "1px solid var(--border)" }}
          />
        </label>
        <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
          Use row 2 or 3 if your sheet has a title above the columns.
        </span>
      </div>

      <p className="fety-label" style={{ marginBottom: -4 }}>
        Map each column
      </p>
      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 480 }}>
          <thead>
            <tr style={{ background: "var(--bg)" }}>
              {parsed.headers.map((h, colIdx) => (
                <th key={colIdx} style={{ padding: 8, textAlign: "left", verticalAlign: "top", minWidth: 120 }}>
                  <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: 6, wordBreak: "break-word" }}>{h || `Column ${colIdx + 1}`}</div>
                  <select
                    value={columnAssignments[colIdx] ?? "ignore"}
                    onChange={(e) => {
                      const next = [...columnAssignments];
                      next[colIdx] = e.target.value as ColumnRole;
                      onColumnAssignmentsChange(next);
                    }}
                    style={selectStyle}
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {COLUMN_ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((row, ri) => (
              <tr key={ri} style={{ borderTop: "1px solid var(--border)" }}>
                {parsed.headers.map((_, colIdx) => (
                  <td key={colIdx} style={{ padding: "6px 8px", color: "var(--ink-2)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {row[colIdx] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {validationErrors.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--trouble-dk)" }}>
          {validationErrors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: 12, color: "var(--clear-dk)", margin: 0 }}>Mapping looks good — continue to preview rows.</p>
      )}
    </div>
  );
}
