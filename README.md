# pocket

GO THROUGH MD ATTACHED ,CREATE GOOD BRAND,logo WILL USE FORR future MERCH AND HODDIES , CREATE FULL PAGES AND ROUTES AND DASHBOARD ALL FLOWS ,ROUTES EERYTHING , USE THE RIGHT PRO PREMIUM ICONS , SUBPAGES FULL should match template prompt design

AND USE THIS TEMPLATE =   Recreate this exact single-page creative studio footer. This is a fidelity task, not a redesign. Implement the supplied content, assets, CSS, and interactions exactly. Build only this footer page. Keep it local; do not publish or deploy it. Do not add a header, hero, cards, forms, sections, buttons, links, animations, or extra copy.

The source snapshots appended below are the authoritative specification. Copy them exactly, adapting only import paths or framework plumbing if necessary. Do not substitute approximate typography, another logo, stock video, or a generic eye-following effect.

1. Overall appearance

The whole page is one footer containing a left information column, a centered script logo, a right contact-style text column with three social icons, and a lavender character video. At desktop widths, the video fills the viewport behind all content. On mobile, the content stacks and the video appears after it in normal document flow. Keep the composition spacious and minimal, with very dark text and no tint, scrim, gradient, blur, or overlay covering the video.

There are no external links or actual contact destinations. Navigation-style labels, contact-style copy, social icons, and the logo are static display elements, not clickable anchors. Do not invent destinations, email addresses, phone numbers, WhatsApp actions, or social accounts. Do not show Truus or truus.co anywhere in the interface or metadata.

2. Exact visible copy

Preserve spelling, capitalization, punctuation, curly apostrophes, asterisks, and explicit line breaks. The replacement copy was matched to the previous copy's character counts; do not rewrite it again. Counts include spaces and punctuation.

Left badge: “have a fresh idea?” (18 characters)
Left headline, first line: “imagination” (11)
Left headline, second line: “meets craft” (11)
Four navigation-style labels, in order:
“Made” (4)
“Story” (5)
“In the lab” (10)
“Say hey” (7)

Right badge: “say hey” (7)
Right headline, first line: “let’s team up!” (14)
Right headline, second line: “bring us your idea*” (19)
Small note: “*good things start with one spark. let’s make yours.” (52)
Social icons in order: LinkedIn, Instagram, TikTok. Use the exact SVG files included below, with no visible text labels and no links.

The central logo is the outlined script Logoipsum SVG included in BrandLogo below. It has a 169 × 40 viewBox. This is the latest supplied SVG, not the earlier filled PNG logo. Use its exact path. Set the path fill to currentColor, so it inherits the text color #080909. Do not trace, regenerate, typeset, or approximate the logo.

3. Exact typography and colors

Headlines: Epilogue Black, weight 900, normal style.
All other text: DM Sans Regular, weight 400, normal style.
Use real font files and font-synthesis: none; do not simulate bold.
Do not use the previously suggested Oobi fonts. The final page reverted to Epilogue and DM Sans.

Download these exact font files and serve them locally:

DM Sans Regular source:
https://cdn.prod.website-files.com/683703490bc01e1b8c052e06/68370ddd1dd328d7914d6512_DMSans-Regular.woff2
Save as public/fonts/DMSans-Regular.woff2.

Epilogue Black source:
https://cdn.prod.website-files.com/683703490bc01e1b8c052e06/68370ddd06d737200122a835_Epilogue-Black.woff2
Save as public/fonts/Epilogue-Black.woff2.

Use @font-face with font-display: swap and the exact family names and weights in the supplied CSS.

Text and logo: #080909.
Desktop fallback background: #dfe4f2, normally covered by the video.
Badge background: #f7f8fa.
Mobile body and footer background: #f0eefa, sampled to match the upper background of the video.
No text shadows, decorative borders, cards, gradients, or drop shadows.

4. Exact desktop layout, viewport width greater than 700px

