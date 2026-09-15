import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageIntro } from "@/components/PageIntro";
import { ProjectGrid } from "@/components/ProjectGrid";
import { StudioFooter } from "@/components/StudioFooter";
export const Route=createFileRoute("/work")({head:()=>({meta:[{title:"Work — Morrow Studio"},{name:"description",content:"Selected identity, campaign, and character work from Morrow."},{property:"og:title",content:"Work — Morrow Studio"},{property:"og:description",content:"Selected identity, campaign, and character work."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}]}),component:Work});
function Work(){const [filter,setFilter]=useState("All");return <><main className="work-page"><PageIntro eyebrow="Archive · 2023–26" title="Made with feeling." copy="A mix of identities, campaigns, objects, and friendly oddities built to stay with you."/><div className="work-filter">{["All","Identity","Campaign","Character","Motion"].map(x=><button key={x} className={`filter-button ${filter===x?"active":""}`} onClick={()=>setFilter(x)}>{x}</button>)}</div><ProjectGrid/></main><StudioFooter/></>}
