"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const PRESETS = [
  { key: "week", label: "This week" },
  { key: "sprint", label: "This sprint" },
  { key: "month", label: "This month" },
] as const;

export default function PeriodSelector({ active }: { active: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");
  const [customOpen, setCustomOpen] = useState(active === "custom");

  function go(period: string) {
    setCustomOpen(period === "custom");
    if (period !== "custom") router.push(`/kpi?period=${period}`);
  }

  function applyCustom() {
    if (!from) return;
    const qs = new URLSearchParams({ period: "custom", from });
    if (to) qs.set("to", to);
    router.push(`/kpi?${qs.toString()}`);
  }

  return (
    <div className="period">
      <div className="period-pills">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            className={`period-pill${active === p.key ? " is-active" : ""}`}
            onClick={() => go(p.key)}
          >
            {p.label}
          </button>
        ))}
        <button
          className={`period-pill${active === "custom" ? " is-active" : ""}`}
          onClick={() => go("custom")}
        >
          Custom
        </button>
      </div>
      {customOpen && (
        <div className="period-custom">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
          <span className="period-dash">→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
          <button className="period-apply" onClick={applyCustom} disabled={!from}>
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
