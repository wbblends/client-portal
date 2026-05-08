import type { MarketIndicator, Pitch } from "./types";

/**
 * Mock market data. Future: pull from a market intelligence vendor + an internal
 * "trends desk" feed curated by the marketing team.
 */
export async function getMarketIndicators(): Promise<MarketIndicator[]> {
  return [
    {
      id: "ashwa",
      label: "Ashwagandha — global wholesale index",
      value: "$11.20 / kg",
      delta: -3.2,
      note: "Indian rabi harvest came in long; pressure expected through Q2.",
    },
    {
      id: "lions-mane",
      label: "Lion's Mane (organic) — spot",
      value: "$84.50 / kg",
      delta: 4.6,
      note: "Demand for cognitive blends keeping spot tight.",
    },
    {
      id: "rhodiola",
      label: "Rhodiola rosea — wildcraft contracts",
      value: "$148.00 / kg",
      delta: 7.1,
      note: "Russia/Kazakh supply uncertainty pricing in.",
    },
    {
      id: "passion-flower",
      label: "Passionflower — calm category",
      value: "$28.40 / kg",
      delta: -1.4,
    },
  ];
}

/**
 * Hand-picked content cards we surface for this customer. Future: editorial CMS
 * tagging customers + segments; a marketing flag toggles which cards appear.
 */
export async function getPitches(_customerId: string): Promise<Pitch[]> {
  return [
    {
      id: "calm-stack",
      title: "Stackable Calm formulation",
      category: "New blend",
      blurb:
        "A drop-in addition to your nighttime SKU — passionflower, lemon balm, and l-theanine. We've already qualified two of the three actives in your QA file.",
      highlight: "Lead time: 18 days",
      cta: "Request a sample",
    },
    {
      id: "mushroom-flight",
      title: "Functional mushroom trio refresh",
      category: "Trend",
      blurb:
        "Lion's mane / cordyceps / reishi at our new lower MOQ. We're rolling improved cold-water solubility across the trio in Q2.",
      highlight: "MOQ now 25 lb",
      cta: "See the spec sheet",
    },
    {
      id: "private-label-bars",
      title: "Private-label adaptogen bar coformulation",
      category: "Capability",
      blurb:
        "We can ship co-developed adaptogen-forward bars on a 9-week first-run timeline. A few customers piloted this last quarter.",
      highlight: "9-week first run",
      cta: "Talk to the team",
    },
  ];
}

/**
 * On-time delivery summary for a customer over the given period. Computed
 * client-side from the order set today; future: pulled directly from the
 * shipping system.
 */
export function computeOnTimeRate(
  delivered: { promisedDate: Date; deliveredDate: Date | null }[],
): number {
  const completed = delivered.filter(o => o.deliveredDate);
  if (completed.length === 0) return 0;
  const onTime = completed.filter(o => o.deliveredDate! <= o.promisedDate).length;
  return Math.round((onTime / completed.length) * 1000) / 10;
}
