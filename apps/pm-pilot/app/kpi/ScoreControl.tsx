"use client";
import { useState } from "react";
import { SCALE, type ScoreIndex } from "@/lib/indexes";

const NUMS = Array.from({ length: SCALE.max - SCALE.min + 1 }, (_, i) => SCALE.min + i);

// One scoreable index for one person: name, description, and a 0–5 picker.
// Saves to SQLite via /api/kpi/manual (value = the number, "" clears it).
export default function ScoreControl({
  personId,
  index,
  week,
  initial,
}: {
  personId: string;
  index: ScoreIndex;
  week: string;
  initial: number | null;
}) {
  const [value, setValue] = useState<number | null>(initial);
  const [saving, setSaving] = useState(false);

  async function set(n: number) {
    const next = value === n ? null : n; // click the current score again to clear
    const prev = value;
    setValue(next);
    setSaving(true);
    try {
      const res = await fetch("/api/kpi/manual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personId, indexKey: index.key, week, value: next === null ? "" : String(next) }),
      });
      if (!res.ok) setValue(prev);
    } catch {
      setValue(prev);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="idx">
      <div className="idx-head">
        <span className="idx-name">{index.name}</span>
        <span className="idx-score">
          {value ?? "–"}<i>/{SCALE.max}</i>
        </span>
      </div>
      <div className="idx-desc">{index.description}</div>
      <div className="idx-scale" role="group" aria-label={index.name}>
        {NUMS.map((n) => {
          const filled = value != null && n <= value && n > 0;
          return (
            <button
              key={n}
              type="button"
              className={`idx-btn${value === n ? " is-on" : ""}${filled ? " filled" : ""}`}
              onClick={() => set(n)}
              disabled={saving}
              aria-pressed={value === n}
              title={`Score ${n} / ${SCALE.max}`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
