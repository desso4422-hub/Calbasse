-- Tests de la base : psql -v ON_ERROR_STOP=1 -f tests/quota.sql (voir scripts/tester-base.sh)
\set ON_ERROR_STOP on
set client_min_messages = warning;

create or replace function pg_temp.nouveau_user() returns uuid language sql as $$
  insert into auth.users default values returning id;
$$;

do $$
declare
  u uuid := pg_temp.nouveau_user();
  r jsonb; scan1 uuid;
begin
  -- 1. Premier scan : réservé, il reste limite - 1
  r := public.reserver_scan(u, 'photo-0001', 3, 1000);
  assert r->>'statut' = 'nouveau', 'premier scan: ' || r::text;
  assert (r->>'restants')::int = 2, 'restants après le 1er: ' || r::text;
  scan1 := (r->>'scan_id')::uuid;
  assert scan1 is not null, 'le scan réservé a un identifiant';

  -- 2. Même photo pendant qu'elle est en cours : pas de double analyse, pas de double décompte
  r := public.reserver_scan(u, 'photo-0001', 3, 1000);
  assert r->>'statut' = 'en_cours', 'renvoi en cours: ' || r::text;
  assert (r->>'restants')::int = 2, 'le renvoi ne coûte rien: ' || r::text;

  -- 3. Une fois terminée, le renvoi rend le même résultat, sans nouveau décompte
  perform public.terminer_scan(scan1, '{"nom":"Garba"}', 'google/gemini', 2500, '{"tokens":10400}');
  r := public.reserver_scan(u, 'photo-0001', 3, 1000);
  assert r->>'statut' = 'deja' and r->'resultat'->>'nom' = 'Garba', 'renvoi terminé: ' || r::text;
  assert (r->>'restants')::int = 2, 'restants après renvoi: ' || r::text;

  -- 4. Le quota : 3 scans par jour, le 4e est refusé
  r := public.reserver_scan(u, 'photo-0002', 3, 1000); assert r->>'statut' = 'nouveau';
  perform public.terminer_scan((r->>'scan_id')::uuid, '{}', 'm', 1, '{}');
  r := public.reserver_scan(u, 'photo-0003', 3, 1000); assert r->>'statut' = 'nouveau' and (r->>'restants')::int = 0, r::text;
  perform public.terminer_scan((r->>'scan_id')::uuid, '{}', 'm', 1, '{}');
  r := public.reserver_scan(u, 'photo-0004', 3, 1000);
  assert r->>'statut' = 'quota' and (r->>'restants')::int = 0, 'quota atteint: ' || r::text;
  -- et une photo déjà analysée reste consultable même à quota atteint
  r := public.reserver_scan(u, 'photo-0001', 3, 1000);
  assert r->>'statut' = 'deja', 'photo déjà faite, quota atteint: ' || r::text;

  -- 5. Le lendemain : les compteurs repartent
  update public.scans set jour = jour - 1 where user_id = u;
  r := public.reserver_scan(u, 'photo-0004', 3, 1000);
  assert r->>'statut' = 'nouveau' and (r->>'restants')::int = 2, 'nouveau jour: ' || r::text;
end $$;

do $$
declare
  u uuid := pg_temp.nouveau_user();
  r jsonb; s uuid;
begin
  -- 6. Un scan en échec ne coûte rien, et se réessaie avec la même ligne
  r := public.reserver_scan(u, 'echec-0001', 2, 1000); s := (r->>'scan_id')::uuid;
  perform public.echouer_scan(s, 'RodiumAI 503');
  assert (public.etat_compte(u, 2)->>'restants')::int = 2, 'un échec ne compte pas';
  r := public.reserver_scan(u, 'echec-0001', 2, 1000);
  assert r->>'statut' = 'nouveau' and (r->>'scan_id')::uuid = s, 'réessai sur la même ligne: ' || r::text;
  assert (select count(*) from public.scans where user_id = u) = 1, 'une seule ligne';

  -- 7. Une réservation restée en cours plus de 3 minutes (fonction interrompue) ne bloque plus personne
  update public.scans set cree_le = now() - interval '4 minutes' where id = s;
  assert (public.etat_compte(u, 2)->>'restants')::int = 2, 'réservation périmée non comptée';
  r := public.reserver_scan(u, 'echec-0001', 2, 1000);
  assert r->>'statut' = 'nouveau', 'reprise après réservation périmée: ' || r::text;
end $$;

do $$
declare
  a uuid := pg_temp.nouveau_user(); b uuid := pg_temp.nouveau_user(); c uuid := pg_temp.nouveau_user();
  r jsonb;
