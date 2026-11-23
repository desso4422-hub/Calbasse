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
  r := public.reserver_scan(u, 'photo-0001', 3, 3, 1000);
  assert r->>'statut' = 'nouveau', 'premier scan: ' || r::text;
  assert (r->>'restants')::int = 2, 'restants après le 1er: ' || r::text;
  scan1 := (r->>'scan_id')::uuid;
  assert scan1 is not null, 'le scan réservé a un identifiant';

  -- 2. Même photo pendant qu'elle est en cours : pas de double analyse, pas de double décompte
  r := public.reserver_scan(u, 'photo-0001', 3, 3, 1000);
  assert r->>'statut' = 'en_cours', 'renvoi en cours: ' || r::text;
  assert (r->>'restants')::int = 2, 'le renvoi ne coûte rien: ' || r::text;

  -- 3. Une fois terminée, le renvoi rend le même résultat, sans nouveau décompte
  perform public.terminer_scan(scan1, '{"nom":"Garba"}', 'google/gemini', 2500, '{"tokens":10400}');
  r := public.reserver_scan(u, 'photo-0001', 3, 3, 1000);
  assert r->>'statut' = 'deja' and r->'resultat'->>'nom' = 'Garba', 'renvoi terminé: ' || r::text;
  assert (r->>'restants')::int = 2, 'restants après renvoi: ' || r::text;

  -- 4. Le quota : 3 scans par jour, le 4e est refusé
  r := public.reserver_scan(u, 'photo-0002', 3, 3, 1000); assert r->>'statut' = 'nouveau';
  perform public.terminer_scan((r->>'scan_id')::uuid, '{}', 'm', 1, '{}');
  r := public.reserver_scan(u, 'photo-0003', 3, 3, 1000); assert r->>'statut' = 'nouveau' and (r->>'restants')::int = 0, r::text;
  perform public.terminer_scan((r->>'scan_id')::uuid, '{}', 'm', 1, '{}');
  r := public.reserver_scan(u, 'photo-0004', 3, 3, 1000);
  assert r->>'statut' = 'quota' and (r->>'restants')::int = 0, 'quota atteint: ' || r::text;
  -- et une photo déjà analysée reste consultable même à quota atteint
  r := public.reserver_scan(u, 'photo-0001', 3, 3, 1000);
  assert r->>'statut' = 'deja', 'photo déjà faite, quota atteint: ' || r::text;

  -- 5. Le lendemain : les compteurs repartent
  update public.scans set jour = jour - 1 where user_id = u;
  r := public.reserver_scan(u, 'photo-0004', 3, 3, 1000);
  assert r->>'statut' = 'nouveau' and (r->>'restants')::int = 2, 'nouveau jour: ' || r::text;
end $$;

do $$
declare
  u uuid := pg_temp.nouveau_user();
  r jsonb; s uuid;
begin
  -- 6. Un scan en échec ne coûte rien, et se réessaie avec la même ligne
  r := public.reserver_scan(u, 'echec-0001', 2, 2, 1000); s := (r->>'scan_id')::uuid;
  perform public.echouer_scan(s, 'RodiumAI 503');
  assert (public.etat_compte(u, 2, 2)->>'restants')::int = 2, 'un échec ne compte pas';
  r := public.reserver_scan(u, 'echec-0001', 2, 2, 1000);
  assert r->>'statut' = 'nouveau' and (r->>'scan_id')::uuid = s, 'réessai sur la même ligne: ' || r::text;
  assert (select count(*) from public.scans where user_id = u) = 1, 'une seule ligne';

  -- 7. Une réservation restée en cours plus de 3 minutes (fonction interrompue) ne bloque plus personne
  update public.scans set cree_le = now() - interval '4 minutes' where id = s;
  assert (public.etat_compte(u, 2, 2)->>'restants')::int = 2, 'réservation périmée non comptée';
  r := public.reserver_scan(u, 'echec-0001', 2, 2, 1000);
  assert r->>'statut' = 'nouveau', 'reprise après réservation périmée: ' || r::text;
end $$;

do $$
declare
  a uuid := pg_temp.nouveau_user(); b uuid := pg_temp.nouveau_user(); c uuid := pg_temp.nouveau_user();
  r jsonb;
