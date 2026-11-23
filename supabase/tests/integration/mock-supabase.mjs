/**
 * Faux Supabase pour les tests d'intégration : il parle le même protocole que Supabase (authentification,
 * appels de fonctions SQL, lecture et écriture de tables) mais écrit dans une VRAIE base PostgreSQL où la
 * vraie migration est appliquée. La vraie fonction « api » (index.ts, sous Deno) tourne contre lui :
 * on vérifie ainsi les noms de paramètres et les formes de réponse entre la fonction et la base.
 *
 * Il contient aussi un faux RodiumAI (/rodium/v1/chat/completions).
 */
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';

const VOID = new Set(['terminer_scan', 'echouer_scan', 'refuser_paiement']);

export function demarrerFauxSupabase({ base, port = 0, reponseModele }) {
  const sql = (requete) =>
    execFileSync('psql', ['-U', 'postgres', '-h', '/var/run/postgresql', '-X', '-q', '-tA', '-v', 'ON_ERROR_STOP=1', '-d', base, '-c', requete], { encoding: 'utf8' }).trim();
  const lit = (v) => {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return `'${(typeof v === 'object' ? JSON.stringify(v) : String(v)).replace(/'/g, "''")}'`;
  };
  const cols = (o) => Object.keys(o).map((k) => `"${k}"`).join(', ');
  const vals = (o) => Object.values(o).map(lit).join(', ');
  const appels = [];

  const serveur = createServer(async (req, res) => {
    const morceaux = [];
    for await (const m of req) morceaux.push(m);
    const texte = Buffer.concat(morceaux).toString();
    const corps = texte ? JSON.parse(texte) : {};
    const url = new URL(req.url, 'http://x');
    const rep = (statut, objet) => {
      res.writeHead(statut, { 'Content-Type': 'application/json' });
      res.end(objet === undefined ? '' : JSON.stringify(objet));
    };
    appels.push(`${req.method} ${url.pathname}`);
    try {
      const jeton = (req.headers.authorization ?? '').replace(/^Bearer /, '');

      // ——— Authentification ———
      if (url.pathname === '/auth/v1/signup' && req.method === 'POST') {
        const id = sql('insert into auth.users default values returning id');
        return rep(200, { access_token: `tok-${id}`, refresh_token: `ref-${id}`, expires_in: 3600, token_type: 'bearer', user: { id, is_anonymous: true } });
      }
      if (url.pathname === '/auth/v1/user' && req.method === 'GET') {
        const id = jeton.startsWith('tok-') ? jeton.slice(4) : '';
        const existe = /^[0-9a-f-]{36}$/.test(id) && sql(`select count(*) from auth.users where id = '${id}'`) === '1';
        return existe ? rep(200, { id, aud: 'authenticated', role: 'authenticated', is_anonymous: true }) : rep(401, { code: 401, msg: 'invalid JWT' });
      }
      const suppression = /^\/auth\/v1\/admin\/users\/([0-9a-f-]{36})$/.exec(url.pathname);
      // La bibliothèque lit l'utilisateur avant de le supprimer
      if (suppression && req.method === 'GET') {
        return sql(`select count(*) from auth.users where id = '${suppression[1]}'`) === '1'
          ? rep(200, { id: suppression[1], aud: 'authenticated', is_anonymous: true })
          : rep(404, { code: 404, msg: 'User not found' });
      }
      if (suppression && req.method === 'DELETE') {
        sql(`delete from auth.users where id = '${suppression[1]}'`);
        return rep(200, {});
      }

      // ——— Fonctions SQL (rpc) : l'appel est écrit avec les noms de paramètres, comme le fait PostgREST ———
      const rpc = /^\/rest\/v1\/rpc\/(\w+)$/.exec(url.pathname);
      if (rpc && req.method === 'POST') {
        const nom = rpc[1];
        const args = Object.entries(corps).map(([k, v]) => `${k} => ${lit(v)}`).join(', ');
        if (VOID.has(nom)) {
          sql(`select public.${nom}(${args})`);
          return rep(200, null);
        }
        const sortie = sql(`select to_jsonb(r) from (select public.${nom}(${args}) as r) t`);
        return res.writeHead(200, { 'Content-Type': 'application/json' }) && res.end(sortie || 'null');
      }

      // ——— Tables ———
      if (url.pathname === '/rest/v1/scans' && req.method === 'GET') {
        const id = /^eq\.(.+)$/.exec(url.searchParams.get('id') ?? '')?.[1];
        const user = /^eq\.(.+)$/.exec(url.searchParams.get('user_id') ?? '')?.[1];
        const lignes = sql(`select coalesce(jsonb_agg(jsonb_build_object('id', id)), '[]') from public.scans where id = ${lit(id)} and user_id = ${lit(user)}`);
        return res.writeHead(200, { 'Content-Type': 'application/json' }) && res.end(lignes);
      }
      if (url.pathname === '/rest/v1/corrections' && req.method === 'POST') {
        sql(`insert into public.corrections (${cols(corps)}) values (${vals(corps)}) on conflict (scan_id) do update set proposees = excluded.proposees, finales = excluded.finales`);
        return rep(201);
      }
      if (url.pathname === '/rest/v1/signalements' && req.method === 'POST') {
        sql(`insert into public.signalements (${cols(corps)}) values (${vals(corps)}) on conflict (user_id, jour, aliment_id) do nothing`);
        return rep(201);
      }

      // ——— Faux RodiumAI ———
      if (url.pathname === '/rodium/v1/chat/completions' && req.method === 'POST') {
        return rep(200, { choices: [{ message: { content: JSON.stringify(reponseModele) }, finish_reason: 'stop' }], usage: { prompt_tokens: 10400, completion_tokens: 350 }, cost_rodi: 2.4 });
      }
      rep(404, { message: `inconnu : ${req.method} ${url.pathname}` });
    } catch (e) {
      rep(400, { message: String(e.stderr ?? e.message).slice(0, 400) });
    }
  });

  return new Promise((resoudre) =>
    serveur.listen(port, '127.0.0.1', () => resoudre({ port: serveur.address().port, appels, sql, fermer: () => serveur.close() })),
  );
}
