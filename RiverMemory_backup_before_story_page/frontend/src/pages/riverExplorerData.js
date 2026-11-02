export const RIVERS = [
  {
    id: "ganga",
    name: "Ganga",
    displayName: "Ganga (Ganges)",
    aliases: ["Ganges"],
    color: "#087f70",
    dashArray: null,
    coreNames: ["ganges"],
    originId: "gangotri",
    description: "The Natural Earth Ganges line is generalized and begins downstream of the Gangotri place marker. It is not a complete glacier-to-delta headwater survey.",
    reference: "https://www.britannica.com/place/Ganges-River",
  },
  {
    id: "yamuna",
    name: "Yamuna",
    displayName: "Yamuna",
    aliases: ["Jamuna"],
    color: "#175db5",
    dashArray: "8 6",
    coreNames: ["yamuna"],
    originId: "yamunotri",
    description: "A generalized Natural Earth Yamuna line passes through northern India to the Prayagraj area. The Yamunotri marker is a settlement reference, not the exact glacier headwater.",
    reference: "https://www.britannica.com/place/Yamuna-River",
  },
  {
    id: "brahmaputra",
    name: "Brahmaputra",
    displayName: "Brahmaputra",
    aliases: ["Yarlung", "Tsangpo"],
    color: "#c75b12",
    dashArray: "3 5",
    coreNames: ["brahmaputra", "yarlung"],
    reference: "https://www.britannica.com/place/Brahmaputra-River",
  },
  {
    id: "indus",
    name: "Indus",
    displayName: "Indus",
    aliases: [],
    color: "#7542a5",
    dashArray: "10 5",
    coreNames: ["indus"],
    reference: "https://www.britannica.com/place/Indus-River",
  },
  {
    id: "godavari",
    name: "Godavari",
    displayName: "Godavari",
    aliases: [],
    color: "#a84d63",
    dashArray: "4 5",
    coreNames: ["godavari"],
    reference: "https://www.britannica.com/place/Godavari-River",
  },
  {
    id: "krishna",
    name: "Krishna",
    displayName: "Krishna",
    aliases: [],
    color: "#9b6800",
    dashArray: "7 4",
    coreNames: ["krishna"],
    reference: "https://www.britannica.com/place/Krishna-River",
  },
  {
    id: "narmada",
    name: "Narmada",
    displayName: "Narmada",
    aliases: [],
    color: "#256c9a",
    dashArray: "2 4",
    coreNames: ["narmada"],
    reference: "https://www.britannica.com/place/Narmada-River",
  },
  {
    id: "nile",
    name: "Nile",
    displayName: "Nile system",
    aliases: ["White Nile", "Blue Nile", "Victoria Nile", "Albert Nile"],
    color: "#007d86",
    dashArray: null,
    coreNames: ["nile"],
    reference: "https://www.britannica.com/place/Nile-River",
  },
  {
    id: "amazon",
    name: "Amazon",
    displayName: "Amazon",
    aliases: ["Amazonas"],
    color: "#47813d",
    dashArray: "8 4",
    coreNames: ["amazon"],
    reference: "https://www.britannica.com/place/Amazon-River",
  },
  {
    id: "mississippi",
    name: "Mississippi",
    displayName: "Mississippi",
    aliases: ["Mississippi–Missouri"],
    color: "#455fa1",
    dashArray: null,
    coreNames: ["mississippi"],
    reference: "https://www.britannica.com/place/Mississippi-River",
  },
  {
    id: "missouri",
    name: "Missouri",
    displayName: "Missouri",
    aliases: ["Mississippi–Missouri"],
    color: "#79539c",
    dashArray: "9 4",
    coreNames: ["missouri"],
    reference: "https://www.britannica.com/place/Missouri-River",
  },
  {
    id: "yangtze",
    name: "Yangtze",
    displayName: "Yangtze",
    aliases: ["Chang Jiang", "Jinsha"],
    color: "#b94f10",
    dashArray: "3 4",
    coreNames: ["yangtze", "jinsha", "chang jiang"],
    reference: "https://www.britannica.com/place/Yangtze-River",
  },
  {
    id: "mekong",
    name: "Mekong",
    displayName: "Mekong",
    aliases: ["Lancang"],
    color: "#a33c7a",
    dashArray: "11 5",
    coreNames: ["mekong", "lancang"],
    reference: "https://www.britannica.com/place/Mekong-River",
  },
  {
    id: "danube",
    name: "Danube",
    displayName: "Danube",
    aliases: ["Donau"],
    color: "#2c6e91",
    dashArray: "5 3",
    coreNames: ["danube", "donau"],
    reference: "https://www.britannica.com/place/Danube-River",
  },
  {
    id: "thames",
    name: "Thames",
    displayName: "Thames",
    aliases: [],
    color: "#616161",
    dashArray: "2 5",
    coreNames: ["thames"],
    reference: "https://www.britannica.com/place/Thames-River",
  },
];

