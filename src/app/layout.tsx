import type { Metadata, Viewport } from 'next';
import './globals.css';
import './app.css';

export const metadata: Metadata = {
  title: 'Pocket, a money assistant on NEAR testnet',
  description: 'Talk to your money. Send test dollars to family, buy paper stocks, and approve every move on your own device. NEAR testnet only.',
  icons: { icon: '/brand/pusd.svg' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#f5f5f2', colorScheme: 'light dark' };

// Theme boot runs before first paint: light | black | system (default). Saved in localStorage pocket-theme.
const THEME = `(function(){var k='pocket-theme',d=document.documentElement,q=new URLSearchParams(location.search);
var pref=q.get('theme')||localStorage.getItem(k)||'system',mq=matchMedia('(prefers-color-scheme: dark)');
function eff(p){return p==='system'?(mq.matches?'black':'light'):p}
function apply(p,anim){if(anim){d.classList.add('theming');clearTimeout(window.__tt);window.__tt=setTimeout(function(){d.classList.remove('theming')},260)}
d.dataset.theme=eff(p);d.dataset.pref=p;var m=document.querySelector('meta[name=theme-color]');if(m)m.content=eff(p)==='black'?'#000000':'#f5f5f2'}
apply(pref,false);mq.addEventListener('change',function(){if(d.dataset.pref==='system')apply('system',true)});
window.setTheme=function(p){localStorage.setItem(k,p);apply(p,true);document.dispatchEvent(new CustomEvent('themechange'))};
var dev=q.get('dev');if(dev){var P={notch:[47,34,'dev-notch'],island:[59,34,'dev-island'],se:[20,0,'dev-se'],android:[28,20,'dev-android dev-punch']}[dev];
if(P){d.classList.add('mock');P[2].split(' ').forEach(function(c){d.classList.add(c)});d.style.setProperty('--sat',P[0]+'px');d.style.setProperty('--sab',P[1]+'px')}}
if(q.get('embed'))d.classList.add('embed');})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME }} />
        <link rel="preload" href="/fonts/Manrope-latin-66cfc0.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/InterVariable-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
          <defs><linearGradient id="solg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#9945FF" /><stop offset="1" stopColor="#14F195" /></linearGradient></defs>
        </svg>
        {children}
      </body>
    </html>
  );
}
