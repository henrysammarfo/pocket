import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { PrivyAppProvider } from "@/components/privy/PrivyAppProvider";
import appCss from "../styles.css?url";
import otariCss from "../styles/otari-ui.css?url";

export const Route=createRootRouteWithContext<{queryClient:QueryClient}>()({
 head:()=>({meta:[{charSet:"utf-8"},{name:"viewport",content:"width=device-width, initial-scale=1"},{name:"theme-color",content:"#123C32"}],links:[{rel:"stylesheet",href:appCss},{rel:"stylesheet",href:otariCss},{rel:"preconnect",href:"https://fonts.googleapis.com"},{rel:"preconnect",href:"https://fonts.gstatic.com"},{rel:"stylesheet",href:"https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"},{rel:"icon",href:"/favicon.svg",type:"image/svg+xml"}]}),shellComponent:RootShell,component:RootComponent,
 notFoundComponent:()=> <main className="not-found"><span className="eyebrow">404</span><h1>That plan went elsewhere.</h1><a href="/">Back to POCKET</a></main>
});
function RootShell({children}:{children:ReactNode}){return <html lang="en"><head><HeadContent/></head><body>{children}<Scripts/></body></html>}
function RootComponent(){const {queryClient}=Route.useRouteContext();return <QueryClientProvider client={queryClient}><PrivyAppProvider><SiteHeader/><Outlet/></PrivyAppProvider></QueryClientProvider>}