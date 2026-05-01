
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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
