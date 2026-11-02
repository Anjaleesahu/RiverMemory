import { useState } from "react";
import { api } from "../api";
import { Async, Card, ErrorBox, Field, Note, PageHeader } from "../components/ui";
import { useApi, useAuth } from "../hooks";

const EMPTY = { title: "", incident_date: "", river: "", location: "", latitude: "", longitude: "", incident_type: "", severity: "", description: "", evidence_source: "" };

function IncidentForm({ initial, onSaved, onCancel }) {
  const [v, setV] = useState({ ...EMPTY, ...Object.fromEntries(Object.entries(initial || {}).map(([k, x]) => [k, x ?? ""])) });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const body = { ...v, river: v.river || null, severity: v.severity || null, latitude: v.latitude === "" ? null : Number(v.latitude), longitude: v.longitude === "" ? null : Number(v.longitude), location: v.location || null, description: v.description || null, evidence_source: v.evidence_source || null };
    delete body.id; delete body.created_at; delete body.created_by;
    try { initial?.id ? await api.put(`/api/incidents/${initial.id}`, body) : await api.post("/api/incidents", body); onSaved(); }
    catch (x) { setErr(x); } finally { setBusy(false); }
  };
  return (
    <Card title={initial?.id ? "Edit incident" : "Add incident"}>
      <form onSubmit={submit}>
        {err && <ErrorBox error={err} />}
        <div className="filters" style={{ border: 0, padding: 0 }}>
          <Field label="Title *"><input required minLength={3} value={v.title} onChange={set("title")} /></Field>
          <Field label="Date *"><input required type="date" value={v.incident_date} onChange={set("incident_date")} /></Field>
          <Field label="Type *"><input required value={v.incident_type} onChange={set("incident_type")} placeholder="e.g. Fish mortality, discolouration" /></Field>
          <Field label="River"><select value={v.river} onChange={set("river")}><option value="">Not specified</option><option>Ganga</option><option>Yamuna</option><option>Confluence</option></select></Field>
          <Field label="Severity"><select value={v.severity} onChange={set("severity")}><option value="">Not assessed</option><option>low</option><option>moderate</option><option>high</option><option>critical</option></select></Field>
          <Field label="Location"><input value={v.location} onChange={set("location")} /></Field>
          <Field label="Latitude"><input type="number" step="any" min="-90" max="90" value={v.latitude} onChange={set("latitude")} /></Field>
          <Field label="Longitude"><input type="number" step="any" min="-180" max="180" value={v.longitude} onChange={set("longitude")} /></Field>
        </div>
        <Field label="Evidence / source (URL or citation)"><input value={v.evidence_source} onChange={set("evidence_source")} /></Field>
        <Field label="Description"><textarea rows={4} value={v.description} onChange={set("description")} /></Field>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </Card>
  );
}

export default function Incidents() {
  const { isAdmin } = useAuth();
  const [f, setF] = useState({ order: "desc" });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [delErr, setDelErr] = useState(null);
  const q = useApi("/api/incidents", { ...f, page, page_size: 10 });
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setPage(1); };
  const del = async (id) => {
    if (!window.confirm("Delete this incident permanently?")) return;
    try { await api.del(`/api/incidents/${id}`); q.reload(); } catch (e) { setDelErr(e); }
  };

  return (
    <>
      <PageHeader title="Environmental incidents">Recorded incidents with date, location and evidence. Anyone can view; only administrators can change records.</PageHeader>
      <div className="filters">
        <Field label="Search"><input value={f.q || ""} onChange={set("q")} placeholder="Title, description, location" /></Field>
        <Field label="River"><select value={f.river || ""} onChange={set("river")}><option value="">All</option><option>Ganga</option><option>Yamuna</option><option>Confluence</option></select></Field>
        <Field label="Type"><select value={f.incident_type || ""} onChange={set("incident_type")}><option value="">All</option>{(q.data?.types || []).map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Severity"><select value={f.severity || ""} onChange={set("severity")}><option value="">All</option><option>low</option><option>moderate</option><option>high</option><option>critical</option></select></Field>
        <Field label="From"><input type="date" value={f.from || ""} onChange={set("from")} /></Field>
        <Field label="To"><input type="date" value={f.to || ""} onChange={set("to")} /></Field>
        <Field label="Order"><select value={f.order} onChange={set("order")}><option value="desc">Newest first</option><option value="asc">Oldest first</option></select></Field>
        {isAdmin && <button className="btn" onClick={() => setEditing({})}>+ Add incident</button>}
      </div>
      {editing && <IncidentForm initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); q.reload(); }} />}
      {delErr && <ErrorBox error={delErr} />}
      <Async q={q} isEmpty={(d) => !d.total} emptyText="No incidents recorded for these filters">
        {(d) => (<>
          {d.items.map((i) => (
            <details className="item" key={i.id}>
              <summary>
                {i.incident_date} · {i.title}{" "}
                {i.river && <span className={`tag tag-${i.river}`}>{i.river}</span>} <span className="tag">{i.incident_type}</span>{" "}
                {i.severity && <span className={`tag sev-${i.severity}`}>{i.severity}</span>}
              </summary>
              <div className="small" style={{ marginTop: 8 }}>
                {i.location && <p><strong>Location:</strong> {i.location}{i.latitude != null && ` (${i.latitude}, ${i.longitude})`}</p>}
                {i.description && <p>{i.description}</p>}
                <p><strong>Evidence / source:</strong> {i.evidence_source ? (/^https?:\/\//.test(i.evidence_source) ? <a href={i.evidence_source} target="_blank" rel="noreferrer">{i.evidence_source}</a> : i.evidence_source) : "None recorded"}</p>
                {isAdmin && <div className="btn-row"><button className="btn btn-small" onClick={() => setEditing(i)}>Edit</button><button className="btn btn-small btn-danger" onClick={() => del(i.id)}>Delete</button></div>}
              </div>
            </details>
          ))}
          <div className="pager">
            <button className="btn btn-ghost btn-small" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span className="small muted">Page {page} of {Math.max(1, Math.ceil(d.total / d.page_size))} · {d.total} incident(s)</span>
            <button className="btn btn-ghost btn-small" disabled={page * d.page_size >= d.total} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </>)}
      </Async>
      {!isAdmin && <Note>Incident records are added by administrators who can cite evidence. Log in on the Admin page to manage them.</Note>}
    </>
  );
}
