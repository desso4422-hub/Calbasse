-- Calbasse : base de données. À coller en entier dans Supabase → SQL Editor → New query, puis Run.
-- Résultat attendu : « Success. No rows returned ».
-- FICHIER GÉNÉRÉ depuis supabase/migrations/ : ne pas modifier ici (npm run installation).

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

-- ——— Forfait payant ———

-- Qui est premium, jusqu'à quand. Absent ou échu = forfait gratuit.
create table public.abonnements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null check (plan in ('mensuel', 'annuel')),
  jusqu_au timestamptz not null,
  source text not null check (source in ('code', 'cinetpay', 'manuel')),
  maj_le timestamptz not null default now()
);

-- Codes d'activation : le client paie (Mobile Money…), tu lui envoies un code, il le saisit dans l'app.
-- Un code ne sert qu'une fois. Création : select * from creer_codes('mensuel', 30, 10, 'lot du 24/11');
create table public.codes_activation (
  code text primary key check (code ~ '^CAL-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$'),
  plan text not null check (plan in ('mensuel', 'annuel')),
  jours integer not null check (jours between 1 and 400),
  note text,
  cree_le timestamptz not null default now(),
  utilise_par uuid references auth.users (id) on delete set null,
  utilise_le timestamptz
);

-- Essais de saisie de code (pour bloquer ceux qui devinent)
create table public.essais_codes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  cree_le timestamptz not null default now()
);
create index essais_codes_user on public.essais_codes (user_id, cree_le);

-- Paiements en ligne (CinetPay). L'identifiant est celui de la transaction chez CinetPay.
create table public.paiements (
  id text primary key check (id ~ '^[A-Z0-9]{8,40}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null check (plan in ('mensuel', 'annuel')),
  montant integer not null,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'accepte', 'refuse')),
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now()
);
create index paiements_user on public.paiements (user_id);

-- ——— Accès verrouillés ———

alter table public.scans enable row level security;
alter table public.corrections enable row level security;
alter table public.signalements enable row level security;
alter table public.abonnements enable row level security;
alter table public.codes_activation enable row level security;
alter table public.essais_codes enable row level security;
alter table public.paiements enable row level security;
revoke all on public.scans, public.corrections, public.signalements, public.abonnements, public.codes_activation, public.essais_codes, public.paiements from anon, authenticated;

-- ——— Fonctions de quota (appelées uniquement par la fonction « api ») ———

-- Un scan compte tant qu'il est réussi, ou en cours depuis moins de 3 minutes. Un scan en échec, ou une photo
-- qui ne montre pas de nourriture (« hors_sujet »), ne coûte rien à l'utilisateur.
-- Le jour change à minuit, heure de Lagos (Bénin, Togo, Cameroun, Nigeria : UTC+1).

