import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { PrivyAppProvider } from "@/components/privy/PrivyAppProvider";
import appCss from "../styles.css?url";

export const Route=createRootRouteWithContext<{queryClient:QueryClient}>()({
 head:()=>({meta:[{charSet:"utf-8"},{name:"viewport",content:"width=device-width, initial-scale=1"},{name:"theme-color",content:"#efff63"}],links:[{rel:"stylesheet",href:appCss},{rel:"icon",href:"/favicon.svg",type:"image/svg+xml"}]}),shellComponent:RootShell,component:RootComponent,
 notFoundComponent:()=> <main className="not-found"><span className="eyebrow">404</span><h1>That plan went elsewhere.</h1><a href="/">Back to POCKET</a></main>
});
function RootShell({children}:{children:ReactNode}){return <html lang="en"><head><HeadContent/></head><body>{children}<Scripts/></body></html>}
function RootComponent(){const {queryClient}=Route.useRouteContext();return <QueryClientProvider client={queryClient}><PrivyAppProvider><SiteHeader/><Outlet/></PrivyAppProvider></QueryClientProvider>}