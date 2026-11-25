import { test, expect } from "vitest";
import { newer } from "../src/update";
test("sürüm karşılaştırma", () => {
  expect(newer("0.1.12", "0.1.9")).toBe(true);
  expect(newer("0.1.9", "0.1.12")).toBe(false);
  expect(newer("0.2.0", "0.1.99")).toBe(true);
  expect(newer("0.1.5", "0.1.5")).toBe(false);
  expect(newer("0.1.1", "0.1.0-dev")).toBe(true);
});
