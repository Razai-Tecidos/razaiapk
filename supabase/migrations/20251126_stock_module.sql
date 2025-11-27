-- 1. Tabela de Saldo Atual (Stock Items)
create table if not exists public.stock_items (
  id uuid default gen_random_uuid() primary key,
  link_id uuid not null unique, -- Garante apenas 1 registro de estoque por vínculo
  quantity_rolls integer default 0 not null,
  updated_at timestamp with time zone default now(),
  
  -- Constraint para garantir integridade referencial (assumindo que a tabela links existe)
  constraint fk_stock_link foreign key (link_id) references public.links (id) on delete cascade
);

-- Habilitar RLS (Segurança)
alter table public.stock_items enable row level security;
create policy "Public Read Stock" on public.stock_items for select using (true);
create policy "Public Write Stock" on public.stock_items for all using (true); -- Ajuste conforme necessidade de auth

-- 2. Tabela de Histórico de Movimentações (Stock Movements)
create table if not exists public.stock_movements (
  id uuid default gen_random_uuid() primary key,
  link_id uuid not null,
  type text not null check (type in ('IN', 'OUT', 'ADJUST')),
  quantity integer not null, -- Quantidade absoluta do movimento
  user_id uuid, -- Pode ser null se for sistema, ou FK para auth.users
  created_at timestamp with time zone default now() not null,

  constraint fk_movement_link foreign key (link_id) references public.links (id) on delete cascade
);

-- Índices para Performance da IA (Previsão de 7/15/30 dias)
-- Este índice composto acelera drasticamente a busca de "saídas dos últimos X dias para o item Y"
create index if not exists idx_movements_link_date_type 
  on public.stock_movements (link_id, created_at, type);

-- Habilitar RLS
alter table public.stock_movements enable row level security;
create policy "Public Read Movements" on public.stock_movements for select using (true);
create policy "Public Write Movements" on public.stock_movements for insert with check (true);

-- 3. View para Consumo Diário (Base para o Algoritmo de Previsão)
create or replace view public.daily_stock_consumption as
select
  link_id,
  date(created_at) as consumption_date,
  sum(quantity) as total_consumed
from
  public.stock_movements
where
  type = 'OUT'
group by
  link_id,
  date(created_at);

-- 4. RPC: Função Transacional para Registrar Movimento
-- Esta função garante que nunca haverá um movimento sem a atualização correspondente do saldo.
create or replace function public.register_stock_movement(
  p_link_id uuid,
  p_type text,
  p_quantity integer,
  p_user_id uuid default null
)
returns void
language plpgsql
as $$
declare
  v_current_qty integer;
begin
  -- 1. Garantir que o item de estoque existe (Upsert)
  insert into public.stock_items (link_id, quantity_rolls)
  values (p_link_id, 0)
  on conflict (link_id) do nothing;

  -- 2. Registrar o movimento no histórico
  insert into public.stock_movements (link_id, type, quantity, user_id)
  values (p_link_id, p_type, p_quantity, p_user_id);

  -- 3. Atualizar o saldo atual baseado no tipo
  if p_type = 'IN' then
    update public.stock_items 
    set quantity_rolls = quantity_rolls + p_quantity,
        updated_at = now()
    where link_id = p_link_id;
    
  elsif p_type = 'OUT' then
    update public.stock_items 
    set quantity_rolls = quantity_rolls - p_quantity,
        updated_at = now()
    where link_id = p_link_id;
    
  elsif p_type = 'ADJUST' then
    -- ADJUST aqui funciona como um "Delta" (Correção). 
    -- Se quiser setar o valor absoluto, a lógica seria diferente, 
    -- mas para manter consistência com 'somando/subtraindo', tratamos como ajuste (+/-).
    update public.stock_items 
    set quantity_rolls = quantity_rolls + p_quantity,
        updated_at = now()
    where link_id = p_link_id;
  end if;
end;
$$;
