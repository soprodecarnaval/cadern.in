import { useEffect, useState } from "react";
import type { ScorePart } from "../../scripts/lib/scoreMeta";

// Temporary milestone-002 scaffold to exercise the IPC surface.
// Replaced by the real file picker / parts table in 003.
export function App() {
  const [mscorePath, setMscorePath] = useState<string | null>(null);
  const [msczPath, setMsczPath] = useState("");
  const [parts, setParts] = useState<ScorePart[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void window.api.getMscorePath().then(setMscorePath);
  }, []);

  const locate = async () => {
    setError("");
    const res = await window.api.locateMscore();
    if (res && res.ok && res.path) {
      setMscorePath(res.path);
    } else if (res && !res.ok) {
      setError(res.error ?? "Invalid binary");
    }
  };

  const pickMscz = async () => {
    setError("");
    const picked = await window.api.pickMscz();
    if (picked) {
      setMsczPath(picked);
    }
  };

  const listParts = async () => {
    setError("");
    setParts([]);
    try {
      const result = await window.api.listParts(msczPath);
      console.log("[listParts]", result);
      setParts(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <h1>cadern.in — Exportador</h1>

      <section style={{ marginBottom: 16 }}>
        <strong>MuseScore 4:</strong>{" "}
        {mscorePath ? (
          <code>{mscorePath}</code>
        ) : (
          <span style={{ color: "#c33" }}>not found</span>
        )}{" "}
        <button onClick={() => void locate()}>Locate…</button>
      </section>

      <section style={{ marginBottom: 16 }}>
        <button onClick={() => void pickMscz()}>Choose .mscz…</button>{" "}
        <input
          style={{ width: 420 }}
          placeholder="/path/to/score.mscz"
          value={msczPath}
          onChange={(e) => setMsczPath(e.target.value)}
        />{" "}
        <button onClick={() => void listParts()} disabled={!msczPath}>
          List parts
        </button>
      </section>

      {error && <p style={{ color: "#c33" }}>{error}</p>}

      {parts.length > 0 && (
        <table cellPadding={6} style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">id</th>
              <th align="left">name</th>
              <th align="left">instrumentId</th>
              <th align="left">cadern.in</th>
            </tr>
          </thead>
          <tbody>
            {parts.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.name}</td>
                <td>
                  <code>{p.instrumentId}</code>
                </td>
                <td style={{ color: p.instrument ? "#2a2" : "#c33" }}>
                  {p.instrument ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
