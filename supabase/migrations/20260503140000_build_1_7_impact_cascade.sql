-- =====================================================================
-- Build 1.7 — Impact Cascade Foundation
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. impact_cascade_runs
-- ---------------------------------------------------------------------
create table if not exists public.impact_cascade_runs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  batch_id uuid not null references public.price_update_batches(id) on delete cascade,
  baseline_version integer not null default 1,
  status text not null default 'generated'
    check (status in ('generated', 'failed')),
  generated_by uuid references auth.users(id) on delete set null,
  generated_at timestamptz not null default now(),
  changed_ingredients_count integer not null default 0,
  affected_dish_count integer not null default 0,
  impact_item_count integer not null default 0,
  newly_below_target_count integer not null default 0,
  total_cogs_delta_per_serving numeric(18,8),
  total_margin_delta_per_serving numeric(18,8),
  note text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists impact_cascade_runs_unique_batch
  on public.impact_cascade_runs (restaurant_id, batch_id);

alter table public.impact_cascade_runs enable row level security;

create trigger impact_cascade_runs_set_updated_at
  before update on public.impact_cascade_runs
  for each row execute function public.tg_set_updated_at();

create policy "impact_cascade_runs_select_member"
  on public.impact_cascade_runs for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy "impact_cascade_runs_insert_manager"
  on public.impact_cascade_runs for insert to authenticated
  with check (public.has_restaurant_role(restaurant_id, array['owner','manager']));

create policy "impact_cascade_runs_update_manager"
  on public.impact_cascade_runs for update to authenticated
  using (public.has_restaurant_role(restaurant_id, array['owner','manager']))
  with check (public.has_restaurant_role(restaurant_id, array['owner','manager']));

-- ---------------------------------------------------------------------
-- 2. impact_cascade_items
-- ---------------------------------------------------------------------
create table if not exists public.impact_cascade_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  run_id uuid not null references public.impact_cascade_runs(id) on delete cascade,
  batch_id uuid not null references public.price_update_batches(id) on delete cascade,
  dish_recipe_id uuid references public.recipes(id) on delete set null,
  dish_name_at_time text not null,
  category_name_at_time text,
  affected_ingredient_ids uuid[],
  affected_ingredient_names text[],
  impact_paths jsonb,

  menu_price numeric(18,6),
  target_gpm numeric(18,8),
  old_cogs_per_serving numeric(18,8),
  new_cogs_per_serving numeric(18,8),
  cogs_delta_per_serving numeric(18,8),
  old_gp numeric(18,8),
  new_gp numeric(18,8),
  gp_delta numeric(18,8),
  old_gpm numeric(18,8),
  new_gpm numeric(18,8),
  gpm_delta numeric(18,8),
  was_on_target boolean,
  is_on_target boolean,
  newly_below_target boolean not null default false,
  suggested_menu_price numeric(18,6),
  suggested_price_delta numeric(18,6),

  calculation_status text not null default 'valid'
    check (calculation_status in ('valid', 'warning', 'error', 'incomplete')),
  issue_summary text,
  created_at timestamptz not null default now()
);

alter table public.impact_cascade_items enable row level security;

create policy "impact_cascade_items_select_member"
  on public.impact_cascade_items for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy "impact_cascade_items_insert_manager"
  on public.impact_cascade_items for insert to authenticated
  with check (public.has_restaurant_role(restaurant_id, array['owner','manager']));

create policy "impact_cascade_items_delete_manager"
  on public.impact_cascade_items for delete to authenticated
  using (public.has_restaurant_role(restaurant_id, array['owner','manager']));
