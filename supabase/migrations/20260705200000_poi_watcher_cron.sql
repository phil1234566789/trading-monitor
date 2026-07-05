-- D5: minütlicher Cron-Trigger für die poi-watcher Edge Function via pg_cron + pg_net.
-- Auth per Bearer-Token: der oeffentliche "publishable"-Key genuegt hier, da er nur die
-- Edge-Function-eigene JWT-Pruefung passieren muss (kein Datenbankzugriff direkt) --
-- die Function selbst nutzt intern den Service-Role-Key aus ihren eigenen Secrets.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'poi-watcher-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://vkphwtqcvqrkphksproj.supabase.co/functions/v1/poi-watcher',
    headers := jsonb_build_object(
      'Authorization', 'Bearer sb_publishable_v88yE7w0wPJxR1xQmboJwA_cCx759_7',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
