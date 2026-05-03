-- =====================================================================
-- Fix: Team Invitations RLS — use auth.jwt() instead of auth.users
-- =====================================================================
-- Root cause: RLS policies on restaurant_invitations used
--   (select email from auth.users where id = auth.uid())
-- which fails because authenticated clients cannot SELECT auth.users.
-- Fix: use auth.jwt() ->> 'email' which is available from the JWT claim.

-- Drop and recreate select policy
drop policy if exists "restaurant_invitations_select_owner" on public.restaurant_invitations;
create policy "restaurant_invitations_select_owner"
  on public.restaurant_invitations for select to authenticated
  using (
    public.has_restaurant_role(restaurant_id, array['owner'])
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Drop and recreate update policy
drop policy if exists "restaurant_invitations_update_owner" on public.restaurant_invitations;
create policy "restaurant_invitations_update_owner"
  on public.restaurant_invitations for update to authenticated
  using (
    public.has_restaurant_role(restaurant_id, array['owner'])
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (
    public.has_restaurant_role(restaurant_id, array['owner'])
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Fix accept_restaurant_invitation to use auth.jwt() instead of auth.users
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

  -- Use JWT email claim instead of querying auth.users
  v_email := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'email', '');

  if v_email = '' then
    raise exception 'email not available in JWT claims';
  end if;

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
