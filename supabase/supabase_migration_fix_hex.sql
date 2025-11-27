-- Permitir que a coluna HEX seja nula na tabela de cores
alter table public.colors alter column hex drop not null;
