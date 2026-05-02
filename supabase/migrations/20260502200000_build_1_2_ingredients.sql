-- =====================================================================
-- Build 1.2 — Ingredients Database
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ingredients
-- ---------------------------------------------------------------------
create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  name text not null,
  type text not null check (type in ('primary', 'intermediate', 'fixed')),
  total_cost numeric(18,6),
  original_quantity numeric(18,6),
  original_uom_code text references public.units(code),
  conversion_on boolean not null default true,
  recipe_uom_code text references public.units(code),
  adjustment numeric(12,6) not null default 0 check (adjustment <> -1),
  density_g_per_ml numeric(18,8),
  manual_recipe_unit_cost numeric(18,8),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case-insensitive unique name per restaurant for active ingredients
create unique index if not exists ingredients_unique_name
  on public.ingredients (restaurant_id, lower(name))
  where (is_active = true);

alter table public.ingredients enable row level security;

create trigger ingredients_set_updated_at
  before update on public.ingredients
  for each row execute function public.tg_set_updated_at();

-- RLS policies
create policy "ingredients_select_member"
  on public.ingredients for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy "ingredients_insert_manager"
  on public.ingredients for insert to authenticated
  with check (public.has_restaurant_role(restaurant_id, array['owner','manager']));

create policy "ingredients_update_manager"
  on public.ingredients for update to authenticated
  using (public.has_restaurant_role(restaurant_id, array['owner','manager']))
  with check (public.has_restaurant_role(restaurant_id, array['owner','manager']));

-- No DELETE policy — use is_active = false for deactivation.

-- ---------------------------------------------------------------------
-- 2. ingredient_cost_state
-- ---------------------------------------------------------------------
create table if not exists public.ingredient_cost_state (
  ingredient_id uuid primary key references public.ingredients(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  cost_source text not null default 'calculated'
    check (cost_source in ('calculated', 'manual', 'intermediate_pending', 'error')),
  original_unit_cost numeric(18,8),
  recipe_quantity numeric(18,8),
  recipe_unit_cost numeric(18,8),
  calculation_status text not null default 'pending'
    check (calculation_status in ('valid', 'warning', 'error', 'pending')),
  calculation_error text,
  last_calculated_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ingredient_cost_state enable row level security;

create trigger ingredient_cost_state_set_updated_at
  before update on public.ingredient_cost_state
  for each row execute function public.tg_set_updated_at();

-- RLS policies
create policy "ingredient_cost_state_select_member"
  on public.ingredient_cost_state for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy "ingredient_cost_state_insert_manager"
  on public.ingredient_cost_state for insert to authenticated
  with check (public.has_restaurant_role(restaurant_id, array['owner','manager']));

create policy "ingredient_cost_state_update_manager"
  on public.ingredient_cost_state for update to authenticated
  using (public.has_restaurant_role(restaurant_id, array['owner','manager']))
  with check (public.has_restaurant_role(restaurant_id, array['owner','manager']));

-- No DELETE policy — cost state is removed via cascade when ingredient is deleted.