Apply border-box sizing globally. Body has zero margin and a minimum height of 100vh.
The footer is position: relative, min-height: 100vh, padding-top: 6.54vw, isolation: isolate, overflow: hidden.

Left block:
- margin-left: 8.65vw; width: 25vw.
- Badge: inline-flex, vertically centered, pill radius 100px, height 1.9vw, padding .39vw .61vw, font-size .88vw, line-height 1.2, nowrap.
- Headline: block, margin-top 1.45vw, font-size 1.66vw, weight 900, line-height 1.2, letter-spacing 0.
- Navigation labels: vertical flex column, align-items flex-start, gap .93vw, margin-top 1.3vw, font-size 1.075vw, line-height 1.35.

Logo:
- Position absolute: left 40.33vw, top 7.7vw, width 17vw.
- SVG display block, width 100%, height auto.

Right block:
- Position absolute: left 74.3vw, top 6.54vw.
- Same badge styling.
- Headline lines: flex column, align-items flex-start, margin-top 1.45vw, nowrap; use shared headline type.
- Note: margin 1.05vw 0 0; font-size .733vw; line-height 1.4; nowrap.
- Social row: horizontal flex, align-items center, gap 1.43vw, margin-top 1.61vw.
- Icon wrappers and images: display block, width and height 1.71vw.

Keep these vw values rather than substituting a generic centered max-width container. Preserve the exact three-column placement.

Video layer:
- Wrapper: position absolute, inset 0, z-index -1, pointer-events none.
- Video: position absolute, inset 0, display block, width 100%, height 100%, object-fit cover, object-position center.
- The video stays behind the text. There is no separate pupil canvas or eye overlay.

5. Exact mobile layout, viewport width 700px or less

Keep all desktop rules intact; apply the provided mobile overrides only within @media(max-width:700px).

- Body and footer background: #f0eefa.
- Footer: vertical flex column, gap 36px, minimum height 100svh, padding 40px 24px 0.
- Visual order: logo; left content block; right content block; video.
- Logo: position static, order 0, align-self flex-start, width 210px, max-width 75%, margin-bottom 4px.
- Left content: order 1, margin 0, width 100%.
- Badges: height 30px, padding 6px 11px, font-size 14px.
- Headings: font-size clamp(22px,6.3vw,30px), line-height 1.25, weight 900.
- Left heading and right headline stack: margin-top 19px.
- Navigation labels: two equal grid columns, column-gap 24px, row-gap 0, margin-top 20px, font-size 17px, line-height 1.4. Each label is vertically centered with min-height 44px. Row one is Made / Story; row two is In the lab / Say hey.
- Right content: position static, order 2, width 100%.
- Right headline stack: gap 4px, white-space normal.
- Small note: max-width 34ch, margin 16px 0 0, font-size 14px, line-height 1.5, normal wrapping.
- Social row: gap 18px, margin-top 20px. Wrappers are 44 × 44px flex boxes with centered 30 × 30px icons. First wrapper has margin-left -7px.
- Video wrapper: position relative, inset auto, order 3, z-index auto, flex none, align-self center, width calc(100% + 48px), aspect-ratio 4/3, margin-top -16px.
- Video fills that wrapper using centered object-fit cover.
- The mobile video is full bleed below the content, not behind or on top of the text. There is no footer bottom padding or extra section after it. The matching body color provides the transition without adding an overlay.

6. Exact video asset

Use this complete, literal CloudFront URL. Do not substitute another clip, omit path segments, escape the underscores, or alter the filename:

https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260908_073327_03643c0a-db33-417a-ae8f-4a39259c7f9c.mp4

The source is 1920 × 1080, 24 fps, approximately 7.041667 seconds. It shows a fuzzy lavender character holding a pink heart against a very pale lavender background. Its eyes move in circles within the actual recorded video.

Download the source as public/footer-background.mp4. For the exact seek-friendly playback asset used by this page, create public/footer-scrub.mp4 with:

