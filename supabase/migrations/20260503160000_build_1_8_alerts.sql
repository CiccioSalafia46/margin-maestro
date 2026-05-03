-- =====================================================================
-- Build 1.8 — Alerts
-- =====================================================================

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  alert_type text not null check (alert_type in (
    'dish_below_target',
    'dish_newly_below_target',
    'ingredient_cost_spike',
    'impact_cascade_margin_drop',
    'missing_menu_price',
    'incomplete_costing',
    'intermediate_cost_shift'
  )),
  severity text not null default 'warning'
    check (severity in ('info', 'warning', 'critical')),
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'resolved', 'dismissed')),
  title text not null,
  message text not null,
  recommended_action text,
  entity_type text check (entity_type is null or entity_type in (
    'ingredient', 'recipe', 'impact_cascade_run', 'impact_cascade_item', 'menu_analytics_row'
  )),
  entity_id uuid,
  batch_id uuid references public.price_update_batches(id) on delete set null,
  impact_cascade_run_id uuid references public.impact_cascade_runs(id) on delete set null,
  impact_cascade_item_id uuid references public.impact_cascade_items(id) on delete set null,
  recipe_id uuid references public.recipes(id) on delete set null,
  ingredient_id uuid references public.ingredients(id) on delete set null,
  payload jsonb,
  detected_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  dismissed_at timestamptz,
  dismissed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.alerts enable row level security;

create trigger alerts_set_updated_at
  before update on public.alerts
  for each row execute function public.tg_set_updated_at();

create policy "alerts_select_member"
  on public.alerts for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy "alerts_insert_manager"
  on public.alerts for insert to authenticated
  with check (public.has_restaurant_role(restaurant_id, array['owner','manager']));

create policy "alerts_update_manager"
  on public.alerts for update to authenticated
  using (public.has_restaurant_role(restaurant_id, array['owner','manager']))
  with check (public.has_restaurant_role(restaurant_id, array['owner','manager']));
