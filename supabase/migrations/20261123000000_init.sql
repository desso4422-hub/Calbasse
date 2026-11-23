-- Calbasse : base de données du MVP.
--
-- Principe : l'application ne parle JAMAIS directement aux tables. Elle appelle la fonction « api »,
-- qui utilise la clé de service et ces fonctions SQL. Les tables sont donc verrouillées pour les
-- clients (RLS activée, aucune règle) : même avec la clé publique de l'app, personne ne peut lire
-- les scans des autres.
--
-- Les comptes sont des comptes anonymes de Supabase Auth (un par installation). Pas d'e-mail, pas de
-- téléphone, pas de mot de passe. Supprimer l'utilisateur d'Auth efface toutes ses données (cascade).

-- ——— Tables ———

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Identifiant unique de la photo, créé par l'app : renvoyer la même photo ne la recompte pas
  cle text not null check (char_length(cle) between 8 and 80),
  jour date not null,
  statut text not null default 'en_cours' check (statut in ('en_cours', 'ok', 'hors_sujet', 'echec')),
  resultat jsonb,
  erreur text,
  modele text,
  duree_ms integer,
  usage jsonb,
  cree_le timestamptz not null default now(),
  termine_le timestamptz,
  unique (user_id, cle)
);
create index scans_user_jour on public.scans (user_id, jour);
create index scans_jour on public.scans (jour);

-- Ce que l'utilisateur a changé dans la proposition de l'IA : la matière première pour améliorer la reconnaissance
create table public.corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scan_id uuid not null references public.scans (id) on delete cascade,
  proposees jsonb not null,
  finales jsonb not null,
  cree_le timestamptz not null default now(),
  unique (scan_id)
);

-- « Un chiffre me semble faux » : remonte au nutritionniste
create table public.signalements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  jour date not null,
  aliment_id text not null check (char_length(aliment_id) <= 80),
  repas_nom text check (char_length(repas_nom) <= 200),
  cree_le timestamptz not null default now()
);
create index signalements_aliment on public.signalements (aliment_id);
-- Un même aliment signalé plusieurs fois le même jour par la même personne ne compte qu'une fois
create unique index signalements_unique on public.signalements (user_id, jour, aliment_id);

-- ——— Accès verrouillés ———

alter table public.scans enable row level security;
alter table public.corrections enable row level security;
alter table public.signalements enable row level security;
revoke all on public.scans, public.corrections, public.signalements from anon, authenticated;

-- ——— Fonctions de quota (appelées uniquement par la fonction « api ») ———

-- Un scan compte tant qu'il est réussi, ou en cours depuis moins de 3 minutes. Un scan en échec, ou une photo
-- qui ne montre pas de nourriture (« hors_sujet »), ne coûte rien à l'utilisateur.
-- Le jour change à minuit, heure de Lagos (Bénin, Togo, Cameroun, Nigeria : UTC+1).

create function public.reserver_scan(p_user uuid, p_cle text, p_limite integer, p_budget integer, p_par_minute integer default 6)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jour date := (now() at time zone 'Africa/Lagos')::date;
  v_scan public.scans;
  v_existe boolean;
  v_autres integer;
  v_total integer;
  v_minute integer;
