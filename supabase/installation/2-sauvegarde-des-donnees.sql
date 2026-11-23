-- Calbasse : sauvegarde des donnees. À coller en entier dans Supabase → SQL Editor → New query, puis Run.
-- Résultat attendu : « Success. No rows returned ».
-- FICHIER GÉNÉRÉ depuis supabase/migrations/20261124000000_sauvegarde.sql : ne pas modifier ici (npm run installation).

-- Sauvegarde en ligne du profil et des repas, pour retrouver ses données sur un nouveau téléphone.
-- Réservée aux comptes qui ont un e-mail (la fonction « api » le vérifie). Une seule ligne par personne.
-- Ce fichier peut être rejoué sans danger.

create table if not exists public.sauvegardes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  donnees jsonb not null,
  revision integer not null default 1,
  maj_le timestamptz not null default now(),
  constraint sauvegarde_taille check (octet_length(donnees::text) <= 3000000)
);
alter table public.sauvegardes enable row level security;
revoke all on public.sauvegardes from anon, authenticated;

-- Lit la sauvegarde. revision 0 = rien de sauvegardé.
create or replace function public.lire_sauvegarde(p_user uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object('revision', revision, 'donnees', donnees, 'maj_le', maj_le) from public.sauvegardes where user_id = p_user),
    jsonb_build_object('revision', 0, 'donnees', null, 'maj_le', null)
  );
$$;

-- Écrit la sauvegarde si p_base est bien la révision connue du téléphone ; sinon un autre téléphone est passé avant : « conflit ».
create or replace function public.ecrire_sauvegarde(p_user uuid, p_donnees jsonb, p_base integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_rev integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('sauvegarde:' || p_user::text, 0));
  select revision into v_rev from public.sauvegardes where user_id = p_user;
  if coalesce(v_rev, 0) <> p_base then
    return jsonb_build_object('statut', 'conflit', 'revision', coalesce(v_rev, 0));
  end if;
  insert into public.sauvegardes (user_id, donnees, revision, maj_le)
  values (p_user, p_donnees, coalesce(v_rev, 0) + 1, now())
  on conflict (user_id) do update set donnees = excluded.donnees, revision = excluded.revision, maj_le = excluded.maj_le;
  return jsonb_build_object('statut', 'ok', 'revision', coalesce(v_rev, 0) + 1);
end;
$$;

revoke all on function public.lire_sauvegarde(uuid) from public, anon, authenticated;
revoke all on function public.ecrire_sauvegarde(uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function public.lire_sauvegarde(uuid) to service_role;
grant execute on function public.ecrire_sauvegarde(uuid, jsonb, integer) to service_role;
