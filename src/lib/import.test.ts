import { describe, expect, it } from "vitest";
import { TEMPLATE_CSV, mapHeader, parseCsv, parseDate, parseRows } from "./import";

describe("import", () => {
  it("parses quoted csv", () => expect(parseCsv('a,b\r\n"x, y","he said ""hi"""\n')).toEqual([["a", "b"], ["x, y", 'he said "hi"']]));
  it("maps header aliases", () => expect(mapHeader(["Member Name", "Mobile", "Expiry Date", "Fees", "x"])).toEqual(["name", "phone", "end", "paid", null]));
  it("parses Indian and ISO dates", () => {
    expect(parseDate("31/01/2026")?.getDate()).toBe(31);
    expect(parseDate("2026-01-31")?.getMonth()).toBe(0);
    expect(parseDate("1/31/2026")?.getDate()).toBe(31);
    expect(parseDate("31/02/2026")).toBeNull();
  });
  it("validates rows from the template", () => {
    const r = parseRows(parseCsv(TEMPLATE_CSV));
    expect(r.unknownHeader).toBe(false);
    expect(r.rows[0]).toMatchObject({ name: "Rahul Sharma", phone: "+919876543210", gender: "MALE", plan: "Monthly", paidPaise: 150000, errors: [] });
    const bad = parseRows([["name", "phone", "end", "start"], ["", "12", "2026-01-01", "2026-02-01"]]).rows[0];
    expect(bad.errors).toEqual(["name missing", 'bad phone "12"', "end before start"]);
  });
});
