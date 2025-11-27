-- Ensure catalog links can be updated by anon/admin clients
alter policy "Public Access Links" on public.links
  using (true)
  with check (true);

alter policy "Public Access Pattern Links" on public.pattern_links
  using (true)
  with check (true);
