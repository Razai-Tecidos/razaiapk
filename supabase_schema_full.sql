-- 1. Tabela de Tecidos (Tissues)
create table if not exists public.tissues (
  id uuid primary key, -- ID original do SQLite (UUID)
  sku text not null,
  name text not null,
  width numeric,
  composition text,
  created_at timestamp with time zone default now()
);

-- 2. Tabela de Cores (Colors)
create table if not exists public.colors (
  id uuid primary key,
  sku text not null,
  name text not null,
  hex text not null,
  lab_l numeric,
  lab_a numeric,
  lab_b numeric,
  created_at timestamp with time zone default now()
);

-- 3. Tabela de Estampas (Patterns)
create table if not exists public.patterns (
  id uuid primary key,
  sku text not null,
  family text,
  name text not null,
  created_at timestamp with time zone default now()
);

-- 4. Estatísticas de Família (Family Stats)
create table if not exists public.family_stats (
  family_name text primary key,
  hue_min numeric,
  hue_max numeric,
  hue_avg numeric,
  color_count integer,
  updated_at timestamp with time zone default now()
);

-- 5. Vínculos Tecido + Cor (Links)
create table if not exists public.links (
  id uuid primary key,
  tissue_id uuid references public.tissues(id) on delete cascade,
  color_id uuid references public.colors(id) on delete cascade,
  sku_filho text not null,
  status text default 'active',
  image_path text, -- Caminho no Storage
  created_at timestamp with time zone default now()
);

-- 6. Vínculos Tecido + Estampa (Pattern Links)
create table if not exists public.pattern_links (
  id uuid primary key,
  tissue_id uuid references public.tissues(id) on delete cascade,
  pattern_id uuid references public.patterns(id) on delete cascade,
  sku_filho text not null,
  status text default 'active',
  image_path text, -- Caminho no Storage
  created_at timestamp with time zone default now()
);

-- 7. Estoque (Stock Items) - Opcional se já rodou o outro script, mas bom garantir
create table if not exists public.stock_items (
  id uuid default gen_random_uuid() primary key,
  link_id uuid not null unique references public.links(id) on delete cascade,
  quantity_rolls integer default 0 not null,
  updated_at timestamp with time zone default now()
);

-- 8. Movimentações de Estoque (Stock Movements)
create table if not exists public.stock_movements (
  id uuid default gen_random_uuid() primary key,
  link_id uuid not null references public.links(id) on delete cascade,
  type text not null check (type in ('IN', 'OUT', 'ADJUST')),
  quantity integer not null,
  user_id uuid,
  created_at timestamp with time zone default now() not null
);

-- ============================================================
-- POLÍTICAS DE SEGURANÇA (RLS)
-- Permite acesso público (anon) para facilitar a migração e uso simples
-- ============================================================

alter table public.tissues enable row level security;
create policy "Public Access Tissues" on public.tissues for all using (true);

alter table public.colors enable row level security;
create policy "Public Access Colors" on public.colors for all using (true);

alter table public.patterns enable row level security;
create policy "Public Access Patterns" on public.patterns for all using (true);

alter table public.family_stats enable row level security;
create policy "Public Access Family Stats" on public.family_stats for all using (true);

alter table public.links enable row level security;
create policy "Public Access Links" on public.links for all using (true);

alter table public.pattern_links enable row level security;
create policy "Public Access Pattern Links" on public.pattern_links for all using (true);

alter table public.stock_items enable row level security;
create policy "Public Access Stock Items" on public.stock_items for all using (true);

alter table public.stock_movements enable row level security;
create policy "Public Access Stock Movements" on public.stock_movements for all using (true);

-- ============================================================
-- STORAGE BUCKETS (Se não existirem, crie manualmente no painel)
-- ============================================================
-- insert into storage.buckets (id, name, public) values ('tissue-images', 'tissue-images', true);
-- insert into storage.buckets (id, name, public) values ('pattern-images', 'pattern-images', true);

-- Política de Storage para permitir upload público (CUIDADO EM PROD)
-- create policy "Public Storage Access" on storage.objects for all using ( bucket_id in ('tissue-images', 'pattern-images') );
