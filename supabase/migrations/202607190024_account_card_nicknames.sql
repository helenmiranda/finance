alter table public.accounts
  add column nickname text check (nickname is null or char_length(nickname) between 1 and 60);

alter table public.credit_cards
  add column nickname text check (nickname is null or char_length(nickname) between 1 and 60);
