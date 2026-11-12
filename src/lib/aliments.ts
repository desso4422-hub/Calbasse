/**
 * Base d'aliments de Calbasse.
 *
 * ⚠️ VALEURS D'ILLUSTRATION. Toutes les calories, protéines, glucides, lipides et
 * grammes ci-dessous sont des exemples, cohérents avec les maquettes. Avant tout test
 * utilisateur, il faut les remplacer par une base sourcée (FAO/INFOODS, tables
 * ouest-africaines WAFCT) validée par un nutritionniste.
 *
 * Valeurs pour 100 g d'aliment prêt à manger (cuit), huile de cuisson habituelle comprise.
 */

export type Categorie = 'cereales' | 'sauces' | 'viandes' | 'autres';

export type Source = 'FAO/INFOODS' | 'estime';

export type Aliment = {
  id: string;
  nom: string;
  categorie: Categorie;
  /** Pour 100 g */
  kcal: number;
  prot: number;
  gluc: number;
  lip: number;
  /** Mesure habituelle, ex. « 1 louche » */
  unite: string;
  /** Poids de la mesure habituelle, en grammes */
  uniteG: number;
  /** Précision affichée après l'unité, ex. « (sec) » */
  uniteNote?: string;
  source: Source;
  /** false pour les aliments comptés à la pièce (cuisse, poisson, œuf) : la taille de portion ne les change pas */
  suitPortion: boolean;
  /** Couleurs de la pastille (maquette Plats) */
  couleur: string;
  contour: string;
  /** Mots qui aident la reconnaissance par texte (indice saisi au scanner) */
  synonymes: string[];
};

export const VALEURS_ILLUSTRATIVES = true;

export const categories: { id: Categorie | 'tous'; nom: string }[] = [
  { id: 'tous', nom: 'Tous' },
  { id: 'cereales', nom: 'Pâtes et céréales' },
  { id: 'sauces', nom: 'Sauces' },
  { id: 'viandes', nom: 'Viandes et poissons' },
  { id: 'autres', nom: 'Œufs, haricots et autres' },
];

