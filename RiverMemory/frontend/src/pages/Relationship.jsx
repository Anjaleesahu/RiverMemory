import { useState } from "react";
import { Async, Card, Filters, Note, PageHeader, ParamSelect, fmt } from "../components/ui";
import { ScatterPlot } from "../components/Charts";
import { useApi } from "../hooks";

function heatColor(rho) {
  if (rho === null || rho === undefined) return "var(--grid)";
  const a = Math.min(1, Math.abs(rho));
  return rho >= 0 ? `rgba(29,78,216,${0.15 + a * 0.75})` : `rgba(217,119,6,${0.15 + a * 0.75})`;
}

export default function Relationship() {
  const [f, setF] = useState({});
  const [param, setParam] = useState("do_mg_l");
  const p = { river: f.river, station_id: f.station_id, from: f.from, to: f.to };
  const corr = useApi("/api/analysis/correlation", p);
  const sc = useApi("/api/analysis/scatter", { ...p, parameter: param });

  return (
    <>
      <PageHeader title="Rainfall and water quality">
        Do months with more rainfall differ in water quality? This page shows associations only; it cannot show cause.
      </PageHeader>
      <Filters value={f} onChange={setF}><ParamSelect value={param} onChange={setParam} /></Filters>
      <Async q={corr}>
        {(c) => (
          <>
            <Note tone="warn">{c.note}</Note>
            <div className="grid g2">
              <Card title="Scatter plot" subtitle={sc.data ? `${sc.data.label} vs monthly rainfall` : undefined}>
                <Async q={sc} isEmpty={(s) => !s.points.length} emptyText="No overlapping complete months of rainfall and water quality">
                  {(s) => (<>
                    <ScatterPlot points={s.points} xLabel="Monthly rainfall (mm)" yLabel={s.unit} />
                    {s.stats.status === "ok"
                      ? <p className="small">n = {s.stats.n} months. Pearson r = {fmt(s.stats.pearson_r, 3)} (p = {fmt(s.stats.pearson_p, 3)}); Spearman ρ = {fmt(s.stats.spearman_rho, 3)} (p = {fmt(s.stats.spearman_p, 3)}).</p>
                      : <Note tone="warn">{s.stats.reason}</Note>}
                  </>)}
                </Async>
              </Card>
              <Card title="Correlation with rainfall" subtitle={`${c.months_paired} paired month(s)`}>
                {c.pairs.length === 0 ? <div className="empty">No data available</div> : (
                  <div className="table-wrap"><table>
                    <thead><tr><th>Parameter</th><th className="num">n</th><th className="num">Pearson r</th><th className="num">Spearman ρ</th><th>Status</th></tr></thead>
                    <tbody>{c.pairs.map((r) => (
                      <tr key={r.parameter}><td>{r.label}</td><td className="num">{r.n}</td>
                        <td className="num">{fmt(r.pearson_r, 3)}</td><td className="num">{fmt(r.spearman_rho, 3)}</td>
                        <td className="small">{r.status === "ok" ? `p = ${fmt(r.spearman_p, 3)}` : <span className="muted">{r.reason}</span>}</td></tr>))}</tbody>
                  </table></div>)}
              </Card>
            </div>
            <Card title="Correlation matrix (Spearman ρ)" subtitle="Blue = positive, orange = negative. Blank cells have fewer than 10 paired months.">
              {c.matrix_keys.length < 2 ? <div className="empty">No data available</div> : (
                <div className="heat" style={{ gridTemplateColumns: `140px repeat(${c.matrix_keys.length}, 1fr)` }}>
                  <div className="lab" />
                  {c.matrix_keys.map((k) => <div key={k} className="lab" style={{ textAlign: "center" }}>{c.labels[k].split(" (")[0]}</div>)}
                  {c.matrix_keys.map((a) => (<>
                    <div key={a + "l"} className="lab">{c.labels[a].split(" (")[0]}</div>
                    {c.matrix_keys.map((b) => {
                      const cell = c.matrix.find((m) => m.x === a && m.y === b);
                      return <div key={a + b} title={`n = ${cell?.n}`} style={{ background: heatColor(cell?.rho) }}>{cell?.rho === null || cell?.rho === undefined ? "" : fmt(cell.rho, 2)}</div>;
                    })}
                  </>))}
                </div>)}
            </Card>
            <p className="muted small">Method: {c.method}.</p>
          </>
        )}
      </Async>
    </>
  );
}
