# Decision Log

Architectural decisions and rationale for Margin IQ.

---

### D01 — Frontend mock-first approach

**Decision:** Build the entire UI with mock data before introducing any backend.

**Rationale:** Validates the domain model, calculation logic, and UX with stakeholders before committing to a database schema. Changes to mock data are cheap; schema migrations are not.

---

### D02 — Calculation helpers before backend persistence

**Decision:** Implement pure TypeScript calculation helpers (`src/lib/*.ts`) before any Supabase tables.

**Rationale:** The calculation logic (unit conversions, ingredient costing, COGS, margins, cascades) is the core IP. Testing it as pure functions in isolation ensures correctness independent of infrastructure. These helpers remain as frontend preview logic even after backend source of truth exists.

---

### D03 — Derived selectors before persistence

**Decision:** Build derived intelligence selectors (`src/data/selectors.ts`) that transform source data into KPIs, analytics, cascades, and alerts.

**Rationale:** Proves the end-to-end chain (ingredients → dishes → analytics → alerts) works before adding persistence complexity. Selectors will swap their data source from mock to Supabase as each domain migrates.

---

### D04 — Supabase Auth/Tenant before operational data

**Decision:** Implement Auth + Tenant foundation (Build 1.0) before any operational tables.

**Rationale:** Multi-tenancy and RLS must be established first. Every operational table will carry `restaurant_id` and rely on membership-based access control. Building this foundation first prevents retrofitting RLS onto existing tables.

---

### D05 — Settings/Admin reference data before Ingredients

**Decision:** Implement units, unit_conversions, menu_categories, and suppliers (Build 1.1) before ingredients.

**Rationale:** Ingredients depend on units for costing and suppliers for sourcing. Having reference data in Supabase first means ingredients can reference real foreign keys instead of mock strings.

---

### D06 — Official Supabase Auth session persistence is acceptable

**Decision:** Use Supabase's built-in `persistSession: true` for session persistence. Do not set `storage` explicitly — let `@supabase/supabase-js` use its built-in default (localStorage in browser, in-memory on server).

**Rationale:** Supabase's auth library handles token storage, refresh, and expiration. Using the official mechanism avoids custom session management complexity. Only the auth session tokens are stored in localStorage — no application state. Explicitly setting `storage` caused a bug in SSR (Build 1.0E); the library's default handles both environments correctly.

---

### D07 — Tenant authorization must not come from localStorage

**Decision:** `activeRestaurantId`, role, membership, and settings must come from Supabase (via `restaurant_members` + RLS), never from localStorage.

**Rationale:** Client storage can be manipulated. Authorization must be server-enforced via RLS policies that check `restaurant_members`. Storing authorization data client-side creates a gap between what the UI believes and what the server allows.

---

### D08 — activeRestaurantId should remain in memory for now

**Decision:** The active restaurant selection is held in React state (AuthProvider) and resets to the first membership on page reload.

**Rationale:** A persistent preference (e.g., stored in `profiles`) could be added later, but it must never come from localStorage. For now, resetting to the first membership on reload is acceptable and simple.

---

### D09 — RLS is mandatory for tenant-owned data

**Decision:** Every tenant-owned table must have RLS enabled with policies enforced via SECURITY DEFINER helpers.

**Rationale:** RLS is the last line of defense against cross-tenant data access. Even if application code has a bug, the database will reject unauthorized access. SECURITY DEFINER helpers avoid the recursive-policy trap on `restaurant_members`.

---

### D10 — Price log must be append-only

**Decision:** `ingredient_price_log` has no UPDATE or DELETE policies. Ever.

**Rationale:** Price history is the audit trail for cost changes. Mutations would compromise the integrity of snapshot diffs, cascade calculations, and business reporting. Corrections are recorded as new rows with notes.

---

### D11 — Baseline reset must be non-destructive

**Decision:** Resetting the baseline bumps `baseline_version`, adds new snapshot and log rows, and never deletes or overwrites existing rows.

**Rationale:** Preserving history enables historical analysis, audit compliance, and rollback investigation. Destructive resets would lose the ability to compare current state against any prior baseline.

---

### D12 — Intermediate recipes should update linked Intermediate ingredients

**Decision:** When an Intermediate recipe's COGS changes, the linked Intermediate ingredient's `recipe_unit_cost` in `ingredient_cost_state` must be updated automatically.

**Rationale:** Intermediate recipes feed into dish recipes via Intermediate ingredients. If the cost propagation stops at the recipe level, downstream dishes won't reflect the true cost. The dependency graph (`recipe_dependency_edges`) tracks these relationships.

---

### D13 — Recipe lines should reference ingredient_id

**Decision:** `recipe_lines.ingredient_id` references `ingredients.id`, not a recipe directly.

**Rationale:** The recipe-to-recipe relationship flows through Intermediate ingredients. `recipe_lines` always reference ingredients; Intermediate ingredients have a `linked_recipe_id` that points back to the recipe that produces them. This keeps the data model simple and the dependency graph explicit.

---

### D14 — Names are labels, not technical primary keys

**Decision:** All primary keys are UUIDs. Names are human-readable labels with uniqueness constraints scoped to `(restaurant_id, lower(name))`.

**Rationale:** Names can be renamed without cascading FK updates. UUID primary keys are stable identifiers that work across imports, exports, and API references.

---

### D15 — Frontend calculations become preview-only after backend source of truth exists

**Decision:** Once a domain moves to Supabase with server-side calculations, the frontend calculation helpers (`src/lib/*.ts`) become preview-only — used for form previews, what-if scenarios, and optimistic UI.

**Rationale:** The server is canonical for persisted values. Allowing the frontend to write calculated values would create drift between what the UI shows and what the database stores. The single source of truth principle prevents data inconsistency.

---

### D16 — TanStack Start createServerFn over Edge Functions

**Decision:** Server-side business operations use TanStack Start `createServerFn`, not Supabase Edge Functions.

**Rationale:** `createServerFn` runs in the same deployment (Cloudflare Workers), shares types with the frontend, and integrates with the existing auth middleware. Edge Functions add a separate deployment surface and runtime. PL/pgSQL helpers handle transactional multi-table writes invoked by `createServerFn`.