ffmpeg -hide_banner -loglevel error -i public/footer-background.mp4 -an -c:v libx264 -preset fast -crf 20 -g 1 -pix_fmt yuv420p -movflags +faststart public/footer-scrub.mp4

Preserve the original dimensions, frame rate, duration, colors, and composition. The all-intra encoding is for responsive random seeking. Use this local derivative in the video element; it comes from the exact CloudFront source above.

The element must have muted, playsInline, and preload="auto". No native playback controls, audio, poster art, or visible loading UI.

7. Exact desktop mouse interaction

The interaction is video scrubbing: moving the cursor selects a frame where the character's recorded pupils point toward the cursor. Do not redraw pupils, shift the whole video, animate CSS eyes, edit video pixels, or continuously play the desktop clip.

Use the complete supplied gaze-frames.json lookup table and FooterBackground component below. These are the calibrated current implementation, not an approximation.

- The source-space midpoint between the eyes is (948,418) in a 1920 × 1080 frame.
- Calculate object-fit cover scale as max(videoRect.width/1920, videoRect.height/1080).
- Eye screen X = videoRect.left + videoRect.width/2 + (948-960)*scale.
- Eye screen Y = videoRect.top + videoRect.height/2 + (418-540)*scale.
- Subtract that screen-space eye midpoint from the pointer's clientX/clientY.
- Ignore changes inside an 8px radius around the midpoint to avoid unstable angles.
- Compute atan2(dy,dx), then normalize to [0,2π). Screen-space Y increases downward, so angle 0 is right, π/2 is down, π is left, and 3π/2 is up.
- Find the table row with the minimum circular angular difference min(abs(target-sample),2π-abs(target-sample)). Each row is [angleInRadians,videoTimeInSeconds].
- Use that row's time + 1/240 second. The small offset puts the seek inside the intended frame.
- Seek only if the time difference exceeds 1/48 second, the video has current frame data, and another seek is not in progress.
- Clamp the seek target to duration - 1/24.
- Coalesce pointer updates through requestAnimationFrame. Keep only the latest requested target while decoding, and handle seeked to apply the newest target.
- Do not interpolate time across the whole clip or assume the eye orbit moves at a constant rate. The table is intentionally non-linear.
- Desktop video starts paused at time 0. It remains at the selected frame after the mouse stops or leaves the page; there is no automatic reset or idle loop.
- Recalculate pointer-relative direction on resize and scroll.
- Register passive pointer and scroll listeners; remove all listeners and cancel animation frames on unmount.

Approximate cardinal-direction checks before adding the 1/240-second offset:
Right → 2.54167s.
Down → 0.33333s.
Left → 1.0s.
Up → 1.70833s.

8. Mobile playback and responsive behavior

At widths <=700px, disable pointer-driven seeking. The below-content video plays normally, muted and looping. Respect prefers-reduced-motion: reduce by pausing mobile playback. If autoplay is unavailable, leave the available frame visible. Do not show an error or force controls.

Use matchMedia change listeners so crossing the 700px breakpoint switches correctly between mobile looping playback and desktop paused cursor scrubbing. Changing reduced-motion preference also updates playback. Desktop behavior stays pointer-controlled regardless of the mobile playback preference.

9. Semantics and metadata

Use a footer element with aria-label="Footer". The video wrapper is aria-hidden="true" and pointer-events:none. The logo wrapper has role="img" and aria-label="Studio logo", and its SVG is aria-hidden. Social wrappers have the labels LinkedIn, Instagram, and TikTok. The exact page markup is supplied below.

Document language: en.
Page title: Studio — Footer.
Description: Fresh ideas, imagination, and creative collaboration.
Favicon: the same supplied logo as /logo.svg, with fill #080909 in the standalone file.

10. Implementation and completion constraints

Use React and TypeScript with ordinary CSS; the reference uses an App Router-style app/page.tsx, app/layout.tsx, and a client-side video component. Preserve the supplied source whenever the environment supports it. No animation library, UI framework, or canvas rendering is needed for this page.

