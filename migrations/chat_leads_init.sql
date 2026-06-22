-- Stolkwebdesign — chatbot leads migration
-- Toe te passen op project lkcfwndigzhzcjnhxcmb.
-- Slaat gesprekken op die door de exit-intent chatbot zijn aangevraagd, met de
-- gevraagde naam + e-mail van de bezoeker. De lead-notificatie zelf gaat naar
-- Notion (Klantverzoeken) — deze tabel bewaart het gesprek voor context.

create table if not exists stolkwebdesign_chat_leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  conversation jsonb,            -- [{role:'user'|'assistant', content:'...'}, ...]
  page_url text,
  user_agent text,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists stolkwebdesign_chat_leads_created_at_idx
  on stolkwebdesign_chat_leads (created_at desc);

-- RLS: anon mag NIET schrijven (we schrijven via service-role in api/chat-lead.js);
-- alleen ingelogde admins mogen lezen.
alter table stolkwebdesign_chat_leads enable row level security;

drop policy if exists "stolkwebdesign_chat_leads auth read" on stolkwebdesign_chat_leads;
create policy "stolkwebdesign_chat_leads auth read"
  on stolkwebdesign_chat_leads for select
  using (auth.role() = 'authenticated');
