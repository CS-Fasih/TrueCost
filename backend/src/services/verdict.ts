import type { PricePoint, Verdict } from "../types";

const SALE_SEASON_DATES = [
  "01-01",
  "03-03",
  "06-06",
  "07-15",
  "09-09",
  "10-10",
  "11-11",
  "11-27",
  "12-12",
  "12-26"
];

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export function daysUntilNextSaleSeason(now: Date, saleDates = SALE_SEASON_DATES): number {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const candidates = saleDates.flatMap((monthDay) => {
    const [month, day] = monthDay.split("-").map(Number);
    return [now.getUTCFullYear(), now.getUTCFullYear() + 1].map((year) => Date.UTC(year, month - 1, day));
  });
  const next = candidates.filter((candidate) => candidate >= today).sort((a, b) => a - b)[0];
  return Math.floor((next - today) / 86_400_000);
}

export function computeVerdict(
  currentPrice: number,
  history: PricePoint[],
  saleSeasonWindowDays: number,
  now = new Date()
): Verdict {
  const prices = [...history.map((point) => point.price), currentPrice].filter(
    (price) => Number.isFinite(price) && price > 0
  );

  const rangeLow = prices.length ? Math.min(...prices) : currentPrice;
  const rangeHigh = prices.length ? Math.max(...prices) : currentPrice;
  const averagePrice = prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : currentPrice;
  const span = rangeHigh - rangeLow;

  if (span <= 0) {
    return {
      label: "🟡 Fair Price",
      tone: "fair",
      reason: "There is not enough price movement yet to call this a strong deal.",
      currentPrice: roundMoney(currentPrice),
      averagePrice: roundMoney(averagePrice),
      rangeLow: roundMoney(rangeLow),
      rangeHigh: roundMoney(rangeHigh)
    };
  }

  const bottomCutoff = rangeLow + span * 0.2;
  const topCutoff = rangeHigh - span * 0.2;
  const daysUntilSale = daysUntilNextSaleSeason(now);

  if (daysUntilSale <= saleSeasonWindowDays && currentPrice > bottomCutoff) {
    return {
      label: "⏳ Wait — Price Usually Drops",
      tone: "wait",
      reason: `A major sale window is about ${daysUntilSale} day${daysUntilSale === 1 ? "" : "s"} away.`,
      currentPrice: roundMoney(currentPrice),
      averagePrice: roundMoney(averagePrice),
      rangeLow: roundMoney(rangeLow),
      rangeHigh: roundMoney(rangeHigh)
    };
  }

  if (currentPrice <= bottomCutoff) {
    return {
      label: "🟢 Great Deal",
      tone: "great",
      reason: "The current price sits in the bottom 20% of its observed range.",
      currentPrice: roundMoney(currentPrice),
      averagePrice: roundMoney(averagePrice),
      rangeLow: roundMoney(rangeLow),
      rangeHigh: roundMoney(rangeHigh)
    };
  }

  if (currentPrice >= topCutoff) {
    return {
      label: "🔴 Overpriced",
      tone: "overpriced",
      reason: "The current price is in the top 20% of its observed range.",
      currentPrice: roundMoney(currentPrice),
      averagePrice: roundMoney(averagePrice),
      rangeLow: roundMoney(rangeLow),
      rangeHigh: roundMoney(rangeHigh)
    };
  }

  return {
    label: "🟡 Fair Price",
    tone: "fair",
    reason: "The current price is close to its historical average.",
    currentPrice: roundMoney(currentPrice),
    averagePrice: roundMoney(averagePrice),
    rangeLow: roundMoney(rangeLow),
    rangeHigh: roundMoney(rangeHigh)
  };
}
