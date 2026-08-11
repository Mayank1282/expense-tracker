# Ledger — Personal Expense Tracker

Portfolio Project 4. A single-user personal finance tracker built as a **Laravel
monolith with React rendered through Inertia.js**, storing documents in
**MongoDB**.

Log income and expenses against categories, watch the month's balance and
budgets, print or export a monthly report, and size up an EMI before committing
to it.

| | |
|---|---|
| Stack | Laravel 13 · Inertia.js 3 · React 19 · MongoDB 8 · Tailwind CSS 4 · Vite 8 |
| Architecture | Monolithic MVC — one app, one deployment, no REST API |
| Design | Material 3 with skeuomorphic accents — tonal elevation, pointer-tracked 3D cards, a physically-shaded WebGL hero |
| Tests | 104 PHP (PHPUnit) + 17 JS (Vitest) |

---

## Why this project is built differently

Projects 1–3 in this portfolio are decoupled SPAs: a React app on Vercel talking
to a Laravel or Express API on Render. This one deliberately is not.

**There is no API.** A controller returns `Inertia::render('Dashboard', [...])`
and Inertia hands those props straight to `resources/js/Pages/Dashboard.jsx`.
No REST layer, no CORS configuration, no Axios for navigation, no client-side
router, no duplicated route table. Laravel's validation errors arrive in the
React form automatically; a `redirect()->with('success', …)` becomes a toast.

That is the pattern worth demonstrating — the one most small teams and internal
tools actually use — and it is why the frontend lives inside the Laravel app in
`resources/js/` rather than in a sibling folder. Splitting them would mean
abandoning Inertia and rebuilding Project 1 a fourth time.

---

## Why MongoDB

The portfolio deliberately covers all three major database families: MySQL
(Projects 1 and 3), PostgreSQL (Project 2), and MongoDB here.

