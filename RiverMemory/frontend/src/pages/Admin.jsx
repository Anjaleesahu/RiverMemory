import { useState } from "react";
import { api } from "../api";
import { Async, Card, ErrorBox, Field, Note, PageHeader } from "../components/ui";
import { useApi, useAuth } from "../hooks";

function Login() {
  const { login } = useAuth();
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await login(u, p); } catch (x) { setErr(x); } finally { setBusy(false); }
  };
  return (
    <div style={{ maxWidth: 420 }}>
      <PageHeader title="Admin login">Required only to import data and manage records. All analysis pages are public.</PageHeader>
      <Card><form onSubmit={submit}>
        {err && <ErrorBox error={err} />}
        <Field label="Username"><input autoComplete="username" required value={u} onChange={(e) => setU(e.target.value)} /></Field>
        <Field label="Password"><input type="password" autoComplete="current-password" required value={p} onChange={(e) => setP(e.target.value)} /></Field>
        <button className="btn" style={{ marginTop: 14 }} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form></Card>
    </div>
  );
}

function Importer({ onDone }) {
  const sources = useApi("/api/data-sources");
  const [kind, setKind] = useState("water_quality");
  const [file, setFile] = useState(null);
  const [sourceId, setSourceId] = useState("");
  const [location, setLocation] = useState("");
  const [rk, setRk] = useState("gridded");
  const [res, setRes] = useState("");
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const form = () => {
    const fd = new FormData();
    fd.append("kind", kind); fd.append("file", file);
    if (sourceId) fd.append("source_id", sourceId);
    if (kind === "rainfall") { if (location) fd.append("location", location); fd.append("rainfall_kind", rk); if (res) fd.append("resolution", res); }
    return fd;
  };
  const run = async (commit) => {
    setBusy(true); setErr(null);
    try { const r = await api.upload(`/api/import/${commit ? "commit" : "preview"}`, form()); setResult(r); if (commit) onDone(); }
    catch (x) { setErr(x); setResult(null); } finally { setBusy(false); }
  };
  return (
    <Card title="Import a CSV dataset" subtitle="Preview first; nothing is saved until you commit.">
      <div className="filters" style={{ border: 0, padding: 0 }}>
        <Field label="Dataset type"><select value={kind} onChange={(e) => { setKind(e.target.value); setResult(null); }}>
          <option value="water_quality">Water quality</option><option value="rainfall">Rainfall</option><option value="stations">Monitoring locations</option></select></Field>
        <Field label="Data source (provenance)"><select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          <option value="">None (register one below)</option>{(sources.data || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="CSV file"><input type="file" accept=".csv,text/csv" onChange={(e) => { setFile(e.target.files[0] || null); setResult(null); }} /></Field>
      </div>
      {kind === "rainfall" && (
        <div className="filters" style={{ border: 0, padding: "8px 0 0" }}>
          <Field label="Data type (if no 'kind' column)"><select value={rk} onChange={(e) => setRk(e.target.value)}><option value="gridded">Gridded estimate</option><option value="gauge">Rain gauge</option></select></Field>
          <Field label="Location (if no 'location' column)"><input value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
          <Field label="Grid resolution (optional)"><input value={res} onChange={(e) => setRes(e.target.value)} placeholder="e.g. 0.25° x 0.25°" /></Field>
        </div>)}
      <p className="small">Template: <a href={`/api/import/template/${kind}`}>download header for {kind.replace("_", " ")}</a>. Accepted date formats: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY.</p>
      <div className="btn-row">
        <button className="btn btn-ghost" disabled={!file || busy} onClick={() => run(false)}>{busy ? "Working…" : "Preview"}</button>
        <button className="btn" disabled={!file || busy || !result || result.committed || result.valid_rows === 0} onClick={() => run(true)}>Commit import</button>
      </div>
      {err && <div style={{ marginTop: 12 }}><ErrorBox error={err} /></div>}
      {result && (
        <div style={{ marginTop: 16 }}>
          <Note tone={result.committed ? "ok" : "info"}>
            {result.committed ? `Import saved (batch #${result.batch_id}). ` : "Preview only; nothing saved. "}
            {result.total_rows} rows read: <strong>{result.valid_rows}</strong> valid, {result.duplicate_rows} duplicate(s) skipped, {result.rejected_rows} rejected.
            {result.columns_ignored.length > 0 && ` Ignored columns: ${result.columns_ignored.join(", ")}.`}
          </Note>
          {Object.keys(result.missing_values_by_column).length > 0 && <p className="small">Missing values: {Object.entries(result.missing_values_by_column).map(([k, v]) => `${k} (${v})`).join(", ")}</p>}
          {result.preview.length > 0 && <div className="table-wrap"><table><thead><tr>{Object.keys(result.preview[0]).map((k) => <th key={k}>{k}</th>)}</tr></thead>
            <tbody>{result.preview.map((r, i) => <tr key={i}>{Object.values(r).map((v, j) => <td key={j}>{v ?? "–"}</td>)}</tr>)}</tbody></table></div>}
          {result.rejected.length > 0 && (<><h4>Rejected rows{result.rejected_truncated && " (first 300 shown)"}</h4>
            <div className="table-wrap"><table><thead><tr><th>CSV row</th><th>Reason</th></tr></thead><tbody>{result.rejected.map((r, i) => <tr key={i}><td>{r.row}</td><td style={{ whiteSpace: "normal" }}>{r.reason}</td></tr>)}</tbody></table></div></>)}
        </div>)}
    </Card>
  );
}

function SourceForm({ onSaved }) {
  const [v, setV] = useState({ name: "", organization: "", url: "", period_start: "", period_end: "", parameters: "", units: "", coverage: "", data_format: "CSV", processing: "", missing_info: "", limitations: "", provenance_verified: false });
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr(null);
    const body = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === "" ? null : x]));
    try { await api.post("/api/data-sources", body); onSaved(); setV({ ...v, name: "" }); } catch (x) { setErr(x); }
  };
  return (
    <Card title="Register a data source" subtitle="Record provenance before importing, so every record carries its source.">
      <form onSubmit={submit}>
        {err && <ErrorBox error={err} />}
        <div className="filters" style={{ border: 0, padding: 0 }}>
          <Field label="Dataset name *"><input required value={v.name} onChange={set("name")} /></Field>
          <Field label="Source organisation"><input value={v.organization} onChange={set("organization")} /></Field>
          <Field label="Original URL"><input type="url" value={v.url} onChange={set("url")} /></Field>
          <Field label="Period start"><input type="date" value={v.period_start} onChange={set("period_start")} /></Field>
          <Field label="Period end"><input type="date" value={v.period_end} onChange={set("period_end")} /></Field>
          <Field label="Format"><input value={v.data_format} onChange={set("data_format")} /></Field>
        </div>
        {[["parameters", "Parameters"], ["units", "Units"], ["coverage", "Geographic coverage"], ["processing", "Processing method"], ["missing_info", "Missing-data information"], ["limitations", "Limitations"]].map(([k, l]) => (
          <Field key={k} label={l}><input value={v[k]} onChange={set(k)} /></Field>))}
        <label className="small" style={{ display: "block", margin: "10px 0" }}><input type="checkbox" checked={v.provenance_verified} onChange={set("provenance_verified")} /> I have confirmed this dataset's provenance from the original publisher</label>
        <button className="btn">Save source</button>
      </form>
    </Card>
  );
}

