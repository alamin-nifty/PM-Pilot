// Config for the manual ("your call") per-person ratings — the hybrid layer.
// Pure constants only (no server imports) so both the server page and the
// client ManualRating component can import it safely.

export type Tone = "good" | "neutral" | "watch";

export interface RatingLevel {
  key: string;
  label: string;
  tone: Tone;
  title: string; // hover explanation
}

export interface RatingConfig {
  metricKey: string; // stored in kpi_input.metric_key
  caption: string; // shown on the card
  levels: RatingLevel[];
}

export const COMMUNICATION: RatingConfig = {
  metricKey: "communication",
  caption: "Communication",
  levels: [
    { key: "strong", label: "Strong", tone: "good", title: "Communicates well — flags blockers, keeps you updated" },
    { key: "ok", label: "OK", tone: "neutral", title: "Communication is fine, nothing notable" },
    { key: "watch", label: "Watch", tone: "watch", title: "Goes quiet / misses updates — needs attention" },
  ],
};

export const DELIVERY: RatingConfig = {
  metricKey: "delivery",
  caption: "Delivery",
  levels: [
    { key: "reliable", label: "Reliable", tone: "good", title: "Does what they commit to, lands on time" },
    { key: "mixed", label: "Mixed", tone: "neutral", title: "Sometimes slips, generally okay" },
    { key: "slipping", label: "Slipping", tone: "watch", title: "Often misses commitments — needs attention" },
  ],
};

// Order they render on each card / in the at-a-glance strip.
export const RATING_CONFIGS: RatingConfig[] = [COMMUNICATION, DELIVERY];

export function ratingLevel(config: RatingConfig, value: string | null | undefined): RatingLevel | null {
  if (!value) return null;
  return config.levels.find((l) => l.key === value) ?? null;
}
