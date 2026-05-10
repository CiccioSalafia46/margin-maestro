-- Build 3.4 — Atomic RPC Hardening
-- Adds a single SQL function that updates a dish recipe's menu_price and
-- inserts the corresponding menu_price_audit_log row in one transaction.
--
-- No new tables. No RLS changes. SECURITY INVOKER so the caller's RLS context
-- is preserved (same checks as direct UPDATE/INSERT). Defensive role check is
-- repeated inside the function to produce a clean error before the row locks.
--
-- Re-runnable: uses CREATE OR REPLACE FUNCTION and idempotent GRANT/REVOKE.

create or replace function public.apply_dish_menu_price_with_audit(
  p_restaurant_id uuid,
  p_recipe_id uuid,
  p_new_menu_price numeric,
  p_source text default 'apply_price',
  p_note text default null,
  p_context jsonb default '{}'::jsonb
)
returns table (
  recipe_id uuid,
  old_menu_price numeric,
  new_menu_price numeric,
  audit_log_id uuid,
  changed_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_old_price numeric;
  v_kind text;
  v_active boolean;
  v_rest uuid;
  v_name text;
  v_category_id uuid;
  v_category_name text;
  v_delta_amount numeric;
  v_delta_percent numeric;
  v_audit_id uuid;
  v_changed_at timestamptz := now();
begin
  -- Authentication
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Input validation
  if p_new_menu_price is null or not (p_new_menu_price > 0) then
    raise exception 'new_menu_price must be greater than zero' using errcode = '22023';
  end if;

  if p_source is null or p_source not in (
    'apply_price', 'manual_recipe_edit', 'import', 'system', 'other'
  ) then
    raise exception 'invalid source value' using errcode = '22023';
  end if;

  -- Defensive role check; RLS also enforces this on UPDATE/INSERT below.
  if not public.has_restaurant_role(p_restaurant_id, array['owner','manager']) then
    raise exception 'permission denied: requires owner or manager role' using errcode = '42501';
  end if;

  -- Lock the target row and read prior state in one go.
  select r.menu_price, r.kind, r.is_active, r.restaurant_id, r.name, r.menu_category_id
    into v_old_price, v_kind, v_active, v_rest, v_name, v_category_id
  from public.recipes r
  where r.id = p_recipe_id and r.restaurant_id = p_restaurant_id
  for update;

  if not found then
    raise exception 'recipe not found for this restaurant' using errcode = 'P0002';
  end if;

  if v_kind is distinct from 'dish' then
    raise exception 'apply price only valid for dish recipes' using errcode = '22023';
  end if;

  if v_active is not true then
    raise exception 'recipe is inactive' using errcode = '22023';
  end if;

  -- Best-effort category name lookup (does not block on failure).
  if v_category_id is not null then
    select c.name into v_category_name
    from public.menu_categories c
    where c.id = v_category_id and c.restaurant_id = p_restaurant_id;
  end if;

  -- Update menu_price.
  update public.recipes
    set menu_price = p_new_menu_price,
        updated_at = v_changed_at
  where id = p_recipe_id and restaurant_id = p_restaurant_id;

  -- Compute deltas safely (no NaN/Infinity).
  if v_old_price is null then
    v_delta_amount := null;
    v_delta_percent := null;
  else
    v_delta_amount := p_new_menu_price - v_old_price;
    if v_old_price = 0 then
      v_delta_percent := null;
    else
      v_delta_percent := v_delta_amount / v_old_price;
    end if;
  end if;

  -- Insert audit row. Same transaction = atomic with the update above.
  insert into public.menu_price_audit_log (
    restaurant_id, recipe_id, recipe_name_at_time, recipe_kind_at_time,
    category_name_at_time, old_menu_price, new_menu_price,
    delta_amount, delta_percent, source, context, note, changed_by, changed_at
  ) values (
    p_restaurant_id, p_recipe_id, v_name, 'dish',
    v_category_name, v_old_price, p_new_menu_price,
    v_delta_amount, v_delta_percent, p_source,
    coalesce(p_context, '{}'::jsonb), p_note, v_user, v_changed_at
  )
  returning id into v_audit_id;

  -- Return the structured result.
  return query
    select p_recipe_id, v_old_price, p_new_menu_price, v_audit_id, v_changed_at;
end;
$$;

comment on function public.apply_dish_menu_price_with_audit(uuid, uuid, numeric, text, text, jsonb) is
  'Build 3.4: atomic dish menu_price update + menu_price_audit_log insert. SECURITY INVOKER. Owner/manager only via RLS + defensive check. Source must be one of apply_price | manual_recipe_edit | import | system | other.';

-- Lock down execute: revoke from PUBLIC, grant to authenticated only.
revoke all on function public.apply_dish_menu_price_with_audit(uuid, uuid, numeric, text, text, jsonb) from public;
revoke all on function public.apply_dish_menu_price_with_audit(uuid, uuid, numeric, text, text, jsonb) from anon;
grant execute on function public.apply_dish_menu_price_with_audit(uuid, uuid, numeric, text, text, jsonb) to authenticated;
