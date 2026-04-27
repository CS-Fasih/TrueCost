import { describe, expect, it } from "vitest";
import { parseProductUrl, productIdFromParsed } from "../src/utils/urlParser";

describe("parseProductUrl", () => {
  it("parses Amazon ASIN links", () => {
    const parsed = parseProductUrl("https://www.amazon.com/Example-Product/dp/B08N5WRWNW?tag=tracking");
    expect(parsed.site).toBe("amazon");
    expect(parsed.externalId).toBe("B08N5WRWNW");
    expect(parsed.canonicalUrl).toBe("https://amazon.com/dp/B08N5WRWNW");
  });

  it("parses Flipkart pid links", () => {
    const parsed = parseProductUrl("https://www.flipkart.com/phone/p/itm123?pid=MOBABC123");
    expect(parsed.site).toBe("flipkart");
    expect(parsed.externalId).toBe("MOBABC123");
  });

  it("creates stable product ids", () => {
    const first = productIdFromParsed(parseProductUrl("https://www.amazon.com/dp/B08N5WRWNW"));
    const second = productIdFromParsed(parseProductUrl("https://amazon.com/dp/B08N5WRWNW?ref_=x"));
    expect(first).toBe(second);
  });
});
