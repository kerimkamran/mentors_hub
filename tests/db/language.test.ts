import { describe, expect, it } from "vitest";
import { normalise } from "../../src/lib/search";
import { OWNER_URL, connect } from "./helpers";

const SAMPLES = [
  "Məmmədov", "MƏMMƏDOV", "Hüseynov", "Əliyev", "Şahin", "ŞAHİN", "Çərkəz", "Göyçay", "Ğ", "Ibrahim", "ılgaz",
  "İsmayıl", "Öztürk", "Ёлкин", "ёлка", "Иванов", "Mammadov", "x", "",
];

describe("Language spike · Azerbaijani and Russian", () => {
  it("search normalisation folds ə/e, ı/i, ö/o, ü/u, ç/c, ş/s, ğ/g, ё/е (Plan §8 rule)", () => {
    expect(normalise("Məmmədov")).toBe(normalise("memmedov"));
    expect(normalise("Şahin Göyçay")).toBe("sahin goycay");
    // KNOWN GAP (OQ-B1-49): the Plan's example "mammadov" finds Məmmədov needs ə↔a, which the written rule (ə/e) does not give.
    expect(normalise("Ёлкин")).toBe(normalise("елкин"));
  });

  it("SQL mh_normalise and TypeScript normalise are identical (NFR: identical in database and app)", async () => {
    const c = await connect(OWNER_URL);
    for (const s of SAMPLES) {
      const r = await c.query("SELECT mh_normalise($1) AS n", [s]);
      expect(r.rows[0].n, `sample ${JSON.stringify(s)}`).toBe(normalise(s));
    }
    await c.end();
  });

  it("Azerbaijani collation puts ç after c, ə after e, ğ after g, ö after o, ş after s, ü after u", async () => {
    const c = await connect(OWNER_URL);
    const r = await c.query<{ v: string }>(
      `SELECT v FROM unnest(ARRAY['ş','s','t','ç','c','d','ə','e','f','ğ','g','h','ö','o','p','ü','u','v']) AS v
       ORDER BY v COLLATE az_ai`,
    );
    expect(r.rows.map((x) => x.v).join("")).toBe("cçdeəfgğhoöpsştuüv");
    await c.end();
  });

  it("Azerbaijani case-insensitive comparison treats dotted and dotless I correctly", async () => {
    const c = await connect(OWNER_URL);
    const r = await c.query(
      `SELECT ('İ' = 'i' COLLATE az_ci) AS dotted, ('I' = 'ı' COLLATE az_ci) AS dotless, ('I' = 'i' COLLATE az_ci) AS mixed`,
    );
    expect(r.rows[0]).toEqual({ dotted: true, dotless: true, mixed: false });
    await c.end();
  });

  it("Russian collation sorts the alphabet in order and ё equals е at the first level", async () => {
    const c = await connect(OWNER_URL);
    const r = await c.query<{ v: string }>(`SELECT v FROM unnest(ARRAY['я','а','ё','е','ж','б']) AS v ORDER BY v COLLATE ru_ai`);
    expect(r.rows.map((x) => x.v).join("")).toBe("абеёжя");
    const eq = await c.query(`SELECT ('ё' = 'е' COLLATE ru_ci) AS same`);
    expect(eq.rows[0].same).toBe(true);
    await c.end();
  });
});