begin
  -- 8. Budget global : la limite de dépense de la journée protège ton crédit
  delete from public.scans;
  r := public.reserver_scan(a, 'budget-a-001', 10, 10, 2); assert r->>'statut' = 'nouveau';
  r := public.reserver_scan(b, 'budget-b-001', 10, 10, 2); assert r->>'statut' = 'nouveau';
  r := public.reserver_scan(c, 'budget-c-001', 10, 10, 2);
  assert r->>'statut' = 'budget', 'budget global atteint: ' || r::text;

  -- 9. Anti-rafale : pas plus de 2 scans par minute pour un même utilisateur (ici)
  delete from public.scans;
  r := public.reserver_scan(a, 'vite-0001', 50, 50, 1000, 2); assert r->>'statut' = 'nouveau';
  r := public.reserver_scan(a, 'vite-0002', 50, 50, 1000, 2); assert r->>'statut' = 'nouveau';
  r := public.reserver_scan(a, 'vite-0003', 50, 50, 1000, 2);
  assert r->>'statut' = 'trop_vite', 'rafale: ' || r::text;
end $$;

do $$
declare
  u uuid := pg_temp.nouveau_user(); r jsonb; s uuid;
begin
  -- 10. Corrections et signalements suivent l'utilisateur ; le supprimer efface tout
  r := public.reserver_scan(u, 'cascade-001', 5, 5, 1000); s := (r->>'scan_id')::uuid;
  insert into public.corrections (user_id, scan_id, proposees, finales) values (u, s, '[]', '[{"alimentId":"piron"}]');
  insert into public.signalements (user_id, jour, aliment_id, repas_nom) values (u, current_date, 'piron', 'Piron, sauce');
  delete from auth.users where id = u;
  assert (select count(*) from public.scans where user_id = u) = 0, 'scans effacés';
  assert (select count(*) from public.corrections where user_id = u) = 0, 'corrections effacées';
  assert (select count(*) from public.signalements where user_id = u) = 0, 'signalements effacés';

  -- 11. Une correction par scan : la dernière remplace la précédente (contrainte unique)
  u := pg_temp.nouveau_user();
  r := public.reserver_scan(u, 'unique-001', 5, 5, 1000); s := (r->>'scan_id')::uuid;
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
  r := public.reserver_scan(u, 'horssujet-1', 3, 3, 1000);
  perform public.terminer_scan((r->>'scan_id')::uuid, '{"estUnRepas":false}', 'm', 1, '{}', false);
  assert (public.etat_compte(u, 3, 3)->>'restants')::int = 3, 'hors sujet non décompté';
  r := public.reserver_scan(u, 'horssujet-1', 3, 3, 1000);
  assert r->>'statut' = 'deja' and (r->>'restants')::int = 3, 'renvoi hors sujet: ' || r::text;
end $$;


-- ——— Forfait payant : 1 scan gratuit par jour, 10 avec le forfait ———

do $$
declare
  u uuid := pg_temp.nouveau_user();
  r jsonb; premium jsonb;