export const aliments: Aliment[] = [
  // Pâtes et céréales
  { id: 'attieke', nom: 'Attiéké', categorie: 'cereales', kcal: 150, prot: 1, gluc: 35, lip: 0.3, unite: '1 louche', uniteG: 120, source: 'FAO/INFOODS', suitPortion: true, couleur: '#F1E3B8', contour: '#E3CF94', synonymes: ['attieke', 'atieke', 'garba'] },
  { id: 'akassa', nom: 'Akassa', categorie: 'cereales', kcal: 100, prot: 2, gluc: 22, lip: 0.5, unite: '1 boule', uniteG: 150, source: 'FAO/INFOODS', suitPortion: true, couleur: '#E9DCC6', contour: '#D2C1A3', synonymes: ['akassa', 'agidi', 'eko'] },
  { id: 'pate-rouge', nom: 'Pâte rouge', categorie: 'cereales', kcal: 110, prot: 2, gluc: 22, lip: 1.5, unite: '1 boule', uniteG: 200, source: 'FAO/INFOODS', suitPortion: true, couleur: '#C9532B', contour: '#A7411D', synonymes: ['pate rouge', 'amiwo', 'amiwô'] },
  { id: 'pate-blanche', nom: 'Pâte blanche (maïs)', categorie: 'cereales', kcal: 105, prot: 2, gluc: 23, lip: 0.6, unite: '1 boule', uniteG: 200, source: 'estime', suitPortion: true, couleur: '#F4EEDC', contour: '#DCD2B6', synonymes: ['pate', 'pâte', 'owo', 'wo', 'toh', 'to', 'ugali', 'banku'] },
  { id: 'igname-pilee', nom: 'Igname pilée', categorie: 'cereales', kcal: 120, prot: 2, gluc: 28, lip: 0.2, unite: '1 boule', uniteG: 200, source: 'FAO/INFOODS', suitPortion: true, couleur: '#EFE0B8', contour: '#DCC892', synonymes: ['igname pilee', 'igname', 'agoun', 'pounded yam', 'foutou'] },
  { id: 'foufou', nom: 'Foufou (manioc)', categorie: 'cereales', kcal: 160, prot: 1.5, gluc: 38, lip: 0.3, unite: '1 boule', uniteG: 200, source: 'estime', suitPortion: true, couleur: '#F6F0E2', contour: '#DED3BA', synonymes: ['foufou', 'fufu', 'placali'] },
  { id: 'gari', nom: 'Gari', categorie: 'cereales', kcal: 360, prot: 1, gluc: 85, lip: 0.5, unite: '1 bol', uniteG: 100, uniteNote: '(sec)', source: 'FAO/INFOODS', suitPortion: true, couleur: '#E8C98A', contour: '#CFAE6B', synonymes: ['gari', 'tapioca', 'eba'] },
  { id: 'riz-au-gras', nom: 'Riz au gras', categorie: 'cereales', kcal: 155, prot: 3, gluc: 23.7, lip: 5.2, unite: '1 assiette', uniteG: 300, source: 'FAO/INFOODS', suitPortion: true, couleur: '#F1D9A0', contour: '#D9B96C', synonymes: ['riz au gras', 'riz gras', 'jollof', 'tieb', 'thieb', 'riz rouge'] },
  { id: 'riz-blanc', nom: 'Riz blanc', categorie: 'cereales', kcal: 130, prot: 2.7, gluc: 28, lip: 0.3, unite: '1 assiette', uniteG: 250, source: 'FAO/INFOODS', suitPortion: true, couleur: '#FBF8F0', contour: '#E3DCCB', synonymes: ['riz blanc', 'riz', 'riz sauce'] },
  { id: 'spaghetti', nom: 'Spaghetti', categorie: 'cereales', kcal: 160, prot: 5.5, gluc: 31, lip: 1.5, unite: '1 assiette', uniteG: 250, source: 'estime', suitPortion: true, couleur: '#EBC873', contour: '#D2AD55', synonymes: ['spaghetti', 'spaghettis', 'pates', 'macaroni'] },
  { id: 'alloco', nom: 'Alloco', categorie: 'cereales', kcal: 250, prot: 1.5, gluc: 32, lip: 13, unite: '1 portion', uniteG: 150, source: 'estime', suitPortion: true, couleur: '#E59B3A', contour: '#C67D22', synonymes: ['alloco', 'aloco', 'dodo', 'plantain frit', 'banane frite'] },
  { id: 'pain', nom: 'Pain', categorie: 'cereales', kcal: 270, prot: 9, gluc: 53, lip: 2, unite: '1 demi-baguette', uniteG: 125, source: 'FAO/INFOODS', suitPortion: true, couleur: '#D9A15B', contour: '#B98340', synonymes: ['pain', 'baguette'] },

  // Sauces
  { id: 'sauce-tomate', nom: 'Sauce tomate', categorie: 'sauces', kcal: 117, prot: 1.7, gluc: 8.3, lip: 9, unite: '1 louche', uniteG: 60, source: 'estime', suitPortion: true, couleur: '#C4421C', contour: '#A8371A', synonymes: ['sauce tomate', 'tomate', 'sauce rouge'] },
  { id: 'sauce-gombo', nom: 'Sauce gombo', categorie: 'sauces', kcal: 60, prot: 2, gluc: 5, lip: 3.5, unite: '1 louche', uniteG: 80, source: 'FAO/INFOODS', suitPortion: true, couleur: '#7E8F3A', contour: '#65742B', synonymes: ['gombo', 'okra', 'fetri'] },
  { id: 'sauce-graine', nom: 'Sauce graine', categorie: 'sauces', kcal: 150, prot: 3, gluc: 4, lip: 14, unite: '1 louche', uniteG: 80, source: 'FAO/INFOODS', suitPortion: true, couleur: '#B5481F', contour: '#93381A', synonymes: ['sauce graine', 'graine', 'noix de palme', 'banga'] },
  { id: 'sauce-arachide', nom: 'Sauce arachide', categorie: 'sauces', kcal: 180, prot: 6, gluc: 7, lip: 15, unite: '1 louche', uniteG: 80, source: 'estime', suitPortion: true, couleur: '#A86A35', contour: '#8A5326', synonymes: ['arachide', 'mafé', 'mafe', 'sauce cacahuete', 'groundnut'] },
  { id: 'sauce-feuilles', nom: 'Sauce feuilles', categorie: 'sauces', kcal: 90, prot: 3, gluc: 4, lip: 7, unite: '1 louche', uniteG: 80, source: 'estime', suitPortion: true, couleur: '#3F6B2E', contour: '#2F5422', synonymes: ['feuilles', 'legumes', 'légumes', 'gboma', 'crincrin', 'adémè', 'ndole', 'ndolè', 'épinards'] },

  // Viandes et poissons
  { id: 'poulet-frit', nom: 'Poulet frit', categorie: 'viandes', kcal: 236, prot: 20.7, gluc: 5.7, lip: 15, unite: '1 cuisse', uniteG: 140, source: 'FAO/INFOODS', suitPortion: false, couleur: '#8A4519', contour: '#6E3612', synonymes: ['poulet frit', 'poulet'] },
  { id: 'poulet-braise', nom: 'Poulet braisé', categorie: 'viandes', kcal: 190, prot: 27, gluc: 0, lip: 9, unite: '1 cuisse', uniteG: 140, source: 'estime', suitPortion: false, couleur: '#9A5424', contour: '#7B4019', synonymes: ['poulet braise', 'poulet braisé', 'poulet bicyclette', 'poulet grillé', 'choukouya'] },
  { id: 'poisson-braise', nom: 'Poisson braisé', categorie: 'viandes', kcal: 170, prot: 22, gluc: 0, lip: 9, unite: '1 morceau', uniteG: 150, source: 'estime', suitPortion: false, couleur: '#8C6A4A', contour: '#6F5236', synonymes: ['poisson braise', 'poisson braisé', 'poisson grillé', 'capitaine', 'tilapia'] },
  { id: 'poisson-frit', nom: 'Poisson frit', categorie: 'viandes', kcal: 200, prot: 20, gluc: 3, lip: 12, unite: '1 morceau', uniteG: 150, source: 'estime', suitPortion: false, couleur: '#A0703F', contour: '#81572C', synonymes: ['poisson frit', 'poisson', 'chinchard', 'maquereau'] },
  { id: 'boeuf', nom: 'Viande de bœuf', categorie: 'viandes', kcal: 220, prot: 26, gluc: 0, lip: 13, unite: '1 morceau', uniteG: 100, source: 'FAO/INFOODS', suitPortion: false, couleur: '#7A3A24', contour: '#5F2B1A', synonymes: ['viande', 'boeuf', 'bœuf', 'brochette', 'suya', 'choukouya boeuf'] },
  { id: 'mouton', nom: 'Viande de mouton', categorie: 'viandes', kcal: 250, prot: 25, gluc: 0, lip: 16, unite: '1 morceau', uniteG: 100, source: 'estime', suitPortion: false, couleur: '#6E3B28', contour: '#552C1D', synonymes: ['mouton', 'agneau', 'chèvre', 'chevre', 'cabri'] },
  { id: 'wagashi', nom: 'Wagashi (fromage peul)', categorie: 'viandes', kcal: 290, prot: 18, gluc: 2, lip: 23, unite: '1 tranche', uniteG: 80, source: 'estime', suitPortion: false, couleur: '#F3E9D2', contour: '#C9532B', synonymes: ['wagashi', 'fromage', 'waragashi', 'gasaru'] },

  // Œufs, haricots et autres
  { id: 'omelette', nom: 'Omelette', categorie: 'autres', kcal: 155, prot: 11, gluc: 1, lip: 12, unite: '2 œufs', uniteG: 120, source: 'FAO/INFOODS', suitPortion: false, couleur: '#F2C94C', contour: '#D9AE2E', synonymes: ['omelette', 'omelet'] },
  { id: 'oeuf', nom: 'Œuf dur', categorie: 'autres', kcal: 155, prot: 13, gluc: 1, lip: 11, unite: '1 œuf', uniteG: 50, source: 'FAO/INFOODS', suitPortion: false, couleur: '#FBF3DA', contour: '#F2C94C', synonymes: ['oeuf', 'œuf', 'oeufs', 'œufs'] },
  { id: 'haricots', nom: 'Haricots (niébé)', categorie: 'autres', kcal: 115, prot: 8, gluc: 20, lip: 0.5, unite: '1 louche', uniteG: 150, source: 'FAO/INFOODS', suitPortion: true, couleur: '#8B4A3A', contour: '#6E392C', synonymes: ['haricot', 'haricots', 'niebe', 'niébé', 'abobo', 'atassi', 'waakye', 'beans'] },
  { id: 'avocat', nom: 'Avocat', categorie: 'autres', kcal: 160, prot: 2, gluc: 9, lip: 15, unite: '1 demi', uniteG: 100, source: 'FAO/INFOODS', suitPortion: false, couleur: '#8DA33E', contour: '#6C8128', synonymes: ['avocat'] },
  { id: 'banane-plantain', nom: 'Banane plantain bouillie', categorie: 'autres', kcal: 120, prot: 1, gluc: 31, lip: 0.2, unite: '1 banane', uniteG: 180, source: 'estime', suitPortion: true, couleur: '#E9C46A', contour: '#CFA94B', synonymes: ['plantain', 'banane'] },
];

const index = new Map(aliments.map((a) => [a.id, a]));

export function trouverAliment(id: string): Aliment {
  const a = index.get(id);
  if (!a) throw new Error(`Aliment inconnu : ${id}`);
  return a;
}

export function alimentExiste(id: string): boolean {
  return index.has(id);
}

/** Retire accents et majuscules, pour comparer des saisies libres. */
export function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function rechercherAliments(requete: string, categorie: Categorie | 'tous' = 'tous'): Aliment[] {
  const q = normaliser(requete);
  return aliments.filter((a) => {
    if (categorie !== 'tous' && a.categorie !== categorie) return false;
    if (!q) return true;
    return normaliser(a.nom).includes(q) || a.synonymes.some((s) => normaliser(s).includes(q));
  });
}
