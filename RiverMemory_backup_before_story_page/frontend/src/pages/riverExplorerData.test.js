import { describe, expect, it } from "vitest";
import {
  buildJourneyPath,
  distanceKm,
  getJourneyLandmarks,
  ORIGIN_REFERENCES,
  RIVERS,
  TRIVENI_SANGAM,
} from "./riverExplorerData";

describe("river explorer geography helpers", () => {
  it("uses a supplied place coordinate without treating it as the river line", () => {
    const origin = ORIGIN_REFERENCES.find((place) => place.id === "yamunotri");
    const features = [{
      properties: { river_id: "yamuna" },
      geometry: {
        type: "MultiLineString",
        coordinates: [
          [[78.4, 31], [78.3, 30]],
          [[78.3, 30], [79, 29]],
        ],
      },
    }];

    expect(buildJourneyPath(features, "yamuna", origin.coordinates)).toEqual([
      [78.4, 31],
      [78.3, 30],
      [79, 29],
    ]);
  });

  it("does not bridge a missing or disconnected route segment", () => {
    const features = [{
      properties: { river_id: "ganga" },
      geometry: {
        type: "MultiLineString",
        coordinates: [
          [[80, 30], [80.1, 29.9]],
          [[82, 27], [82.1, 26.9]],
        ],
      },
    }];

    const path = buildJourneyPath(features, "ganga", [30, 80]);

    expect(path).toEqual([[80, 30], [80.1, 29.9]]);
    expect(path).not.toContainEqual([82, 27]);
  });

  it("does not mutate source coordinates when orienting a journey", () => {
    const coordinates = [[80, 30], [80.1, 29.9]];
    const features = [{
      properties: { river_id: "ganga" },
      geometry: { type: "LineString", coordinates },
    }];

    expect(buildJourneyPath(features, "ganga", [29.9, 80.1])).toEqual([[80.1, 29.9], [80, 30]]);
    expect(coordinates).toEqual([[80, 30], [80.1, 29.9]]);
  });

  it("orders nearby city waypoints along the mapped journey", () => {
    const path = [[80, 30], [81, 29], [82, 28]];
    const cities = [
      {
        properties: { river_ids: ["ganga"], name: "Downstream" },
        geometry: { coordinates: [82, 28] },
      },
      {
        properties: { river_ids: ["ganga"], name: "Upstream" },
        geometry: { coordinates: [80, 30] },
      },
      {
        properties: { river_ids: ["yamuna"], name: "Other river" },
        geometry: { coordinates: [81, 29] },
      },
    ];

    expect(getJourneyLandmarks(cities, "ganga", path).map(({ city }) => city.properties.name))
      .toEqual(["Upstream", "Downstream"]);
  });

  it("keeps the Sangam marker separate from rainfall-reference coordinates", () => {
    expect(TRIVENI_SANGAM.coordinates).toEqual([25.4222299, 81.8923259]);
    expect(distanceKm(TRIVENI_SANGAM.coordinates, [25.4358, 81.8463])).toBeGreaterThan(0);
  });

  it("provides an information entry without a route for Godavari", () => {
    expect(RIVERS.find((river) => river.id === "godavari").name).toBe("Godavari");
    expect(buildJourneyPath([], "godavari")).toEqual([]);
  });
});
