import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowRight } from "lucide-react";
import { ProjectGrid } from "@/components/ProjectGrid";
import { StudioFooter } from "@/components/StudioFooter";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Morrow — Independent Creative Studio" },
    { name: "description", content: "Morrow builds bright identities, campaigns, and characters for ambitious brands." },
    { property: "og:title", content: "Morrow — Independent Creative Studio" },
    { property: "og:description", content: "Bright ideas, shaped with care." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}), component: Home,
});
function Home(){return <><main><section className="home-hero"><div className="hero-kicker"><span>Independent creative studio</span><span>Accra · London · Everywhere</span></div><h1>Bright ideas,<br/><span>shaped with care.</span></h1><div className="hero-bottom"><p>We build identities, campaigns, and characters for brands with something real to say.</p><Link to="/work" className="round-link" aria-label="See our work"><ArrowDownRight/></Link></div></section><section className="marquee" aria-label="Capabilities"><div>Brand worlds <i>✳</i> Moving image <i>✳</i> Big feelings <i>✳</i> Good trouble <i>✳</i></div></section><section className="featured"><div className="section-heading"><span className="eyebrow">Selected work · 2025–26</span><h2>Things we made<br/>with good people.</h2><Link to="/work">All projects <ArrowRight/></Link></div><ProjectGrid limit={3}/></section><section className="manifesto"><span className="eyebrow">Our way</span><p>Strategy that clears the fog.<br/>Craft that makes you look twice.<br/>Collaboration without the theatre.</p><Link to="/studio">Meet the studio <ArrowRight/></Link></section></main><StudioFooter/></>}