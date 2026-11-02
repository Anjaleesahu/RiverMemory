import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Polyline,
  Popup,
  ScaleControl,
  TileLayer,
  useMap,
} from "react-leaflet";
import { Link } from "react-router-dom";
import { useApi } from "../hooks";
import {
  buildJourneyPath,
  distanceKm,
  getJourneyLandmarks,
  ORIGIN_REFERENCES,
  RIVERS,
  riverFeatureName,
  TRIVENI_SANGAM,
} from "./riverExplorerData";

const INITIAL_RIVER_VISIBILITY = Object.fromEntries(
  RIVERS.map(({ id }) => [id, id === "ganga" || id === "yamuna"]),
);
const MAP_CENTER = [27.2, 82.4];
const MAP_ZOOM = 5;

function routeStyle(feature, selectedRiverId, associated = false) {
  const river = RIVERS.find(({ id }) => id === feature.properties.river_id);
  const selected = river?.id === selectedRiverId;
  return {
    color: river?.color || "#315d75",
    weight: selected ? (associated ? 3 : 4.5) : (associated ? 2 : 3.5),
    opacity: associated ? 0.72 : 0.92,
    dashArray: river?.dashArray || null,
    lineCap: "round",
    lineJoin: "round",
  };
}

function MapMotion({ command, features }) {
  const map = useMap();

  useEffect(() => {
    if (!command) return;
    if (command.type === "world") {
      map.fitBounds([[-55, -180], [72, 180]], { padding: [20, 20], maxZoom: 2 });
      return;
    }
    if (command.type === "point") {
      map.flyTo(command.coordinates, command.zoom || 10, { duration: 1 });
      return;
    }
    if (command.type === "river") {
      const source = ORIGIN_REFERENCES.find(({ riverId }) => riverId === command.riverId);
      if (source) {
        map.flyTo(source.coordinates, 8, { duration: 1 });
        return;
      }
      const selectedFeatures = features.filter((feature) => feature.properties.river_id === command.riverId);
      if (selectedFeatures.length) {
        const bounds = L.geoJSON({ type: "FeatureCollection", features: selectedFeatures }).getBounds();
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [32, 32], maxZoom: 8 });
      }
    }
  }, [command, features, map]);

  return null;
}

function MapLayer({ features, selectedRiverId, associated = false }) {
  if (!features.length) return null;
  return (
    <GeoJSON
      data={{ type: "FeatureCollection", features }}
      style={(feature) => routeStyle(feature, selectedRiverId, associated)}
    />
  );
}

function Toggle({ checked, onChange, children, disabled = false, hint }) {
  return (
    <label className={`explorer-toggle${disabled ? " is-disabled" : ""}`}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      <span>{children}</span>
      {hint && <small>{hint}</small>}
    </label>
  );
}

function RiverDetail({ river, features, cities, hasGeometry }) {
  if (!river) return null;
  const riverFeatures = features.filter((feature) => feature.properties.river_id === river.id);
  const names = [...new Set(riverFeatures.map((feature) => feature.properties.name_en))];
  const nearbyCities = cities
    .filter((city) => city.properties.river_ids.includes(river.id))
    .map((city) => `${city.properties.name} (${city.properties.country})`);

  return (
    <section className="explorer-detail" aria-labelledby="river-detail-heading">
      <div className="explorer-section-heading">
        <span className="explorer-kicker">Selected river</span>
        <h2 id="river-detail-heading">{river.displayName}</h2>
      </div>
      {hasGeometry ? (
        <>
          <p>{river.description || "A generalized named river line is available in the selected Natural Earth dataset."}</p>
          <dl className="explorer-facts">
            <div><dt>Mapped line names</dt><dd>{names.join(", ") || "No named line attributes"}</dd></div>
            <div><dt>Length</dt><dd>Not supplied by this geometry dataset.</dd></div>
            <div><dt>Source and mouth</dt><dd>Exact source and endpoint attributes are not supplied.</dd></div>
            <div><dt>Countries traversed</dt><dd>Not encoded; nearby city locations are listed separately.</dd></div>
          </dl>
          <p className="explorer-nearby">
            <strong>Nearby mapped cities:</strong>{" "}
            {nearbyCities.length ? nearbyCities.join(" · ") : "No major city point passed the map's proximity filter."}
          </p>
        </>
      ) : (
        <div className="explorer-unavailable" role="status">
          No matching river line was found in the selected Natural Earth release. RiverMemory does not draw a substitute route.
        </div>
      )}
      <a href={river.reference} target="_blank" rel="noreferrer" className="explorer-source-link">
        Read a river geography reference ↗
      </a>
    </section>
  );
}

