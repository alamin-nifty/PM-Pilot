import Link from "next/link";
import { getKpiReport, type PersonReport, type Tile } from "@/lib/kpi-report";
import PeriodSelector from "./PeriodSelector";
import ManualRating from "./ManualRating";
import { RATING_CONFIGS, ratingLevel } from "./ratings";

export const dynamic = "force-dynamic"; // always reflect the latest synced data

// Deterministic, calm avatar color from a name.
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

function StatTile({ t }: { t: Tile }) {
  return (
    <div className={`kt${t.muted ? " is-muted" : ""}${t.flag ? ` flag-${t.flag}` : ""}`} title={t.hint}>
      <span className="kt-val">
        {t.value}
        {t.flag && <i className={`kt-dot dot-${t.flag}`} />}
      </span>
      <span className={`kt-label${t.confidence === "medium" ? " is-inferred" : ""}`}>{t.label}</span>
    </div>
  );
}

function Card({ r }: { r: PersonReport }) {
  const stale = r.lastActive.flag;
  return (
    <div className={`kc${r.hasSignal ? "" : " is-quiet"}`}>
      <div className="kc-head">
        <Avatar name={r.person.name} />
        <span className="kc-name" title={r.person.id}>{r.person.name}</span>
        <span className={`kc-last${stale ? ` flag-${stale}` : ""}`} title="Most recent Slack message or task update">
          {r.lastActive.text}
        </span>
      </div>
      <div className="kc-tiles">
        {r.tiles.map((t) => (
          <StatTile t={t} key={t.key} />
        ))}
      </div>
      <div className="rate-group">
        {RATING_CONFIGS.map((config) => (
          <ManualRating
            key={config.metricKey}
            personId={r.person.id}
            config={config}
            initial={r.ratings[config.metricKey] ?? null}
          />
        ))}
      </div>
      {r.deferred.length > 0 && (
        <div className="kc-foot" title={`${r.deferred.join(" and ")} need richer ClickUp data, which isn't synced yet.`}>
          {r.deferred.join(" · ")} <span className="kc-foot-note">needs ClickUp data</span>
        </div>
      )}
    </div>
  );
}

function Section({ title, rows, emptyRole }: { title: string; rows: PersonReport[]; emptyRole: string }) {
  return (
    <section className="kpi-block">
      <h2 className="kpi-block-title">{title} <span className="kpi-count">{rows.length}</span></h2>
      {rows.length === 0 ? (
        <p className="kpi-empty">No one is tagged as {emptyRole} yet — <Link href="/settings">assign roles in Settings</Link>.</p>
      ) : (
        <div className="kc-grid">
          {rows.map((r) => (
            <Card r={r} key={r.person.id} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function KpiPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const report = getKpiReport(sp);
  const everyone = [...report.developers, ...report.qa];

  return (
    <>
      <header className="band">
        <div className="band-inner">
          <p className="brand">Keystone</p>
          <span className="kpi-crumb">· KPI Builder</span>
          <span className="spacer" />
          <Link href="/" className="settings-back">← Dashboard</Link>
          <Link href="/settings" className="settings-gear" title="Settings">⚙</Link>
        </div>
      </header>

      <main className="wrap">
        <section className="kpi-head">
          <div className="kpi-head-row">
            <div>
              <h1 className="kpi-h1">Team performance</h1>
              <p className="kpi-h1-sub">
                Private to you — conversation-starters, not scorecards. Hover any number for the reasoning.
              </p>
            </div>
            <div className="kpi-head-period">
              <PeriodSelector active={report.period.key} />
              <span className="kpi-period-label">{report.period.label}</span>
            </div>
          </div>
        </section>

        {!report.clickupConnected && (
          <div className="kpi-connect">
            <div className="kpi-connect-text">
              <strong>Connect ClickUp to bring these cards to life.</strong>
              <span>
                {report.slackConnected ? "Slack is connected" : "Slack isn’t connected"} ✓ — but task signals
                (active, done, bug load, cycle time, reopen rate) come from ClickUp, which isn’t synced yet.
              </span>
            </div>
            <Link href="/settings" className="kpi-connect-btn">Connect ClickUp →</Link>
          </div>
        )}

        {everyone.length > 0 && (
          <section className="kpi-strip">
            <div className="kpi-strip-title">At a glance</div>
            <ul className="kpi-strip-list">
              {everyone.map((r) => (
                <li key={r.person.id} className="kpi-strip-row">
                  <Avatar name={r.person.name} />
                  <span className="kpi-strip-name">{r.person.name}</span>
                  <span className={`chip role-${r.person.role}`}>{r.person.role}</span>
                  <span className="kpi-strip-line">{r.summary}</span>
                  {RATING_CONFIGS.map((config) => {
                    const lvl = ratingLevel(config, r.ratings[config.metricKey]);
                    return lvl ? (
                      <span
                        key={config.metricKey}
                        className={`rate-pill tone-${lvl.tone}`}
                        title={`${config.caption}: ${lvl.label} (your rating)`}
                      >
                        {lvl.label}
                      </span>
                    ) : null;
                  })}
                  <span className={`kpi-strip-last${r.lastActive.flag ? ` flag-${r.lastActive.flag}` : ""}`}>
                    {r.lastActive.text}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Section title="Developers" rows={report.developers} emptyRole="a developer" />
        <Section title="QA" rows={report.qa} emptyRole="QA" />

        {report.areas.length > 0 && (
          <section className="kpi-block">
            <h2 className="kpi-block-title">
              Where the fire is <span className="kpi-count">{report.areas.length}</span>
            </h2>
            <p className="kpi-area-note">Bugs &amp; escalations by area — the team-health lens, not by person.</p>
            <div className="area-list">
              {report.areas.map((a) => (
                <div className="area-row" key={a.area}>
                  <span className="area-name">{a.area}</span>
                  <span className="area-stat">{a.bugs} bug{a.bugs === 1 ? "" : "s"}</span>
                  <span className="area-stat">{a.escalations} escalation{a.escalations === 1 ? "" : "s"}</span>
                  {a.people.length > 0 && <span className="area-people">→ {a.people.join(", ")}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {everyone.length === 0 && (
          <p className="kpi-empty-all">
            No developers or QA to show yet. <Link href="/settings">Tag people in Settings</Link> and they’ll appear here.
          </p>
        )}
      </main>
    </>
  );
}
