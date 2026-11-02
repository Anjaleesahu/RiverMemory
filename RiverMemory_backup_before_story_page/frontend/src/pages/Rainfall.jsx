import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Async, Card, Field, Filters, Note, PageHeader, Stat, fmt } from "../components/ui";
import { RainBars, RainLine } from "../components/Charts";
import { useApi } from "../hooks";

export default function Rainfall() {
  const [f, setF] = useState({});
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);
  const p = { from: f.from, to: f.to, kind };
  const meta = useApi("/api/rainfall/meta");
  const sum = useApi("/api/rainfall/summary", p);
  const daily = useApi("/api/rainfall/aggregate", { ...p, period: "daily" });
  const monthly = useApi("/api/rainfall/aggregate", { ...p, period: "monthly" });
  const yearly = useApi("/api/rainfall/aggregate", { ...p, period: "yearly" });
  const dist = useApi("/api/rainfall/distribution", p);
  const recs = useApi("/api/rainfall", { ...p, page, page_size: 15 });

  return (
    <>
      <PageHeader title="Rainfall analysis">Rainfall for the Prayagraj / Triveni Sangam study region.</PageHeader>
      <Filters value={f} onChange={(v) => { setF(v); setPage(1); }} showRiver={false} showStation={false}>
        <Field label="Data type">
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">All</option><option value="gridded">Gridded estimate</option><option value="gauge">Rain gauge</option>
          </select>
        </Field>
      </Filters>
      <Note>{meta.data?.method_note || "Gridded estimates are not direct rain-gauge observations."}</Note>

      <Async q={sum} isEmpty={(s) => !s.records} emptyText="No rainfall data available for this selection">
        {(s) => (
          <>
            <div className="grid g4" style={{ marginBottom: 16 }}>
              <Stat label="Days with data" value={fmt(s.days_with_data, 0)} hint={`${s.range.from} to ${s.range.to}`} />
              <Stat label="Total rainfall" value={`${fmt(s.total_mm, 0)} mm`} />
              <Stat label="Wettest day" value={`${fmt(s.wettest_day.rainfall_mm)} mm`} hint={s.wettest_day.date} />
              <Stat label="Missing days in range" value={fmt(s.missing_days_in_range, 0)} hint={s.resolutions.length ? `Resolution: ${s.resolutions.join(", ")}` : undefined} />
            </div>
            <div className="grid g2">
              <Card title="Monthly totals" subtitle="Months with missing days are lower bounds (see table)">
                <Async q={monthly}>{(m) => <RainBars points={m.points.map((x) => ({ ...x, period: x.period }))} />}</Async>
              </Card>
              <Card title="Daily rainfall"><Async q={daily}>{(d) => <RainLine points={d.points} />}</Async></Card>
              <Card title="Monthly comparison" subtitle="Mean total per calendar month, complete months only">
                {s.monthly_climatology.length === 0 ? <div className="empty">No complete months available</div> : (
                  <ResponsiveContainer width="100%" height={280}><BarChart data={s.monthly_climatology}>
                    <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" /><XAxis dataKey="month_name" stroke="var(--muted)" fontSize={12} /><YAxis stroke="var(--muted)" fontSize={12} width={56} />
                    <Tooltip formatter={(v, n, i) => [`${fmt(v)} mm (${i.payload.years} yr)`, "Mean monthly total"]} />
                    <Bar dataKey="mean_total_mm" fill="#0f9d8a" /></BarChart></ResponsiveContainer>)}
              </Card>
              <Card title="Distribution of daily rainfall" subtitle="Number of days in each intensity class">
                <Async q={dist} isEmpty={(d) => !d.bins.length}>{(d) => (
                  <ResponsiveContainer width="100%" height={280}><BarChart data={d.bins}>
                    <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" /><XAxis dataKey="bin" stroke="var(--muted)" fontSize={11} /><YAxis stroke="var(--muted)" fontSize={12} width={56} />
                    <Tooltip /><Bar dataKey="days" fill="#1d4ed8" name="Days" /></BarChart></ResponsiveContainer>)}</Async>
              </Card>
            </div>
            <Card title="Yearly summary">
              <Async q={yearly} isEmpty={(y) => !y.points.length}>{(y) => (
                <div className="table-wrap"><table>
                  <thead><tr><th>Year</th><th className="num">Total (mm)</th><th className="num">Days with data</th><th className="num">Rainy days ≥2.5 mm</th><th className="num">Max daily (mm)</th><th>Complete</th></tr></thead>
                  <tbody>{y.points.map((r) => <tr key={r.period}><td>{r.period}</td><td className="num">{fmt(r.rainfall_mm, 1)}</td><td className="num">{r.days_with_data}/{r.days_expected}</td><td className="num">{r.rainy_days_ge_2_5mm}</td><td className="num">{fmt(r.max_daily_mm)}</td><td>{r.complete ? "Yes" : <span className="tag">partial</span>}</td></tr>)}</tbody>
                </table></div>)}</Async>
            </Card>
            <Card title="Daily records">
              <Async q={recs} isEmpty={(r) => !r.total}>{(r) => (<>
                <div className="table-wrap"><table>
                  <thead><tr><th>Date</th><th>Location</th><th className="num">Rainfall (mm)</th><th>Type</th><th>Resolution</th></tr></thead>
                  <tbody>{r.items.map((x) => <tr key={x.id}><td>{x.date}</td><td>{x.location}</td><td className="num">{fmt(x.rainfall_mm)}</td><td>{x.kind}</td><td>{x.resolution || "–"}</td></tr>)}</tbody>
                </table></div>
                <div className="pager">
                  <button className="btn btn-ghost btn-small" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
                  <span className="small muted">Page {page} of {Math.max(1, Math.ceil(r.total / r.page_size))} · {fmt(r.total, 0)} records</span>
                  <button className="btn btn-ghost btn-small" disabled={page * r.page_size >= r.total} onClick={() => setPage(page + 1)}>Next</button>
                </div></>)}</Async>
            </Card>
          </>
        )}
      </Async>
    </>
  );
}
