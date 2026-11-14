// Ported verbatim from the approved design (styles/final/avatars.mjs).
// Original jersey style avatars (football kit look, no real club crests). Clean vector, one SVG each.
const SHIRT='M31 20 L43 15 Q50 21 57 15 L69 20 L86 32 L78 46 L70 41 L70 86 Q50 89 30 86 L30 41 L22 46 L14 32 Z';
export type Kit={id:string;name:string;bg:string;base:string;alt:string;pat:string;num:number;ink:string};
export const KITS:Kit[]=[
 {id:'forest',name:'Forest 7',bg:'#dff3ea',base:'#0f3329',alt:'#5fd3a5',pat:'sash',num:7,ink:'#ffffff'},
 {id:'flame',name:'Flame 10',bg:'#ffe9e3',base:'#c8102e',alt:'#fcd116',pat:'stripes',num:10,ink:'#ffffff'},
 {id:'sun',name:'Sun 9',bg:'#fff6d6',base:'#fcd116',alt:'#006b3f',pat:'hoops',num:9,ink:'#0b0d0c'},
 {id:'night',name:'Night 4',bg:'#e9e9ee',base:'#121214',alt:'#3a3a3e',pat:'pin',num:4,ink:'#f5f5f7'},
 {id:'ocean',name:'Ocean 11',bg:'#e2ecff',base:'#1d4ed8',alt:'#7fb2ff',pat:'halves',num:11,ink:'#ffffff'},
 {id:'tiger',name:'Tiger 23',bg:'#ffeedd',base:'#f97316',alt:'#111111',pat:'chevron',num:23,ink:'#111111'},
 {id:'classic',name:'Classic 1',bg:'#eef2ef',base:'#ffffff',alt:'#123c32',pat:'trim',num:1,ink:'#123c32'},
 {id:'neon',name:'Neon 99',bg:'#efe7ff',base:'#6d28d9',alt:'#22d3ee',pat:'fade',num:99,ink:'#ffffff'},
];
function pattern(k:Kit,cid:string){const a=k.alt;switch(k.pat){
 case 'stripes':return [34,46,58].map(x=>`<rect x="${x}" y="0" width="6" height="100" fill="${a}"/>`).join('');
 case 'hoops':return [36,52,68].map(y=>`<rect x="0" y="${y}" width="100" height="7" fill="${a}"/>`).join('');
 case 'sash':return `<path d="M20 20 L36 20 L82 90 L66 90 Z" fill="${a}"/>`;
 case 'pin':return [36,42,48,54,60,66].map(x=>`<rect x="${x}" y="0" width="1.2" height="100" fill="${a}"/>`).join('');
 case 'halves':return `<rect x="50" y="0" width="50" height="100" fill="${a}"/>`;
 case 'chevron':return `<path d="M10 24 L50 40 L90 24 L90 31 L50 47 L10 31 Z" fill="${a}"/>`;
 case 'trim':return `<rect x="0" y="0" width="100" height="100" fill="none"/><path d="M14 32 L22 46 L30 41 Z M86 32 L78 46 L70 41 Z" fill="${a}"/>`;
 case 'fade':return `<defs><linearGradient id="g${cid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${k.base}"/><stop offset="1" stop-color="${a}"/></linearGradient></defs><rect width="100" height="100" fill="url(#g${cid})"/>`;
 default:return ''}}
let n=0;
export function jersey(k:Kit,{size=64}:{size?:number;ring?:boolean}={}){const cid='k'+k.id+(n++);
 const lightKit=k.base.toLowerCase()==='#ffffff'||k.base==='#fcd116';
 return `<svg class="kit" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${k.name} jersey"><circle cx="50" cy="50" r="50" fill="${k.bg}"/>
 <clipPath id="c${cid}"><path d="${SHIRT}"/></clipPath>
 <g clip-path="url(#c${cid})"><rect width="100" height="100" fill="${k.base}"/>${pattern(k,cid)}</g>
 <path d="${SHIRT}" fill="none" stroke="${lightKit?'rgba(0,0,0,.18)':'rgba(0,0,0,.25)'}" stroke-width="1.2" stroke-linejoin="round"/>
 <path d="M43 15 Q50 27 57 15" fill="none" stroke="${k.alt==='#ffffff'&&k.base!=='#ffffff'?'#ffffff':k.alt}" stroke-width="3" stroke-linecap="round"/>
 <text x="50" y="${k.pat==='chevron'?74:(k.num>9?67:68)}" text-anchor="middle" font-family="Manrope,Inter,sans-serif" font-weight="800" font-size="${k.num>9?24:28}" fill="${k.ink}" stroke="${k.pat==='halves'||k.pat==='stripes'||k.pat==='hoops'?k.base:'none'}" stroke-width="${k.pat==='halves'||k.pat==='stripes'||k.pat==='hoops'?3:0}" paint-order="stroke">${k.num}</text></svg>`}
export const EMOJI:[string,string][]=[['😎','#ffe8a3'],['🦁','#ffd9b3'],['⚽','#dff3ea'],['🚀','#e2ecff'],['🌍','#d8f3ff'],['🦅','#efe7ff']];
export const emo=([e,bg]:[string,string],size=64)=>`<span class="emo" style="width:${size}px;height:${size}px;background:${bg};font-size:${Math.round(size*.52)}px">${e}</span>`;
