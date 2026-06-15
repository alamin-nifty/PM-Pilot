import { getAgenda, allTasks, recentItems, person } from "@/lib/agenda";
import { getTeamKpis, type KpiRow } from "@/lib/kpi";
import AskBrain from "./AskBrain";
import Link from "next/link";

function KpiCard({ row }: { row: KpiRow }) {
  return (
    <div className="kpi-card">
      <div className="kpi-name">{row.person.name}</div>
      <div className="kpi-metrics">
        {row.metrics.map((m) => (
          <div className="kpi-metric" key={m.label}>
            <span className={`kpi-val${m.flag ? ` flag-${m.flag}` : ""}`}>{m.value}</span>
            <span className="kpi-label">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const agenda = getAgenda();
  const tasks = allTasks();
  const items = recentItems();
  const kpis = getTeamKpis();
  const total = agenda.counts.questions + agenda.counts.tasks;

  return (
    <>
      <header className="band">
        <div className="band-inner">
          <p className="brand">Keystone</p>
          <p className="date">{agenda.date}</p>
          <span className="spacer" />
          <AskBrain />
          <Link href="/settings" className="settings-gear" title="Settings">⚙</Link>
        </div>
      </header>

      <main className="wrap">
        <section className="hero">
          <h1 className="big">
            <b>{total}</b> thing{total === 1 ? "" : "s"} need you today.
          </h1>
          <p className="sub">
            {agenda.counts.questions} open question{agenda.counts.questions === 1 ? "" : "s"} ·{" "}
            {agenda.counts.tasks} task{agenda.counts.tasks === 1 ? "" : "s"} waiting on you
          </p>
        </section>

        <div className="grid">
          <section className="panel">
            <h2>Open questions — by person</h2>
            {agenda.openQuestions.length === 0 && <p className="empty">Nothing waiting.</p>}
            {agenda.openQuestions.map((g) => (
              <div className="person" key={g.person.id}>
                <div className="person-head">
                  <span className="name">{g.person.name}</span>
                  <span className={`chip role-${g.person.role}`}>{g.person.role}</span>
                </div>
                {g.items.map((it) => (
                  <p className="q" key={it.id}>
                    {it.body}{" "}
                    {it.taskId && <span className="tasktag">[{it.taskId}]</span>}
                  </p>
                ))}
              </div>
            ))}
          </section>

          <section className="panel">
            <h2>Tasks</h2>
            {tasks.map((t) => (
              <div className="task" key={t.id}>
                <span className="id">{t.id}</span>
                <span className="title">{t.title}</span>
                <span className={`chip s-${t.status}`}>{t.status.replace("_", " ")}</span>
                <span className="who">{person(t.assigneeId)?.name ?? "—"}</span>
              </div>
            ))}
          </section>
        </div>

        <section className="panel" style={{ marginTop: 22 }}>
          <h2>Activity — Slack &amp; ClickUp</h2>
          {items.map((it) => {
            const who = person(it.authorId);
            return (
              <div className="feed-item" key={it.id}>
                <div className="feed-meta">
                  <span>{who?.name ?? it.authorId}</span>
                  <span className={`chip role-${who?.role ?? "developer"}`}>{who?.role}</span>
                  <span>· {it.source}</span>
                  {it.taskId && <span>· {it.taskId}</span>}
                </div>
                <div className="feed-body">{it.body}</div>
              </div>
            );
          })}
        </section>

        <section className="panel" style={{ marginTop: 22 }}>
          <h2>Team performance — developers &amp; QA</h2>
          <p className="kpi-caveat">
            For your eyes only — conversation-starters, not scorecards. Pair every
            number with its context.
          </p>
          <p className="kpi-group-label">Developers</p>
          <div className="kpi-grid">
            {kpis.developers.map((row) => (
              <KpiCard row={row} key={row.person.id} />
            ))}
          </div>
          <p className="kpi-group-label" style={{ marginTop: 18 }}>QA</p>
          <div className="kpi-grid">
            {kpis.qa.map((row) => (
              <KpiCard row={row} key={row.person.id} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
