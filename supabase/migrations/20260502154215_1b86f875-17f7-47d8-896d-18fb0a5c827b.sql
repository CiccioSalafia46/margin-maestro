-- =====================================================================
-- Build 1.1 — Settings/Admin Reference Data
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. units (global)
-- ---------------------------------------------------------------------
create table if not exists public.units (
  code text primary key,
  label text not null,
  family text not null check (family in ('mass', 'volume', 'count')),
  base_unit_code text,
  to_base_factor numeric,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.units enable row level security;

create policy "units_select_authenticated"
  on public.units for select
  to authenticated
  using (true);

-- Seed default units (idempotent)
insert into public.units (code, label, family, base_unit_code, to_base_factor, sort_order) values
  ('Ct', 'Count',       'count',  'Ct', 1,            10),
  ('Gr', 'Grams',       'mass',   'Gr', 1,            20),
  ('Kg', 'Kilograms',   'mass',   'Gr', 1000,         21),
  ('Lb', 'Pounds',      'mass',   'Gr', 453.592,      22),
  ('Oz', 'Ounces',      'mass',   'Gr', 28.3495,      23),
  ('Ml', 'Milliliters', 'volume', 'Ml', 1,            30),
  ('Lt', 'Liters',      'volume', 'Ml', 1000,         31),
  ('Gl', 'US Gallons',  'volume', 'Ml', 3785.411784,  32)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- 2. unit_conversions (global)
-- ---------------------------------------------------------------------
create table if not exists public.unit_conversions (
  id uuid primary key default gen_random_uuid(),
  from_unit_code text not null references public.units(code),
  to_unit_code   text not null references public.units(code),
  factor numeric not null,
  requires_density boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (from_unit_code, to_unit_code)
);

alter table public.unit_conversions enable row level security;

create policy "unit_conversions_select_authenticated"
  on public.unit_conversions for select
  to authenticated
  using (true);

-- Seed same-family conversions, derived from to_base_factor.
-- factor(from -> to) = from.to_base_factor / to.to_base_factor
insert into public.unit_conversions (from_unit_code, to_unit_code, factor, requires_density)
select f.code, t.code, (f.to_base_factor / t.to_base_factor)::numeric, false
from public.units f
join public.units t
  on f.family = t.family
where f.family in ('mass','volume','count')
on conflict (from_unit_code, to_unit_code) do nothing;

-- ---------------------------------------------------------------------
-- 3. menu_categories (per-restaurant)
-- ---------------------------------------------------------------------
create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists menu_categories_restaurant_name_uq
  on public.menu_categories (restaurant_id, lower(name));

create index if not exists menu_categories_restaurant_idx
  on public.menu_categories (restaurant_id);

alter table public.menu_categories enable row level security;

create policy "menu_categories_select_member"
  on public.menu_categories for select
  to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy "menu_categories_insert_owner_manager"
  on public.menu_categories for insert
  to authenticated
  with check (public.has_restaurant_role(restaurant_id, array['owner','manager']));

create policy "menu_categories_update_owner_manager"
  on public.menu_categories for update
  to authenticated
  using (public.has_restaurant_role(restaurant_id, array['owner','manager']))
  with check (public.has_restaurant_role(restaurant_id, array['owner','manager']));

-- No DELETE policy — soft-delete via is_active=false.

create trigger trg_menu_categories_updated_at
  before update on public.menu_categories
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- 4. suppliers (per-restaurant)
-- ---------------------------------------------------------------------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  contact_name text,
  email text,
  phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists suppliers_restaurant_name_uq
  on public.suppliers (restaurant_id, lower(name));

create index if not exists suppliers_restaurant_idx
  on public.suppliers (restaurant_id);

alter table public.suppliers enable row level security;

create policy "suppliers_select_member"
  on public.suppliers for select
  to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy "suppliers_insert_owner_manager"
  on public.suppliers for insert
  to authenticated
  with check (public.has_restaurant_role(restaurant_id, array['owner','manager']));

create policy "suppliers_update_owner_manager"
  on public.suppliers for update
  to authenticated
  using (public.has_restaurant_role(restaurant_id, array['owner','manager']))
  with check (public.has_restaurant_role(restaurant_id, array['owner','manager']));

-- No DELETE policy — soft-delete via is_active=false.

create trigger trg_suppliers_updated_at
  before update on public.suppliers
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------
-- 5. initialize_restaurant_reference_data (idempotent)
-- ---------------------------------------------------------------------
create or replace function public.initialize_restaurant_reference_data(p_restaurant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_member boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Caller must be a member of the target restaurant. (Service-definer call
  -- from create_restaurant_with_owner satisfies this because the owner row
  -- is inserted before this function runs.)
  select exists (
    select 1 from public.restaurant_members
    where restaurant_id = p_restaurant_id and user_id = v_uid
  ) into v_is_member;

  if not v_is_member then
    raise exception 'not a member of restaurant %', p_restaurant_id;
  end if;

  -- Default menu categories (idempotent via unique(restaurant_id, lower(name)))
  insert into public.menu_categories (restaurant_id, name, sort_order)
  values
    (p_restaurant_id, 'Appetizers & Salads',        10),
    (p_restaurant_id, 'The Classics',               20),
    (p_restaurant_id, 'Signature Dishes',           30),
    (p_restaurant_id, 'Specials',                   40),
    (p_restaurant_id, 'Desserts',                   50),
    (p_restaurant_id, 'Pizzeria',                   60),
    (p_restaurant_id, 'Wine',                       70),
    (p_restaurant_id, 'Beer',                       80),
    (p_restaurant_id, 'Non-alcoholic beverages',    90),
    (p_restaurant_id, 'Intermediate',              100)
  on conflict (restaurant_id, lower(name)) do nothing;

  -- Default demo suppliers (idempotent)
  insert into public.suppliers (restaurant_id, name)
  values
    (p_restaurant_id, 'Mediterraneo Imports'),
    (p_restaurant_id, 'Local Greens Co.'),
    (p_restaurant_id, 'Dairy & Oil Co.'),
    (p_restaurant_id, 'House Prep')
  on conflict (restaurant_id, lower(name)) do nothing;
end;
$$;

revoke execute on function public.initialize_restaurant_reference_data(uuid) from public, anon;
grant execute on function public.initialize_restaurant_reference_data(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Extend create_restaurant_with_owner to seed reference data
-- ---------------------------------------------------------------------
create or replace function public.create_restaurant_with_owner(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_name text := trim(coalesce(p_name, ''));
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if v_name = '' then
    raise exception 'restaurant name required';
  end if;

  insert into public.restaurants (name, created_by)
  values (v_name, v_uid)
  returning id into v_id;

  insert into public.restaurant_members (restaurant_id, user_id, role)
  values (v_id, v_uid, 'owner');

  insert into public.restaurant_settings (restaurant_id)
  values (v_id);

  -- Seed reference data (categories + demo suppliers).
  perform public.initialize_restaurant_reference_data(v_id);

  return v_id;
end;
$$;

revoke execute on function public.create_restaurant_with_owner(text) from public, anon;
grant execute on function public.create_restaurant_with_owner(text) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Backfill: seed reference data for any pre-existing restaurants.
-- We cannot call initialize_restaurant_reference_data here (no auth.uid()
-- in a migration), so we inline the seed inserts using the same idempotent
-- conflict targets.
-- ---------------------------------------------------------------------
insert into public.menu_categories (restaurant_id, name, sort_order)
select r.id, c.name, c.sort_order
from public.restaurants r
cross join (values
  ('Appetizers & Salads',        10),
  ('The Classics',               20),
  ('Signature Dishes',           30),
  ('Specials',                   40),
  ('Desserts',                   50),
  ('Pizzeria',                   60),
  ('Wine',                       70),
  ('Beer',                       80),
  ('Non-alcoholic beverages',    90),
  ('Intermediate',              100)
) as c(name, sort_order)
on conflict (restaurant_id, lower(name)) do nothing;

insert into public.suppliers (restaurant_id, name)
select r.id, s.name
from public.restaurants r
cross join (values
  ('Mediterraneo Imports'),
  ('Local Greens Co.'),
  ('Dairy & Oil Co.'),
  ('House Prep')
) as s(name)
on conflict (restaurant_id, lower(name)) do nothing;