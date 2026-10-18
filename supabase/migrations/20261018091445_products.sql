create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  sale_price numeric not null default 0 check (sale_price >= 0),
  currency text not null default 'EUR',
  return_rate numeric not null default 0 check (return_rate >= 0 and return_rate < 1),
  return_cost numeric not null default 0 check (return_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_user_id_idx on public.products (user_id);

create table public.cost_lines (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('material', 'labor', 'fixed', 'percent')),
  quantity numeric,
  unit_price numeric,
  hours numeric,
  rate numeric,
  amount numeric,
  percent numeric,
  position int not null default 0
);

create index cost_lines_product_id_idx on public.cost_lines (product_id, position);

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

alter table public.products enable row level security;
alter table public.cost_lines enable row level security;

create policy "Users manage their own products"
on public.products for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users manage cost lines of their own products"
on public.cost_lines for all
to authenticated
using (
  exists (
    select 1 from public.products p
    where p.id = cost_lines.product_id and p.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.products p
    where p.id = cost_lines.product_id and p.user_id = (select auth.uid())
  )
);

grant select, insert, update, delete on public.products, public.cost_lines to authenticated;
