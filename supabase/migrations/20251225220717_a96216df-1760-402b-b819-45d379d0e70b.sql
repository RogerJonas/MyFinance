-- Core enum for roles
create type public.app_role as enum ('admin', 'collaborator', 'accountant');

-- Profiles table linked to auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile" on public.profiles
for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
for insert with check (auth.uid() = id);

-- User roles table
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create policy "Users can view own roles" on public.user_roles
for select using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

-- Companies
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_id text,
  default_regime text check (default_regime in ('cash','accrual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.companies enable row level security;

create table public.company_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'collaborator',
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

alter table public.company_users enable row level security;

create policy "Users see own company links" on public.company_users
for select using (auth.uid() = user_id);

create policy "Members can view their companies" on public.companies
for select using (
  exists (
    select 1 from public.company_users cu
    where cu.company_id = companies.id and cu.user_id = auth.uid()
  )
);

-- Chart of accounts (plano de contas)
create type public.account_class as enum ('asset','liability','equity','revenue','expense');

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  class public.account_class not null,
  parent_id uuid references public.accounts(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

alter table public.accounts enable row level security;

create policy "Company members manage accounts" on public.accounts
for all using (
  exists (
    select 1 from public.company_users cu
    where cu.company_id = accounts.company_id and cu.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.company_users cu
    where cu.company_id = accounts.company_id and cu.user_id = auth.uid()
  )
);

-- Financial accounts (bank, cash, credit card control)
create type public.financial_account_type as enum ('bank','cash','credit_card');

create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  type public.financial_account_type not null,
  initial_balance numeric(14,2) not null default 0,
  currency text not null default 'BRL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.financial_accounts enable row level security;

create policy "Company members manage financial accounts" on public.financial_accounts
for all using (
  exists (
    select 1 from public.company_users cu
    where cu.company_id = financial_accounts.company_id and cu.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.company_users cu
    where cu.company_id = financial_accounts.company_id and cu.user_id = auth.uid()
  )
);

-- Cost centers
create table public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  parent_id uuid references public.cost_centers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

alter table public.cost_centers enable row level security;

create policy "Company members manage cost centers" on public.cost_centers
for all using (
  exists (
    select 1 from public.company_users cu
    where cu.company_id = cost_centers.company_id and cu.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.company_users cu
    where cu.company_id = cost_centers.company_id and cu.user_id = auth.uid()
  )
);

-- Transactions
create type public.transaction_type as enum ('income','expense');
create type public.transaction_status as enum ('scheduled','pending','realized','reconciled');
create type public.transaction_recurrence_type as enum ('none','installment','fixed');

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  financial_account_id uuid not null references public.financial_accounts(id),
  account_id uuid references public.accounts(id),
  cost_center_id uuid references public.cost_centers(id),
  type public.transaction_type not null,
  amount numeric(14,2) not null,
  cash_date date not null,
  competence_date date not null,
  status public.transaction_status not null default 'scheduled',
  recurrence_type public.transaction_recurrence_type not null default 'none',
  recurrence_total integer,
  recurrence_index integer,
  recurrence_parent_id uuid references public.transactions(id) on delete cascade,
  description text,
  notes text,
  origin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "Company members manage transactions" on public.transactions
for all using (
  exists (
    select 1 from public.company_users cu
    where cu.company_id = transactions.company_id and cu.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.company_users cu
    where cu.company_id = transactions.company_id and cu.user_id = auth.uid()
  )
);

-- Simple goals table
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  account_id uuid references public.accounts(id),
  cost_center_id uuid references public.cost_centers(id),
  period_start date not null,
  period_end date not null,
  target_amount numeric(14,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.goals enable row level security;

create policy "Company members manage goals" on public.goals
for all using (
  exists (
    select 1 from public.company_users cu
    where cu.company_id = goals.company_id and cu.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.company_users cu
    where cu.company_id = goals.company_id and cu.user_id = auth.uid()
  )
);

-- Audit log (basic)
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id uuid,
  created_at timestamptz not null default now(),
  details jsonb
);

alter table public.audit_log enable row level security;

create policy "Company members can read audit log" on public.audit_log
for select using (
  company_id is null or exists (
    select 1 from public.company_users cu
    where cu.company_id = audit_log.company_id and cu.user_id = auth.uid()
  )
);

-- Generic updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at_profiles
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_updated_at_companies
before update on public.companies
for each row execute function public.set_updated_at();

create trigger set_updated_at_accounts
before update on public.accounts
for each row execute function public.set_updated_at();

create trigger set_updated_at_financial_accounts
before update on public.financial_accounts
for each row execute function public.set_updated_at();

create trigger set_updated_at_cost_centers
before update on public.cost_centers
for each row execute function public.set_updated_at();

create trigger set_updated_at_transactions
before update on public.transactions
for each row execute function public.set_updated_at();

create trigger set_updated_at_goals
before update on public.goals
for each row execute function public.set_updated_at();