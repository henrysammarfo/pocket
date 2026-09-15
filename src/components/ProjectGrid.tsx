import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { projects } from "@/data/site";
export function ProjectGrid({limit}:{limit?:number}){return <div className="project-grid">{projects.slice(0,limit).map((p,i)=><Link to="/work/$slug" params={{slug:p.slug}} className={`project-card project-${p.color}`} key={p.slug}><div className="project-image"><img src={p.image} alt={`${p.title} campaign`} loading={i?"lazy":"eager"} width={1408} height={1056}/><span className="project-arrow"><ArrowUpRight/></span></div><div className="project-meta"><div><h3>{p.title}</h3><p>{p.type}</p></div><span>{p.year}</span></div></Link>)}</div>}
