import { useState } from "react";
import { Async, Card, Filters, Note, PageHeader, ParamSelect } from "../components/ui";
import { TimelineChart } from "../components/Charts";
import { useApi } from "../hooks";

export default function Timeline() {
  const [f, setF] = useState({});
  const [param, setParam] = useState("do_mg_l");
  const q = useApi("/api/timeline", { parameter: param, river: f.river, from: f.from, to: f.to });
  return (
    <>
      <PageHeader title="Historical timeline">Monthly water quality, monthly rainfall and recorded incidents on one time axis.</PageHeader>
      <Filters value={f} onChange={setF} showStation={false}><ParamSelect value={param} onChange={setParam} /></Filters>
      <Async q={q} isEmpty={(d) => !d.months.length && !d.incidents.length} emptyText="No data available for this selection">
        {(d) => (<>
          <Card title={`${d.label} and rainfall`} subtitle="Dashed orange lines mark months with a recorded incident. Co-occurrence does not show cause.">
            {d.months.length ? <TimelineChart months={d.months} incidents={d.incidents} label={`${d.label} (${d.unit})`} unit={d.unit} /> : <div className="empty">No data available</div>}
          </Card>
          <Card title="Incident timeline">
            {d.incidents.length === 0 ? <div className="empty">No incidents recorded in this period</div> : (
              <ol style={{ paddingLeft: 18 }}>{d.incidents.map((i) => (
                <li key={i.id} style={{ marginBottom: 8 }}><strong>{i.date}</strong> · {i.title} <span className="tag">{i.type}</span> {i.river && <span className={`tag tag-${i.river}`}>{i.river}</span>}{i.location && <span className="muted small"> · {i.location}</span>}</li>))}</ol>)}
          </Card>
          <Note>Significant changes are not labelled automatically. Use the outlier view on the Water Quality page to find values worth reviewing.</Note>
        </>)}
      </Async>
    </>
  );
}
