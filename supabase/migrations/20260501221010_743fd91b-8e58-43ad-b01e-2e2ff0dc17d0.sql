
-- =========================================================
-- Build 1.0 — Tenant foundation
-- =========================================================

-- updated_at helper
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------- profiles ----------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.tg_set_updated_at();

-- profile auto-create on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- profiles policies
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------- restaurants ----------------
create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.restaurants enable row level security;

drop trigger if exists restaurants_set_updated_at on public.restaurants;
create trigger restaurants_set_updated_at
before update on public.restaurants
for each row execute function public.tg_set_updated_at();

-- ---------------- restaurant_members ----------------
create table if not exists public.restaurant_members (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','manager','viewer')),
  created_at timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);

alter table public.restaurant_members enable row level security;

create index if not exists restaurant_members_user_idx
  on public.restaurant_members(user_id);

-- ---------------- restaurant_settings ----------------
create table if not exists public.restaurant_settings (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  currency_code text not null default 'USD',
  locale text not null default 'en-US',
  target_gpm numeric not null default 0.78 check (target_gpm > 0 and target_gpm < 1),
  tax_mode text not null default 'ex_tax' check (tax_mode in ('ex_tax','inc_tax')),
  timezone text not null default 'America/New_York',
  ingredient_spike_threshold_percent numeric not null default 0.10,
  gpm_drop_threshold_percent numeric not null default 0.03,
  gp_floor_amount numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.restaurant_settings enable row level security;

drop trigger if exists restaurant_settings_set_updated_at on public.restaurant_settings;
create trigger restaurant_settings_set_updated_at
before update on public.restaurant_settings
for each row execute function public.tg_set_updated_at();

-- ---------------- helper functions (SECURITY DEFINER) ----------------
create or replace function public.is_restaurant_member(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.restaurant_members
    where restaurant_id = p_restaurant_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.has_restaurant_role(p_restaurant_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.restaurant_members
    where restaurant_id = p_restaurant_id
      and user_id = auth.uid()
      and role = any(p_roles)
  );
$$;

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

  return v_id;
end;
$$;

revoke all on function public.create_restaurant_with_owner(text) from public;
grant execute on function public.create_restaurant_with_owner(text) to authenticated;

revoke all on function public.is_restaurant_member(uuid) from public;
grant execute on function public.is_restaurant_member(uuid) to authenticated;

revoke all on function public.has_restaurant_role(uuid, text[]) from public;
grant execute on function public.has_restaurant_role(uuid, text[]) to authenticated;

-- ---------------- restaurants policies ----------------
drop policy if exists "restaurants_select_member" on public.restaurants;
create policy "restaurants_select_member" on public.restaurants
  for select to authenticated
  using (public.is_restaurant_member(id));

drop policy if exists "restaurants_update_owner" on public.restaurants;
create policy "restaurants_update_owner" on public.restaurants
  for update to authenticated
  using (public.has_restaurant_role(id, array['owner']))
  with check (public.has_restaurant_role(id, array['owner']));

-- No INSERT policy; restaurants must be created via create_restaurant_with_owner.
-- No DELETE policy.

-- ---------------- restaurant_members policies ----------------
-- Members can see all rows for restaurants they belong to.
drop policy if exists "restaurant_members_select" on public.restaurant_members;
create policy "restaurant_members_select" on public.restaurant_members
  for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

-- Owners can add new members (but cannot escalate themselves — initial owner is added by SECURITY DEFINER fn).
drop policy if exists "restaurant_members_insert_owner" on public.restaurant_members;
create policy "restaurant_members_insert_owner" on public.restaurant_members
  for insert to authenticated
  with check (
    public.has_restaurant_role(restaurant_id, array['owner'])
    and user_id <> auth.uid()
  );

-- Owners can update other members' roles, but not their own (no self-escalation).
drop policy if exists "restaurant_members_update_owner" on public.restaurant_members;
create policy "restaurant_members_update_owner" on public.restaurant_members
  for update to authenticated
  using (
    public.has_restaurant_role(restaurant_id, array['owner'])
    and user_id <> auth.uid()
  )
  with check (
    public.has_restaurant_role(restaurant_id, array['owner'])
    and user_id <> auth.uid()
  );

-- Owners can remove other members; sole-owner protection enforced by trigger below.
drop policy if exists "restaurant_members_delete_owner" on public.restaurant_members;
create policy "restaurant_members_delete_owner" on public.restaurant_members
  for delete to authenticated
  using (public.has_restaurant_role(restaurant_id, array['owner']));

-- Sole-owner protection trigger
create or replace function public.protect_sole_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_count int;
begin
  if (tg_op = 'DELETE' and old.role = 'owner')
     or (tg_op = 'UPDATE' and old.role = 'owner' and new.role <> 'owner') then
    select count(*) into v_owner_count
    from public.restaurant_members
    where restaurant_id = old.restaurant_id
      and role = 'owner';
    if v_owner_count <= 1 then
      raise exception 'cannot remove or demote the sole owner of a restaurant';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

drop trigger if exists restaurant_members_protect_sole_owner on public.restaurant_members;
create trigger restaurant_members_protect_sole_owner
before update or delete on public.restaurant_members
for each row execute function public.protect_sole_owner();

-- ---------------- restaurant_settings policies ----------------
drop policy if exists "restaurant_settings_select_member" on public.restaurant_settings;
create policy "restaurant_settings_select_member" on public.restaurant_settings
  for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

drop policy if exists "restaurant_settings_update_owner" on public.restaurant_settings;
create policy "restaurant_settings_update_owner" on public.restaurant_settings
  for update to authenticated
  using (public.has_restaurant_role(restaurant_id, array['owner']))
  with check (public.has_restaurant_role(restaurant_id, array['owner']));

-- No INSERT policy; settings row is created by create_restaurant_with_owner.
