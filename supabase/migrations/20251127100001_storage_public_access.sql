-- Ensure buckets exist and remain public
insert into storage.buckets (id, name, public)
values
  ('tissue-images', 'tissue-images', true),
  ('pattern-images', 'pattern-images', true)
on conflict (id) do update set public = excluded.public;

-- Create storage policies only when the executing role owns storage.objects
do $$
declare
  owner_oid oid;
  current_oid oid;
begin
  select relowner into owner_oid from pg_class where oid = 'storage.objects'::regclass;
  select oid into current_oid from pg_roles where rolname = current_user;

  if owner_oid = current_oid then
    begin
      create policy "Catalog Images Read" on storage.objects
        for select
        using (bucket_id in ('tissue-images', 'pattern-images'));
    exception
      when duplicate_object then null;
    end;

    begin
      create policy "Catalog Images Insert" on storage.objects
        for insert
        with check (bucket_id in ('tissue-images', 'pattern-images'));
    exception
      when duplicate_object then null;
    end;

    begin
      create policy "Catalog Images Update" on storage.objects
        for update
        using (bucket_id in ('tissue-images', 'pattern-images'))
        with check (bucket_id in ('tissue-images', 'pattern-images'));
    exception
      when duplicate_object then null;
    end;

    begin
      create policy "Catalog Images Delete" on storage.objects
        for delete
        using (bucket_id in ('tissue-images', 'pattern-images'));
    exception
      when duplicate_object then null;
    end;
  else
    raise notice 'Skipping storage.objects policy creation because % is not owner', current_user;
  end if;
end $$;
