import { describe, expect, it } from "vitest";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import { uz } from "../i18n/uz";

describe("translations", () => {
  const keys = Object.keys(en).sort();

  it.each([
    ["ko", ko],
    ["uz", uz],
  ])("%s has exactly the English keys", (_name, dict) => {
    expect(Object.keys(dict).sort()).toEqual(keys);
  });

  it.each([
    ["ko", ko],
    ["uz", uz],
  ])("%s has no empty strings", (_name, dict) => {
    for (const value of Object.values(dict)) expect(value.trim()).not.toBe("");
  });

  it("uses the proper Uzbek modifier letter, not a straight quote", () => {
    for (const value of Object.values(uz)) expect(value).not.toMatch(/[oOgG]['‘`´]/);
  });
});
