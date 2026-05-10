-- Build 2.9 — Menu Price Audit Trail
-- Append-only audit log for changes to dish recipes' menu_price.
-- This is NOT ingredient_price_log (supplier prices) and NOT POS publishing.
-- Only menu price changes initiated inside Margin IQ are recorded here.
--
-- Re-runnable: prior failed attempts may have partially created the table or
-- policies, so we use IF NOT EXISTS / DROP POLICY IF EXISTS where appropriate.

create table if not exists public.menu_price_audit_log (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete set null,
  recipe_name_at_time text not null,
  recipe_kind_at_time text not null default 'dish',
  category_name_at_time text,
  old_menu_price numeric(18,6),
  new_menu_price numeric(18,6) not null,
  delta_amount numeric(18,6),
  delta_percent numeric(18,8),
  source text not null,
  context jsonb,
  note text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint menu_price_audit_log_new_price_positive
    check (new_menu_price > 0),
  constraint menu_price_audit_log_kind_dish_only
    check (recipe_kind_at_time = 'dish'),
  constraint menu_price_audit_log_source_valid
    check (source in ('apply_price', 'manual_recipe_edit', 'import', 'system', 'other'))
);

create index if not exists menu_price_audit_log_restaurant_idx
  on public.menu_price_audit_log (restaurant_id);
create index if not exists menu_price_audit_log_recipe_idx
  on public.menu_price_audit_log (recipe_id);
create index if not exists menu_price_audit_log_changed_at_idx
  on public.menu_price_audit_log (changed_at desc);
create index if not exists menu_price_audit_log_source_idx
  on public.menu_price_audit_log (source);
create index if not exists menu_price_audit_log_changed_by_idx
  on public.menu_price_audit_log (changed_by);

alter table public.menu_price_audit_log enable row level security;

-- Drop any prior versions of these policies in case a previous failed run
-- created them with the wrong has_restaurant_role(...) call signature.
drop policy if exists "menu_price_audit_log_select_members"
  on public.menu_price_audit_log;
drop policy if exists "menu_price_audit_log_insert_owner_manager"
  on public.menu_price_audit_log;

-- SELECT: members of the same restaurant.
create policy "menu_price_audit_log_select_members"
  on public.menu_price_audit_log
  for select
  to authenticated
  using (public.is_restaurant_member(restaurant_id));

-- INSERT: only owner or manager of the same restaurant.
-- has_restaurant_role(restaurant_id, text[]) — array of role names, matching
-- the project-wide pattern used in builds 1.2, 1.3, 1.5, 1.7, 1.8.
create policy "menu_price_audit_log_insert_owner_manager"
  on public.menu_price_audit_log
  for insert
  to authenticated
  with check (public.has_restaurant_role(restaurant_id, array['owner','manager']));

-- No UPDATE policy: rows are immutable.
-- No DELETE policy: rows are append-only.

comment on table public.menu_price_audit_log is
  'Append-only audit log of dish recipe menu_price changes. Build 2.9.';
comment on column public.menu_price_audit_log.source is
  'Origin of the change: apply_price | manual_recipe_edit | import | system | other.';
comment on column public.menu_price_audit_log.context is
  'Optional structured context: origin route, target_gpm, scenario tag, etc. Never includes secrets.';
