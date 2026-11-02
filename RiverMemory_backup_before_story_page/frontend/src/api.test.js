import { describe, expect, it } from "vitest";
import { qs } from "./api";

describe("qs", () => {
  it("drops empty values and encodes the rest", () => {
    expect(qs({ a: "1", b: "", c: undefined, d: null, e: "x y" })).toBe("?a=1&e=x+y");
  });
  it("returns an empty string with no params", () => {
    expect(qs({})).toBe("");
  });
});
