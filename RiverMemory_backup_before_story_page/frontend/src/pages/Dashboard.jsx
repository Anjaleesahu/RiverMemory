import { useState } from "react";
import { Link } from "react-router-dom";
import { Async, Card, Note, PageHeader, ParamSelect, Stat, fmt } from "../components/ui";
import { RainBars, SeriesChart } from "../components/Charts";
import { useApi } from "../hooks";

const COLS = [["ph", "pH"], ["do_mg_l", "DO"], ["bod_mg_l", "BOD"], ["temperature_c", "Temp °C"], ["conductivity_us_cm", "EC µS/cm"]];

export default function Dashboard() {
  const dash = useApi("/api/dashboard");
  const [param, setParam] = useState("do_mg_l");
  const series = useApi("/api/water-quality/series", { parameter: param, agg: "monthly" });
  const rain = useApi("/api/rainfall/aggregate", { period: "monthly" });
  const range = (r) => (r?.from ? `${r.from} to ${r.to}` : undefined);

  return (
    <>
      <PageHeader title="Dashboard">Overview of the records stored in the platform. Every figure is computed from the database.</PageHeader>
      <Async q={dash}>
        {(d) => (
          <>
            {!d.has_data && (
              <Note tone="warn">
                No water-quality or rainfall data has been imported yet. An administrator can load datasets from the{" "}
                <Link to="/admin">Admin</Link> page (CSV import). All values below show "No data available" until then.
              </Note>
            )}
            <div className="grid g4" style={{ marginBottom: 16 }}>
              <Stat label="Water-quality records" value={d.has_data || d.totals.water_quality_records ? fmt(d.totals.water_quality_records, 0) : "No data available"} hint={range(d.water_quality_range)} />
              <Stat label="Rainfall records" value={d.totals.rainfall_records ? fmt(d.totals.rainfall_records, 0) : "No data available"} hint={range(d.rainfall_range)} />
              <Stat label="Monitoring locations" value={d.totals.monitoring_locations ? fmt(d.totals.monitoring_locations, 0) : "No data available"} />
              <Stat label="Recorded incidents" value={fmt(d.totals.incidents, 0)} hint={`${d.totals.data_sources} registered data sources`} />
            </div>

            <div className="grid g2">
              <Card title="Historical water-quality trend" subtitle="Monthly mean by river" actions={<ParamSelect value={param} onChange={setParam} />}>
                <Async q={series} isEmpty={(s) => !s.points.length} emptyText="No data available for this parameter">
                  {(s) => <SeriesChart points={s.points} groups={s.groups} unit={s.unit} />}
                </Async>
              </Card>
              <Card title="Rainfall trend" subtitle="Monthly totals (mm). Partial months are lower bounds.">
                <Async q={rain} isEmpty={(r) => !r.points.length}>{(r) => <RainBars points={r.points} dataKey="rainfall_mm" />}</Async>
              </Card>
            </div>

            <Card title="Latest available observations" subtitle="Most recent record at each monitoring location">
              {d.latest_observations.length === 0 ? (
                <div className="empty">No data available</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Location</th><th>River</th><th>Date</th>{COLS.map(([, l]) => <th key={l} className="num">{l}</th>)}</tr>
                    </thead>
                    <tbody>
                      {d.latest_observations.map((r) => (
                        <tr key={r.station_id}>
                          <td>{r.station}</td>
                          <td><span className={`tag tag-${r.river}`}>{r.river}</span></td>
                          <td>{r.date}</td>
                          {COLS.map(([k]) => <td key={k} className="num">{fmt(r[k])}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <div className="grid g2">
              <Card title="River comparison" subtitle="Records per river">
                {Object.keys(d.records_per_river).length === 0 ? <div className="empty">No data available</div> : (
                  <ul className="small">{Object.entries(d.records_per_river).map(([r, n]) => <li key={r}><span className={`tag tag-${r}`}>{r}</span> {fmt(n, 0)} records</li>)}</ul>
                )}
                <Link to="/comparison">Open full comparison →</Link>
              </Card>
              <Card title="Data availability" subtitle="Records holding a value for each parameter">
                {d.totals.water_quality_records === 0 ? <div className="empty">No data available</div> : d.availability.map((a) => (
                  <div key={a.parameter} style={{ marginBottom: 8 }}>
                    <div className="small" style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{a.label}</span><span className="muted">{fmt(a.records, 0)} of {fmt(d.totals.water_quality_records, 0)}</span>
                    </div>
                    <div className="bar"><span style={{ width: `${(100 * a.records) / d.totals.water_quality_records}%` }} /></div>
                  </div>
                ))}
              </Card>
            </div>
          </>
        )}
      </Async>
    </>
  );
}
