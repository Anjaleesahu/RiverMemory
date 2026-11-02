import { Link } from "react-router-dom";
import { Card } from "../components/ui";

const CAPS = [
  ["Water-quality analysis", "pH, DO, BOD, COD, temperature, conductivity, nitrate and coliform records with trends, statistics and missing-data indicators.", "/water-quality"],
  ["2022 year in review", "Explore the actual daily gridded rainfall series alongside undated annual water-quality ranges, with source caveats.", "/insights"],
  ["Rainfall analysis", "Daily, monthly and yearly rainfall with distributions and seasonal comparison, with gridded estimates labelled as such.", "/rainfall"],
  ["Ganga vs Yamuna", "Side-by-side comparison of compatible records, with explicit notes on stations and methods.", "/comparison"],
  ["Rainfall and quality", "Correlation analysis between monthly rainfall and water quality, with clear limits on interpretation.", "/relationship"],
  ["Incident tracker", "Publicly viewable environmental incident records with evidence references, maintained by administrators.", "/incidents"],
  ["Map and timeline", "Verified monitoring locations and incidents on a map, and a historical timeline of records and events.", "/map"],
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <h1>RiverMemory</h1>
        <p>
          Historical river water quality and environmental intelligence for the Triveni Sangam region of
          Prayagraj, Uttar Pradesh. One place to explore water-quality records, rainfall and environmental
          incidents for the Ganga and Yamuna, over time.
        </p>
        <div className="btn-row" style={{ marginTop: 20 }}>
          <Link to="/dashboard" className="btn btn-teal">Open dashboard</Link>
          <Link to="/sources" className="btn btn-ghost">Data &amp; methodology</Link>
        </div>
      </section>

      <section className="section grid g2">
        <Card title="The Triveni Sangam">
          <p>
            At Prayagraj, the Ganga and the Yamuna meet at the Sangam, a place of deep cultural and religious
            significance. Tradition also places the Saraswati here. RiverMemory presents no water-quality
            measurements for the Saraswati, because there is no verified monitoring data for it; the platform
            analyses the Ganga and Yamuna only.
          </p>
        </Card>
        <Card title="Why this platform">
          <p>
            Water-quality records and rainfall data sit in different portals and formats, which makes it hard to
            see change over time or to relate rainfall to river conditions. RiverMemory brings imported datasets
            together, keeps their source attribution, and shows what the records do and do not support.
          </p>
        </Card>
      </section>

      <section className="section">
        <h2>Objectives</h2>
        <div className="grid g3">
          {["Organise historical water-quality data for the Ganga and Yamuna.", "Integrate rainfall records for the Prayagraj study region.", "Visualise change over time and compare parameters.", "Explore associations between rainfall and water quality, without overclaiming.", "Track environmental incidents with evidence.", "Keep data sources and methods transparent."].map((o) => (
            <div className="card feature" key={o}>{o}</div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>What you can do</h2>
        <div className="grid g3">
          {CAPS.map(([t, d, to]) => (
            <Link key={t} to={to} style={{ textDecoration: "none", color: "inherit" }}>
              <div className="card feature" style={{ height: "100%" }}>
                <h3>{t}</h3>
                <p className="muted small">{d}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <Card title="Data-driven, with stated limits">
          <p className="small">
            Every figure shown comes from records stored in the platform's database. Where a dataset has not been
            loaded, pages say "No data available" instead of showing placeholders. Water-quality screening uses
            CPCB criteria for organised outdoor bathing and is indicative only. It is not a statement that water is
            safe to drink. Statistical outliers are flagged for review and are not confirmed pollution incidents.
          </p>
        </Card>
      </section>
    </>
  );
}