Use the exact source files below. Fetch the two fonts and source video as specified. For public/logo.svg, take the SVG from BrandLogo, convert JSX attribute names fillRule/clipRule back to SVG fill-rule/clip-rule, and set currentColor to #080909 for the standalone file. Preserve its viewBox and path.

Build successfully and check the cardinal gaze mapping, mobile stacking, wrapping at 320px/390px widths, and desktop layout at widths above 700px. Do not add or change content while validating. Keep all work local; do not publish or deploy.

AUTHORITATIVE SOURCE FILES FOLLOW


File: app/page.tsx

```tsx
import FooterBackground from './footer-background';
import BrandLogo from './brand-logo';

export default function Home() {
  return (
    


      
      


        have a fresh idea?
        imagination
meets craft
        


          Made
          Story
          In the lab
          Say hey
        


      


      


        
      


      


        say hey
        


          let’s team up!
          bring us your idea*
        


        

*good things start with one spark. let’s make yours.


        


          
          
          
        


      


    


  );
}
```

File: app/globals.css

```css
@font-face{font-family:'DM Sans';src:url('/fonts/DMSans-Regular.woff2') format('woff2');font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:Epilogue;src:url('/fonts/Epilogue-Black.woff2') format('woff2');font-weight:900;font-style:normal;font-display:swap}
:root{--background:#dfe4f2;--foreground:#080909;font-family:'DM Sans',Arial,sans-serif;font-weight:400;color:var(--foreground);background:var(--background);font-synthesis:none}
*{box-sizing:border-box}
body{margin:0;min-height:100vh}
a{color:inherit;text-decoration:none}
a:focus-visible{outline:2px solid currentColor;outline-offset:6px}
.footer{position:relative;min-height:100vh;padding-top:6.54vw}
.jobs{margin-left:8.65vw;width:25vw}
.tag{display:inline-flex;align-items:center;border-radius:100px;background:#f7f8fa;padding:.39vw .61vw;font-size:.88vw;line-height:1.2;height:1.9vw;white-space:nowrap}
.headline{font-family:Epilogue,Arial,sans-serif;font-weight:900;font-size:1.66vw;line-height:1.2;letter-spacing:0}
.job-title{display:block;margin-top:1.45vw}
.footer-nav{display:flex;flex-direction:column;align-items:flex-start;gap:.93vw;margin-top:1.3vw;font-size:1.075vw;line-height:1.35}
.logo{position:absolute;left:40.33vw;top:7.7vw;width:17vw}
.logo svg{display:block;width:100%;height:auto}
.contact{position:absolute;left:74.3vw;top:6.54vw}
.contact-links{display:flex;flex-direction:column;align-items:flex-start;margin-top:1.45vw;white-space:nowrap}
.note{margin:1.05vw 0 0;font-size:.733vw;line-height:1.4;white-space:nowrap}
.socials{display:flex;align-items:center;gap:1.43vw;margin-top:1.61vw}
.socials span,.socials img{display:block;width:1.71vw;height:1.71vw}

.footer{isolation:isolate;overflow:hidden}
.footer-background{position:absolute;inset:0;z-index:-1;pointer-events:none}
.footer-background video{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover;object-position:center}

@media(max-width:700px){
  :root{--background:#f0eefa;background:var(--background)}
  body{background:var(--background)}
  .footer{display:flex;flex-direction:column;gap:36px;min-height:100svh;padding:40px 24px 0;background:var(--background)}
  .logo{position:static;order:0;align-self:flex-start;width:210px;max-width:75%;margin-bottom:4px}
  .jobs{order:1;margin:0;width:100%}
  .tag{height:30px;padding:6px 11px;font-size:14px}
  .headline{font-size:clamp(22px,6.3vw,30px);line-height:1.25}
  .job-title,.contact-links{margin-top:19px}
  .footer-nav{display:grid;grid-template-columns:1fr 1fr;gap:0 24px;margin-top:20px;font-size:17px;line-height:1.4}
  .footer-nav span{display:flex;align-items:center;min-height:44px}
  .contact{position:static;order:2;width:100%}
  .contact-links{gap:4px;white-space:normal}
  .note{max-width:34ch;margin:16px 0 0;font-size:14px;line-height:1.5;white-space:normal}
  .socials{gap:18px;margin-top:20px}
  .socials span{display:flex;align-items:center;justify-content:center;width:44px;height:44px}
  .socials img{width:30px;height:30px}
  .socials span:first-child{margin-left:-7px}
  .footer-background{position:relative;inset:auto;order:3;z-index:auto;flex:none;align-self:center;width:calc(100% + 48px);aspect-ratio:4/3;margin-top:-16px}
  .footer-background video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center}
}
```

