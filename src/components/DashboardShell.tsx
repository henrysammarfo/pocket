import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Activity, Bell, BookOpenCheck, LayoutDashboard, ListChecks, Plus, Settings, ShieldCheck, X } from "lucide-react";
import { BrandLogo } from "./BrandLogo";

const items = [["/dashboard", LayoutDashboard, "Overview"], ["/dashboard/new-plan", Plus, "New plan"], ["/dashboard/plans", ListChecks, "Plans"], ["/dashboard/activity", Activity, "Activity"], ["/dashboard/rules", ShieldCheck, "Rules"], ["/dashboard/settings", Settings, "Settings"]] as const;

export function DashboardShell() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const current = items.find(([to]) => to === path)?.[2] ?? "POCKET";
  return <div className="dashboard-shell"><aside className="dash-sidebar"><Link to="/" className="dash-brand"><BrandLogo compact /></Link><nav aria-label="POCKET navigation">{items.map(([to, Icon, label]) => <Link key={to} to={to} activeOptions={{ exact: to === "/dashboard" }} activeProps={{ className: "is-active" }}><Icon /><span>{label}</span></Link>)}</nav><div className="dash-help"><BookOpenCheck /><span>Demo on testnet</span><p>Every transaction and balance shown here is sample data.</p></div><Link to="/" className="exit-link"><X /> Exit app</Link></aside><main className="dash-main"><header className="dash-top"><div><span className="eyebrow">Monad testnet · Demo</span><strong>{current}</strong></div><button className="icon-button" aria-label="Notifications" title="Notifications"><Bell /></button><div className="avatar">HM</div></header><Outlet /></main></div>;
}