export const ORIGIN_REFERENCES = [
  {
    id: "gangotri",
    riverId: "ganga",
    name: "Gangotri town",
    label: "Ganga source-region place reference",
    coordinates: [30.9943684, 78.9398699],
    note: "OpenStreetMap place marker in the Gangotri region; not the exact glacier headwater.",
    url: "https://www.openstreetmap.org/node/342110021",
  },
  {
    id: "yamunotri",
    riverId: "yamuna",
    name: "Yamunotri",
    label: "Yamuna source-region place reference",
    coordinates: [30.999214, 78.4626951],
    note: "OpenStreetMap settlement marker in the Yamunotri region; not the exact glacier headwater.",
    url: "https://www.openstreetmap.org/node/342112741",
  },
];

export const TRIVENI_SANGAM = {
  id: "triveni-sangam",
  name: "Triveni Sangam, Prayagraj",
  coordinates: [25.4222299, 81.8923259],
  url: "https://www.openstreetmap.org/node/958479027",
  osmId: 958479027,
};

const EARTH_RADIUS_KM = 6371;
const MAX_PATH_JOIN_KM = 2;

export function distanceKm(first, second) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const [firstLat, firstLon] = first;
  const [secondLat, secondLon] = second;
  const latitudeDelta = radians(secondLat - firstLat);
  const longitudeDelta = radians(secondLon - firstLon);
  const arc = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(firstLat)) * Math.cos(radians(secondLat)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(arc));
}

function lineLengthKm(coordinates) {
  return coordinates.slice(1).reduce(
    (length, point, index) => length + distanceKm(
      [coordinates[index][1], coordinates[index][0]],
      [point[1], point[0]],
    ),
    0,
  );
}

function linesFromFeature(feature) {
  if (feature.geometry?.type === "LineString") return [feature.geometry.coordinates];
  if (feature.geometry?.type === "MultiLineString") return feature.geometry.coordinates;
  return [];
}

export function buildJourneyPath(features, riverId, originCoordinates) {
  const remaining = features
    .filter((feature) => feature.properties.river_id === riverId)
    .flatMap(linesFromFeature)
    .filter((line) => line.length > 1)
    .map((coordinates) => {
      const copy = coordinates.map(([longitude, latitude]) => [longitude, latitude]);
      return { coordinates: copy, length: lineLengthKm(copy) };
    });
  if (!remaining.length) return [];

  let startingIndex = 0;
  let reverseStart = false;
  if (originCoordinates) {
    let nearestDistance = Infinity;
    remaining.forEach(({ coordinates }, index) => {
      const startDistance = distanceKm(
        originCoordinates,
        [coordinates[0][1], coordinates[0][0]],
      );
      const endDistance = distanceKm(
        originCoordinates,
        [coordinates.at(-1)[1], coordinates.at(-1)[0]],
      );
      if (Math.min(startDistance, endDistance) < nearestDistance) {
        nearestDistance = Math.min(startDistance, endDistance);
        startingIndex = index;
        reverseStart = endDistance < startDistance;
      }
    });
  } else {
    startingIndex = remaining.reduce(
      (longest, line, index) => line.length > remaining[longest].length ? index : longest,
      0,
    );
  }

  const [first] = remaining.splice(startingIndex, 1);
  if (reverseStart) first.coordinates.reverse();
  const path = [...first.coordinates];

  while (remaining.length) {
    const tail = path.at(-1);
    let candidateIndex = -1;
    let candidateDistance = Infinity;
    let candidateReverse = false;
    remaining.forEach(({ coordinates, length }, index) => {
      const startDistance = distanceKm([tail[1], tail[0]], [coordinates[0][1], coordinates[0][0]]);
      const endDistance = distanceKm([tail[1], tail[0]], [coordinates.at(-1)[1], coordinates.at(-1)[0]]);
      const distance = Math.min(startDistance, endDistance);
      if (distance <= MAX_PATH_JOIN_KM
        && (candidateIndex < 0 || distance < candidateDistance
          || (distance === candidateDistance && length > remaining[candidateIndex].length))) {
        candidateIndex = index;
        candidateDistance = distance;
        candidateReverse = endDistance < startDistance;
      }
    });
    if (candidateIndex < 0) break;
    const [next] = remaining.splice(candidateIndex, 1);
    if (candidateReverse) next.coordinates.reverse();
    path.push(...next.coordinates.slice(1));
  }
  return path;
}

export function getJourneyLandmarks(cities, riverId, path) {
  if (path.length < 2) return [];

  return cities
    .filter((city) => city.properties.river_ids.includes(riverId))
    .map((city) => {
      const [longitude, latitude] = city.geometry.coordinates;
      let nearestIndex = -1;
      let nearestDistance = Infinity;
      path.forEach(([pathLongitude, pathLatitude], index) => {
        const distance = distanceKm([latitude, longitude], [pathLatitude, pathLongitude]);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });
      return { city, index: nearestIndex, distanceKm: nearestDistance };
    })
    .filter((landmark) => landmark.distanceKm <= 25)
    .sort((first, second) => first.index - second.index);
}

export function riverFeatureName(feature) {
  return String(feature.properties.name_en || feature.properties.name || "").toLowerCase();
}
