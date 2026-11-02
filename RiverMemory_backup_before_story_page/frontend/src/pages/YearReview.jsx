import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Async, Card, Empty, Note, PageHeader, Stat, fmt } from "../components/ui";
import { useApi } from "../hooks";

const YEAR = 2022;
const RIVER_COLORS = { Ganga: "#00796b", Yamuna: "#1d4ed8" };
const axis = { stroke: "var(--muted)", fontSize: 11 };

function RainCalendar({ months }) {
  const values = months.flatMap((month) => month.days.map((day) => day?.rainfall_mm).filter((v) => v != null));
  const maximum = Math.max(0, ...values);
  const cellColor = (value) => {
    if (value == null) return {};
    const alpha = maximum > 0 ? 0.12 + (value / maximum) * 0.88 : 0.12;
    return {
      backgroundColor: `rgba(8, 106, 128, ${alpha})`,
      color: alpha > 0.56 ? "#fff" : "var(--text)",
    };
  };

  return (
    <div className="calendar-scroll">
      <div className="calendar-grid" role="grid" aria-label={`${YEAR} daily rainfall calendar in millimetres`}>
        <span className="calendar-corner" aria-hidden="true" />
        {Array.from({ length: 31 }, (_, i) => <span className="calendar-day-head" key={i}>{i + 1}</span>)}
        {months.map((month) => (
          <div className="calendar-row" role="row" key={month.month}>
            <span className="calendar-month" role="rowheader">{month.label}</span>
            {month.days.map((day, index) => (
              <span
                className={`calendar-cell${day ? "" : " calendar-cell-empty"}`}
                key={`${month.month}-${index}`}
                role="gridcell"
                title={day ? `${day.date}: ${fmt(day.rainfall_mm)} mm` : undefined}
                aria-label={day ? `${day.date}, ${fmt(day.rainfall_mm)} millimetres` : undefined}
                style={cellColor(day?.rainfall_mm)}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="calendar-legend small" aria-label="Rainfall intensity legend">
        <span>0 mm</span><span className="calendar-gradient" /><span>{fmt(maximum)} mm</span>
      </div>
    </div>
  );
}

function RangeTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="tip">
      <strong>{row.station}</strong><br />
      {row.river} · {row.label}<br />
      Min: {fmt(row.min_value)} {row.unit}<br />
      Max: {fmt(row.max_value)} {row.unit}
    </div>
  );
}

function RangeChart({ parameter, items }) {
  const rows = items.filter((item) => item.parameter === parameter);
  const criteria = rows.find((row) => row.criteria)?.criteria;
  const ceiling = Math.max(
    1,
    ...rows.map((row) => row.max_value),
    criteria?.min || 0,
    criteria?.max || 0,
  );
  const domainMax = Number((ceiling * 1.08).toPrecision(4));
  const first = rows[0];

  return (
    <Card
      title={first?.label || parameter}
      subtitle={first ? first.unit : "No data available"}
      className="range-card"
    >
      {!rows.length ? <Empty /> : (
        <>
          <div className="range-chart">
            <ResponsiveContainer width="100%" height={Math.max(190, rows.length * 52 + 70)}>
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: 8, right: 12, bottom: 8, left: 0 }}
              >
                <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, domainMax]} {...axis} />
                <YAxis
                  type="category"
                  dataKey="station_code"
                  width={54}
                  tick={{ fill: "var(--muted)", fontSize: 10 }}
                />
                <Tooltip content={<RangeTooltip />} />
                <Bar dataKey="min_value" stackId="range" fill="transparent" isAnimationActive={false} />
                <Bar dataKey="range_width" stackId="range" name="Annual min-max range" isAnimationActive={false}>
                  {rows.map((row) => (
                    <Cell key={row.id} fill={RIVER_COLORS[row.river] || "#475569"} />
                  ))}
                </Bar>
                {criteria?.min != null && (
                  <ReferenceLine x={criteria.min} stroke="#b45309" strokeDasharray="5 4" />
                )}
                {criteria?.max != null && (
                  <ReferenceLine x={criteria.max} stroke="#b45309" strokeDasharray="5 4" />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {criteria && (
            <p className="small muted">
              Dashed line{criteria.min != null && criteria.max != null ? "s" : ""}: Class B screening
              {criteria.min != null && ` minimum ${criteria.min}`}
              {criteria.min != null && criteria.max != null && " /"}
              {criteria.max != null && ` maximum ${criteria.max}`} {first.unit}.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function DataTable({ data }) {
  const [view, setView] = useState("rainfall");
  return (
    <Card title="Data table" subtitle="Values returned by the year-in-review API">
      <div className="btn-row table-tabs" role="group" aria-label="Choose table data">
        <button className={`btn btn-small ${view === "rainfall" ? "" : "btn-ghost"}`} onClick={() => setView("rainfall")}>
          Daily rainfall
        </button>
        <button className={`btn btn-small ${view === "ranges" ? "" : "btn-ghost"}`} onClick={() => setView("ranges")}>
          Annual ranges
        </button>
      </div>
      {view === "rainfall" ? (
        data.rainfall.daily.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th className="num">Rainfall (mm)</th><th className="num">Grid values</th></tr></thead>
              <tbody>{data.rainfall.daily.map((row) => (
                <tr key={row.date}>
                  <td>{row.date}</td>
                  <td className="num">{fmt(row.rainfall_mm)}</td>
                  <td className="num">{row.locations_count || "–"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <Empty />
      ) : (
        data.ranges.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Station</th><th>River</th><th>Parameter</th><th>Unit</th><th className="num">Min</th><th className="num">Max</th><th>Screening</th></tr></thead>
              <tbody>{data.ranges.map((row) => (
                <tr key={row.id}>
                  <td>{row.station_code} · {row.station}</td>
                  <td><span className={`tag tag-${row.river}`}>{row.river}</span></td>
                  <td>{row.label}</td><td>{row.unit}</td>
                  <td className="num">{fmt(row.min_value)}</td><td className="num">{fmt(row.max_value)}</td>
                  <td>{row.screening ? row.screening.status : "No limit applied"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <Empty />
      )}
    </Card>
  );
}

export default function YearReview() {
  const query = useApi(`/api/insights/year/${YEAR}`);

  return (
    <>
      <PageHeader title={`Year in review: ${YEAR}`}>
        A database-backed summary of the 2022 gridded rainfall series and annual water-quality ranges.
      </PageHeader>
      <Async q={query}>
        {(data) => {
          const h = data.highlights;
          return (
            <>
              {!data.has_data && <Empty />}
              {data.has_data && (
                <>
                  {data.has_rainfall ? (
                    <div className="grid g3 insight-highlights">
                      <Stat label="Annual rainfall" value={`${fmt(h.total_rainfall_mm)} mm`} hint={`${data.rainfall.days_with_data} of ${data.rainfall.days_expected} days`} />
                      <Stat label="Rainy days (≥2.5 mm)" value={fmt(h.rainy_days_ge_2_5mm, 0)} hint={`${fmt(h.wet_days_gt_0mm, 0)} days > 0 mm`} />
                      <Stat label="Jun–Sep monsoon share" value={h.monsoon_share_percent == null ? "No data available" : `${fmt(h.monsoon_share_percent, 1)}%`} hint={`${fmt(h.monsoon_rainfall_mm)} mm in monsoon months`} />
                      <Stat label="Wettest month" value={h.wettest_month ? h.wettest_month.label : "No data available"} hint={h.wettest_month ? `${fmt(h.wettest_month.rainfall_mm)} mm` : undefined} />
                      <Stat label="Longest dry spell" value={h.longest_dry_spell ? `${h.longest_dry_spell.days} days` : "No data available"} hint={h.longest_dry_spell ? `${h.longest_dry_spell.from} to ${h.longest_dry_spell.to}` : undefined} />
                      <Stat label="Wettest day" value={h.wettest_day ? `${fmt(h.wettest_day.rainfall_mm)} mm` : "No data available"} hint={h.wettest_day?.date} />
                    </div>
                  ) : <Note>No rainfall data available for {YEAR}.</Note>}

                  {data.has_rainfall && (
                    <>
                      <Card title="Daily rainfall calendar" subtitle="Hover over a day for its rainfall value. Blank cells are outside the month.">
                        <RainCalendar months={data.rainfall.calendar} />
                      </Card>
                      <div className="grid g2">
                        <Card title="Cumulative rainfall" subtitle="Daily cumulative total; shaded area marks June–September">
                          <div className="insight-chart">
                            <ResponsiveContainer width="100%" height={280}>
                              <LineChart data={data.rainfall.cumulative} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
                                <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
                                <ReferenceArea x1={`${YEAR}-06-01`} x2={`${YEAR}-09-30`} fill="#0f766e" fillOpacity={0.12} />
                                <XAxis dataKey="date" interval={30} tickFormatter={(value) => value.slice(5)} {...axis} />
                                <YAxis width={48} {...axis} />
                                <Tooltip labelFormatter={(value) => value} formatter={(value) => [`${fmt(value)} mm`, "Cumulative rainfall"]} />
                                <Line type="monotone" dataKey="cumulative_mm" stroke="#00796b" dot={false} strokeWidth={2} connectNulls={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </Card>
                        <Card title="Monthly rainfall totals" subtitle="Months without observations are left blank, not treated as zero">
                          <div className="insight-chart">
                            <ResponsiveContainer width="100%" height={280}>
                              <BarChart data={data.rainfall.monthly} margin={{ top: 12, right: 8, bottom: 4, left: 0 }}>
                                <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
                                <XAxis dataKey="label" {...axis} />
                                <YAxis width={48} {...axis} />
                                <Tooltip formatter={(value) => [`${fmt(value)} mm`, "Monthly rainfall"]} />
                                <Bar dataKey="rainfall_mm" fill="#00796b" name="Rainfall (mm)" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </Card>
                      </div>
                    </>
                  )}

                  {data.has_ranges ? (
                    <>
                      <section aria-labelledby="range-heading">
                        <h2 id="range-heading">Annual water-quality ranges</h2>
                        <p className="muted small">One min–max range per station and parameter. Ganga is teal; Yamuna is blue.</p>
                        <div className="river-legend" aria-label="Water-quality chart legend">
                          <span><i className="legend-swatch legend-ganga" />Ganga</span>
                          <span><i className="legend-swatch legend-yamuna" />Yamuna</span>
                          <span><i className="legend-line" />Class B screening limit (where applicable)</span>
                        </div>
                        <div className="grid g2 range-grid">
                          {data.range_parameters.map((parameter) => (
                            <RangeChart key={parameter} parameter={parameter} items={data.ranges} />
                          ))}
                        </div>
                      </section>
                      <DataTable data={data} />
                    </>
                  ) : <Note>No annual water-quality ranges available for {YEAR}.</Note>}

                  <Card title="Interpretation and caveats">
                    <ul className="small">{data.caveats.map((text) => <li key={text}>{text}</li>)}</ul>
                    <p className="small">
                      Screening reference: <strong>{data.screening.name}</strong>. Range endpoints are compared
                      with applicable limit lines; a min–max range does not reveal the dates or distribution of
                      individual measurements. No limit is applied to nitrate or fecal coliform.
                    </p>
                    <p className="small">
                      Nitrate reporting basis (NO3 vs N) is not stated in the supplied source. Conductivity is
                      displayed as µS/cm; source unit: µmhos/cm.
                    </p>
                    <p className="small">CPCB provenance remains unverified until the original report, page and period are confirmed.</p>
                    <p className="small">
                      Rainfall points: {data.reference_points.map((point) => (
                        <span key={point.code}>{point.code} ({point.latitude}, {point.longitude}){point.code === "RF-TARGET" ? "; " : ""}</span>
                      ))}
                      . These are not water-quality station coordinates.
                    </p>
                  </Card>
                </>
              )}
              <div className="print-action">
                <button className="btn btn-teal" onClick={() => window.print()}>Print / save as PDF</button>
              </div>
            </>
          );
        }}
      </Async>
    </>
  );
}