begin
  -- Une seule réservation à la fois par utilisateur : pas de course entre deux envois simultanés
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));

  select * into v_scan from public.scans where user_id = p_user and cle = p_cle;
  v_existe := found;       -- à lire tout de suite : la requête suivante réécrit « found »

  select count(*) into v_autres from public.scans
   where user_id = p_user and jour = v_jour and cle <> p_cle
     and (statut = 'ok' or (statut = 'en_cours' and cree_le > now() - interval '3 minutes'));

  if v_existe and v_scan.statut in ('ok', 'hors_sujet') then
    return jsonb_build_object('statut', 'deja', 'scan_id', v_scan.id, 'resultat', v_scan.resultat,
                              'limite', p_limite,
                              'restants', greatest(0, p_limite - v_autres - case when v_scan.statut = 'ok' and v_scan.jour = v_jour then 1 else 0 end));
  end if;
  if v_existe and v_scan.statut = 'en_cours' and v_scan.cree_le > now() - interval '3 minutes' then
    return jsonb_build_object('statut', 'en_cours', 'scan_id', v_scan.id, 'limite', p_limite, 'restants', greatest(0, p_limite - v_autres - 1));
  end if;

  if v_autres >= p_limite then
    return jsonb_build_object('statut', 'quota', 'limite', p_limite, 'restants', 0);
  end if;

  select count(*) into v_minute from public.scans
   where user_id = p_user and cree_le > now() - interval '1 minute' and cle <> p_cle;
  if v_minute >= p_par_minute then
    return jsonb_build_object('statut', 'trop_vite', 'limite', p_limite, 'restants', greatest(0, p_limite - v_autres));
  end if;

  select count(*) into v_total from public.scans
   where jour = v_jour and (statut = 'ok' or (statut = 'en_cours' and cree_le > now() - interval '3 minutes'));
  if v_total >= p_budget then
    return jsonb_build_object('statut', 'budget', 'limite', p_limite, 'restants', greatest(0, p_limite - v_autres));
  end if;

  if v_existe then    -- une photo qui avait échoué (ou une réservation périmée) : on réessaie la même ligne
    update public.scans set statut = 'en_cours', jour = v_jour, cree_le = now(), erreur = null, termine_le = null
     where id = v_scan.id returning * into v_scan;
  else
    insert into public.scans (user_id, cle, jour) values (p_user, p_cle, v_jour) returning * into v_scan;
  end if;
  return jsonb_build_object('statut', 'nouveau', 'scan_id', v_scan.id, 'limite', p_limite, 'restants', greatest(0, p_limite - v_autres - 1));
end;
$$;

-- p_compte = false : la photo ne montrait pas de nourriture, le scan n'est pas décompté
create function public.terminer_scan(p_scan uuid, p_resultat jsonb, p_modele text, p_duree integer, p_usage jsonb, p_compte boolean default true)
returns void
language sql
security definer
set search_path = public
as $$
  update public.scans
     set statut = case when p_compte then 'ok' else 'hors_sujet' end,
         resultat = p_resultat, modele = p_modele, duree_ms = p_duree, usage = p_usage, termine_le = now()
   where id = p_scan;
$$;

create function public.echouer_scan(p_scan uuid, p_erreur text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.scans set statut = 'echec', erreur = left(p_erreur, 500), termine_le = now() where id = p_scan;
$$;

create function public.etat_compte(p_user uuid, p_limite integer)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'limite', p_limite,
    'restants', greatest(0, p_limite - count(*)::integer)
  )
  from public.scans
  where user_id = p_user
    and jour = (now() at time zone 'Africa/Lagos')::date
    and (statut = 'ok' or (statut = 'en_cours' and cree_le > now() - interval '3 minutes'));
$$;

revoke all on function public.reserver_scan(uuid, text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.terminer_scan(uuid, jsonb, text, integer, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.echouer_scan(uuid, text) from public, anon, authenticated;
revoke all on function public.etat_compte(uuid, integer) from public, anon, authenticated;
grant execute on function public.reserver_scan(uuid, text, integer, integer, integer) to service_role;
grant execute on function public.terminer_scan(uuid, jsonb, text, integer, jsonb, boolean) to service_role;
grant execute on function public.echouer_scan(uuid, text) to service_role;
grant execute on function public.etat_compte(uuid, integer) to service_role;

-- ——— Tableau de bord : à lire dans l'éditeur SQL de Supabase ———
-- select * from stats_jour;

create view public.stats_jour with (security_invoker = true) as
select s.jour,
       count(*) filter (where s.statut = 'ok') as scans_reussis,
       count(*) filter (where s.statut = 'echec') as scans_en_echec,
       count(distinct s.user_id) as utilisateurs,
       count(c.id) as corrections,
       round(avg(s.duree_ms) filter (where s.statut = 'ok')) as duree_moyenne_ms
  from public.scans s
  left join public.corrections c on c.scan_id = s.id
 group by s.jour
 order by s.jour desc;
revoke all on public.stats_jour from anon, authenticated;
