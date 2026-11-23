# WA Dashboard

Next.js dashboard for the Soft7 API, with shared feature modules, panel theming, and Socket.IO notifications.

## Local setup

Use the Node version supported by package.json, then install the locked dependencies:

```bash
npm ci
```

Set local environment values in .env or .env.local; these files stay out of Git. The local backend uses the `pg` PostgreSQL driver. Set `DATABASE_URL` to your existing PostgreSQL database; its tables remain unchanged and no generated ORM client is needed:

```bash
npm run start:user
```

The user dashboard runs at http://localhost:3000. The Windows start:user and start:admin scripts are provided in package.json. Use npm run build followed by npm start for the standard production Next.js server. Custom Socket.IO server entry points remain at server-user.ts and server-admin.ts.

Shopify requests call `https://hostapi.soft7.in/v1` directly with the dashboard JWT. Store listing uses `GET /admin/shopify/connections`. The API must allow the frontend origin (including `http://localhost:3001` for development) and the Authorization header through CORS. OAuth start also requires credentialed CORS so its browser-binding cookie belongs to the API callback host.

## Repository layout

- src/app/: Next.js routes and layouts.
- src/features/: feature screens, components, API helpers, and feature tests.
- src/components/, src/hooks/, src/lib/, src/types/, src/utils/: shared code.
- src/styles/, src/theme/: panel styles and theme tokens.
- src/workers/, src/jobs/, src/queues/, src/services/: local backend and worker code.
- src/lib/database/: shared PostgreSQL pool, typed repositories, enums, and table mappings.
- db/schema.sql: baseline for a new, empty PostgreSQL database.
- public/: assets required by the dashboard.
- scripts/: repeatable verification tools.
- docs/guides/: setup and feature reference guides moved out of the repository root.
- .local/maintenance/: archived one-off scripts and obsolete configs, retained only in this checkout and ignored by Git.
- .tmp/, audit/, coverage/: generated local verification output, ignored by Git.

## Git and production files

Keep package.json, package-lock.json, TypeScript/Next/PostCSS/ESLint configuration, source JSON, and source tests tracked. Tests and repeatable verification scripts belong in the repository even when they are not part of the deployed client bundle.

For an existing database, deploy the code with the same `DATABASE_URL`; no schema reset or migration is needed. For a new database, `npm run db:setup` explicitly creates the baseline and refuses a database that already has tables. Database changes belong in reviewed SQL files under `db/`; app startup never applies schema changes.

Run `npm run test:database` to verify repositories and wallet transactions against an isolated, in-memory PostgreSQL engine. This test command uses synthetic data and does not connect to `DATABASE_URL`. `npm run verify-wallet` is a separate manual integration script that writes to its configured database; use a disposable test database for that command.

Ignore local environment files, editor settings, generated Next.js output, logs, uploads, database dumps, ZIP archives, and audit evidence. Existing tracked local artifacts have been removed from Git's index so the ignore rules apply while their local copies remain available. Private local deployment settings and certificates stay outside Git; production settings must be supplied on the host.

The current cleanup does not rewrite Git history or update a remote branch. Review the staged artifact removals together with the source changes before committing.

# Frontend developer guide

The frontend uses Next.js App Router, Tailwind v4, Ant Design, and `next-themes`. Start with these files:

| Change | Central file |
| --- | --- |
| Brand, accent palettes, Light/Dark surfaces, text, borders, status colors, charts, and theme shadows | `src/styles/themes.css` |
| Body/heading/statistic fonts, typography, spacing, radii, button/icon sizes, sidebar/header dimensions, and z-index | `src/styles/tokens.css` |
| Existing web-font loading | `src/styles/fonts.css` |
| Base typography and application defaults | `src/styles/globals.css` |
| Tailwind utility mappings | `src/styles/tailwind.css` |
| Appearance preference identifiers and accent labels | `src/theme/config.ts` |

`src/app/globals.css` imports these once and preserves the existing CSS order. There is no second Tailwind theme: `@theme inline` maps utilities such as `bg-primary`, `text-foreground`, `font-sans`, spacing, and font weights to the CSS tokens. Tailwind v4 uses this CSS configuration; the older `tailwind.config.cjs` is not the source of design values.

For example, change `--palette-emerald` in `src/styles/themes.css` to update Emerald brand accents and the appearance swatch. Its readable primary action color remains `--primary-base`; update that and `--accent-hover` together when changing the action palette. Other accents have independent `:root[data-accent="..."]` overrides. Light values live in `:root`, and Dark overrides live in `html.dark`. Colors representing messaging delivery state, logos, and WhatsApp previews are intentionally preserved.

