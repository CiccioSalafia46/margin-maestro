-- =====================================================================
-- Build 1.3 — Recipes
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. recipes
-- ---------------------------------------------------------------------
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('intermediate', 'dish')),
  menu_category_id uuid references public.menu_categories(id) on delete set null,
  serving_quantity numeric(18,6) not null default 1 check (serving_quantity > 0),
  serving_uom_code text not null references public.units(code),
  menu_price numeric(18,6) check (menu_price is null or menu_price >= 0),
  linked_intermediate_ingredient_id uuid references public.ingredients(id) on delete set null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists recipes_unique_name
  on public.recipes (restaurant_id, lower(name))
  where (is_active = true);

alter table public.recipes enable row level security;

create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function public.tg_set_updated_at();

-- RLS policies
create policy "recipes_select_member"
  on public.recipes for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy "recipes_insert_manager"
  on public.recipes for insert to authenticated
  with check (public.has_restaurant_role(restaurant_id, array['owner','manager']));

create policy "recipes_update_manager"
  on public.recipes for update to authenticated
  using (public.has_restaurant_role(restaurant_id, array['owner','manager']))
  with check (public.has_restaurant_role(restaurant_id, array['owner','manager']));

-- No DELETE policy — use is_active = false for deactivation.

-- ---------------------------------------------------------------------
-- 2. recipe_lines
-- ---------------------------------------------------------------------
create table if not exists public.recipe_lines (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantity numeric(18,6) not null check (quantity > 0),
  uom_code text not null references public.units(code),
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recipe_lines enable row level security;

create trigger recipe_lines_set_updated_at
  before update on public.recipe_lines
  for each row execute function public.tg_set_updated_at();

-- RLS policies
create policy "recipe_lines_select_member"
  on public.recipe_lines for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy "recipe_lines_insert_manager"
  on public.recipe_lines for insert to authenticated
  with check (public.has_restaurant_role(restaurant_id, array['owner','manager']));

create policy "recipe_lines_update_manager"
  on public.recipe_lines for update to authenticated
  using (public.has_restaurant_role(restaurant_id, array['owner','manager']))
  with check (public.has_restaurant_role(restaurant_id, array['owner','manager']));

create policy "recipe_lines_delete_manager"
  on public.recipe_lines for delete to authenticated
  using (public.has_restaurant_role(restaurant_id, array['owner','manager']));
