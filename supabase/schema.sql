-- 学生跟进系统 · Supabase 数据库结构
-- 用法：Supabase 控制台 → SQL Editor → 粘贴整段 → Run。可以重复运行（不会删数据）。
--
-- 安全：每张表都开启了行级安全（RLS），每个登录账号只能读写 owner_id = 自己 的数据。
-- 以后扩展成团队：可以加一张 workspace_members 表，把下面的策略改成按团队判断。
-- 「负责人」（students.assignee）和「记录人」（timeline_events.recorder）已经预留。

create extension if not exists pgcrypto;

-- ───────────── 学生 ─────────────
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  english_name text,
  assignee text,                         -- 负责人（null = 未分配）
  business_type text not null default '其他',
  status text not null default '未开始',
  ball text not null default '我们',
  priority text not null default '普通',
  background text not null default '',
  referrer text,
  contact text,
  follow_cycle_days int not null default 14,
  next_follow_date date,
  last_handled_date date,
  last_checked_date date,
  dormant_until date,
  dormant_reason text,
  import_meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────── 申请学校 ─────────────
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  school text not null default '',
  program text not null default '',
  intake text not null default '',
  status text not null default '未递交',
  note text not null default '',
  offer_ddl date,
  offer_ddl_tbc boolean not null default false,
  tbc_remind_on date,
  payment_ddl date,
  payment_done_on date,
  condition_text text not null default '',
  condition_ddl date,
  condition_done_on date,
  last_reminded_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────── 签证 ─────────────
create table if not exists public.visas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  visa_type text not null default '500',
  materials_on date,
  paid_on date,
  submitted_on date,
  medical_on date,
  granted_on date,
  expiry_date date,
  expiry_ack_on date,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────── 关键日期 ─────────────
create table if not exists public.key_dates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  kind text not null default '其他',
  date date not null,
  note text not null default '',
  ack_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────── 待办 ─────────────
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  content text not null,
  due_date date,
  handler text,                          -- 交给谁
  done_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────── 收费 ─────────────
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  item text not null default '',
  amount numeric,
  currency text not null default 'AUD',
  paid_on date,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────── 时间线（只能追加，不能删除） ─────────────
create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  kind text not null default 'note',
  occurred_on date not null,             -- 发生日期（可改）
  date_unknown boolean not null default false,
  content text not null default '',
  recorder text,                         -- 记录人
  milestone boolean not null default false,
  edit_history jsonb not null default '[]'::jsonb,  -- 编辑前的原文
  edited_at timestamptz,
  source text,
  created_at timestamptz not null default now()     -- 录入时间（不能改）
);

-- ───────────── 导入确认清单 ─────────────
create table if not exists public.review_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  kind text not null,
  text text not null default '',
  suggestion jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ───────────── 设置（负责人列表等） ─────────────
create table if not exists public.app_settings (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ───────────── 索引 ─────────────
create index if not exists students_owner_idx on public.students(owner_id);
create index if not exists applications_student_idx on public.applications(student_id);
create index if not exists visas_student_idx on public.visas(student_id);
create index if not exists key_dates_student_idx on public.key_dates(student_id);
create index if not exists tasks_student_idx on public.tasks(student_id);
create index if not exists payments_student_idx on public.payments(student_id);
create index if not exists events_student_idx on public.timeline_events(student_id, occurred_on);
create index if not exists review_items_student_idx on public.review_items(student_id);

-- ───────────── 权限：只有登录用户能访问（未登录的 anon 什么都看不到） ─────────────
grant usage on schema public to authenticated;
revoke all on public.students, public.applications, public.visas, public.key_dates, public.tasks,
  public.payments, public.timeline_events, public.review_items, public.app_settings from anon;
grant select, insert, update, delete on public.students, public.applications, public.visas, public.key_dates,
  public.tasks, public.payments, public.review_items, public.app_settings to authenticated;
-- 时间线没有删除权限（删除学生时会由数据库级联删除）
revoke delete on public.timeline_events from authenticated;
grant select, insert, update on public.timeline_events to authenticated;

-- ───────────── 行级安全 ─────────────
do $$
declare t text;
begin
  foreach t in array array['students','applications','visas','key_dates','tasks','payments','review_items','app_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
  end loop;
end $$;

-- 时间线：可以读、追加、编辑，但不能删除
alter table public.timeline_events enable row level security;
drop policy if exists "own rows" on public.timeline_events;
drop policy if exists "read own events" on public.timeline_events;
drop policy if exists "insert own events" on public.timeline_events;
drop policy if exists "update own events" on public.timeline_events;
create policy "read own events" on public.timeline_events for select to authenticated using (owner_id = auth.uid());
create policy "insert own events" on public.timeline_events for insert to authenticated with check (owner_id = auth.uid());
create policy "update own events" on public.timeline_events for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 录入时间不能改
create or replace function public.keep_event_created_at() returns trigger language plpgsql as $$
begin
  new.created_at := old.created_at;
  return new;
end $$;
drop trigger if exists keep_event_created_at on public.timeline_events;
create trigger keep_event_created_at before update on public.timeline_events
  for each row execute function public.keep_event_created_at();

-- 「设置 → 清空所有数据」用的函数（只清空当前账号自己的数据）
create or replace function public.reset_all_data() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.timeline_events where owner_id = auth.uid();
  delete from public.review_items where owner_id = auth.uid();
  delete from public.payments where owner_id = auth.uid();
  delete from public.tasks where owner_id = auth.uid();
  delete from public.key_dates where owner_id = auth.uid();
  delete from public.visas where owner_id = auth.uid();
  delete from public.applications where owner_id = auth.uid();
  delete from public.students where owner_id = auth.uid();
end $$;
revoke all on function public.reset_all_data() from public, anon;
grant execute on function public.reset_all_data() to authenticated;
