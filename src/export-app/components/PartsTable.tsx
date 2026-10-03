import type { ScorePart } from "../../../scripts/lib/scoreMeta";

interface Props {
  parts: ScorePart[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}

export function PartsTable({ parts, selected, onToggle }: Props) {
  return (
    <table className="parts">
      <thead>
        <tr>
          <th style={{ width: 32 }} />
          <th>Parte</th>
          <th>MuseScore ID</th>
          <th>cadern.in ID</th>
        </tr>
      </thead>
      <tbody>
        {parts.map((p) => {
          const compatible = p.instrument !== undefined;
          return (
            <tr key={p.id} className={compatible ? "" : "incompatible"}>
              <td>
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  disabled={!compatible}
                  onChange={() => onToggle(p.id)}
                />
              </td>
              <td>{p.name}</td>
              <td>
                <code>{p.instrumentId}</code>
              </td>
              <td>
                <span className={compatible ? "badge" : "badge no"}>
                  {p.instrument ? <code>{p.instrument}</code> : "incompatível"}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
