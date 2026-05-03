-- =====================================================================
-- Build 1.5 — Price Log + Snapshot Foundation
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. price_update_batches
-- ---------------------------------------------------------------------
create table if not exists public.price_update_batches (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'previewed', 'applied', 'cancelled', 'failed')),
  source text not null default 'manual'
    check (source in ('manual', 'baseline_initialization', 'baseline_reset', 'system')),
  note text,
  baseline_version integer not null default 1,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.price_update_batches enable row level security;

create trigger price_update_batches_set_updated_at
  before update on public.price_update_batches
  for each row execute function public.tg_set_updated_at();

create policy "price_update_batches_select_member"
  on public.price_update_batches for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy "price_update_batches_insert_manager"
  on public.price_update_batches for insert to authenticated
  with check (public.has_restaurant_role(restaurant_id, array['owner','manager']));

create policy "price_update_batches_update_manager"
  on public.price_update_batches for update to authenticated
  using (public.has_restaurant_role(restaurant_id, array['owner','manager']))
  with check (public.has_restaurant_role(restaurant_id, array['owner','manager']));

-- ---------------------------------------------------------------------
-- 2. ingredient_price_log (append-only)
-- ---------------------------------------------------------------------
create table if not exists public.ingredient_price_log (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  batch_id uuid references public.price_update_batches(id) on delete set null,
  ingredient_id uuid references public.ingredients(id) on delete set null,
  baseline_version integer not null default 1,

  -- snapshot for audit readability
  ingredient_name_at_time text not null,
  supplier_name_at_time text,
  ingredient_type_at_time text not null
    check (ingredient_type_at_time in ('primary', 'intermediate', 'fixed')),

  -- old values
  old_total_cost numeric(18,6),
  old_quantity numeric(18,6),
  old_uom_code text,
  old_unit_cost numeric(18,8),
  old_recipe_unit_cost numeric(18,8),

  -- new values
  new_total_cost numeric(18,6),
  new_quantity numeric(18,6),
  new_uom_code text,
  new_unit_cost numeric(18,8),
  new_recipe_unit_cost numeric(18,8),

  -- deltas
  delta_recipe_unit_cost_amount numeric(18,8),
  delta_recipe_unit_cost_percent numeric(18,8),

  -- metadata
  event_type text not null check (event_type in ('baseline', 'change', 'correction', 'manual_note')),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- append-only: no updated_at trigger, no update policy, no delete policy
alter table public.ingredient_price_log enable row level security;

create policy "ingredient_price_log_select_member"
  on public.ingredient_price_log for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy "ingredient_price_log_insert_manager"
  on public.ingredient_price_log for insert to authenticated
  with check (public.has_restaurant_role(restaurant_id, array['owner','manager']));

-- NO update policy — append-only
-- NO delete policy — append-only

-- ---------------------------------------------------------------------
-- 3. ingredient_snapshots
-- ---------------------------------------------------------------------
create table if not exists public.ingredient_snapshots (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  baseline_version integer not null default 1,

  -- snapshot fields
  ingredient_name_at_time text not null,
  supplier_name_at_time text,
  ingredient_type_at_time text not null
    check (ingredient_type_at_time in ('primary', 'intermediate', 'fixed')),
  total_cost numeric(18,6),
  quantity numeric(18,6),
  uom_code text,
  unit_cost numeric(18,8),
  recipe_unit_cost numeric(18,8),
  calculation_status text,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ingredient_snapshots_unique
  on public.ingredient_snapshots (restaurant_id, ingredient_id, baseline_version);

alter table public.ingredient_snapshots enable row level security;

create trigger ingredient_snapshots_set_updated_at
  before update on public.ingredient_snapshots
  for each row execute function public.tg_set_updated_at();

create policy "ingredient_snapshots_select_member"
  on public.ingredient_snapshots for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy "ingredient_snapshots_insert_manager"
  on public.ingredient_snapshots for insert to authenticated
  with check (public.has_restaurant_role(restaurant_id, array['owner','manager']));

create policy "ingredient_snapshots_update_manager"
  on public.ingredient_snapshots for update to authenticated
  using (public.has_restaurant_role(restaurant_id, array['owner','manager']))
  with check (public.has_restaurant_role(restaurant_id, array['owner','manager']));
