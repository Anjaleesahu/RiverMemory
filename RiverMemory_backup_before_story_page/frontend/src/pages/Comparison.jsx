import { useState } from "react";
import { AggSelect, Async, Card, Field, Note, PageHeader, ParamSelect, fmt } from "../components/ui";
import { SeriesChart } from "../components/Charts";
import { useApi } from "../hooks";

export default function Comparison() {
  const [param, setParam] = useState("do_mg_l");
  const [agg, setAgg] = useState("monthly");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const q = useApi("/api/comparison", { parameter: param, agg, from, to });
  const locs = useApi("/api/locations");

  return (
    <>
      <PageHeader title="Ganga vs Yamuna">Compare a parameter between the two rivers over time.</PageHeader>
      <div className="filters">
        <ParamSelect value={param} onChange={setParam} />
        <AggSelect value={agg} onChange={setAgg} options={["monthly", "yearly", "raw"]} />
        <Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      <Async q={q} isEmpty={(d) => !d.points.length} emptyText="No data available for this parameter and period">
        {(d) => (
          <>
            <div className="grid g2">
              {["Ganga", "Yamuna"].map((r) => (
                <Card key={r} title={<span className={`tag tag-${r}`} style={{ fontSize: "1rem" }}>{r}</span>} subtitle={`${d.label} (${d.unit})`}>
                  <SeriesChart points={d.points} groups={[r]} unit={d.unit} height={240} />
                </Card>
              ))}
            </div>
            <Card title="Both rivers together" subtitle={`${d.overlapping_periods} ${agg} period(s) have observations for both rivers`}>
              <SeriesChart points={d.points} groups={["Ganga", "Yamuna"]} unit={d.unit} height={340} />
            </Card>
            <Card title="Statistical summary">
              <div className="table-wrap"><table>
                <thead><tr><th>River</th><th className="num">n</th><th className="num">Min</th><th className="num">Max</th><th className="num">Mean</th><th className="num">Median</th><th className="num">Std dev</th><th>First</th><th>Last</th><th>Trend</th></tr></thead>
                <tbody>{Object.entries(d.rivers).map(([r, v]) => (
                  <tr key={r}><td><span className={`tag tag-${r}`}>{r}</span></td><td className="num">{v.stats.n}</td><td className="num">{fmt(v.stats.min)}</td><td className="num">{fmt(v.stats.max)}</td><td className="num">{fmt(v.stats.mean)}</td><td className="num">{fmt(v.stats.median)}</td><td className="num">{fmt(v.stats.std)}</td><td>{v.first || "–"}</td><td>{v.last || "–"}</td>
                    <td>{v.trend ? `${fmt(v.trend.slope_per_year)} ${d.unit}/yr` : <span className="muted">insufficient data</span>}</td></tr>))}</tbody>
              </table></div>
            </Card>
            <div className="grid g2">
              <Card title="Locations contributing to each river">
                {Object.entries(d.rivers).map(([r, v]) => (
                  <p key={r} className="small"><span className={`tag tag-${r}`}>{r}</span> {v.stations.length ? v.stations.join(", ") : "No locations with data"}</p>))}
                {locs.data && <p className="muted small">{locs.data.length} registered monitoring location(s) in total.</p>}
              </Card>
              <Card title="Comparability notes">
                <ul className="small">{d.notes.map((n) => <li key={n}>{n}</li>)}</ul>
              </Card>
            </div>
          </>
        )}
      </Async>
      {q.data && !q.data.points.length && <Note>Import water-quality records for both rivers to enable comparison.</Note>}
    </>
  );
}