function SaraswatiContext() {
  return (
    <section className="saraswati-context" aria-labelledby="saraswati-heading">
      <h2 id="saraswati-heading">Saraswati: tradition and historical questions</h2>
      <ul>
        <li><strong>Tradition:</strong> At Prayag, Saraswati is revered as the unseen third river.</li>
        <li><strong>Historical hypotheses:</strong> Proposed ancient river identifications and courses remain debated.</li>
        <li><strong>Map treatment:</strong> No unverified surface or underground Saraswati line is drawn.</li>
      </ul>
      <a href="https://www.britannica.com/place/Sarasvati-River-Asia" target="_blank" rel="noreferrer">
        Further reading: Sarasvati River ↗
      </a>
    </section>
  );
}

function LocationMarkers({
  cities,
  locations,
  sources,
  showCities,
  showOrigins,
  showConfluences,
  showStations,
  visibleRiverIds,
  onSelectCity,
}) {
  const verifiedSources = new Map(
    (sources || []).filter((source) => source.provenance_verified).map((source) => [source.id, source]),
  );
  const stations = (locations || []).filter((station) => (
    station.latitude != null
    && station.longitude != null
    && station.source_id != null
    && verifiedSources.has(station.source_id)
  ));

  return (
    <>
      {showOrigins && ORIGIN_REFERENCES.map((origin) => (
        <CircleMarker
          key={origin.id}
          center={origin.coordinates}
          radius={8}
          pathOptions={{ color: "#61378e", fillColor: "#b695d8", fillOpacity: 0.95, weight: 2 }}
        >
          <Popup>
            <strong>{origin.label}</strong><br />
            {origin.note}<br />
            <a href={origin.url} target="_blank" rel="noreferrer">OpenStreetMap place record</a>
          </Popup>
        </CircleMarker>
      ))}
      {showConfluences && (
        <CircleMarker
          center={TRIVENI_SANGAM.coordinates}
          radius={10}
          pathOptions={{ color: "#7a3d00", fillColor: "#f0ac39", fillOpacity: 1, weight: 3 }}
        >
          <Popup>
            <strong>{TRIVENI_SANGAM.name}</strong><br />
            The mapped Ganga and Yamuna lines approach this OpenStreetMap locality marker; Natural Earth geometry is generalized and does not encode a surveyed junction point.
            Saraswati is shown as religious and historical context, not as a verified river line.<br />
            <a href={TRIVENI_SANGAM.url} target="_blank" rel="noreferrer">OpenStreetMap place record</a>
          </Popup>
        </CircleMarker>
      )}
      {showCities && cities.filter((city) => city.properties.river_ids.some((id) => visibleRiverIds.has(id))).map((city) => {
        const [longitude, latitude] = city.geometry.coordinates;
        return (
          <CircleMarker
            key={`${city.properties.name}-${city.properties.country}`}
            center={[latitude, longitude]}
            radius={5}
            pathOptions={{ color: "#263f52", fillColor: "#f7f8fa", fillOpacity: 1, weight: 2 }}
            eventHandlers={{ click: () => onSelectCity(city) }}
          >
            <Popup>
              <strong>{city.properties.name}</strong><br />
              {[city.properties.region, city.properties.country].filter(Boolean).join(", ")}<br />
              Nearby to a selected Natural Earth river line; city-to-river distance is approximate.<br />
              <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth populated places</a>
            </Popup>
          </CircleMarker>
        );
      })}
      {showStations && stations.map((station) => {
        const source = verifiedSources.get(station.source_id);
        return (
          <CircleMarker
            key={`station-${station.id}`}
            center={[station.latitude, station.longitude]}
            radius={8}
            pathOptions={{ color: "#a31621", fillColor: "#ee6b64", fillOpacity: 0.9, weight: 2 }}
          >
            <Popup>
              <strong>{station.name}</strong><br />
              {station.river} · Station ID {station.id}<br />
              Coordinates: {station.latitude}, {station.longitude}<br />
              Source: {source.name} · provenance verified<br />
              {station.record_count} dated water-quality record(s)
              {station.last_date ? ` · latest ${station.last_date}` : ""}<br />
              <Link to="/water-quality">Open water-quality analysis</Link>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

function RiverMap({
  data,
  command,
  selectedRiverId,
  mainFeatures,
  associatedFeatures,
  journeyPath,
  journeyProgress,
  visibleRiverIds,
  layers,
  locations,
  sources,
  onTileError,
  onSelectCity,
}) {
  return (
    <MapContainer
      center={MAP_CENTER}
      zoom={MAP_ZOOM}
      minZoom={2}
      maxZoom={16}
      scrollWheelZoom
      preferCanvas
      worldCopyJump
      className="river-explorer-map"
      aria-label="Interactive map of selected world river courses"
    >
      <MapMotion command={command} features={data?.features || []} />
      <ScaleControl position="bottomleft" imperial={false} />
      <TileLayer
        attribution={'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'}
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        eventHandlers={{ tileerror: onTileError }}
      />
      <MapLayer features={mainFeatures} selectedRiverId={selectedRiverId} />
      {layers.associated && (
        <MapLayer features={associatedFeatures} selectedRiverId={selectedRiverId} associated />
      )}
      {journeyProgress > 0 && journeyPath.length > 1 && (
        <Polyline
          positions={journeyPath.slice(0, journeyProgress).map(([longitude, latitude]) => [latitude, longitude])}
          pathOptions={{ color: "#f0ac39", weight: 6, opacity: 0.95, lineCap: "round", lineJoin: "round" }}
        />
      )}
      <LocationMarkers
        cities={data?.cities || []}
        locations={locations}
        sources={sources}
        showCities={layers.cities}
        showOrigins={layers.origins}
        showConfluences={layers.confluences || layers.saraswati}
        showStations={layers.stations}
        visibleRiverIds={visibleRiverIds}
        onSelectCity={onSelectCity}
      />
    </MapContainer>
  );
}

export default function RiverExplorer() {
  const [data, setData] = useState(null);
  const [dataError, setDataError] = useState(null);
  const [tileError, setTileError] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedRiverId, setSelectedRiverId] = useState("ganga");
  const [riverVisibility, setRiverVisibility] = useState(INITIAL_RIVER_VISIBILITY);
  const [layers, setLayers] = useState({
    associated: false,
    origins: true,
    confluences: true,
    cities: true,
    stations: false,
    saraswati: false,
  });
  const [command, setCommand] = useState(null);
  const [journeyRiverId, setJourneyRiverId] = useState("ganga");
  const [journey, setJourney] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const locationsQuery = useApi("/api/locations", {}, layers.stations);
  const sourcesQuery = useApi("/api/data-sources", {}, layers.stations);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/river-explorer.geojson", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`River geography request failed (HTTP ${response.status}).`);
        return response.json();
      })
      .then((result) => {
        if (result.type !== "FeatureCollection" || !Array.isArray(result.features) || !Array.isArray(result.cities)) {
          throw new Error("The river geography file has an invalid format.");
        }
        setData(result);
      })
      .catch((error) => {
        if (error.name !== "AbortError") setDataError(error);
      });
    return () => controller.abort();
  }, []);

  const journeyPath = useMemo(() => {
    const origin = ORIGIN_REFERENCES.find(({ riverId }) => riverId === journeyRiverId);
    return buildJourneyPath(data?.features || [], journeyRiverId, origin?.coordinates);
  }, [data, journeyRiverId]);
  const journeyLandmarks = useMemo(
    () => getJourneyLandmarks(data?.cities || [], journeyRiverId, journeyPath),
    [data, journeyPath, journeyRiverId],
  );

  useEffect(() => {
    if (!journey?.playing || journeyPath.length < 2) return undefined;
    const step = Math.max(1, Math.ceil(journeyPath.length / 120));
    const timer = window.setInterval(() => {
      setJourney((current) => {
        if (!current?.playing) return current;
        const progress = Math.min(journeyPath.length, current.progress + step);
        return { ...current, progress, playing: progress < journeyPath.length };
      });
    }, 90);
    return () => window.clearInterval(timer);
  }, [journey?.riverId, journey?.playing, journeyPath.length]);

  const visibleRiverIds = useMemo(
    () => new Set(RIVERS.filter(({ id }) => riverVisibility[id]).map(({ id }) => id)),
    [riverVisibility],
  );
  const availableRiverIds = useMemo(
    () => new Set((data?.features || []).map((feature) => feature.properties.river_id)),
    [data],
  );
  const selectedRiver = RIVERS.find(({ id }) => id === selectedRiverId) || null;
  const selectedHasGeometry = selectedRiver ? availableRiverIds.has(selectedRiver.id) : false;
  const mainFeatures = useMemo(() => (data?.features || []).filter((feature) => {
    const river = RIVERS.find(({ id }) => id === feature.properties.river_id);
    return riverVisibility[feature.properties.river_id]
      && river?.coreNames.includes(riverFeatureName(feature));
  }), [data, riverVisibility]);
  const associatedFeatures = useMemo(() => (data?.features || []).filter((feature) => {
    const river = RIVERS.find(({ id }) => id === feature.properties.river_id);
    return riverVisibility[feature.properties.river_id]
      && river && !river.coreNames.includes(riverFeatureName(feature));
  }), [data, riverVisibility]);

  const searchResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term || !data) return [];
    const riverResults = RIVERS
      .filter((river) => {
        const searchable = [river.name, river.displayName, river.id, ...river.aliases].join(" ").toLowerCase();
        const countryMatch = data.cities.some((city) => city.properties.river_ids.includes(river.id)
          && city.properties.country.toLowerCase().includes(term));
        return searchable.includes(term) || countryMatch;
      })
      .map((river) => ({ type: "river", id: river.id, label: river.displayName }));
    const cityResults = data.cities
      .filter((city) => [
        city.properties.name,
        city.properties.country,
        city.properties.region,
      ].filter(Boolean).some((value) => value.toLowerCase().includes(term)))
      .map((city) => ({
        type: "city",
        id: `${city.properties.name}-${city.properties.country}`,
        label: city.properties.name,
        detail: `${city.properties.region ? `${city.properties.region}, ` : ""}${city.properties.country}`,
        city,
      }));
    return [...riverResults, ...cityResults].slice(0, 12);
  }, [data, query]);

  const updateLayer = (key) => setLayers((previous) => ({ ...previous, [key]: !previous[key] }));
  const issueCommand = (next) => setCommand((previous) => ({ ...next, id: (previous?.id || 0) + 1 }));

  const selectRiver = (riverId, focus = true) => {
    setJourney(null);
    setSelectedRiverId(riverId);
    setSelectedCity(null);
    setQuery("");
    setSearchOpen(false);
    const river = RIVERS.find(({ id }) => id === riverId);
    if (availableRiverIds.has(riverId)) {
      setRiverVisibility((previous) => ({ ...previous, [riverId]: true }));
    }
    if (focus && river) issueCommand({ type: "river", riverId });
  };

  const selectCity = (city) => {
    const [longitude, latitude] = city.geometry.coordinates;
    setJourney(null);
    setSelectedCity(city);
    setSelectedRiverId(city.properties.river_ids[0]);
    setRiverVisibility((previous) => ({
      ...previous,
      ...Object.fromEntries(city.properties.river_ids.map((id) => [id, true])),
    }));
    setQuery("");
    setSearchOpen(false);
    issueCommand({ type: "point", coordinates: [latitude, longitude], zoom: 9 });
  };

  const showSangam = () => {
    setJourney(null);
    setSelectedRiverId("ganga");
    setSelectedCity(null);
    setRiverVisibility((previous) => ({ ...previous, ganga: true, yamuna: true }));
    setLayers((previous) => ({ ...previous, confluences: true }));
    issueCommand({ type: "point", coordinates: TRIVENI_SANGAM.coordinates, zoom: 12 });
  };

  const showWorld = () => {
    setJourney(null);
    setSelectedCity(null);
    setSelectedRiverId(null);
    setRiverVisibility(Object.fromEntries(RIVERS.map(({ id }) => [id, availableRiverIds.has(id)])));
    issueCommand({ type: "world" });
  };

  const followRiver = (riverId) => {
    if (!availableRiverIds.has(riverId)) return;
    selectRiver(riverId, false);
    setJourneyRiverId(riverId);
    setJourney({ riverId, progress: 0, playing: true });
    issueCommand({ type: "river", riverId });
  };

  const toggleJourney = () => {
    if (!journey || journey.riverId !== journeyRiverId) {
      followRiver(journeyRiverId);
      return;
    }
    if (journey.progress >= journeyPath.length) {
      setJourney({ ...journey, progress: 0, playing: true });
      return;
    }
    setJourney({ ...journey, playing: !journey.playing });
  };

  const resetJourney = () => {
    setJourney(null);
    const origin = ORIGIN_REFERENCES.find(({ riverId }) => riverId === journeyRiverId);
    if (origin) issueCommand({ type: "point", coordinates: origin.coordinates, zoom: 8 });
  };

  const currentJourney = journey?.riverId === journeyRiverId ? journey : null;
  const journeyProgress = currentJourney?.progress || 0;
  const reachedLandmarks = journeyLandmarks.filter(({ index }) => index < journeyProgress);
  const lastReachedLandmark = reachedLandmarks.at(-1);
  const nextLandmark = journeyLandmarks.find(({ index }) => index >= journeyProgress);
  const journeyOrigin = ORIGIN_REFERENCES.find(({ riverId }) => riverId === journeyRiverId);
  const firstJourneyPoint = journeyPath.length ? [journeyPath[0][1], journeyPath[0][0]] : null;
  const sourceToLineGap = journeyOrigin && firstJourneyPoint
    ? distanceKm(journeyOrigin.coordinates, firstJourneyPoint)
    : null;
  const locatedStations = (locationsQuery.data || []).filter((station) => (
    station.latitude != null && station.longitude != null
  ));
  const verifiedSourceIds = new Set(
    (sourcesQuery.data || []).filter((source) => source.provenance_verified).map((source) => source.id),
  );
  const verifiedStationCount = locatedStations.filter((station) => (
    station.source_id != null && verifiedSourceIds.has(station.source_id)
  )).length;
  const unverifiedStationCount = locatedStations.length - verifiedStationCount;

  return (
    <div className="river-explorer-page">
      <header className="river-explorer-heading">
        <div>
          <span className="explorer-kicker">RiverMemory · geographic journeys</span>
          <h1>River Explorer</h1>
          <p>Explore selected mapped river courses, places and the Triveni Sangam—without filling gaps with invented lines.</p>
        </div>
        <div className="river-explorer-heading-actions">
          <button type="button" className="btn btn-teal" onClick={showSangam}>View Triveni Sangam</button>
          <button type="button" className="btn btn-ghost" onClick={showWorld}>Reset to world view</button>
        </div>
      </header>

      <div className={`river-explorer-workspace${panelCollapsed ? " is-collapsed" : ""}`}>
        {!panelCollapsed && (
          <aside className="river-explorer-sidebar" aria-label="River Explorer controls">
            <div className="river-sidebar-top">
              <h2>Explore the map</h2>
              <button type="button" className="btn btn-small btn-ghost" onClick={() => setPanelCollapsed(true)}>
                Hide panel
              </button>
            </div>

            <div className="river-search">
              <label htmlFor="river-search-input">Search rivers, countries or cities</label>
              <input
                id="river-search-input"
                type="search"
                value={query}
                placeholder="Try Yamuna, India, or Varanasi"
                role="combobox"
                aria-expanded={searchOpen && !!query.trim()}
                aria-controls="river-search-results"
                aria-autocomplete="list"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setSearchOpen(false);
                }}
              />
              {searchOpen && query.trim() && (
                <ul id="river-search-results" className="river-search-results" role="listbox" aria-label="Search results">
                  {searchResults.map((result) => (
                    <li key={`${result.type}-${result.id}`}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => result.type === "river" ? selectRiver(result.id) : selectCity(result.city)}
                      >
                        <strong>{result.label}</strong>
                        <span>{result.type === "river" ? "River system" : result.detail}</span>
                      </button>
                    </li>
                  ))}
                  {!searchResults.length && <li className="river-search-empty">No matching mapped river or nearby city.</li>}
                </ul>
              )}
            </div>

            <section className="river-control-group" aria-labelledby="river-layer-title">
              <div className="explorer-section-heading">
                <span className="explorer-kicker">Independent overlays</span>
                <h2 id="river-layer-title">River lines</h2>
              </div>
              {RIVERS.map((river) => {
                const hasGeometry = availableRiverIds.has(river.id);
                return (
                  <div className="river-layer-row" key={river.id}>
                    <Toggle
                      checked={!!riverVisibility[river.id]}
                      disabled={!hasGeometry}
                      hint={!hasGeometry ? "Route not in dataset" : undefined}
                      onChange={() => setRiverVisibility((previous) => ({
                        ...previous,
                        [river.id]: !previous[river.id],
                      }))}
                    >
                      <span className="river-line-swatch" style={{
                        "--river-color": river.color,
                        "--river-dash": river.dashArray ? "dashed" : "solid",
                      }} />
                      {river.name}
                    </Toggle>
                    {!hasGeometry && (
                      <button type="button" className="river-info-button" onClick={() => selectRiver(river.id, false)}>
                        Info
                      </button>
                    )}
                  </div>
                );
              })}
            </section>

            <section className="river-control-group" aria-labelledby="map-layer-title">
              <div className="explorer-section-heading">
                <span className="explorer-kicker">Context and places</span>
                <h2 id="map-layer-title">Map layers</h2>
              </div>
              <Toggle checked={layers.origins} onChange={() => updateLayer("origins")}>River source-region references</Toggle>
              <Toggle checked={layers.confluences} onChange={() => updateLayer("confluences")}>Geographic confluence / Sangam</Toggle>
              <Toggle checked={layers.saraswati} onChange={() => updateLayer("saraswati")}>Saraswati tradition &amp; hypotheses</Toggle>
              <Toggle checked={layers.associated} onChange={() => updateLayer("associated")}>Other named system courses</Toggle>
              <Toggle checked={layers.cities} onChange={() => updateLayer("cities")}>Nearby major cities</Toggle>
              <Toggle checked={layers.stations} onChange={() => updateLayer("stations")}>Verified RiverMemory stations</Toggle>
            </section>

            <section className="river-control-group journey-controls" aria-labelledby="follow-river-title">
              <div className="explorer-section-heading">
                <span className="explorer-kicker">Mapped line playback</span>
                <h2 id="follow-river-title">Follow the river</h2>
              </div>
              <label htmlFor="journey-river-select">Choose a mapped route</label>
              <select
                id="journey-river-select"
                value={journeyRiverId}
                onChange={(event) => {
                  setJourneyRiverId(event.target.value);
                  setJourney(null);
                }}
              >
                {RIVERS.filter(({ id }) => availableRiverIds.has(id)).map((river) => (
                  <option value={river.id} key={river.id}>{river.displayName}</option>
                ))}
              </select>
              {currentJourney && (
                <>
                  <div className="journey-progress" role="progressbar" aria-label={`${journeyRiverId} route progress`} aria-valuenow={Math.round(100 * journeyProgress / Math.max(1, journeyPath.length))} aria-valuemin={0} aria-valuemax={100}>
                    <span style={{ width: `${100 * journeyProgress / Math.max(1, journeyPath.length)}%` }} />
                  </div>
                  {lastReachedLandmark ? (
                    <p className="journey-waypoint" aria-live="polite">
                      <strong>Nearby mapped place:</strong> {lastReachedLandmark.city.properties.name}
                      {[lastReachedLandmark.city.properties.region, lastReachedLandmark.city.properties.country].filter(Boolean).length
                        ? ` · ${[lastReachedLandmark.city.properties.region, lastReachedLandmark.city.properties.country].filter(Boolean).join(", ")}`
                        : ""}
                      . This Natural Earth city point is approximately {Math.round(lastReachedLandmark.distanceKm)} km from the generalized route, not a confirmed riverbank location.
                    </p>
                  ) : nextLandmark ? (
                    <p className="journey-waypoint" aria-live="polite">
                      <strong>Next nearby mapped place:</strong> {nextLandmark.city.properties.name}
                      {[nextLandmark.city.properties.region, nextLandmark.city.properties.country].filter(Boolean).length
                        ? ` · ${[nextLandmark.city.properties.region, nextLandmark.city.properties.country].filter(Boolean).join(", ")}`
                        : ""}
                    </p>
                  ) : (
                    <p className="journey-waypoint">No nearby mapped city waypoint is available on this route.</p>
                  )}
                  {sourceToLineGap != null && (
                    <p className="muted small">
                      The first mapped line point is about {Math.round(sourceToLineGap)} km from the place reference; no connector is drawn across missing headwater data.
                    </p>
                  )}
                </>
              )}
              <div className="river-explorer-heading-actions">
                <button type="button" className="btn btn-small btn-teal" disabled={!availableRiverIds.has(journeyRiverId)} onClick={toggleJourney}>
                  {currentJourney?.playing ? "Pause" : currentJourney?.progress >= journeyPath.length ? "Replay" : currentJourney ? "Resume" : "Start journey"}
                </button>
                <button type="button" className="btn btn-small btn-ghost" disabled={!currentJourney} onClick={resetJourney}>
                  Reset
                </button>
              </div>
              <p className="muted small">Playback reveals Natural Earth vertices only. The map does not draw a straight connector to an origin marker.</p>
            </section>

            {layers.saraswati && <SaraswatiContext />}

            {data ? (
              <RiverDetail
                river={selectedRiver}
                features={data.features}
                cities={data.cities}
                hasGeometry={selectedHasGeometry}
              />
            ) : <p className="muted small">Loading river details…</p>}
            {selectedCity && (
              <section className="explorer-detail" aria-labelledby="selected-city-heading">
                <span className="explorer-kicker">Selected nearby place</span>
                <h2 id="selected-city-heading">{selectedCity.properties.name}</h2>
                <p>{[selectedCity.properties.region, selectedCity.properties.country].filter(Boolean).join(", ")}</p>
                <p className="muted small">
                  Natural Earth populated-place coordinates; selected because the city point is within 25 km of a mapped river line. This proximity is not a surveyed riverbank relationship.
                </p>
                <p className="muted small">
                  Coordinate: {selectedCity.geometry.coordinates[1].toFixed(4)}, {selectedCity.geometry.coordinates[0].toFixed(4)}
                </p>
              </section>
            )}

            <section className="river-control-group station-status" aria-labelledby="station-status-title">
              <div className="explorer-section-heading">
                <span className="explorer-kicker">RiverMemory data</span>
                <h2 id="station-status-title">Monitoring stations</h2>
              </div>
              {!layers.stations && <p className="muted small">Enable the station layer to check coordinate and source verification.</p>}
              {layers.stations && (locationsQuery.loading || sourcesQuery.loading) && <p className="muted small">Loading station and source records…</p>}
              {layers.stations && locationsQuery.error && (
                <p className="explorer-error" role="alert">
                  Could not load monitoring locations: {locationsQuery.error.message}
                  <button type="button" className="btn btn-small btn-ghost" onClick={locationsQuery.reload}>Retry</button>
                </p>
              )}
              {layers.stations && !locationsQuery.error && sourcesQuery.error && (
                <p className="explorer-error" role="alert">
                  Could not verify station-source provenance: {sourcesQuery.error.message}
                  <button type="button" className="btn btn-small btn-ghost" onClick={sourcesQuery.reload}>Retry</button>
                </p>
              )}
              {layers.stations && !locationsQuery.loading && !sourcesQuery.loading && !locationsQuery.error && !sourcesQuery.error && (
                <p className="muted small">
                  {verifiedStationCount
                    ? `${verifiedStationCount} station(s) with coordinates and verified source provenance are mapped.`
                    : "No monitoring stations with both coordinates and verified source provenance are available."}
                  {unverifiedStationCount > 0 && ` ${unverifiedStationCount} located station(s) were omitted because their source is not verified.`}
                  {" "}Rainfall reference points and annual ranges are not monitoring-station markers.
                </p>
              )}
            </section>

            <section className="explorer-legend" aria-labelledby="legend-heading">
              <h2 id="legend-heading">Legend</h2>
              {RIVERS.filter(({ id }) => riverVisibility[id] && availableRiverIds.has(id)).map((river) => (
                <div key={river.id}>
                  <span className="river-line-swatch" style={{
                    "--river-color": river.color,
                    "--river-dash": river.dashArray ? "dashed" : "solid",
                  }} />
                  <span>{river.displayName}</span>
                </div>
              ))}
              <div><span className="legend-origin" /> Source-region place reference (not exact headwater)</div>
              <div><span className="legend-confluence" /> Triveni Sangam locality marker</div>
              <div><span className="legend-city" /> Nearby Natural Earth city</div>
              <div><span className="legend-station" /> Verified monitoring station</div>
            </section>

            <section className="explorer-sources" aria-labelledby="map-source-heading">
              <h2 id="map-source-heading">Map sources &amp; limits</h2>
              <p>
                River lines and nearby major places: <a href="https://github.com/nvkelso/natural-earth-vector/tree/ca96624a56bd078437bca8184e78163e5039ad19" target="_blank" rel="noreferrer">Natural Earth 1:10m</a>, public domain. Selected named rivers only—not a complete global network.
              </p>
              <p>
                Basemap: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>. Source-region and Sangam locality markers link to their OpenStreetMap records.
              </p>
              {data?.metadata && <p className="muted small">{data.metadata.geometryNote}</p>}
              <p><Link to="/map">Open monitoring locations &amp; incident map →</Link></p>
            </section>
          </aside>
        )}

        <section className="river-explorer-map-panel" aria-label="Interactive river map">
          {panelCollapsed && (
            <button type="button" className="river-panel-reopen btn btn-small" onClick={() => setPanelCollapsed(false)}>
              Show map controls
            </button>
          )}
          {dataError && (
            <div className="map-data-error" role="alert">
              <strong>River geography could not be loaded.</strong>
              <span>{dataError.message}</span>
              <button type="button" className="btn btn-small btn-ghost" onClick={() => window.location.reload()}>Reload map</button>
            </div>
          )}
          {tileError && (
            <div className="map-tile-warning" role="status">
              Some OpenStreetMap tiles did not load. The river lines and markers can still be explored.
              <button type="button" aria-label="Dismiss map tile warning" onClick={() => setTileError(false)}>×</button>
            </div>
          )}
          {!data && !dataError && <div className="map-data-loading" role="status">Loading selected river geography…</div>}
          <RiverMap
            data={data}
            command={command}
            selectedRiverId={selectedRiverId}
            mainFeatures={mainFeatures}
            associatedFeatures={associatedFeatures}
            journeyPath={journeyPath}
            journeyProgress={currentJourney?.progress || 0}
            visibleRiverIds={visibleRiverIds}
            layers={layers}
            locations={locationsQuery.data || []}
            sources={sourcesQuery.data || []}
            onTileError={() => setTileError(true)}
            onSelectCity={selectCity}
          />
        </section>
      </div>
    </div>
  );
}
