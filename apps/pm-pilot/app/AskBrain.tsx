"use client";
import { useState } from "react";

interface AskResult {
  note: string;
  retrieved: string[];
}

export default function AskBrain() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);

  async function ask() {
    if (!q.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      setResult(await res.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="ask">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="Ask about the project…  e.g. what's blocking login?"
        />
        <button onClick={ask} disabled={loading}>
          {loading ? "…" : "Ask"}
        </button>
      </div>
      {result && (
        <div className="ask-result">
          <div className="ask-card">
            <p className="note">{result.note}</p>
            {result.retrieved.length ? (
              <ul>
                {result.retrieved.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            ) : (
              <p className="note">No matching context found.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
