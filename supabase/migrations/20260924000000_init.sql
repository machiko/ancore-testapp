-- 社團活動報名系統 — 初始 schema + 假資料
-- 注意：這份 SQL 故意複製了 AI 生成程式碼常見的權限寫法，用來測試 AnCore。請只在測試專案執行。

-- ============ 資料表 ============
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date date not null,
  location text,
  capacity int not null default 30,
  created_at timestamptz default now()
);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  user_id uuid references auth.users(id),
  name text not null,
  phone text,
  email text,
  diet text,
  note text,
  paid boolean default false,
  created_at timestamptz default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- 註冊時自動建立 profile
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1));
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ RLS ============
alter table public.events enable row level security;
alter table public.registrations enable row level security;
alter table public.profiles enable row level security;

-- events：所有人可看，管理員可改（管理員判斷在前端）
create policy "Anyone can view events" on public.events
  for select using (true);
create policy "Authenticated users can manage events" on public.events
  for all to authenticated using (true) with check (true);

-- registrations：不用登入就能報名
create policy "Anyone can register" on public.registrations
  for insert with check (true);
-- 讓管理後台能看到全部名單
create policy "Authenticated users can view registrations" on public.registrations
  for select to authenticated using (true);
create policy "Users can cancel their own registration" on public.registrations
  for delete to authenticated using (auth.uid() = user_id);
create policy "Authenticated users can update registrations" on public.registrations
  for update to authenticated using (true);

-- profiles：顯示名稱要能被其他人看到
create policy "Profiles are viewable by everyone" on public.profiles
  for select using (true);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);
-- 給後端用
create policy "Service role full access" on public.profiles
  for all using (true) with check (true);

-- ============ 假資料 ============
insert into public.events (title, description, event_date, location, capacity) values
  ('秋季登山健行', '一起走陽明山二子坪步道，適合新手。', '2026-10-18', '陽明山二子坪', 25),
  ('桌遊之夜', '帶你玩五款經典桌遊，新手友善。', '2026-10-24', '社團辦公室', 16),
  ('手沖咖啡工作坊', '從磨豆到沖煮，兩小時上手。', '2026-11-02', '大稻埕咖啡教室', 12),
  ('年度攝影外拍', '主題：老街與黃昏。', '2026-11-15', '九份老街', 20),
  ('歲末聚餐', '一年一次的大聚餐，歡迎攜伴。', '2026-12-20', '待定', 60);

-- 每個活動 10 筆假報名（姓名/手機/email 皆為虛構）
insert into public.registrations (event_id, name, phone, email, diet, note, paid)
select e.id,
       (array['王小明','陳美玲','林志豪','張雅婷','李俊宏','黃淑芬','吳建宏','劉怡君','蔡宗翰','鄭佳穎'])[g],
       '09' || lpad((10000000 + (random()*89999999)::int)::text, 8, '0'),
       'test' || g || '_' || substr(e.id::text, 1, 4) || '@example.com',
       (array['', '素食', '', '不吃牛', '', '', '素食', '', '', '其他'])[g],
       case when g % 4 = 0 then '會晚十分鐘到' else '' end,
       g % 3 = 0
from public.events e, generate_series(1, 10) g;
