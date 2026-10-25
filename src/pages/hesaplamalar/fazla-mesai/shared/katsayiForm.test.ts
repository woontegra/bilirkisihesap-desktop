import { describe, expect, it } from "vitest";
import { parseDecimalKatsayi } from "./katsayiForm";
import { parseKatsayi as donemsel } from "../donemsel/engine";
import { parseKatsayi as donemselHaftalik } from "../donemsel-haftalik/engine";
import { parseKatsayi as haftalikKarma } from "../haftalik-karma/engine";
import { parseKatsayi as gemi724 } from "../gemi-adami-7-24/engine";

describe("parseDecimalKatsayi", () => {
  it("reads dot as decimal", () => {
    expect(parseDecimalKatsayi("1.131")).toBe(1.131);
    expect(parseDecimalKatsayi(1.131)).toBe(1.131);
    expect(parseDecimalKatsayi("2")).toBe(2);
  });

  it("accepts Turkish comma input", () => {
    expect(parseDecimalKatsayi("1,131")).toBe(1.131);
    expect(parseDecimalKatsayi("1.234,5")).toBe(1234.5);
  });

  it("falls back to 1 for empty, invalid or non-positive values", () => {
    expect(parseDecimalKatsayi("")).toBe(1);
    expect(parseDecimalKatsayi("abc")).toBe(1);
    expect(parseDecimalKatsayi("0")).toBe(1);
    expect(parseDecimalKatsayi("-2")).toBe(1);
    expect(parseDecimalKatsayi(undefined)).toBe(1);
  });
});

describe.each([
  ["Dönemsel", donemsel],
  ["Dönemsel Haftalık", donemselHaftalik],
  ["Haftalık Karma", haftalikKarma],
  ["Gemi 7/24", gemi724],
])("%s parseKatsayi", (_name, parse) => {
  it("does not read 1.131 as 1131", () => {
    expect(parse("1.131")).toBe(1.131);
    expect(parse("1,131")).toBe(1.131);
    expect(parse("1")).toBe(1);
    expect(parse("")).toBe(1);
  });
});
