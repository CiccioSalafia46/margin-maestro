-- =====================================================================
-- Build 2.2 — Billing
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. billing_customers
-- ---------------------------------------------------------------------
create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  stripe_customer_id text not null,
  billing_email text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(restaurant_id),
  unique(stripe_customer_id)
);

alter table public.billing_customers enable row level security;

create trigger billing_customers_set_updated_at
  before update on public.billing_customers
  for each row execute function public.tg_set_updated_at();

create policy "billing_customers_select_member"
  on public.billing_customers for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy "billing_customers_insert_owner"
  on public.billing_customers for insert to authenticated
  with check (public.has_restaurant_role(restaurant_id, array['owner']));

create policy "billing_customers_update_owner"
  on public.billing_customers for update to authenticated
  using (public.has_restaurant_role(restaurant_id, array['owner']))
  with check (public.has_restaurant_role(restaurant_id, array['owner']));

-- ---------------------------------------------------------------------
-- 2. billing_subscriptions
-- ---------------------------------------------------------------------
create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  stripe_product_id text,
  plan_key text,
  status text not null default 'none',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_start timestamptz,
  trial_end timestamptz,
  quantity integer,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(restaurant_id)
);

create unique index if not exists billing_subscriptions_stripe_id
  on public.billing_subscriptions (stripe_subscription_id)
  where (stripe_subscription_id is not null);

alter table public.billing_subscriptions enable row level security;

create trigger billing_subscriptions_set_updated_at
  before update on public.billing_subscriptions
  for each row execute function public.tg_set_updated_at();

create policy "billing_subscriptions_select_member"
  on public.billing_subscriptions for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

create policy "billing_subscriptions_insert_owner"
  on public.billing_subscriptions for insert to authenticated
  with check (public.has_restaurant_role(restaurant_id, array['owner']));

create policy "billing_subscriptions_update_owner"
  on public.billing_subscriptions for update to authenticated
  using (public.has_restaurant_role(restaurant_id, array['owner']))
  with check (public.has_restaurant_role(restaurant_id, array['owner']));

-- ---------------------------------------------------------------------
-- 3. billing_events
-- ---------------------------------------------------------------------
create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id) on delete set null,
  stripe_event_id text not null unique,
  event_type text not null,
  processing_status text not null default 'processed'
    check (processing_status in ('processed', 'ignored', 'failed')),
  error_message text,
  payload jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.billing_events enable row level security;

create policy "billing_events_select_owner"
  on public.billing_events for select to authenticated
  using (
    restaurant_id is not null
    and public.has_restaurant_role(restaurant_id, array['owner'])
  );