File: app/footer-background.tsx

```tsx
'use client';

import { useEffect, useRef } from 'react';
import gazeFrames from './gaze-frames.json';

const TAU = Math.PI * 2;
const wrappedAngle = (angle: number) => (angle % TAU + TAU) % TAU;

// These angles were measured from the actual pupil positions in the clip's
// first complete orbit. Match direction, rather than assuming constant speed.
function timeForAngle(angle: number) {
  const target = wrappedAngle(angle);
  let nearestTime = gazeFrames[0][1];
  let nearestDistance = Infinity;
  for (const [sampleAngle, time] of gazeFrames) {
    const difference = Math.abs(target - sampleAngle);
    const distance = Math.min(difference, TAU - difference);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestTime = time;
    }
  }
  return nearestTime + 1 / 240;
}

export default function FooterBackground() {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current!;
    let frame = 0;
    let desiredTime = 0;
    let pointer: { x: number; y: number } | null = null;
    let disposed = false;
    const mobile = window.matchMedia('(max-width: 700px)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const seek = () => {
      frame = 0;
      if (disposed || mobile.matches || video.readyState < 2 || video.seeking) return;
      if (Math.abs(video.currentTime - desiredTime) > 1 / 48) {
        video.currentTime = Math.min(desiredTime, video.duration - 1 / 24);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(seek);
    };
    const updateTarget = () => {
      if (mobile.matches || !pointer) return;
      const rect = video.getBoundingClientRect();
      const scale = Math.max(rect.width / 1920, rect.height / 1080);
      // Match the exact object-fit: cover positioning, including mobile crops.
      const eyeX = rect.left + rect.width / 2 + (948 - 960) * scale;
      const eyeY = rect.top + rect.height / 2 + (418 - 540) * scale;
      const dx = pointer.x - eyeX;
      const dy = pointer.y - eyeY;
      // Avoid unstable angles directly between the eyes.
      if (Math.hypot(dx, dy) > 8) {
        desiredTime = timeForAngle(Math.atan2(dy, dx));
        schedule();
      }
    };
    const move = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      updateTarget();
    };
    const ready = () => {
      video.loop = mobile.matches;
      if (mobile.matches && !reducedMotion.matches) {
        void video.play().catch(() => { /* Keep the first frame if autoplay is unavailable. */ });
      } else {
        video.pause();
        if (!mobile.matches) { updateTarget(); schedule(); }
      }
    };
    // Coalesce fast pointer movements while a frame is decoding. When it
    // finishes, seek immediately to the latest requested gaze direction.
    video.addEventListener('seeked', schedule);
    video.addEventListener('loadeddata', ready);
    mobile.addEventListener('change', ready);
    reducedMotion.addEventListener('change', ready);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('resize', updateTarget);
    window.addEventListener('scroll', updateTarget, { passive: true });
    if (video.readyState >= 2) ready();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      video.removeEventListener('seeked', schedule);
      video.removeEventListener('loadeddata', ready);
      mobile.removeEventListener('change', ready);
      reducedMotion.removeEventListener('change', ready);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('scroll', updateTarget);
    };
  }, []);

  return (
    


      
    


  );
}
```

File: app/gaze-frames.json