begin
  -- 8. Budget global : la limite de dépense de la journée protège ton crédit
  delete from public.scans;
  r := public.reserver_scan(a, 'budget-a-001', 10, 2); assert r->>'statut' = 'nouveau';
  r := public.reserver_scan(b, 'budget-b-001', 10, 2); assert r->>'statut' = 'nouveau';
  r := public.reserver_scan(c, 'budget-c-001', 10, 2);
  assert r->>'statut' = 'budget', 'budget global atteint: ' || r::text;

  -- 9. Anti-rafale : pas plus de 2 scans par minute pour un même utilisateur (ici)
  delete from public.scans;
  r := public.reserver_scan(a, 'vite-0001', 50, 1000, 2); assert r->>'statut' = 'nouveau';
  r := public.reserver_scan(a, 'vite-0002', 50, 1000, 2); assert r->>'statut' = 'nouveau';
  r := public.reserver_scan(a, 'vite-0003', 50, 1000, 2);
  assert r->>'statut' = 'trop_vite', 'rafale: ' || r::text;
end $$;

do $$
declare
  u uuid := pg_temp.nouveau_user(); r jsonb; s uuid;
begin
  -- 10. Corrections et signalements suivent l'utilisateur ; le supprimer efface tout
  r := public.reserver_scan(u, 'cascade-001', 5, 1000); s := (r->>'scan_id')::uuid;
  insert into public.corrections (user_id, scan_id, proposees, finales) values (u, s, '[]', '[{"alimentId":"piron"}]');
  insert into public.signalements (user_id, jour, aliment_id, repas_nom) values (u, current_date, 'piron', 'Piron, sauce');
  delete from auth.users where id = u;
  assert (select count(*) from public.scans where user_id = u) = 0, 'scans effacés';
  assert (select count(*) from public.corrections where user_id = u) = 0, 'corrections effacées';
  assert (select count(*) from public.signalements where user_id = u) = 0, 'signalements effacés';

  -- 11. Une correction par scan : la dernière remplace la précédente (contrainte unique)
  u := pg_temp.nouveau_user();
  r := public.reserver_scan(u, 'unique-001', 5, 1000); s := (r->>'scan_id')::uuid;
  insert into public.corrections (user_id, scan_id, proposees, finales) values (u, s, '[]', '[]');
  begin
    insert into public.corrections (user_id, scan_id, proposees, finales) values (u, s, '[]', '[]');
    raise exception 'la 2e correction aurait dû être refusée';
  exception when unique_violation then null; end;
end $$;

-- 11 bis. Une photo sans nourriture ne coûte pas de scan, et son renvoi rend le même résultat
do $$
declare u uuid := pg_temp.nouveau_user(); r jsonb;
begin
  r := public.reserver_scan(u, 'horssujet-1', 3, 1000);
  perform public.terminer_scan((r->>'scan_id')::uuid, '{"estUnRepas":false}', 'm', 1, '{}', false);
  assert (public.etat_compte(u, 3)->>'restants')::int = 3, 'hors sujet non décompté';
  r := public.reserver_scan(u, 'horssujet-1', 3, 1000);
  assert r->>'statut' = 'deja' and (r->>'restants')::int = 3, 'renvoi hors sujet: ' || r::text;
end $$;

-- 12. Verrouillage : avec la clé publique de l'app (rôles anon / authenticated), rien n'est lisible ni appelable
do $$ begin perform public.reserver_scan(pg_temp.nouveau_user(), 'secret-0001', 5, 1000); end $$;

set role anon;
do $$ begin
  begin perform count(*) from public.scans; raise exception 'anon a pu lire scans'; exception when insufficient_privilege then null; end;
  begin perform public.reserver_scan(gen_random_uuid(), 'x-0000001', 5, 1000); raise exception 'anon a pu réserver'; exception when insufficient_privilege then null; end;
  begin perform * from public.stats_jour; raise exception 'anon a pu lire les stats'; exception when insufficient_privilege then null; end;
end $$;
reset role;

set role authenticated;
do $$ begin
  begin perform count(*) from public.scans; raise exception 'authenticated a pu lire scans'; exception when insufficient_privilege then null; end;
  begin insert into public.corrections (user_id, scan_id, proposees, finales) values (gen_random_uuid(), gen_random_uuid(), '[]', '[]'); raise exception 'authenticated a pu écrire'; exception when insufficient_privilege then null; end;
  begin perform public.etat_compte(gen_random_uuid(), 5); raise exception 'authenticated a pu appeler etat_compte'; exception when insufficient_privilege then null; end;
end $$;
reset role;

set role service_role;
do $$ begin
  perform public.etat_compte(gen_random_uuid(), 5);       -- la fonction api, elle, y a accès
  perform count(*) from public.scans;
end $$;
reset role;

select 'TOUS LES TESTS DE LA BASE PASSENT' as resultat;
