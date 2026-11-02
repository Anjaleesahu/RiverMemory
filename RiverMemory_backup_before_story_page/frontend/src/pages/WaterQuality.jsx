import { useState } from "react";
import { AggSelect, Async, Card, Filters, Note, PageHeader, ParamSelect, fmt } from "../components/ui";
import { SeriesChart } from "../components/Charts";
import { useApi } from "../hooks";

const clean = (f) => ({ river: f.river, station_id: f.station_id, from: f.from, to: f.to });

export default function WaterQuality() {
  const [f, setF] = useState({});
  const [param, setParam] = useState("do_mg_l");
  const [agg, setAgg] = useState("monthly");
  const [page, setPage] = useState(1);
  const p = clean(f);
  const series = useApi("/api/water-quality/series", { ...p, parameter: param, agg });
  const summary = useApi("/api/water-quality/summary", p);
  const outliers = useApi("/api/analysis/outliers", { ...p, parameter: param });
  const records = useApi("/api/water-quality", { ...p, page, page_size: 15 });
  const ranges = useApi("/api/water-quality/ranges", { river: f.river, station_id: f.station_id });
  const reset = (v) => { setF(v); setPage(1); };

  return (
    <>
      <PageHeader title="Water quality analysis">
        Ganga and Yamuna records by parameter, location and date. Screening limits are CPCB criteria for organised outdoor bathing.
      </PageHeader>
      <Filters value={f} onChange={reset}>
        <ParamSelect value={param} onChange={setParam} />
        <AggSelect value={agg} onChange={setAgg} />
      </Filters>

      <Card title="Historical trend" subtitle={series.data?.label ? `${series.data.label} (${series.data.unit}), ${agg}` : undefined}>
        <Async q={series} isEmpty={(s) => !s.points.length} emptyText="No data available for this selection">
          {(s) => <SeriesChart points={s.points} groups={s.groups} unit={s.unit} height={360} />}
        </Async>
      </Card>

      <Card title="Parameter summary" subtitle="Statistics over the selected records. Missing means no value recorded.">
        <Async q={summary} isEmpty={(s) => s.records === 0} emptyText="No data available for this selection">
          {(s) => (
            <>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Parameter</th><th>Unit</th><th className="num">n</th><th className="num">Missing</th><th className="num">Min</th><th className="num">Max</th><th className="num">Mean</th><th className="num">Median</th><th>Trend</th><th>Within bathing limit</th></tr></thead>
                  <tbody>
                    {s.parameters.map((r) => (
                      <tr key={r.parameter}>
                        <td>{r.label}</td><td>{r.unit}</td><td className="num">{fmt(r.n, 0)}</td>
                        <td className="num">{r.missing === r.total_records ? <span className="tag">not recorded</span> : fmt(r.missing, 0)}</td>
                        <td className="num">{fmt(r.min)}</td><td className="num">{fmt(r.max)}</td><td className="num">{fmt(r.mean)}</td><td className="num">{fmt(r.median)}</td>
                        <td>{r.trend ? `${r.trend.slope_per_year > 0 ? "▲" : "▼"} ${fmt(r.trend.slope_per_year)}/yr (ρ=${fmt(r.trend.spearman_rho)}, p=${fmt(r.trend.p_value, 3)})` : <span className="muted">insufficient data</span>}</td>
                        <td>{r.criteria ? `${r.criteria.pct_within}% (${r.criteria.within}/${r.criteria.within + r.criteria.outside})` : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Note tone="warn"><strong>{s.criteria_name}.</strong> {s.criteria_note} <a href={s.criteria_url} target="_blank" rel="noreferrer">CPCB criteria</a></Note>
            </>
          )}
        </Async>
      </Card>

      <Card title="Annual min–max ranges" subtitle="One minimum and one maximum per parameter and year. Not dated readings.">
        <Async q={ranges} isEmpty={(r) => !r.total} emptyText="No annual range data loaded">
          {(r) => (
            <>
              <div className="table-wrap"><table>
                <thead><tr><th>Year</th><th>Station</th><th>River</th><th>Parameter</th><th>Unit</th><th className="num">Min</th><th className="num">Max</th><th className="num">Width</th><th>Source status</th></tr></thead>
                <tbody>{r.items.map((x) => (
                  <tr key={x.id}><td>{x.year}</td><td>{x.station_code ? `${x.station_code} · ` : ""}{x.station}</td><td><span className={`tag tag-${x.river}`}>{x.river}</span></td>
                    <td>{x.label}</td><td>{x.unit}</td><td className="num">{fmt(x.min_value)}</td><td className="num">{fmt(x.max_value)}</td><td className="num">{fmt(x.range_width)}</td>
                    <td>{x.source_status || "–"}</td></tr>))}</tbody>
              </table></div>
              <Note tone="warn">{r.note}</Note>
            </>
          )}
        </Async>
      </Card>

      <Card title="Statistical outliers" subtitle="Robust z-score (median/MAD) per river. For review only.">
        <Async q={outliers} isEmpty={(o) => !o.items.length && !o.skipped.length} emptyText="No statistical outliers flagged">
          {(o) => (
            <>
              {o.items.length > 0 && (
                <div className="table-wrap"><table>
                  <thead><tr><th>Date</th><th>River</th><th>Location</th><th className="num">Value</th><th className="num">Median</th><th className="num">Robust z</th></tr></thead>
                  <tbody>{o.items.map((i, k) => <tr key={k}><td>{i.date}</td><td>{i.river}</td><td>{i.station}</td><td className="num">{fmt(i.value)}</td><td className="num">{fmt(i.median)}</td><td className="num">{i.robust_z}</td></tr>)}</tbody>
                </table></div>
              )}
              {o.skipped.map((s) => <p key={s.river} className="muted small">{s.river}: not assessed, {s.reason}.</p>)}
              <Note>{o.method} {o.limitations}</Note>
            </>
          )}
        </Async>
      </Card>

      <Card title="Records">
        <Async q={records} isEmpty={(r) => !r.total}>
          {(r) => (
            <>
              <div className="table-wrap"><table>
                <thead><tr><th>Date</th><th>Location</th><th>River</th><th className="num">pH</th><th className="num">DO</th><th className="num">BOD</th><th className="num">COD</th><th className="num">Temp</th><th className="num">EC</th><th className="num">Nitrate</th><th className="num">TC</th><th className="num">FC</th></tr></thead>
                <tbody>{r.items.map((x) => (
                  <tr key={x.id}><td>{x.date}</td><td>{x.station}</td><td><span className={`tag tag-${x.river}`}>{x.river}</span></td>
                    {["ph","do_mg_l","bod_mg_l","cod_mg_l","temperature_c","conductivity_us_cm","nitrate_mg_l","total_coliform_mpn","fecal_coliform_mpn"].map((k) => <td key={k} className="num">{fmt(x[k])}</td>)}</tr>))}</tbody>
              </table></div>
              <div className="pager">
                <button className="btn btn-ghost btn-small" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
                <span className="small muted">Page {page} of {Math.max(1, Math.ceil(r.total / r.page_size))} · {fmt(r.total, 0)} records</span>
                <button className="btn btn-ghost btn-small" disabled={page * r.page_size >= r.total} onClick={() => setPage(page + 1)}>Next</button>
              </div>
            </>
          )}
        </Async>
      </Card>
    </>
  );
}
