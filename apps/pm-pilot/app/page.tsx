import { redirect } from "next/navigation";

// The hosted app is the scorecard; the old Slack/ClickUp dashboard is retired.
export default function Home() {
  redirect("/kpi");
}
