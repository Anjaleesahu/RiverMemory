import { useState } from "react";
import { download, reportUrl } from "../api";
import { Card, ErrorBox, Field, Note, PageHeader } from "../components/ui";

export default function Reports() {
  const [dataset, setDataset] = useState("water-quality");
  const [river, setRiver] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState(null);
  const go = async (format) => {
    setBusy(format); setErr(null);
    try { await download(reportUrl(dataset, format, { river, from, to }), `rivermemory_${dataset}.${format}`); }
    catch (e) { setErr(e); } finally { setBusy(""); }
  };
  return (
    <>
      <PageHeader title="Reports and exports">Download the stored records for the filters you choose. Files contain exactly what the database returns.</PageHeader>
      <Card title="Choose data">
        <div className="filters" style={{ border: 0, padding: 0 }}>
          <Field label="Dataset"><select value={dataset} onChange={(e) => setDataset(e.target.value)}>
            <option value="water-quality">Water quality</option><option value="rainfall">Rainfall summary and records</option><option value="incidents">Incidents</option></select></Field>
          {dataset !== "rainfall" && <Field label="River"><select value={river} onChange={(e) => setRiver(e.target.value)}><option value="">All rivers</option><option>Ganga</option><option>Yamuna</option>{dataset === "incidents" && <option>Confluence</option>}</select></Field>}
          <Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
        <div className="btn-row" style={{ marginTop: 14 }}>
          {[["csv", "CSV"], ["xlsx", "Excel (.xlsx)"], ["pdf", "PDF report"]].map(([f, l]) => (
            <button key={f} className="btn" disabled={!!busy} onClick={() => go(f)}>{busy === f ? "Preparing…" : `Download ${l}`}</button>))}
        </div>
        {err && <div style={{ marginTop: 12 }}><ErrorBox error={err} /></div>}
      </Card>
      <Note>PDF reports contain summary statistics and up to 150 records; use CSV or Excel for the full filtered data. Reports without data say "No data available".</Note>
    </>
  );
}
