-- =====================================================================
-- Build 2.1 — Team Management
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. restaurant_invitations
-- ---------------------------------------------------------------------
create table if not exists public.restaurant_invitations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'manager', 'viewer')),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'cancelled', 'expired')),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz,
  token uuid not null default gen_random_uuid(),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One pending invite per email per restaurant
create unique index if not exists restaurant_invitations_pending_unique
  on public.restaurant_invitations (restaurant_id, lower(email))
  where (status = 'pending');

create unique index if not exists restaurant_invitations_token_unique
  on public.restaurant_invitations (token);

alter table public.restaurant_invitations enable row level security;

create trigger restaurant_invitations_set_updated_at
  before update on public.restaurant_invitations
  for each row execute function public.tg_set_updated_at();

-- RLS: owners can manage invitations
create policy "restaurant_invitations_select_owner"
  on public.restaurant_invitations for select to authenticated
  using (
    public.has_restaurant_role(restaurant_id, array['owner'])
    or lower(email) = lower((select email from auth.users where id = auth.uid()))
  );

create policy "restaurant_invitations_insert_owner"
  on public.restaurant_invitations for insert to authenticated
  with check (public.has_restaurant_role(restaurant_id, array['owner']));

create policy "restaurant_invitations_update_owner"
  on public.restaurant_invitations for update to authenticated
  using (
    public.has_restaurant_role(restaurant_id, array['owner'])
    or lower(email) = lower((select email from auth.users where id = auth.uid()))
  )
  with check (
    public.has_restaurant_role(restaurant_id, array['owner'])
    or lower(email) = lower((select email from auth.users where id = auth.uid()))
  );

-- ---------------------------------------------------------------------
-- 2. accept_restaurant_invitation RPC
-- ---------------------------------------------------------------------
create or replace function public.accept_restaurant_invitation(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_inv record;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select email into v_email from auth.users where id = v_uid;

  select * into v_inv
  from public.restaurant_invitations
  where token = p_token
    and status = 'pending'
    and lower(email) = lower(v_email);

  if v_inv is null then
    raise exception 'invitation not found, expired, or email mismatch';
  end if;

  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    update public.restaurant_invitations set status = 'expired' where id = v_inv.id;
    raise exception 'invitation has expired';
  end if;

  -- Check if already a member (idempotent)
  if exists (
    select 1 from public.restaurant_members
    where restaurant_id = v_inv.restaurant_id and user_id = v_uid
  ) then
    update public.restaurant_invitations
    set status = 'accepted', accepted_by = v_uid, accepted_at = now()
    where id = v_inv.id;
    return jsonb_build_object('restaurant_id', v_inv.restaurant_id, 'role', v_inv.role, 'already_member', true);
  end if;

  -- Insert membership
  insert into public.restaurant_members (restaurant_id, user_id, role)
  values (v_inv.restaurant_id, v_uid, v_inv.role);

  -- Mark accepted
  update public.restaurant_invitations
  set status = 'accepted', accepted_by = v_uid, accepted_at = now()
  where id = v_inv.id;

  return jsonb_build_object('restaurant_id', v_inv.restaurant_id, 'role', v_inv.role, 'already_member', false);
end;
$$;

revoke all on function public.accept_restaurant_invitation(uuid) from public, anon;
grant execute on function public.accept_restaurant_invitation(uuid) to authenticated;