begin
  -- 13. Gratuit : 1 scan par jour, le 2e est refusé
  r := public.reserver_scan(u, 'gratuit-001', 1, 10, 1000);
  assert r->>'statut' = 'nouveau' and (r->>'limite')::int = 1 and r->'premium' = 'null'::jsonb, 'gratuit: ' || r::text;
  perform public.terminer_scan((r->>'scan_id')::uuid, '{}', 'm', 1, '{}');
  r := public.reserver_scan(u, 'gratuit-002', 1, 10, 1000);
  assert r->>'statut' = 'quota' and (r->>'limite')::int = 1, 'quota gratuit: ' || r::text;
  assert public.etat_compte(u, 1, 10)->>'restants' = '0' and (public.etat_compte(u, 1, 10)->>'limite')::int = 1;

  -- 14. Le forfait porte la limite à 10, sur-le-champ, et le scan déjà fait compte dans les 10
  premium := public.activer_abonnement(u, 'mensuel', 30, 'manuel');
  assert premium->>'plan' = 'mensuel', 'forfait activé: ' || premium::text;
  assert (public.etat_compte(u, 1, 10)->>'limite')::int = 10 and (public.etat_compte(u, 1, 10)->>'restants')::int = 9;
  r := public.reserver_scan(u, 'gratuit-002', 1, 10, 1000);
  assert r->>'statut' = 'nouveau' and (r->>'restants')::int = 8 and r->'premium'->>'plan' = 'mensuel', 'scan premium: ' || r::text;
  perform public.terminer_scan((r->>'scan_id')::uuid, '{}', 'm', 1, '{}');
  for i in 3..10 loop
    r := public.reserver_scan(u, 'gratuit-' || lpad(i::text, 3, '0'), 1, 10, 1000, 100);
    assert r->>'statut' = 'nouveau', 'scan ' || i || ': ' || r::text;
    perform public.terminer_scan((r->>'scan_id')::uuid, '{}', 'm', 1, '{}');
  end loop;
  r := public.reserver_scan(u, 'gratuit-011', 1, 10, 1000, 100);
  assert r->>'statut' = 'quota' and (r->>'limite')::int = 10, 'le 11e est refusé: ' || r::text;

  -- 15. Forfait échu : retour à 1 scan par jour
  update public.abonnements set jusqu_au = now() - interval '1 minute' where user_id = u;
  assert public.forfait_de(u) is null, 'forfait échu';
  assert (public.etat_compte(u, 1, 10)->>'limite')::int = 1, 'retour au gratuit';

  -- 16. Réabonnement : la durée s'ajoute à la fin du forfait en cours, sans perdre de jours
  perform public.activer_abonnement(u, 'mensuel', 30, 'code');
  perform public.activer_abonnement(u, 'mensuel', 30, 'code');
  assert (select jusqu_au from public.abonnements where user_id = u) > now() + interval '59 days'
     and (select jusqu_au from public.abonnements where user_id = u) < now() + interval '61 days', 'deux mois cumulés';
end $$;

-- ——— Codes d'activation ———

do $$
declare
  a uuid := pg_temp.nouveau_user(); b uuid := pg_temp.nouveau_user();
  codes text[]; r jsonb;