-- Forfait actif d'un utilisateur : { plan, jusquau } ou null
create function public.forfait_de(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('plan', plan, 'jusquau', to_char(jusqu_au at time zone 'Africa/Lagos', 'YYYY-MM-DD'))
    from public.abonnements
   where user_id = p_user and jusqu_au > now();
$$;

create function public.reserver_scan(p_user uuid, p_cle text, p_gratuit integer, p_premium integer, p_budget integer, p_par_minute integer default 6)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jour date := (now() at time zone 'Africa/Lagos')::date;
  v_forfait jsonb := public.forfait_de(p_user);
  p_limite integer := case when v_forfait is null then p_gratuit else p_premium end;
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
    return jsonb_build_object('statut', 'deja', 'scan_id', v_scan.id, 'resultat', v_scan.resultat, 'premium', v_forfait,
                              'limite', p_limite,
                              'restants', greatest(0, p_limite - v_autres - case when v_scan.statut = 'ok' and v_scan.jour = v_jour then 1 else 0 end));
  end if;
  if v_existe and v_scan.statut = 'en_cours' and v_scan.cree_le > now() - interval '3 minutes' then
    return jsonb_build_object('statut', 'en_cours', 'scan_id', v_scan.id, 'premium', v_forfait, 'limite', p_limite, 'restants', greatest(0, p_limite - v_autres - 1));
  end if;

  if v_autres >= p_limite then
    return jsonb_build_object('statut', 'quota', 'premium', v_forfait, 'limite', p_limite, 'restants', 0);
  end if;

  select count(*) into v_minute from public.scans
   where user_id = p_user and cree_le > now() - interval '1 minute' and cle <> p_cle;
  if v_minute >= p_par_minute then
    return jsonb_build_object('statut', 'trop_vite', 'premium', v_forfait, 'limite', p_limite, 'restants', greatest(0, p_limite - v_autres));
  end if;

  select count(*) into v_total from public.scans
   where jour = v_jour and (statut = 'ok' or (statut = 'en_cours' and cree_le > now() - interval '3 minutes'));
  if v_total >= p_budget then
    return jsonb_build_object('statut', 'budget', 'premium', v_forfait, 'limite', p_limite, 'restants', greatest(0, p_limite - v_autres));
  end if;

  if v_existe then    -- une photo qui avait échoué (ou une réservation périmée) : on réessaie la même ligne
    update public.scans set statut = 'en_cours', jour = v_jour, cree_le = now(), erreur = null, termine_le = null
     where id = v_scan.id returning * into v_scan;
  else
    insert into public.scans (user_id, cle, jour) values (p_user, p_cle, v_jour) returning * into v_scan;
  end if;
  return jsonb_build_object('statut', 'nouveau', 'scan_id', v_scan.id, 'premium', v_forfait, 'limite', p_limite, 'restants', greatest(0, p_limite - v_autres - 1));
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

create function public.etat_compte(p_user uuid, p_gratuit integer, p_premium integer)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with f as (select public.forfait_de(p_user) as forfait),
       l as (select forfait, case when forfait is null then p_gratuit else p_premium end as limite from f)
  select jsonb_build_object(
    'premium', l.forfait,
    'limite', l.limite,
    'restants', greatest(0, l.limite - (
      select count(*)::integer from public.scans
       where user_id = p_user
         and jour = (now() at time zone 'Africa/Lagos')::date
         and (statut = 'ok' or (statut = 'en_cours' and cree_le > now() - interval '3 minutes'))
    ))
  )
  from l;
$$;

-- ——— Forfait : activation, codes, paiements ———

-- Prolonge le forfait : à partir de la fin du forfait en cours s'il y en a un, sinon à partir de maintenant
create function public.activer_abonnement(p_user uuid, p_plan text, p_jours integer, p_source text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.abonnements (user_id, plan, jusqu_au, source)
  values (p_user, p_plan, now() + make_interval(days => p_jours), p_source)
  on conflict (user_id) do update
    set plan = excluded.plan,
        jusqu_au = greatest(now(), public.abonnements.jusqu_au) + make_interval(days => p_jours),
        source = excluded.source,
        maj_le = now();
  return public.forfait_de(p_user);
end;
$$;

-- Saisie d'un code par l'utilisateur. Statuts : ok, invalide, deja_utilise, trop_essais
create function public.utiliser_code(p_user uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(btrim(p_code));
  v_ligne public.codes_activation;
begin
  perform pg_advisory_xact_lock(hashtextextended('code:' || p_user::text, 0));
  if (select count(*) from public.essais_codes where user_id = p_user and cree_le > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('statut', 'trop_essais');
  end if;

  select * into v_ligne from public.codes_activation where code = v_code for update;
  if not found then
    insert into public.essais_codes (user_id) values (p_user);
    return jsonb_build_object('statut', 'invalide');
  end if;
  if v_ligne.utilise_par is not null then
    insert into public.essais_codes (user_id) values (p_user);
    return jsonb_build_object('statut', 'deja_utilise');
  end if;

  update public.codes_activation set utilise_par = p_user, utilise_le = now() where code = v_code;
  return jsonb_build_object('statut', 'ok', 'premium', public.activer_abonnement(p_user, v_ligne.plan, v_ligne.jours, 'code'));
end;
$$;

-- Pour toi, dans l'éditeur SQL de Supabase : select * from creer_codes('mensuel', 30, 10, 'lot du 24/11');
create function public.creer_codes(p_plan text, p_jours integer, p_nombre integer, p_note text default null)
returns setof text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_u text;
  i integer := 0;
begin
  while i < p_nombre loop
    v_u := upper(replace(gen_random_uuid()::text, '-', ''));
    v_code := 'CAL-' || substr(v_u, 1, 4) || '-' || substr(v_u, 5, 4) || '-' || substr(v_u, 9, 4);
    begin
      insert into public.codes_activation (code, plan, jours, note) values (v_code, p_plan, p_jours, p_note);
      i := i + 1;
      return next v_code;
    exception when unique_violation then null;   -- improbable : on en tire un autre
    end;
  end loop;
end;
$$;

create function public.creer_paiement(p_user uuid, p_plan text, p_montant integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_id text := 'CAL' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 18));
begin
  insert into public.paiements (id, user_id, plan, montant) values (v_id, p_user, p_plan, p_montant);
  return v_id;
end;
$$;

create function public.lire_paiement(p_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(p) from public.paiements p where p.id = p_id;
$$;

-- Appelée une fois le paiement confirmé auprès de CinetPay. Sans danger si elle est appelée deux fois :
-- l'abonnement n'est prolongé qu'à la première.
create function public.valider_paiement(p_id text, p_jours integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_p public.paiements;
begin
  update public.paiements set statut = 'accepte', maj_le = now()
   where id = p_id and statut = 'en_attente' returning * into v_p;
  if found then
    perform public.activer_abonnement(v_p.user_id, v_p.plan, p_jours, 'cinetpay');
  end if;
  return (select to_jsonb(p) from public.paiements p where p.id = p_id);
end;
$$;

create function public.refuser_paiement(p_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.paiements set statut = 'refuse', maj_le = now() where id = p_id and statut = 'en_attente';
$$;

-- Tout est réservé à la fonction « api » (rôle service_role). creer_codes ne l'est qu'à toi (éditeur SQL).
revoke all on function public.forfait_de(uuid) from public, anon, authenticated;
revoke all on function public.reserver_scan(uuid, text, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.terminer_scan(uuid, jsonb, text, integer, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.echouer_scan(uuid, text) from public, anon, authenticated;
revoke all on function public.etat_compte(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.activer_abonnement(uuid, text, integer, text) from public, anon, authenticated;
revoke all on function public.utiliser_code(uuid, text) from public, anon, authenticated;
revoke all on function public.creer_codes(text, integer, integer, text) from public, anon, authenticated, service_role;
revoke all on function public.creer_paiement(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.lire_paiement(text) from public, anon, authenticated;
revoke all on function public.valider_paiement(text, integer) from public, anon, authenticated;
revoke all on function public.refuser_paiement(text) from public, anon, authenticated;
grant execute on function public.forfait_de(uuid) to service_role;
grant execute on function public.reserver_scan(uuid, text, integer, integer, integer, integer) to service_role;
grant execute on function public.terminer_scan(uuid, jsonb, text, integer, jsonb, boolean) to service_role;
grant execute on function public.echouer_scan(uuid, text) to service_role;
grant execute on function public.etat_compte(uuid, integer, integer) to service_role;
grant execute on function public.activer_abonnement(uuid, text, integer, text) to service_role;
grant execute on function public.utiliser_code(uuid, text) to service_role;
grant execute on function public.creer_paiement(uuid, text, integer) to service_role;
grant execute on function public.lire_paiement(text) to service_role;
grant execute on function public.valider_paiement(text, integer) to service_role;
grant execute on function public.refuser_paiement(text) to service_role;

-- ——— Tableau de bord : à lire dans l'éditeur SQL de Supabase ———
-- select * from stats_jour;
-- select count(*) as abonnes_actifs from abonnements where jusqu_au > now();

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
