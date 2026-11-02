import { useApi } from "../hooks";

export const COLORS = { Ganga: "#0f9d8a", Yamuna: "#1d4ed8", Confluence: "#7c3aed", rain: "#38bdf8", accent: "#65a30d" };
export const SERIES_COLORS = ["#0f9d8a", "#1d4ed8", "#d97706", "#7c3aed", "#db2777", "#65a30d"];

export function Card({ title, subtitle, children, actions, className = "" }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p className="muted small">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }) {
  return (
    <div className="stat">
      <div className="stat-value">{value ?? "No data available"}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="muted small">{hint}</div>}
    </div>
  );
}

export function Empty({ children = "No data available" }) {
  return <div className="empty">{children}</div>;
}

export function Loading() {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" /> Loading…
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  return (
    <div className="error-box" role="alert">
      <strong>Something went wrong.</strong> {error?.message}
      {onRetry && (
        <button className="btn btn-small" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

/** Wraps an useApi result: loading / error / empty / content. */
export function Async({ q, isEmpty, emptyText, children }) {
  if (q.loading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} onRetry={q.reload} />;
  if (!q.data || (isEmpty && isEmpty(q.data))) return <Empty>{emptyText}</Empty>;
  return children(q.data);
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function PageHeader({ title, children }) {
  return (
    <div className="page-head">
      <h1>{title}</h1>
      {children && <p className="lead">{children}</p>}
    </div>
  );
}

export function Note({ children, tone = "info" }) {
  return <div className={`note note-${tone}`}>{children}</div>;
}

/** Shared filter bar: river, station, from, to (+ optional extras). */
export function Filters({ value, onChange, showStation = true, showRiver = true, children }) {
  const stations = useApi("/api/locations", showStation ? { river: value.river } : {}, showStation);
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value, ...(k === "river" ? { station_id: "" } : {}) });
  return (
    <div className="filters">
      {showRiver && (
        <Field label="River">
          <select value={value.river || ""} onChange={set("river")}>
            <option value="">All rivers</option>
            <option>Ganga</option>
            <option>Yamuna</option>
          </select>
        </Field>
      )}
      {showStation && (
        <Field label="Location">
          <select value={value.station_id || ""} onChange={set("station_id")}>
            <option value="">All locations</option>
            {(stations.data || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.river})
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="From">
        <input type="date" value={value.from || ""} onChange={set("from")} />
      </Field>
      <Field label="To">
        <input type="date" value={value.to || ""} onChange={set("to")} />
      </Field>
      {children}
      <button className="btn btn-ghost" onClick={() => onChange({})}>
        Reset
      </button>
    </div>
  );
}

export function ParamSelect({ value, onChange }) {
  const q = useApi("/api/water-quality/parameters");
  return (
    <Field label="Parameter">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {(q.data || []).map((p) => (
          <option key={p.key} value={p.key}>
            {p.label} ({p.unit})
          </option>
        ))}
      </select>
    </Field>
  );
}

export function AggSelect({ value, onChange, options = ["raw", "monthly", "yearly"] }) {
  return (
    <Field label="Aggregation">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o[0].toUpperCase() + o.slice(1)}
          </option>
        ))}
      </select>
    </Field>
  );
}

export const fmt = (v, d = 2) => (v === null || v === undefined ? "–" : Number(v).toLocaleString(undefined, { maximumFractionDigits: d }));
