import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { BrandLogo } from "./BrandLogo";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (state) => state.location.pathname });
  if (path.startsWith("/dashboard")) return null;
  const links = [["/product", "Product"], ["/security", "Safety"], ["/activity", "Activity"], ["/made", "Merch"], ["/story", "Story"]] as const;
  return <header className="site-header"><Link to="/" aria-label="POCKET home"><BrandLogo compact /></Link><nav aria-label="Main navigation" className={open ? "nav-open" : ""}>{links.map(([to,label]) => <Link key={to} to={to} activeProps={{ className: "is-active" }} onClick={() => setOpen(false)}>{label}</Link>)}<Link to="/dashboard" className="client-link">Open POCKET <span>↗</span></Link></nav><button className="menu-button" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button></header>;
}