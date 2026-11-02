import { useState } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { Link } from "react-router-dom";
import { Async, Card, Note, PageHeader } from "../components/ui";
import { useApi } from "../hooks";

// Initial view only (approximate area of the Sangam, Prayagraj). It is not a data point.
const VIEW_CENTER = [25.43, 81.88];
void L;

export default function MapPage() {
  const locs = useApi("/api/locations");
  const incs = useApi("/api/incidents", { page_size: 200 });
  const [show, setShow] = useState({ Ganga: true, Yamuna: true, incidents: true });
  const toggle = (k) => setShow({ ...show, [k]: !show[k] });
  const stations = (locs.data || []).filter((s) => s.latitude != null && show[s.river]);
  const noCoords = (locs.data || []).filter((s) => s.latitude == null).length;
  const incidents = (incs.data?.items || []).filter((i) => i.latitude != null);

  return (
    <>
      <PageHeader title="Map">Monitoring locations and incidents with verified coordinates, around the Triveni Sangam.</PageHeader>
      <div className="filters">
        {[["Ganga", "Ganga locations"], ["Yamuna", "Yamuna locations"], ["incidents", "Incidents"]].map(([k, l]) => (
          <label key={k} className="small"><input type="checkbox" checked={show[k]} onChange={() => toggle(k)} /> {l}</label>
        ))}
      </div>
      <div className="map">
        <MapContainer center={VIEW_CENTER} zoom={11} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {stations.map((s) => (
            <CircleMarker key={`s${s.id}`} center={[s.latitude, s.longitude]} radius={9} pathOptions={{ color: s.river === "Ganga" ? "#0f9d8a" : "#1d4ed8", fillOpacity: 0.8 }}>
              <Popup><strong>{s.name}</strong><br />{s.river}<br />{s.record_count} water-quality record(s){s.last_date ? <><br />Latest: {s.last_date}</> : null}<br /><Link to="/water-quality">Open analysis</Link></Popup>
            </CircleMarker>
          ))}
          {show.incidents && incidents.map((i) => (
            <CircleMarker key={`i${i.id}`} center={[i.latitude, i.longitude]} radius={8} pathOptions={{ color: "#d97706", fillColor: "#f59e0b", fillOpacity: 0.85 }}>
              <Popup><strong>{i.title}</strong><br />{i.incident_date} · {i.incident_type}{i.severity ? ` · ${i.severity}` : ""}<br />{i.location}<br /><Link to="/incidents">All incidents</Link></Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <Async q={locs}>{() => (
        <Card title="Map coverage">
          <p className="small">{stations.length} location marker(s) and {show.incidents ? incidents.length : 0} incident marker(s) shown. {noCoords > 0 && `${noCoords} location(s) have no coordinates and are not mapped.`}</p>
          {locs.data.length === 0 && <p className="small muted">No monitoring locations have been imported yet.</p>}
          <Note>Markers use only coordinates supplied in imported datasets or incident records; none are inferred. River centre-lines and study-area boundaries are not loaded because no verified geometry has been imported.</Note>
        </Card>)}
      </Async>
    </>
  );
}