function StationForm({ onSaved }) {
  const [v, setV] = useState({ name: "", river: "Ganga", latitude: "", longitude: "" });
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr(null);
    try { await api.post("/api/locations", { ...v, latitude: Number(v.latitude), longitude: Number(v.longitude) }); onSaved(); setV({ ...v, name: "" }); } catch (x) { setErr(x); }
  };
  return (
    <Card title="Add a monitoring location" subtitle="Use coordinates from the official dataset; do not estimate them.">
      <form onSubmit={submit} className="filters" style={{ border: 0, padding: 0 }}>
        {err && <ErrorBox error={err} />}
        <Field label="Name *"><input required value={v.name} onChange={set("name")} /></Field>
        <Field label="River"><select value={v.river} onChange={set("river")}><option>Ganga</option><option>Yamuna</option></select></Field>
        <Field label="Latitude *"><input required type="number" step="any" min="6" max="38" value={v.latitude} onChange={set("latitude")} /></Field>
        <Field label="Longitude *"><input required type="number" step="any" min="68" max="98" value={v.longitude} onChange={set("longitude")} /></Field>
        <button className="btn">Add location</button>
      </form>
    </Card>
  );
}

function Manage() {
  const sources = useApi("/api/data-sources");
  const batches = useApi("/api/import/batches");
  const locs = useApi("/api/locations");
  const [err, setErr] = useState(null);
  const refresh = () => { sources.reload(); batches.reload(); locs.reload(); };
  const delSrc = async (id) => { if (!window.confirm("Delete this data source?")) return; try { await api.del(`/api/data-sources/${id}`); refresh(); } catch (e) { setErr(e); } };
  const delLoc = async (id) => { if (!window.confirm("Delete this location?")) return; try { await api.del(`/api/locations/${id}`); refresh(); } catch (e) { setErr(e); } };
  return (
    <>
      <Importer onDone={refresh} />
      <div className="grid g2"><SourceForm onSaved={refresh} /><StationForm onSaved={refresh} /></div>
      {err && <ErrorBox error={err} />}
      <div className="grid g2">
        <Card title="Data sources"><Async q={sources} isEmpty={(d) => !d.length} emptyText="None registered">{(l) => l.map((s) => (
          <div key={s.id} className="small" style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}><span>{s.name}</span><button className="btn btn-small btn-danger" onClick={() => delSrc(s.id)}>Delete</button></div>))}</Async></Card>
        <Card title="Monitoring locations"><Async q={locs} isEmpty={(d) => !d.length} emptyText="None yet">{(l) => l.map((s) => (
          <div key={s.id} className="small" style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}><span>{s.name} ({s.river}, {s.record_count} records)</span><button className="btn btn-small btn-danger" onClick={() => delLoc(s.id)}>Delete</button></div>))}</Async></Card>
      </div>
      <Card title="Import history"><Async q={batches} isEmpty={(d) => !d.length} emptyText="No imports yet">{(l) => (
        <div className="table-wrap"><table><thead><tr><th>#</th><th>When</th><th>Type</th><th>File</th><th className="num">Rows</th><th className="num">Imported</th><th className="num">Duplicates</th><th className="num">Rejected</th><th>By</th></tr></thead>
          <tbody>{l.map((b) => <tr key={b.id}><td>{b.id}</td><td>{String(b.created_at).slice(0, 16)}</td><td>{b.kind}</td><td>{b.filename}</td><td className="num">{b.rows_total}</td><td className="num">{b.rows_imported}</td><td className="num">{b.rows_duplicate}</td><td className="num">{b.rows_rejected}</td><td>{b.imported_by}</td></tr>)}</tbody></table></div>)}</Async></Card>
    </>
  );
}

export default function Admin() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Login />;
  return (<><PageHeader title="Administration">Import datasets and manage sources and locations. Incidents are managed on the Incidents page.</PageHeader><Manage /></>);
}
