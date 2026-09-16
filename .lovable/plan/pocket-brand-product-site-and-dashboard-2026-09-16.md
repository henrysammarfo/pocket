# POCKET brand, product site, and dashboard

## Direction
Transform the current studio template into POCKET: a consumer finance brand built around the promise “money plans that cannot overspend.” Keep the template’s expressive editorial scale, generous composition, and distinctive footer energy, while replacing every Morrow-specific surface with an original POCKET system suitable for product UI and future merchandise.

## Brand system
- Create an original, bold POCKET wordmark and compact monogram that remain legible on hoodies, caps, app icons, and small screens.
- Use a confident consumer-finance palette, strong display typography, restrained motion, and premium Lucide icons.
- Build a consistent responsive header, footer, buttons, status marks, and product controls.

## Public pages
- Home: literal POCKET headline, plain-English value proposition, interactive plan preview, guardrail proof, product workflow, integrations, and launch call-to-action.
- Product: explain Plan Parser, fail-closed Policy Engine, Intent Composer, one-settlement execution, and receipts.
- Security: caps, allowlists, expiry, approvals, blocked-plan states, and honest testnet labeling.
- Activity: public demo receipt/explorer-style proof view with clearly marked sample data.
- About: mission, competition positioning, build principles, and founder identity from the brief.
- Contact: focused partnership and early-access paths.

## Product dashboard
- Build a complete app shell with Overview, New Plan, Plans, Activity, Rules, and Settings.
- Implement the core clickable demo: type a plan, generate a proposed multi-leg plan, review policy checks, approve a simulated settlement, force an overspend attempt, and show a blocked result.
- Include realistic local receipts, transaction states, spending caps, approved recipients/assets, expiry controls, notifications, and editable preferences.
- Label all activity as demo/testnet; never imply real settlement, fixed returns, or verified user traction.

## Quality and validation
- Give every route unique metadata and accessible landmarks.
- Verify all navigation and key dashboard interactions at desktop and mobile widths.
- Check current preview diagnostics and route rendering.
- Keep the experience local-only; no wallet, chain, or external service connection is added in this version.

## Technical details
- Preserve TanStack Start routing and Tailwind v4 semantic tokens.
- Replace the existing Morrow routes and fixtures rather than layering POCKET over them.
- Use typed local fixtures and React state for the clickable demo.
- Use the existing locally hosted fonts where they support the new identity, and SVG source artwork for scalable branding.
