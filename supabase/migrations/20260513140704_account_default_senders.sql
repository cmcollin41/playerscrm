alter table public.accounts
  add column if not exists default_invoice_sender_id uuid
    references public.senders(id) on delete set null,
  add column if not exists default_sender_id uuid
    references public.senders(id) on delete set null;

create index if not exists accounts_default_invoice_sender_id_idx
  on public.accounts (default_invoice_sender_id);
create index if not exists accounts_default_sender_id_idx
  on public.accounts (default_sender_id);
