import { Async, Card, Note, PageHeader } from "../components/ui";
import { useApi } from "../hooks";

const Row = ({ k, v }) => v ? <tr><th style={{ width: 170, whiteSpace: "normal" }}>{k}</th><td style={{ whiteSpace: "normal" }}>{v}</td></tr> : null;

export default function Sources() {
  const src = useApi("/api/data-sources");
  const ref = useApi("/api/data-sources/reference");
  const crit = useApi("/api/analysis/criteria");
  return (
    <>
      <PageHeader title="Data sources and methodology">Where the data comes from, how it is processed, and what it can and cannot show.</PageHeader>
      <h2>Registered datasets</h2>
      <Async q={src} isEmpty={(d) => !d.length} emptyText="No datasets have been registered yet. Administrators register a source when importing data.">
        {(list) => list.map((s) => (
          <Card key={s.id} title={s.name} subtitle={s.organization}>
            <div className="table-wrap"><table><tbody>
              <Row k="Original source" v={s.url && <a href={s.url} target="_blank" rel="noreferrer">{s.url}</a>} />
              <Row k="Collection period" v={s.period_start && `${s.period_start} to ${s.period_end || "present"}`} />
              <Row k="Parameters" v={s.parameters} /><Row k="Units" v={s.units} /><Row k="Geographic coverage" v={s.coverage} />
              <Row k="Data format" v={s.data_format} /><Row k="Processing" v={s.processing} /><Row k="Missing data" v={s.missing_info} /><Row k="Limitations" v={s.limitations} />
              <Row k="Provenance" v={s.provenance_verified ? "Provenance confirmed by the administrator who registered it" : "Provenance not independently verified. Do not describe this dataset as government-verified."} />
            </tbody></table></div>
          </Card>))}
      </Async>
      <h2 style={{ marginTop: 28 }}>Official portals</h2>
      <Card subtitle="Links where official datasets can be obtained. Listing a portal does not mean its data is loaded here.">
        <Async q={ref}>{(l) => <ul>{l.map((r) => <li key={r.url}><a href={r.url} target="_blank" rel="noreferrer">{r.name}</a> <span className="muted small">- {r.note}</span></li>)}</ul>}</Async>
      </Card>
      <h2 style={{ marginTop: 28 }}>Methodology</h2>
      <div className="grid g2">
        <Card title="Import and storage"><ul className="small">
          <li>General datasets enter through validated CSV import; the supplied Phase 3 workbook has a dedicated idempotent importer. Rows are checked for valid dates, numeric values, plausible ranges and coordinates where applicable.</li>
          <li>Rows that fail are rejected and listed in the import report; values are never silently corrected. Blank or "BDL"/"NA" cells are stored as missing, not as zero.</li>
          <li>Duplicates (same location and date, or same rainfall date, location and type) are skipped and counted.</li>
          <li>Only the Ganga and Yamuna are accepted. No Saraswati measurements are held.</li>
        </ul></Card>
        <Card title="Statistics"><ul className="small">
          <li>Summaries use only non-missing values. Monthly and yearly figures are means (water quality) or sums (rainfall).</li>
          <li>Trend: least-squares slope per year with Spearman ρ; reported only with at least 8 observations. Irregular sampling and seasonality can distort it.</li>
          <li>Outliers: robust z-score (median and MAD), flagged beyond 3.5. These are statistical flags, not confirmed pollution incidents.</li>
        </ul></Card>
        <Card title="Rainfall"><ul className="small">
          <li>Gridded estimates are area values at the dataset's resolution, not rain-gauge observations; the type is stored per row and shown in the interface.</li>
          <li>Monthly totals are sums of daily values present. Months with missing days are flagged partial and excluded from correlation.</li>
          <li>The 2022 RF-TARGET and RF-GRID coordinates are rainfall reference points, kept separate from water-quality stations.</li>
        </ul></Card>
        <Card title="Rainfall and water quality"><ul className="small">
          <li>Monthly mean of each parameter is paired with the monthly rainfall total of complete months.</li>
          <li>Pearson and Spearman coefficients are shown only with at least 10 paired months and non-constant data.</li>
          <li>Association is not cause. Discharge, season, upstream rainfall, treatment and sampling sites are not controlled for.</li>
        </ul></Card>
      </div>
      <Card title="Water-quality screening criteria">
        <Async q={crit}>{(c) => (<>
          <p className="small"><strong>{c.name}</strong> (<a href={c.source_url} target="_blank" rel="noreferrer">CPCB</a>)</p>
          <ul className="small">{Object.entries(c.limits).map(([k, v]) => <li key={k}>{k}: {[v.min != null && `≥ ${v.min}`, v.max != null && `≤ ${v.max}`].filter(Boolean).join(" and ")}</li>)}</ul>
          <Note tone="warn">{c.applicability}</Note></>)}</Async>
      </Card>
    </>
  );
}