An expense entry is a small, self-contained, document-shaped record with no
joins worth speaking of, which suits a document store. The
[`mongodb/laravel-mongodb`](https://github.com/mongodb/laravel-mongodb) package
provides Eloquent-compatible models over it, so controllers, form requests,
validation rules and Inertia responses look exactly like a SQL Laravel app —
the engine changes, the teaching point (the Inertia monolith) does not.

There are no tables to create, so the migrations only build indexes. Every query
is scoped to one user and then filtered or sorted by date, so the index that
matters is the compound `(user_id, occurred_on)`. Password-reset rows also carry
a **TTL index**, which is a genuine advantage here — MongoDB expires stale
tokens itself, with no scheduled job to run.

---

## Design — Material 3 with skeuomorphic accents

A third distinct visual identity for the portfolio. Projects 1 and 2 are flat
indigo SaaS; Project 3 is warm, editorial and soft-edged. This one is Material
3: tonal surfaces, real elevation, generous radii — with a light skeuomorphic
layer so the surfaces feel like objects rather than rectangles.

Three rules hold it together:

1. **Elevation is tonal first, shadow second.** A raised surface is a lighter
   surface container; the shadow only seats it. Shadow alone on a dark theme
   reads as mud.
2. **Interaction is a state layer** — the foreground colour at 8% on hover and
   12% on press — never an opacity change on the whole element.
3. **Radii follow the M3 shape scale.** Nothing is square; nothing is a pill
   unless it is genuinely a chip or a FAB.

The skeuomorphic accents are deliberately faint: a 1px inset highlight along the
top edge of every raised surface and a barely-there vertical gradient. It is the
same cue a physical button gets from a light above it. At this strength you feel
it rather than see it, which is the line between tactile and toy-like.

### The 3D

3D here has to survive being read off, because these are surfaces people check
numbers on. Research was clear on where it belongs: decorative 3D *inside
charts* is a 2026 anti-pattern, while tactile structural 3D is current. So the
charts stay flat and the depth is structural, in two layers.

**CSS 3D — the cards.** `IsoSlab` in `resources/js/Components/IsoStat.jsx` tilts
toward the pointer, runs a specular sheen that tracks the cursor across the
surface, and floats its content on a raised Z plane so it parallaxes very
slightly as the card turns. The tilt is capped at 6–7°: past about 8° text
begins to shear and legibility starts paying for the effect.

**WebGL — the landing hero only.** A stack of smooth 64-segment coins in
`meshPhysicalMaterial` with real roughness, clearcoat and a small studio
environment, beside a raised card. Physically shaded rather than flat: a
believable object under believable light, so the depth in the hero matches the
depth in the cards beside it.

Its guards (3D must never block the page):

| Guard | Behaviour |
|---|---|
| Lazy | `three` is reached only through `import()`; nothing statically imports it |
| Deferred | Mounts on `requestIdleCallback`, after the page is interactive |
| Optional | Under 768px, no WebGL, or `prefers-reduced-motion` -> CSS fallback |
| Clamped | DPR capped at 1.75, `powerPreference: 'low-power'` |

The fallback is a finished composition — a real balance card with category bars,
not a blank box. Most phones will only ever see that version.

### Palette

A tonal palette seeded on a deep teal-green. Indigo belongs to Projects 1 and 2
and clay to Project 3, so the seed here is a green that suits money without
being the obvious fintech blue.

| Role | Light | Dark |
|---|---|---|
| `primary` | `#00695A` | `#5EDBC0` |
| `primary-container` | `#7EF8DC` | `#005046` |
| `tertiary` (expenses) | `#6750A4` | `#D0BCFF` |
| `error` | `#BA1A1A` | `#FFB4AB` |
| `surface` | `#F4FBF8` | `#0E1513` |
| `surface-container` | `#E8EFEC` | `#1A211F` |
| `on-surface` | `#161D1B` | `#DEE4E1` |

Dark mode is a pure token swap — no component hardcodes a colour, so nothing
needs a `dark:` variant to stay correct. The theme is applied by an inline
script in `<head>` before first paint, so it never flashes.

**Type:** Space Grotesk for headings and UI, IBM Plex Mono for every figure.
All currency is `tabular-nums` so columns align.

### Mobile

The portfolio-wide responsive contract is unchanged from Projects 1-3: bottom
navigation, 44px minimum touch targets, tables collapsing to stacked cards, no
horizontal scroll anywhere. The bottom bar uses M3's pill indicator, and the app
bars are translucent over the content behind them.

---

## Money

Every amount is an **integer number of paise**, from input to render.
`App\Support\Money` parses once at the edge; nothing converts back until the
browser formats it for display. Project 3 shipped three separate money bugs and
all of them were floats rounding at the wrong moment, so `MoneyTest` runs the
awkward inputs that would have caught them: `799.99`, `0.01`, `3333.33`,
`0.10 + 0.20`.

Direction is carried by `type`, never by the sign of the amount. A ledger with
both conventions in play eventually sums incorrectly.

---

## Features

- **Auth** — register, login (rate-limited 5/min per email+IP), logout, profile,
  password change, account deletion
- **Password reset** — emailed single-use link over Brevo SMTP. Tokens are stored
  hashed, expire in 60 minutes, are invalidated when a newer one is issued, and
  clean themselves up via a MongoDB TTL index. The request form responds
  identically for known and unknown addresses so it cannot be used to enumerate
  accounts
- **Transactions** — full CRUD plus multi-select bulk delete. Filters (type,
  category, date range, note search) are **staged behind a Search button** so the
  table does not reshuffle mid-thought; Clear resets them. Paginated 10/page with
  a 10/20/50/100/All selector. The summary tiles total the **filter**, not the
  visible page
- **Categories** — CRUD with a fixed palette and optional monthly budgets. Type
  locks once entries exist, and a category holding entries **cannot be deleted**
  at all — reassign or remove them first. Refusing beats the earlier behaviour of
  silently detaching entries into "Uncategorised", which preserved every total
  but destroyed the classification with no undo
- **Dashboard** — extruded KPI slabs, 6-month income/expense trend, category
  breakdown, budget pressure bars, recent entries
- **Monthly report** — paginated month ledger, a **standalone print document**
  (`/reports/print`, plain Blade with the Ledger masthead — not the app page
  behind a print stylesheet), and a streamed CSV export with a UTF-8 BOM so Excel
  opens it correctly
- **Graceful degradation** — an unreachable database renders a self-contained 503
  page instead of a stack trace naming the host and port. Atlas' free tier sleeps,
  so this is an expected condition, not a bug
- **Audit chain** — every ledger change is appended to a tamper-evident hash
  chain (each block carries the hash of the one before it). `/chain` verifies it
  and, outside production, offers a "tamper" button that rewrites a past block
  so the failure is demonstrable rather than described
- **EMI calculator** — public, no login. Recalculates on every keystroke with a
  full amortisation schedule. The final instalment absorbs accumulated rounding
  so the balance closes at exactly zero

---

## Running it locally

**Requires:** PHP 8.4+ with `ext-mongodb`, Composer, Node 20+, and a MongoDB
server (local or an Atlas connection string). Password reset needs SMTP
credentials — or set `MAIL_MAILER=log` to write the emails into
`storage/logs/laravel.log` instead.

```bash
composer install
npm install

cp .env.example .env
php artisan key:generate

# point MONGODB_URI at your server, then:
php artisan migrate    # indexes only — there are no tables
php artisan db:seed    # demo@yopmail.com / password, 8 months of entries

npm run dev            # in one terminal
php artisan serve      # in another
```

Everything at http://localhost:8000.

**Or with Docker**, which also brings its own MongoDB:

```bash
APP_KEY=$(php artisan key:generate --show) docker compose up --build
```

### The MongoDB PHP extension on Windows

Composer will refuse to install without `ext-mongodb`. Match your PHP build
exactly — thread-safe vs not, and the VC version:

```bash
php -i | grep -E "Thread Safety|Compiler|Architecture"
# grab the matching zip from https://downloads.php.net/~windows/pecl/releases/mongodb/
# drop php_mongodb.dll into your PHP ext/ folder, then add to php.ini:
#   extension=mongodb
php -m | grep mongodb
```

---

## Tests

```bash
php artisan test   # 104 tests — money, aggregation, ownership, validation, auth,
                   #            password reset, filters, CSV export
npm test           # 17 tests — EMI amortisation and formatting
```

Feature tests run against a real MongoDB on a separate `ledger_testing`
database. There is no in-memory substitute for a document store, and mocking it
would only test the mock — the queries and the date-range boundaries are exactly
the parts worth exercising against the real engine.

### Four bugs the tests and a build audit actually caught

None of these would have surfaced by reading the code.

**1. Filtered totals were page-scoped.** `the_index_totals_describe_the_filter_not_the_page`
failed on its first run. Laravel's `paginate()` applies its `limit` and `offset`
to the same builder, so a clone taken *after* pagination silently inherited them
and the ledger's summary tiles only ever totalled the visible 20 rows while
claiming to total the filter. Clone before paginating.

**2. `manualChunks` defeated the entire lazy-3D guard.** Naming `three` and
`recharts` as manual chunks looks like isolation but does the opposite: forcing a
module into a named chunk hoists it to a *static* import of the entry. The build
manifest showed every page — the login screen included — statically importing
885 KB of three.js it would never use, so the lazy/idle/WebGL guards were
decorative. Removing the config let the bundler respect the real `import()`
boundary. The login page went from shipping ~1.5 MB of JS to ~320 KB.

**3. CSV formula injection.** A note of `=1+1` was written to the export
unescaped. Quoting does not help — Excel, LibreOffice and Sheets all evaluate a
cell starting with `= + - @` or a control character as a formula even from a
quoted field, so a crafted note became a payload in the reader's spreadsheet.
Fields starting with those characters are now apostrophe-prefixed.

**4. Sub-paisa amounts became zero-value entries.** `gt:0` accepted `0.001`,
which then rounded to `0` on the way into storage — a ₹0.00 line that counts as
an entry but moves no money. The rule is `min:0.01`.

**5. A cross-page import.** The monthly report borrowed `PeriodBar` from
`Dashboard.jsx`, which made the whole dashboard page — Recharts and all — a
dependency of a report that draws no charts. It is a shared component now.

---

## Known limits

Stated rather than left to be discovered:

- **A password reset does not sign out other devices.** Sessions live in the file
  store keyed by session id and nothing in the reset path touches them. Closing
  it means enabling Laravel's `AuthenticateSession` middleware and calling
  `logoutOtherDevices()`. Documented in `PasswordResetService`.
- **The audit chain cannot detect truncation.** Delete the newest block and what
  remains is a shorter, perfectly valid chain. Only an anchor outside the
  database fixes that — publishing the head hash to a testnet is the next step.
  `LedgerChainTest` asserts this limitation explicitly rather than hiding it.
- **No "remember me".** Sessions last `SESSION_LIFETIME` and no longer. A
  long-lived cookie on an app whose demo credentials are published is a worse
  trade than the convenience is worth.
- **The Docker image has not been built.** Docker Desktop's Linux engine does not
  start on the development machine, so the Dockerfile is verified statically
  only. Expect to iterate on the first deploy.

## Deploying

One Docker image, one service. `render.yaml` is a working blueprint.

1. Create a **MongoDB Atlas** M0 cluster, add a database user, and allow access
   from anywhere (`0.0.0.0/0`) since Render's egress IP is not fixed on the free
   plan.
2. Create a Render **Docker** web service from this repo.
3. Set `APP_KEY` (`php artisan key:generate --show`), `MONGODB_URI`, and
   `APP_URL`.
4. Keep the Render region and the Atlas region close. Project 3 measured 88 ms
   per query on a cross-ocean pairing, and every one of those is on the
   critical path of a page render here.

The entrypoint caches config, routes and views at boot (not at build, since
those values only exist at runtime) and applies the index migration.

**Free tiers sleep after ~15 minutes idle** — open the site a couple of minutes
before demoing it.

---

## Project layout

```
expense-tracker/
├─ app/
│  ├─ Http/Controllers/       Dashboard, Transaction, Category, Report, Profile, Page
│  ├─ Http/Requests/          TransactionRequest, CategoryRequest
│  ├─ Http/Middleware/        HandleInertiaRequests (shared props)
│  ├─ Models/                 User, Category, Transaction, PasswordReset, Block
│  ├─ Notifications/          ResetPasswordLink
│  ├─ Services/               LedgerService, CategorySeeder, PasswordResetService,
│  │                          LedgerChain
│  └─ Support/                Money, TransactionPresenter
├─ resources/
│  ├─ css/app.css             the entire design system
│  ├─ js/
│  │  ├─ Pages/               one component per route
│  │  ├─ Layouts/             AppLayout (sidebar + bottom nav), AuthLayout
│  │  ├─ Components/          Ui, IsoStat, TrendChart, Toast
│  │  ├─ 3d/                  Ambient3D (guards), CoinStackScene (WebGL)
│  │  └─ lib/                 format, emi  (+ their tests)
│  └─ views/app.blade.php     the one Blade file — Inertia root
├─ database/
│  ├─ migrations/             indexes only (incl. a TTL index on reset tokens)
│  └─ seeders/DemoSeeder.php  8 months of plausible activity
├─ docker/                    nginx, supervisor, php.ini, entrypoint
├─ Dockerfile                 3 stages: assets → vendor → runtime
└─ render.yaml
```

## Demo account

`demo@yopmail.com` / `password` — 153 entries across 8 months, with budgets set
and one deliberately over-spent month so the negative-balance and over-budget
states are actually visible rather than theoretical.