begin
  -- 17. Création de codes (par toi, dans l'éditeur SQL) : 3 codes distincts au bon format
  select array_agg(c) into codes from public.creer_codes('mensuel', 30, 3, 'lot test') c;
  assert array_length(codes, 1) = 3 and codes[1] ~ '^CAL-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$' and codes[1] <> codes[2], 'format: ' || codes::text;

  -- 18. Un code active le forfait, y compris saisi en minuscules avec des espaces
  r := public.utiliser_code(a, '  ' || lower(codes[1]) || ' ');
  assert r->>'statut' = 'ok' and r->'premium'->>'plan' = 'mensuel', 'code accepté: ' || r::text;
  assert (public.etat_compte(a, 1, 10)->>'limite')::int = 10, 'forfait actif après le code';

  -- 19. Usage unique : le même code ne sert pas à un autre
  r := public.utiliser_code(b, codes[1]);
  assert r->>'statut' = 'deja_utilise', 'code déjà utilisé: ' || r::text;
  assert public.forfait_de(b) is null, 'b reste gratuit';

  -- 20. Un code inventé est refusé, et après 5 essais ratés en une heure, plus rien n'est accepté (même un bon code)
  for i in 1..4 loop
    r := public.utiliser_code(b, 'CAL-0000-0000-000' || i);
    assert r->>'statut' = 'invalide', 'code faux: ' || r::text;
  end loop;
  r := public.utiliser_code(b, codes[2]);                      -- 5e essai : le code est bon et l'essai précédent (« deja_utilise ») comptait déjà
  assert r->>'statut' = 'trop_essais', 'blocage après 5 essais: ' || r::text;
  assert public.forfait_de(b) is null;
end $$;

-- ——— Paiement en ligne ———

do $$
declare
  u uuid := pg_temp.nouveau_user();
  id text; p jsonb;
begin
  id := public.creer_paiement(u, 'annuel', 20000);
  assert id ~ '^CAL[A-F0-9]{18}$', 'identifiant de transaction: ' || id;
  assert public.lire_paiement(id)->>'statut' = 'en_attente';
  p := public.valider_paiement(id, 365);
  assert p->>'statut' = 'accepte' and public.forfait_de(u)->>'plan' = 'annuel', 'paiement validé';
  -- Appelée une 2e fois (CinetPay renvoie la notification, l'app vérifie aussi) : pas de double abonnement
  perform public.valider_paiement(id, 365);
  assert (select jusqu_au from public.abonnements where user_id = u) < now() + interval '366 days', 'une seule prolongation';
  -- Un paiement refusé ne donne rien, et un paiement accepté ne peut plus être refusé
  id := public.creer_paiement(u, 'mensuel', 2000);
  perform public.refuser_paiement(id);
  assert public.lire_paiement(id)->>'statut' = 'refuse';
  perform public.valider_paiement(id, 30);
  assert public.lire_paiement(id)->>'statut' = 'refuse', 'un paiement refusé ne se valide pas';
end $$;

-- Supprimer l'utilisateur efface aussi son forfait et ses paiements
do $$
declare u uuid := pg_temp.nouveau_user();
begin
  perform public.activer_abonnement(u, 'mensuel', 30, 'manuel');
  perform public.creer_paiement(u, 'mensuel', 2000);
  delete from auth.users where id = u;
  assert not exists (select from public.abonnements where user_id = u) and not exists (select from public.paiements where user_id = u), 'cascade forfait et paiements';
end $$;

-- 12. Verrouillage : avec la clé publique de l'app (rôles anon / authenticated), rien n'est lisible ni appelable
do $$ begin perform public.reserver_scan(pg_temp.nouveau_user(), 'secret-0001', 5, 5, 1000); end $$;

set role anon;
do $$ begin
  begin perform count(*) from public.scans; raise exception 'anon a pu lire scans'; exception when insufficient_privilege then null; end;
  begin perform public.reserver_scan(gen_random_uuid(), 'x-0000001', 5, 5, 1000); raise exception 'anon a pu réserver'; exception when insufficient_privilege then null; end;
  begin perform * from public.stats_jour; raise exception 'anon a pu lire les stats'; exception when insufficient_privilege then null; end;
  begin perform count(*) from public.abonnements; raise exception 'anon a pu lire les abonnements'; exception when insufficient_privilege then null; end;
  begin perform count(*) from public.codes_activation; raise exception 'anon a pu lire les codes'; exception when insufficient_privilege then null; end;
  begin perform public.creer_codes('mensuel', 30, 1); raise exception 'anon a pu créer des codes'; exception when insufficient_privilege then null; end;
  begin perform public.activer_abonnement(gen_random_uuid(), 'annuel', 365, 'manuel'); raise exception 'anon a pu activer un forfait'; exception when insufficient_privilege then null; end;
end $$;
reset role;

set role authenticated;
do $$ begin
  begin perform count(*) from public.scans; raise exception 'authenticated a pu lire scans'; exception when insufficient_privilege then null; end;
  begin insert into public.corrections (user_id, scan_id, proposees, finales) values (gen_random_uuid(), gen_random_uuid(), '[]', '[]'); raise exception 'authenticated a pu écrire'; exception when insufficient_privilege then null; end;
  begin perform public.etat_compte(gen_random_uuid(), 5, 5); raise exception 'authenticated a pu appeler etat_compte'; exception when insufficient_privilege then null; end;
  begin perform public.utiliser_code(gen_random_uuid(), 'CAL-0000-0000-0000'); raise exception 'authenticated a pu essayer un code'; exception when insufficient_privilege then null; end;
  begin perform public.creer_codes('mensuel', 365, 100); raise exception 'authenticated a pu créer des codes'; exception when insufficient_privilege then null; end;
  begin perform public.activer_abonnement(gen_random_uuid(), 'annuel', 365, 'manuel'); raise exception 'authenticated a pu se donner un forfait'; exception when insufficient_privilege then null; end;
end $$;
reset role;

set role service_role;
do $$ begin
  perform public.etat_compte(gen_random_uuid(), 5, 5);       -- la fonction api, elle, y a accès
  perform count(*) from public.scans;
  begin perform public.creer_codes('mensuel', 30, 1); raise exception 'service_role a pu créer des codes'; exception when insufficient_privilege then null; end;   -- réservé à toi, dans l'éditeur SQL
end $$;
reset role;

select 'TOUS LES TESTS DE LA BASE PASSENT' as resultat;
