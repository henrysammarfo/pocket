import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/DashboardShell";
export const Route=createFileRoute("/dashboard")({head:()=>({meta:[{title:"POCKET — Money plan demo"},{name:"description",content:"Create policy-checked money plans in the POCKET interactive demo."},{property:"og:title",content:"POCKET money plan demo"},{property:"og:description",content:"Plan plainly, approve once, and block overspend."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:DashboardShell});
