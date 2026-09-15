import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/DashboardShell";
export const Route=createFileRoute("/dashboard")({head:()=>({meta:[{title:"Client Room — Morrow"},{name:"description",content:"Project overview and activity for Morrow clients."},{property:"og:title",content:"Client Room — Morrow"},{property:"og:description",content:"Project overview and activity."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:DashboardShell});
