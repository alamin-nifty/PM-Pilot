"use client";
import { useState } from "react";
import type { RatingConfig } from "./ratings";

// A reusable manual rating control (Communication, Delivery, …).
// Saves to SQLite via /api/kpi/manual; click the active level again to clear.
export default function ManualRating({
  personId,
  config,
  initial,
}: {
  personId: string;
  config: RatingConfig;
  initial: string | null;
}) {
  const [value, setValue] = useState<string | null>(initial);
  const [saving, setSaving] = useState(false);

  async function set(level: string) {
    const next = value === level ? "" : level; // toggle off
    const prev = value;
    setValue(next || null);
    setSaving(true);
    try {
      const res = await fetch("/api/kpi/manual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personId, metricKey: config.metricKey, value: next }),
      });
      if (!res.ok) setValue(prev); // revert on failure
    } catch {
      setValue(prev);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rate">
      <span className="rate-label">
        {config.caption} <i>· your call</i>
      </span>
      <div className="rate-seg" role="group" aria-label={`${config.caption} rating`}>
        {config.levels.map((l) => (
          <button
            key={l.key}
            type="button"
            className={`rate-btn tone-${l.tone}${value === l.key ? " is-on" : ""}`}
            onClick={() => set(l.key)}
            disabled={saving}
            title={l.title}
            aria-pressed={value === l.key}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
