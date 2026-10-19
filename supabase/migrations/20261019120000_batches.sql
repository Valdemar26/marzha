-- Replaces the per-product margin model with batch pricing. The old tables only held test data.
drop table public.cost_lines;
drop table public.products;

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  quantity numeric not null check (quantity > 0),
  currency text not null default 'UAH' check (currency ~ '^[A-Z]{3}$'),
  defect_rate numeric not null default 0 check (defect_rate >= 0 and defect_rate < 1),
  target_profit numeric not null default 0 check (target_profit >= 0),
  competitor_price numeric check (competitor_price >= 0),
  sales_start_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index batches_user_id_idx on public.batches (user_id);

create trigger batches_set_updated_at
before update on public.batches
for each row execute function public.set_updated_at();

create table public.batch_costs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  kind text not null check (kind in ('one_time', 'monthly', 'per_sale_fixed', 'per_sale_percent')),
  amount numeric check (amount >= 0),
  percent numeric check (percent >= 0 and percent <= 1),
  position int not null default 0,
  check (
    case kind
      when 'per_sale_percent' then percent is not null and amount is null
      else amount is not null and percent is null
    end
  )
);

create index batch_costs_batch_id_idx on public.batch_costs (batch_id, position);

create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  position int not null default 0
);

create index scenarios_batch_id_idx on public.scenarios (batch_id, position);

create table public.scenario_stages (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.scenarios (id) on delete cascade,
  share numeric not null check (share >= 0 and share <= 1),
  discount numeric not null default 0 check (discount >= 0 and discount <= 1),
  months numeric not null default 1 check (months >= 0),
  position int not null default 0
);

create index scenario_stages_scenario_id_idx on public.scenario_stages (scenario_id, position);

alter table public.batches enable row level security;
alter table public.batch_costs enable row level security;
alter table public.scenarios enable row level security;
alter table public.scenario_stages enable row level security;

create policy "Users manage their own batches"
on public.batches for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users manage costs of their own batches"
on public.batch_costs for all
to authenticated
using (
  exists (
    select 1 from public.batches b
    where b.id = batch_costs.batch_id and b.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.batches b
    where b.id = batch_costs.batch_id and b.user_id = (select auth.uid())
  )
);

create policy "Users manage scenarios of their own batches"
on public.scenarios for all
to authenticated
using (
  exists (
    select 1 from public.batches b
    where b.id = scenarios.batch_id and b.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.batches b
    where b.id = scenarios.batch_id and b.user_id = (select auth.uid())
  )
);

create policy "Users manage stages of their own scenarios"
on public.scenario_stages for all
to authenticated
using (
  exists (
    select 1 from public.scenarios s
    join public.batches b on b.id = s.batch_id
    where s.id = scenario_stages.scenario_id and b.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.scenarios s
    join public.batches b on b.id = s.batch_id
    where s.id = scenario_stages.scenario_id and b.user_id = (select auth.uid())
  )
);

grant select, insert, update, delete
on public.batches, public.batch_costs, public.scenarios, public.scenario_stages
to authenticated;
