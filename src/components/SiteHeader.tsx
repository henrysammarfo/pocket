import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { BrandLogo } from "./BrandLogo";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (state) => state.location.pathname });
  // Beebah product + Desktop-3 landing own their chrome
  if (path === "/" || path.startsWith("/app") || path.startsWith("/auth")) return null;
  const links = [["/product", "Product"], ["/security", "Safety"], ["/activity", "Activity"], ["/made", "Merch"], ["/story", "Story"]] as const;
  return <header className="site-header"><Link to="/" aria-label="POCKET home"><BrandLogo compact /></Link><nav id="main-navigation" aria-label="Main navigation" className={open ? "nav-open" : ""}>{links.map(([to,label]) => <Link key={to} to={to} activeProps={{ className: "is-active" }} onClick={() => setOpen(false)}>{label}</Link>)}<Link to="/app" className="client-link" onClick={() => setOpen(false)}>Open POCKET <span>↗</span></Link></nav><button className="menu-button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="main-navigation" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button></header>;
}