Change `--font-body` in `src/styles/tokens.css` to update the body, Tailwind `font-sans`, inherited controls, and Ant Design. `--font-heading` controls headings; `--font-statistics` independently controls dashboard numbers. The existing Inter/Fraunces and inbox Newsreader/Plus Jakarta CSS font imports are combined and loaded once in `src/styles/fonts.css`, with local/system fallback stacks in `tokens.css`. Inbox retains its existing typography through `--font-inbox-heading` and `--font-inbox-body`. Define a new `@font-face` in `fonts.css` before selecting a new custom family.

Adjust `--space-unit` for Tailwind's spacing scale, `--control-height` for shared compact controls, `--nav-rail-width` for the desktop navigation rail, and `--app-header-height` for the header. Contacts intentionally use `--contacts-control-height` and `--contacts-control-gap` for their smaller controls. Dashboard statistics retain separate mobile/desktop sizes (32px/40px). Use the relevant token instead of adding a numeric override to a page.

`src/app/Providers.tsx` supplies `next-themes`, defaulting to System. Light/Dark sets the root class; System follows device preference changes. The `theme` and `app-accent` localStorage keys are unchanged and independent. The root initialization script restores both before paint. `src/theme/AppearanceProvider.tsx` restores accents across tabs, and `src/theme/antd.ts` reads resolved CSS tokens for Ant Design. `src/hooks/useChartPalette.ts` resolves chart colors for canvas charts, which cannot directly use CSS `var()` strings.

File responsibilities:

- `src/app/`: route composition and layouts; existing nested feature folders, including inbox hooks/components/utilities, remain together.
- `src/components/ui/`: shared buttons, inputs, cards, tables, badges, dialogs, and their shared class API in `primitives.css`.
- `src/components/layout/`: the active `AppSidebar`, `AppHeader`, and navigation/layout styles. Older `Sidebar`/`Header` components remain a separate implementation; the active layout imports `AppSidebar`/`AppHeader` explicitly.
- `src/features/<feature>/`: top-level page implementations and feature styles, including dashboard, contacts, campaigns, gallery, settings, and integrations. Keep small local components together; extract only reusable or substantial responsibilities.
- `src/features/dashboard/dashboard.api.ts` and `types.ts`: an example of keeping a feature's API calls and contracts beside it. Existing shared HTTP authentication/interceptors stay in `src/lib/axiosInstance.ts`; Redux API services stay in `src/store/`, and backend services stay in `src/services/`.
- `src/hooks/`, `src/types/`, and `src/lib/` or `src/utils/`: shared hooks, contracts, and utilities. Do not move server-only services into client components.

To add a page, create a feature component and compose it from a route:

```tsx
// src/app/user/example/page.tsx
import ExamplePage from "@/features/example/ExamplePage";
export default function Page() { return <ExamplePage />; }
```

Use shared components and semantic classes (`bg-card text-foreground border-border`). Add a CSS Module beside the feature for new custom rules. Existing feature styles retain their scoped selector conventions. Compatibility CSS imports under old route paths and exports in `src/context/AppearanceContext.tsx` preserve nested routes and existing imports; they contain no independent palette.

To add an accent, define its palette and selector in `themes.css` and add its label in `theme/config.ts`. The central initialization in `src/theme/initialize.ts` uses that configuration automatically. Extend the accent list in `scripts/verify-appearance.mjs` and `scripts/verify-frontend.mjs`. A new appearance mode needs a complete set of semantic overrides and a matching `next-themes`/initialization configuration; do not copy component styles.

Legacy integration rules remain in `src/components/layout/legacy-overrides.css` and `chrome.css`. Some `!important` declarations are still necessary to override inline or third-party styles. Identical rules and circular radius aliases were removed; dynamically assembled class names were retained. Continue migrating integrations component by component with visual checks before deleting compatibility rules.

Verification:

```bash
npm run build
npm run typecheck
npm run lint
npm run verify:appearance
npm run verify:frontend
```

On Windows PowerShell with restricted script execution, use `npm.cmd`. Browser verification uses Chromium (`CHROME_PATH` can override the default Windows Chrome path), renders the actual dashboard statistic cards plus representative contacts/layout controls, and checks 1440px/390px layouts in both modes with all five accents. It checks central color/font propagation and restores the design afterward. Screenshots and results go into `.tmp/frontend-verification/`. This component check does not authenticate or test live API flows; use an authenticated development session for full route smoke testing. The current Next configuration skips type/lint checks during builds, so run those commands separately.
