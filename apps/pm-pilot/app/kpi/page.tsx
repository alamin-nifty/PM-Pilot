import Link from "next/link";
import {
  getScorecard,
  currentWeek,
  shiftWeek,
  weekLabel,
  type PersonScore,
} from "@/lib/scorecard";
import { indexesFor } from "@/lib/indexes";
import ScoreControl from "./ScoreControl";

export const dynamic = "force-dynamic"; // always reflect the latest saved scores

function hue(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}
function initials(name: string) {
  const parts = name.replace(/[^\p{L}\s.]/gu, "").split(/[\s.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
function Avatar({ name }: { name: string }) {
  const h = hue(name);
  return (
    <span className="kc-avatar" style={{ background: `hsl(${h} 62% 92%)`, color: `hsl(${h} 48% 38%)` }}>
      {initials(name)}
    </span>
  );
}

function totalTone(total: number, max: number): "low" | "mid" | "high" | "none" {
  if (max === 0) return "none";
  const pct = total / max;
  if (pct >= 0.7) return "high";
  if (pct >= 0.4) return "mid";
  return "low";
}

function Trend({ ps }: { ps: PersonScore }) {
  if (ps.trend === "new" || ps.delta == null) return null;
  if (ps.trend === "flat") return <span className="sc-trend trend-flat" title="Same as last week">±0</span>;
  const up = ps.trend === "up";
  return (
    <span className={`sc-trend trend-${ps.trend}`} title={`${up ? "Up" : "Down"} ${Math.abs(ps.delta)} vs last week`}>
      {up ? "▲" : "▼"} {Math.abs(ps.delta)}
    </span>
  );
}

function ScoreCard({ ps, week }: { ps: PersonScore; week: string }) {
  const indexes = indexesFor(ps.person.role);
  const tone = totalTone(ps.total, ps.maxTotal);
  const complete = ps.scoredCount === ps.applicableCount;
  return (
    <div className="sc-card">
      <div className="sc-head">
        <Avatar name={ps.person.name} />
        <span className="sc-name" title={ps.person.id}>{ps.person.name}</span>
        <Trend ps={ps} />
        <span className={`sc-total tone-${tone}`} title="Sum of this person's index scores this week">
          {ps.total}<i>/{ps.maxTotal}</i>
        </span>
      </div>
      {!complete && <p className="sc-progress">{ps.scoredCount} of {ps.applicableCount} scored this week</p>}
      <div className="sc-indexes">
        {indexes.map((idx) => (
          <ScoreControl
            key={`${idx.key}-${week}`}
            personId={ps.person.id}
            index={idx}
            week={week}
            initial={idx.key in ps.scores ? ps.scores[idx.key] : null}
          />
        ))}
      </div>
    </div>
  );
}

function Section({ title, rows, week, emptyRole }: { title: string; rows: PersonScore[]; week: string; emptyRole: string }) {
  return (
    <section className="kpi-block">
      <h2 className="kpi-block-title">{title} <span className="kpi-count">{rows.length}</span></h2>
      {rows.length === 0 ? (
        <p className="kpi-empty">No one is tagged as {emptyRole} yet — <Link href="/settings">assign roles in Settings</Link>.</p>
      ) : (
        <div className="sc-grid">
          {rows.map((ps) => <ScoreCard ps={ps} week={week} key={ps.person.id} />)}
        </div>
      )}
    </section>
  );
}

export default async function KpiPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const sp = await searchParams;
  const today = currentWeek();
  let week = sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : today;
  if (week > today) week = today; // never score a future week

  const card = await getScorecard(week);
  const everyone = [...card.developers, ...card.qa];
  const prevWeek = shiftWeek(week, -1);
  const nextWeek = shiftWeek(week, 1);
  const isCurrent = week === today;

  return (
    <>
      <header className="band">
        <div className="band-inner">
          <p className="brand">Keystone</p>
          <span className="kpi-crumb">· Scorecard</span>
          <span className="spacer" />
          <Link href="/settings" className="settings-gear" title="Settings">⚙</Link>
        </div>
      </header>

      <main className="wrap">
        <section className="kpi-head">
          <div className="kpi-head-row">
            <div>
              <h1 className="kpi-h1">Team scorecard</h1>
              <p className="kpi-h1-sub">
                Private to you — your weekly read on each person, scored 0–5 per index. A conversation-starter,
                not a verdict. Hover an index for what it means.
              </p>
            </div>
            <div className="wk-nav">
              <Link href={`/kpi?week=${prevWeek}`} className="wk-btn" title="Previous week">‹</Link>
              <span className="wk-label">
                Week of {weekLabel(week)}{isCurrent && <i> · this week</i>}
              </span>
              <Link
                href={isCurrent ? "/kpi" : `/kpi?week=${nextWeek}`}
                className={`wk-btn${isCurrent ? " is-disabled" : ""}`}
                title="Next week"
                aria-disabled={isCurrent}
              >
                ›
              </Link>
              {!isCurrent && <Link href="/kpi" className="wk-today">This week</Link>}
            </div>
          </div>
        </section>

        {everyone.length > 0 && (
          <section className="kpi-strip">
            <div className="kpi-strip-title">At a glance — week of {weekLabel(week)}</div>
            <ul className="kpi-strip-list">
              {everyone.map((ps) => {
                const tone = totalTone(ps.total, ps.maxTotal);
                const pct = ps.maxTotal ? Math.round((ps.total / ps.maxTotal) * 100) : 0;
                return (
                  <li key={ps.person.id} className="kpi-strip-row">
                    <Avatar name={ps.person.name} />
                    <span className="kpi-strip-name">{ps.person.name}</span>
                    <span className={`chip role-${ps.person.role}`}>{ps.person.role}</span>
                    <span className="sc-bar"><span className={`sc-bar-fill tone-${tone}`} style={{ width: `${pct}%` }} /></span>
                    <Trend ps={ps} />
                    <span className={`sc-total-mini tone-${tone}`}>{ps.total}/{ps.maxTotal}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <Section title="Developers" rows={card.developers} week={week} emptyRole="a developer" />
        <Section title="QA" rows={card.qa} week={week} emptyRole="QA" />

        {!card.hasPeople && (
          <p className="kpi-empty-all">
            No developers or QA to score yet. <Link href="/settings">Tag people in Settings</Link> and they’ll appear here.
          </p>
        )}
      </main>
    </>
  );
}