```json
[
  [
    0.037186,
    2.54167
  ],
  [
    0.130722,
    2.58333
  ],
  [
    0.234912,
    2.625
  ],
  [
    0.321399,
    2.66667
  ],
  [
    0.419378,
    2.70833
  ],
  [
    0.493296,
    2.75
  ],
  [
    0.597784,
    2.79167
  ],
  [
    0.763067,
    2.83333
  ],
  [
    0.778708,
    2.875
  ],
  [
    0.878749,
    2.91667
  ],
  [
    0.993308,
    2.95833
  ],
  [
    1.262791,
    3.0
  ],
  [
    1.388902,
    3.04167
  ],
  [
    1.466609,
    0.25
  ],
  [
    1.473318,
    0.29167
  ],
  [
    1.520011,
    3.08333
  ],
  [
    1.53824,
    0.33333
  ],
  [
    1.6056,
    0.375
  ],
  [
    1.640696,
    3.125
  ],
  [
    1.691747,
    0.41667
  ],
  [
    1.779194,
    0.45833
  ],
  [
    1.869867,
    0.5
  ],
  [
    1.984485,
    0.54167
  ],
  [
    2.07265,
    0.58333
  ],
  [
    2.183915,
    0.625
  ],
  [
    2.267155,
    0.66667
  ],
  [
    2.36138,
    0.70833
  ],
  [
    2.44749,
    0.75
  ],
  [
    2.517676,
    0.79167
  ],
  [
    2.605329,
    0.83333
  ],
  [
    2.670889,
    0.875
  ],
  [
    2.809991,
    0.91667
  ],
  [
    2.918365,
    0.95833
  ],
  [
    3.134177,
    1.0
  ],
  [
    3.240289,
    1.04167
  ],
  [
    3.35949,
    1.08333
  ],
  [
    3.464119,
    1.125
  ],
  [
    3.549317,
    1.16667
  ],
  [
    3.663539,
    1.20833
  ],
  [
    3.78152,
    1.25
  ],
  [
    3.878742,
    1.29167
  ],
  [
    3.989446,
    1.33333
  ],
  [
    4.066996,
    1.375
  ],
  [
    4.225574,
    1.45833
  ],
  [
    4.260255,
    1.41667
  ],
  [
    4.276468,
    1.5
  ],
  [
    4.404025,
    1.54167
  ],
  [
    4.487075,
    1.58333
  ],
  [
    4.552949,
    1.625
  ],
  [
    4.628837,
    1.66667
  ],
  [
    4.701131,
    1.70833
  ],
  [
    4.773675,
    1.75
  ],
  [
    4.833089,
    1.79167
  ],
  [
    4.894145,
    1.83333
  ],
  [
    4.962593,
    1.875
  ],
  [
    5.028737,
    1.91667
  ],
  [
    5.090028,
    1.95833
  ],
  [
    5.212041,
    2.0
  ],
  [
    5.28302,
    2.04167
  ],
  [
    5.349352,
    2.08333
  ],
  [
    5.412121,
    2.125
  ],
  [
    5.473636,
    2.16667
  ],
  [
    5.573871,
    2.20833
  ],
  [
    5.656364,
    2.25
  ],
  [
    5.759153,
    2.29167
  ],
  [
    5.85261,
    2.33333
  ],
  [
    5.938647,
    2.375
  ],
  [
    6.048453,
    2.41667
  ],
  [
    6.153327,
    2.45833
  ],
  [
    6.222603,
    2.5
  ]
]
```

File: app/brand-logo.tsx

```tsx
export default function BrandLogo() {
  return (  );
}
```

File: app/layout.tsx

```tsx
import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Studio — Footer',
  description: 'Fresh ideas, imagination, and creative collaboration.',
  icons: { icon: '/logo.svg' },
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return {children};
}
```

File: public/linkedin.svg (find linked in icon)
```

File: public/instagram.svg (find insta icon)


File: public/tiktok.svg (find simple Tiktok iocn)

## Development

POCKET runs on Vercel + Neon Postgres + Privy. See `memory/KEYS_GUIDE.md` for key setup.

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
