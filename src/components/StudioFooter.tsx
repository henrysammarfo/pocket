import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Github } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { FooterBackground } from "./FooterBackground";

export function StudioFooter() {
  return <footer className="studio-footer" aria-label="Footer"><div className="footer-jobs"><span className="tag">one plan, one approval</span><h2 className="footer-headline">your money.<br/>inside your rules.</h2><div className="footer-nav"><Link to="/product">Product</Link><Link to="/security">Safety</Link><Link to="/activity">Receipts</Link><Link to="/contact">Contact</Link></div></div><div className="footer-logo"><BrandLogo /></div><div className="footer-contact"><span className="tag">built in Accra</span><h2 className="footer-headline footer-contact-lines"><span>plan plainly.</span><span>settle safely.*</span></h2><p className="footer-note">*POCKET is currently a testnet demo. No real funds move.</p><div className="footer-socials"><a href="https://github.com/henrysammarfo" aria-label="Henry Sam Marfo on GitHub"><Github /></a><a href="https://x.com/henrysammarfo" aria-label="Henry Sam Marfo on X">X</a></div></div><FooterBackground /></footer>;
}