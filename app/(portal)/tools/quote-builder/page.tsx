import type { Metadata } from "next";
import { QuoteBuilder } from "./quote-builder";

/**
 * Quote Builder — lives under the portal's new Tools section, available to
 * every signed-in user (the (portal) layout already gates auth). A rep
 * uploads whatever they have (emails, specs, sheets), the AI pre-fills the
 * quote, the rep reviews, and we hand back the finished WB Blends quote PDF.
 */
export const metadata: Metadata = {
  title: "Quote Builder — WB Blends",
  description: "Turn customer materials into a ready-to-send WB Blends quote.",
};

export default function QuoteBuilderPage() {
  return <QuoteBuilder />;
}
