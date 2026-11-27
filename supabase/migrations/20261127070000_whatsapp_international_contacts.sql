-- Mantém contatos antigos e a representação sem "+" usada pelos JIDs e pelo PARAR.
alter table public.whatsapp_contacts
  drop constraint whatsapp_contacts_phone_check,
  add constraint whatsapp_contacts_phone_check
    check (phone ~ '^[1-9][0-9]{7,14}$');
