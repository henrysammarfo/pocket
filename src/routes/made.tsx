import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
import { PageHero } from "@/components/marketing/Kit";
import { StudioFooter } from "@/components/StudioFooter";
import hoodie from "@/assets/pocket-hoodie.jpg";
import cap from "@/assets/pocket-cap.jpg";
import stickers from "@/assets/pocket-stickers.jpg";

const products=[
  {name:"The Guardrail Hoodie",price:"$88",detail:"460gsm cotton · black / safety lime",image:hoodie},
  {name:"The Policy Cap",price:"$34",detail:"Six-panel twill · embroidered mark",image:cap},
  {name:"Pocket Proof Pack",price:"$12",detail:"Three weatherproof die-cut stickers",image:stickers},
] as const;

export const Route=createFileRoute("/made")({head:()=>({meta:[{title:"POCKET Merch — Hoodies, caps and stickers"},{name:"description",content:"Wear the rules. Explore POCKET hoodies, caps, and stickers."},{property:"og:title",content:"POCKET — Made to keep"},{property:"og:description",content:"Limited POCKET hoodies, caps, and stickers."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}]}),component:Made});

function Made(){return <><main className="mk-page"><PageHero eyebrow="Drop 001 · Limited numbers" title={<>Wear the <em>guardrails</em>.</>} copy="Heavyweight essentials for people who believe boundaries make better systems." /><section className="product-grid">{products.map((product,index)=><article className={index===0?"featured-product":""} key={product.name}><img src={product.image} alt={`${product.name} in black and POCKET safety lime`} loading={index===0?"eager":"lazy"} width={1200} height={1400}/><div><span>{product.detail}</span><h2>{product.name}</h2><strong>{product.price}</strong><button disabled title="Connect Shopify to enable checkout"><LockKeyhole/> Checkout pending</button></div></article>)}</section><section className="shop-status"><div><span className="eyebrow">Store status</span><h2>The drop is designed.<br/>Checkout awaits connection.</h2></div><p>Shopify setup was not approved, so these products cannot take real payments yet. Connect the store when ready—no placeholder checkout or fake purchase confirmation has been added.</p><a href="https://www.shopify.com/pricing" target="_blank" rel="noreferrer">Shopify details <ArrowUpRight/></a></section></main><StudioFooter/></>}