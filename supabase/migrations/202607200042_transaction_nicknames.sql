-- Apelidos preservam um nome familiar para lançamentos importados sem substituir a descrição original.
alter table public.transactions
  add column nickname text
  check (nickname is null or char_length(nickname) between 1 and 120);
