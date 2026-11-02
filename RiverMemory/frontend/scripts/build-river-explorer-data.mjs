import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REVISION = "ca96624a56bd078437bca8184e78163e5039ad19";
const BASE_URL = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${REVISION}/geojson`;
const DESTINATION = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/data/river-explorer.geojson");
const GROUPS = [
  ["ganga", ["ganges"]],
  ["yamuna", ["yamuna"]],
  ["brahmaputra", ["brahmaputra"]],
  ["indus", ["indus"]],
  ["godavari", ["godavari"]],
  ["krishna", ["krishna"]],
  ["narmada", ["narmada"]],
  ["nile", ["nile"]],
  ["amazon", ["amazon"]],
  ["mississippi", ["mississippi"]],
  ["missouri", ["missouri"]],
  ["yangtze", ["yangtze"]],
  ["mekong", ["mekong"]],
  ["danube", ["danube"]],
  ["thames", ["thames"]],
];
const MAX_CITY_DISTANCE_KM = 25;

async function loadGeoJson(filename) {
  const response = await fetch(`${BASE_URL}/${filename}`);
  if (!response.ok) throw new Error(`Could not download ${filename}: HTTP ${response.status}`);
  return response.json();
}

function lineStrings(geometry) {
  if (geometry?.type === "LineString") return [geometry.coordinates];
  if (geometry?.type === "MultiLineString") return geometry.coordinates;
  return [];
}

function groupForFeature(feature) {
  const names = ["name", "name_en", "name_alt"]
    .map((key) => feature.properties?.[key])
    .filter(Boolean)
    .map((name) => String(name).toLowerCase());
  return GROUPS.find(([, tokens]) => tokens.some((token) => names.some((name) => name.includes(token))))?.[0];
}

function distanceToLineKm(point, lines) {
  const [longitude, latitude] = point;
  let minimum = Infinity;
  for (const line of lines) {
    for (let index = 1; index < line.length; index += 1) {
      const start = line[index - 1];
      const end = line[index];
      const midpointLatitude = (start[1] + end[1] + latitude) / 3;
      const longitudeScale = 111.32 * Math.cos((midpointLatitude * Math.PI) / 180);
      const startX = (start[0] - longitude) * longitudeScale;
      const startY = (start[1] - latitude) * 111.32;
      const deltaX = (end[0] - start[0]) * longitudeScale;
      const deltaY = (end[1] - start[1]) * 111.32;
      const lengthSquared = deltaX * deltaX + deltaY * deltaY;
      const fraction = lengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, -(startX * deltaX + startY * deltaY) / lengthSquared));
      const distance = Math.hypot(startX + fraction * deltaX, startY + fraction * deltaY);
      if (distance < minimum) minimum = distance;
    }
  }
  return minimum;
}

function labelForPlace(properties) {
  const name = properties.NAME_EN || properties.NAMEASCII || properties.NAME;
  return name === "Allahabad" ? "Allahabad / Prayagraj" : name;
}

const [riverSource, placeSource] = await Promise.all([
  loadGeoJson("ne_10m_rivers_lake_centerlines.geojson"),
  loadGeoJson("ne_10m_populated_places.geojson"),
]);

const riverFeatures = riverSource.features
  .map((feature) => ({ feature, riverId: groupForFeature(feature) }))
  .filter(({ riverId }) => riverId)
  .map(({ feature, riverId }) => ({
    type: "Feature",
    properties: {
      river_id: riverId,
      name: feature.properties.name || feature.properties.name_en || "Unnamed mapped course",
      name_en: feature.properties.name_en || feature.properties.name || "Unnamed mapped course",
      scalerank: feature.properties.scalerank,
    },
    geometry: feature.geometry,
  }));

const routeLines = new Map(GROUPS.map(([id]) => {
  const lines = riverFeatures.filter((feature) => feature.properties.river_id === id)
    .flatMap((feature) => lineStrings(feature.geometry));
  const extent = { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity };
  for (const line of lines) {
    for (const [longitude, latitude] of line) {
      extent.minLon = Math.min(extent.minLon, longitude);
      extent.maxLon = Math.max(extent.maxLon, longitude);
      extent.minLat = Math.min(extent.minLat, latitude);
      extent.maxLat = Math.max(extent.maxLat, latitude);
    }
  }
  return [id, { lines, extent }];
}));

const cityCandidates = placeSource.features
  .filter((feature) => Number(feature.properties.SCALERANK) <= 5 && feature.geometry?.type === "Point")
  .map((feature) => {
    const [longitude, latitude] = feature.geometry.coordinates;
    const nearbyRivers = [];
    for (const [riverId, { lines, extent }] of routeLines) {
      if (!lines.length) continue;
      const roughExtentMatch = longitude >= extent.minLon - 1 && longitude <= extent.maxLon + 1
        && latitude >= extent.minLat - 0.5 && latitude <= extent.maxLat + 0.5;
      if (!roughExtentMatch) continue;
      const distance = distanceToLineKm(feature.geometry.coordinates, lines);
      if (distance <= MAX_CITY_DISTANCE_KM) nearbyRivers.push({ riverId, distance });
    }
    return { feature, nearbyRivers };
  })
  .filter(({ nearbyRivers }) => nearbyRivers.length > 0);

const chosenCities = new Map();
for (const [riverId] of GROUPS) {
  const matches = cityCandidates
    .filter(({ nearbyRivers }) => nearbyRivers.some((river) => river.riverId === riverId))
    .sort((left, right) => left.nearbyRivers.find((river) => river.riverId === riverId).distance
      - right.nearbyRivers.find((river) => river.riverId === riverId).distance);
  for (const { feature, nearbyRivers } of matches) {
    const properties = feature.properties;
    const name = labelForPlace(properties);
    if (!name || !properties.ADM0NAME) continue;
    const existing = chosenCities.get(name + properties.ADM0NAME);
    const record = {
      type: "Feature",
      properties: {
        name,
        country: properties.ADM0NAME,
        region: properties.ADM1NAME || null,
        river_ids: nearbyRivers.map(({ riverId: id }) => id),
      },
      geometry: feature.geometry,
    };
    if (!existing) chosenCities.set(name + properties.ADM0NAME, record);
    else existing.properties.river_ids = [...new Set([...existing.properties.river_ids, ...record.properties.river_ids])];
  }
}

const output = {
  type: "FeatureCollection",
  metadata: {
    source: "Natural Earth 1:10m Rivers + Lake Centerlines and Populated Places",
    sourceUrl: "https://github.com/nvkelso/natural-earth-vector",
    revision: REVISION,
    license: "Public domain",
    rivers: "Selected named major-river features only; this is not a complete global river network.",
    citySelection: `Natural Earth populated places within ${MAX_CITY_DISTANCE_KM} km of selected mapped river lines.`,
    geometryNote: "Natural Earth generalized cartographic geometry; it does not encode verified river lengths, exact hydrological source points, mouth attributes, or tributary relationships.",
  },
  features: riverFeatures,
  cities: [...chosenCities.values()].sort((left, right) => left.properties.name.localeCompare(right.properties.name)),
};

await mkdir(path.dirname(DESTINATION), { recursive: true });
await writeFile(DESTINATION, `${JSON.stringify(output)}\n`, "utf8");

const counts = Object.fromEntries(GROUPS.map(([id]) => [
  id,
  riverFeatures.filter((feature) => feature.properties.river_id === id).length,
]));
console.log(`Wrote ${riverFeatures.length} river features and ${output.cities.length} nearby city points.`);
console.log(`Geometry available: ${Object.entries(counts).filter(([, count]) => count).map(([id]) => id).join(", ")}`);
console.log(`No mapped feature for: ${Object.entries(counts).filter(([, count]) => !count).map(([id]) => id).join(", ")}`);
console.log(DESTINATION);
