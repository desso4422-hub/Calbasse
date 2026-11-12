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

export type Categorie = 'cereales' | 'sauces' | 'viandes' | 'autres' | 'fruits';

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
  /** Noms locaux et variantes : recherche, indice du scanner, et vocabulaire du modèle de vision */
  synonymes: string[];
  /**
   * À quoi l'aliment ressemble dans l'assiette, et avec quoi on le confond.
   * Envoyé au modèle de vision : c'est ce qui lui permet de distinguer attiéké et couscous,
   * akassa et pâte blanche, sauce graine et sauce tomate…
   */
  description: string;
};

export const VALEURS_ILLUSTRATIVES = true;

export const categories: { id: Categorie | 'tous'; nom: string }[] = [
  { id: 'tous', nom: 'Tous' },
  { id: 'cereales', nom: 'Pâtes et céréales' },
  { id: 'sauces', nom: 'Sauces' },
  { id: 'viandes', nom: 'Viandes et poissons' },
  { id: 'autres', nom: 'Œufs, haricots et autres' },
  { id: 'fruits', nom: 'Fruits et boissons' },
];

type Macros = [kcal: number, prot: number, gluc: number, lip: number];

function al(
  id: string,
  nom: string,
  categorie: Categorie,
  [kcal, prot, gluc, lip]: Macros,
  unite: string,
  uniteG: number,
  source: Source,
  suitPortion: boolean,
  [couleur, contour]: [string, string],
  synonymes: string[],
  description: string,
  uniteNote?: string,
): Aliment {
  return { id, nom, categorie, kcal, prot, gluc, lip, unite, uniteG, uniteNote, source, suitPortion, couleur, contour, synonymes, description };
}

const F = 'FAO/INFOODS' as const;
const E = 'estime' as const;

export const aliments: Aliment[] = [
  // ——— Pâtes, céréales, tubercules ———
  al('attieke', 'Attiéké', 'cereales', [150, 1, 35, 0.3], '1 louche', 120, F, true, ['#F1E3B8', '#E3CF94'], ['attieke', 'atieke', 'garba', 'acheke'],
    "Semoule de manioc fermentée cuite à la vapeur : petits grains blanc cassé à jaune pâle, légèrement collants, en tas aéré. Grains plus irréguliers et plus mats que le couscous de blé ; plus gros, humides et cuits que le gari (sec, fin, crème)."),
  al('akassa', 'Akassa', 'cereales', [100, 2, 22, 0.5], '1 boule', 150, F, true, ['#E9DCC6', '#D2C1A3'], ['akassa', 'agidi', 'eko', 'akasan'],
    "Pâte de maïs fermentée blanche, lisse, ferme, souvent servie emballée ou moulée en pavé/boule dans une feuille. Plus blanche, plus lisse et plus gélifiée que la pâte blanche (owo) ; l'ablo est en petits pains spongieux."),
  al('pate-rouge', 'Pâte rouge', 'cereales', [110, 2, 22, 1.5], '1 boule', 200, F, true, ['#C9532B', '#A7411D'], ['pate rouge', 'amiwo', 'amiwô', 'djinkoumé', 'djenkoume'],
    "Pâte de maïs cuite dans un bouillon de tomate et d'huile : boule ou dôme orange-rouge, lisse ou légèrement granuleuse, brillante. Souvent avec poulet ou poisson frit. Ne pas confondre avec le riz au gras (grains visibles)."),
  al('pate-blanche', 'Pâte blanche (maïs)', 'cereales', [105, 2, 23, 0.6], '1 boule', 200, E, true, ['#F4EEDC', '#DCD2B6'], ['pate', 'pâte', 'owo', 'wo', 'ugali', 'sadza', 'nshima'],
    "Pâte épaisse de farine de maïs : boule ou galette blanc crème, mate, lisse, qu'on découpe à la main, servie à côté d'une sauce (gombo, légumes, arachide). Plus opaque et plus friable que l'akassa."),
  al('to-mil', 'Tô (mil ou sorgho)', 'cereales', [110, 3, 23, 1], '1 boule', 250, E, true, ['#C9B48C', '#A9946C'], ['to', 'tô', 'toh', 'tuo zaafi', 'tz', 'tô de mil'],
    "Pâte de mil, de sorgho ou de maïs du Sahel : boule beige, grise ou brun clair, plus terne que la pâte de maïs blanche, servie avec une sauce gluante (gombo, feuilles, baobab)."),
  al('igname-pilee', 'Igname pilée', 'cereales', [120, 2, 28, 0.2], '1 boule', 200, F, true, ['#EFE0B8', '#DCC892'], ['igname pilee', 'agoun', 'pounded yam', 'iyan', 'foutou igname'],
    "Igname bouillie puis pilée : boule blanche à ivoire très lisse, élastique et brillante, sans grain. Plus blanche et plus élastique que le foufou de manioc ; le foutou banane est jaune-orangé."),
  al('foutou-banane', 'Foutou banane', 'cereales', [150, 1.2, 36, 0.3], '1 boule', 250, E, true, ['#E9C46A', '#CFA94B'], ['foutou banane', 'foutou', 'foufou banane', 'fufu plantain'],
    "Banane plantain (parfois avec manioc) pilée : boule lisse jaune à orange pâle, collante, servie avec sauce graine ou sauce claire."),
  al('foufou', 'Foufou (manioc)', 'cereales', [160, 1.5, 38, 0.3], '1 boule', 200, E, true, ['#F6F0E2', '#DED3BA'], ['foufou', 'fufu', 'water fufu', 'kpokpo', 'chikwangue'],
    "Pâte de manioc fermentée : boule blanche à grisâtre, lisse, collante et un peu translucide, odeur de fermentation. Plus grise que l'igname pilée."),
  al('placali', 'Placali', 'cereales', [120, 0.5, 29, 0.2], '1 boule', 250, E, true, ['#EDE8DA', '#CFC7B0'], ['placali', 'placaly'],
    "Pâte de manioc fermentée ivoirienne, très lisse, élastique et luisante, blanc gris, servie dans une assiette creuse avec sauce claire, kopè ou gombo."),
  al('eba', 'Eba (gari cuit)', 'cereales', [160, 1, 38, 0.3], '1 boule', 200, E, true, ['#EAD39A', '#CDB570'], ['eba', 'gari cuit', 'piron'],
    "Gari mélangé à l'eau chaude : boule ferme jaune pâle ou blanche, texture fine légèrement granuleuse, servie avec egusi ou sauce gombo."),
  al('banku', 'Banku', 'cereales', [120, 2, 26, 1], '1 boule', 200, E, true, ['#EFE7D2', '#D6CBAE'], ['banku', 'akple', 'akplé'],
    "Pâte fermentée de maïs et manioc : boule blanc cassé lisse, un peu collante, souvent avec sauce gombo, piment et poisson."),
  al('kenkey', 'Kenkey', 'cereales', [130, 2.5, 28, 1], '1 boule', 200, E, true, ['#E4D7B6', '#C3B38A'], ['kenkey', 'dokounou', 'dokunu', 'komi'],
    "Pâte de maïs fermentée cuite dans des feuilles (maïs ou bananier) : boule ou cylindre ferme, beige, surface marquée par la feuille, souvent servie avec poisson frit et piment."),
  al('ablo', 'Ablo', 'cereales', [200, 4, 42, 1], '3 pièces', 150, E, true, ['#F7F1E1', '#DED4B9'], ['ablo', 'abolo'],
    "Petits pains de maïs (ou riz) cuits à la vapeur, ronds, blancs, spongieux et légèrement sucrés, servis par 3 à 6 avec poisson frit et sauce tomate-piment."),
  al('gari', 'Gari', 'cereales', [360, 1, 85, 0.5], '1 bol', 100, F, true, ['#E8C98A', '#CFAE6B'], ['gari', 'tapioca', 'garri'],
    "Semoule de manioc grillée, sèche, en grains fins jaune pâle ou crème, saupoudrée sur les haricots ou trempée dans l'eau. Grains plus fins et plus secs que l'attiéké.", '(sec)'),
  al('baton-manioc', 'Bâton de manioc', 'cereales', [160, 1, 38, 0.3], '1 bâton', 150, E, true, ['#E8E1CC', '#C7BC9C'], ['baton de manioc', 'miondo', 'bobolo', 'chikwangue', 'kwanga'],
    "Pâte de manioc fermentée enroulée dans des feuilles : bâton cylindrique, blanc gris à translucide, très lisse et élastique."),
  al('riz-au-gras', 'Riz au gras', 'cereales', [155, 3, 23.7, 5.2], '1 assiette', 300, F, true, ['#F1D9A0', '#D9B96C'], ['riz au gras', 'riz gras', 'jollof', 'jollof rice', 'riz rouge', 'zame', 'benachin'],
    "Riz cuit dans une sauce tomate-oignon huileuse : grains séparés, orange à rouge orangé, luisants, parfois avec morceaux de légumes. Plus rouge et plus gras que le riz blanc ; le riz du thiéboudienne est plus brun-orangé et servi avec poisson et gros légumes."),
  al('riz-thieb', 'Riz thiéboudienne', 'cereales', [175, 3.5, 28, 5.5], '1 assiette', 300, E, true, ['#D9A066', '#B9824A'], ['thieboudienne', 'thiéboudienne', 'ceebu jen', 'tieb', 'thieb', 'riz au poisson'],
    "Riz brisé cuit dans le bouillon de poisson à la tomate : grains fins cassés, brun orangé, avec croûte (xoon) parfois ; servi en plat large avec poisson farci, manioc, chou, carotte, aubergine."),
  al('riz-blanc', 'Riz blanc', 'cereales', [130, 2.7, 28, 0.3], '1 assiette', 250, F, true, ['#FBF8F0', '#E3DCCB'], ['riz blanc', 'riz', 'riz sauce', 'riz nature'],
    "Riz nature cuit, grains blancs. Ce que la sauce posée dessus recouvre reste blanc."),
  al('waakye', 'Waakye / riz-haricot', 'cereales', [150, 5, 28, 1.5], '1 assiette', 300, E, true, ['#8E5B48', '#6F4434'], ['waakye', 'ayimolou', 'riz haricot', 'riz au haricot', 'watche', 'atassi riz'],
    "Riz cuit avec des haricots (niébé) : grains brun-rouge à violacés parsemés de haricots, souvent avec spaghetti, gari, œuf, sauce tomate-piment (shito)."),
  al('fonio', 'Fonio', 'cereales', [120, 2, 26, 0.5], '1 assiette', 200, E, true, ['#EFE3C4', '#D3C29C'], ['fonio', 'findi'],
    "Très petites graines cuites, plus fines que le couscous, beige clair, légères et aérées."),
  al('couscous-mil', 'Couscous de mil (thiéré)', 'cereales', [130, 3.5, 27, 1], '1 assiette', 250, E, true, ['#B9A27C', '#977F5A'], ['thiere', 'thiéré', 'cere', 'couscous de mil', 'couscous'],
    "Couscous de mil : petits grains gris-beige à brun, plus foncés que l'attiéké, souvent avec sauce mafé ou viande."),
  al('spaghetti', 'Spaghetti', 'cereales', [160, 5.5, 31, 1.5], '1 assiette', 250, E, true, ['#EBC873', '#D2AD55'], ['spaghetti', 'spaghettis', 'pates', 'macaroni', 'spaghetti sauté'],
    "Pâtes longues (ou macaroni), souvent sautées à la tomate et à l'huile, orangées."),
  al('alloco', 'Alloco', 'cereales', [250, 1.5, 32, 13], '1 portion', 150, E, true, ['#E59B3A', '#C67D22'], ['alloco', 'aloco', 'dodo', 'plantain frit', 'banane frite', 'kelewele'],
    "Banane plantain mûre frite : rondelles ou dés jaune-orange à brun caramélisé, brillants d'huile."),
  al('banane-plantain', 'Banane plantain bouillie', 'cereales', [120, 1, 31, 0.2], '1 banane', 180, E, true, ['#E9C46A', '#CFA94B'], ['plantain', 'banane bouillie', 'plantain bouilli', 'plantain braisé', 'bole', 'boli'],
    "Plantain bouilli ou braisé : gros tronçons jaunes (bouilli) ou à peau noircie (braisé, boli), sans huile apparente."),
  al('igname-bouillie', 'Igname bouillie', 'cereales', [115, 1.5, 27, 0.2], '2 morceaux', 200, E, true, ['#F1E6C8', '#D8C99F'], ['igname', 'igname bouillie', 'yam'],
    "Gros morceaux d'igname cuits à l'eau, blancs à jaune pâle, farineux, aux bords nets."),
  al('igname-frite', 'Igname frite', 'cereales', [230, 2, 32, 10], '1 portion', 150, E, true, ['#E8C27A', '#C9A158'], ['igname frite', 'yam frite', 'dundu'],
    "Bâtonnets ou tranches d'igname frits, dorés, plus épais et plus pâles que les frites de pomme de terre."),
  al('patate-douce', 'Patate douce', 'cereales', [90, 1.6, 21, 0.1], '1 morceau', 150, E, true, ['#E8955A', '#C8763E'], ['patate douce', 'patate'],
    "Patate douce bouillie ou braisée, chair orange ou blanche."),
  al('frites', 'Frites', 'cereales', [300, 3, 38, 15], '1 portion', 150, E, true, ['#F0C35A', '#D2A33C'], ['frites', 'frites de pomme de terre', 'chips'],
    "Frites de pomme de terre dorées, fines et régulières."),
  al('pain', 'Pain', 'cereales', [270, 9, 53, 2], '1 demi-baguette', 125, F, true, ['#D9A15B', '#B98340'], ['pain', 'baguette', 'tapalapa', 'pain de mie'],
    "Pain de type baguette ou tapalapa, croûte dorée, souvent fourré (omelette, haricot, viande)."),
  al('beignets', 'Beignets (puff-puff)', 'cereales', [350, 6, 45, 16], '3 beignets', 90, E, true, ['#C98A3E', '#A86E28'], ['beignet', 'beignets', 'puff puff', 'puff-puff', 'botokoin', 'gbofloto', 'bofrot', 'mikate', 'yovo doko', 'chin chin'],
    "Boules de pâte de farine frites, brun doré, rondes et gonflées, intérieur blanc moelleux."),
  al('bouillie', 'Bouillie (mil ou maïs)', 'cereales', [60, 1.5, 12, 0.5], '1 bol', 300, E, true, ['#E6D3AE', '#C8B38A'], ['bouillie', 'koko', 'hausa koko', 'akassan', 'ogi', 'pap', 'bouillie de mil', 'kossam'],
    "Bouillie liquide de mil ou maïs fermenté, beige à brun clair, servie au bol, souvent avec beignets."),

  // ——— Sauces ———
  al('sauce-tomate', 'Sauce tomate', 'sauces', [117, 1.7, 8.3, 9], '1 louche', 60, E, true, ['#C4421C', '#A8371A'], ['sauce tomate', 'tomate', 'sauce rouge', 'stew', 'shito', 'sauce pimentée tomate'],
    "Sauce rouge vif d'huile, tomate, oignon et piment, brillante, sans grains ni feuilles."),
  al('sauce-gombo', 'Sauce gombo', 'sauces', [60, 2, 5, 3.5], '1 louche', 80, F, true, ['#7E8F3A', '#65742B'], ['gombo', 'sauce gombo', 'okra', 'okro', 'fetri', 'ademe gombo', 'sauce gluante', 'kopè'],
    "Sauce verte gluante et filante avec rondelles ou morceaux de gombo, souvent avec poisson fumé ou crabe."),
  al('sauce-graine', 'Sauce graine', 'sauces', [150, 3, 4, 14], '1 louche', 80, F, true, ['#B5481F', '#93381A'], ['sauce graine', 'graine', 'noix de palme', 'banga', 'banga soup', 'sauce palme', 'palm nut soup', 'aboloo'],
    "Sauce à la pulpe de noix de palme : rouge-orangé profond à brun-rouge, épaisse, veloutée et huileuse, plus foncée et plus crémeuse que la sauce tomate."),
  al('sauce-arachide', 'Sauce arachide', 'sauces', [180, 6, 7, 15], '1 louche', 80, E, true, ['#A86A35', '#8A5326'], ['arachide', 'mafé', 'mafe', 'domoda', 'sauce cacahuete', 'groundnut soup', 'tigadèguèna', 'sauce arachide'],
    "Sauce à la pâte d'arachide : brun-orangé, épaisse et opaque, avec huile rouge en surface ; souvent avec viande et gros légumes (mafé)."),
  al('sauce-feuilles', 'Sauce feuilles', 'sauces', [90, 3, 4, 7], '1 louche', 80, E, true, ['#3F6B2E', '#2F5422'], ['feuilles', 'sauce feuilles', 'legumes', 'légumes', 'gboma', 'crincrin', 'adémè', 'épinards', 'sauce verte', 'baobab', 'lalo', 'kouka', 'efo riro', 'pondu', 'saka saka', 'feuilles de manioc'],
    "Sauce de légumes-feuilles hachés (gboma, épinards, crincrin, manioc, baobab) : vert foncé, filandreuse, plus ou moins huileuse, parfois avec poisson fumé ou viande."),
  al('ndole', 'Ndolè', 'sauces', [180, 8, 6, 14], '1 louche', 100, E, true, ['#4E6A34', '#3B5225'], ['ndole', 'ndolè', 'ndolé'],
    "Feuilles amères hachées cuites avec pâte d'arachide : vert foncé à vert kaki, épais, granuleux, souvent avec crevettes ou viande. Plus clair et plus crémeux que la sauce feuilles simple."),
  al('eru', 'Eru / okok', 'sauces', [190, 5, 4, 17], '1 louche', 100, E, true, ['#2F5A2A', '#22441E'], ['eru', 'okok', 'okazi', 'afang'],
    "Feuilles finement émincées de gnetum cuites dans beaucoup d'huile rouge : vert sombre luisant, filaments fins, avec peau de bœuf ou poisson fumé."),
  al('sauce-egusi', 'Sauce egusi', 'sauces', [220, 8, 6, 18], '1 louche', 80, E, true, ['#C9A24A', '#A88430'], ['egusi', 'sauce egusi', 'sauce pistache', 'agoussi', 'gboman egusi', 'ngondo'],
    "Graines de courge moulues : sauce jaune-orangée grumeleuse comme des œufs brouillés, souvent avec feuilles vertes, huile rouge et viande."),
  al('sauce-claire', 'Sauce claire', 'sauces', [35, 2, 3, 1.5], '1 louche', 100, E, true, ['#C76A3A', '#A65428'], ['sauce claire', 'light soup', 'soupe', 'pepper soup', 'soupe de poisson', 'bouillon', 'kpètè'],
    "Bouillon léger et liquide rouge-orangé (tomate, piment), peu gras, avec morceaux de viande ou de poisson, servi dans un bol ou une assiette creuse."),
  al('sauce-yassa', 'Sauce yassa', 'sauces', [110, 1.5, 9, 8], '1 louche', 100, E, true, ['#D9B65C', '#B8963E'], ['yassa', 'sauce oignon', 'sauce yassa'],
    "Oignons émincés fondus au citron et à la moutarde : sauce jaune pâle à dorée, pleine de lamelles d'oignon translucides, parfois avec olives."),
  al('piment', 'Piment écrasé', 'sauces', [40, 1.5, 5, 2], '1 cuillère', 20, E, true, ['#B3261E', '#8E1C16'], ['piment', 'pili pili', 'shito', 'kpètè piment', 'sauce piment'],
    "Petite quantité de piment écrasé (rouge ou vert) au bord de l'assiette."),

  // ——— Viandes et poissons ———
  al('poulet-frit', 'Poulet frit', 'viandes', [236, 20.7, 5.7, 15], '1 cuisse', 140, F, false, ['#8A4519', '#6E3612'], ['poulet frit', 'poulet', 'cuisse de poulet'],
    "Morceau de poulet frit, peau brun doré à brun foncé, croustillante et brillante."),
  al('poulet-braise', 'Poulet braisé', 'viandes', [190, 27, 0, 9], '1 cuisse', 140, E, false, ['#9A5424', '#7B4019'], ['poulet braise', 'poulet braisé', 'poulet bicyclette', 'poulet grillé', 'poulet piqué', 'poulet yassa', 'choukouya poulet'],
    "Poulet grillé au feu de bois : peau marquée, zones noircies, rouge-brun épicé, plus sec que le poulet frit."),
  al('kedjenou', 'Kedjenou (poulet mijoté)', 'viandes', [150, 18, 4, 7], '1 portion', 250, E, false, ['#B0602F', '#8E4A21'], ['kedjenou', 'kédjénou', 'poulet mijoté', 'poulet en sauce', 'poulet dg'],
    "Poulet mijoté avec tomate, oignon, aubergine et piment : morceaux de poulet dans une sauce rouge-orangé peu grasse avec légumes fondus."),
  al('pintade', 'Pintade', 'viandes', [160, 25, 0, 6.5], '1 cuisse', 140, E, false, ['#6B3D25', '#53301C'], ['pintade', 'guinea fowl'],
    "Volaille à chair plus foncée que le poulet, souvent braisée ou en sauce."),
  al('gesiers', 'Gésiers', 'viandes', [150, 25, 0, 5], '1 portion', 100, E, false, ['#7E3B2A', '#61301F'], ['gesier', 'gésiers', 'gesiers', 'gizzard'],
    "Petits morceaux ronds et fermes de gésiers de volaille, bruns, sautés ou en brochette."),
  al('boeuf', 'Viande de bœuf', 'viandes', [220, 26, 0, 13], '1 morceau', 100, F, false, ['#7A3A24', '#5F2B1A'], ['viande', 'boeuf', 'bœuf', 'brochette', 'suya', 'choukouya', 'kilishi', 'viande en sauce'],
    "Morceaux de bœuf brun foncé, en sauce ou grillés (brochette, suya couvert d'épices d'arachide rouges)."),
  al('mouton', 'Viande de mouton ou chèvre', 'viandes', [250, 25, 0, 16], '1 morceau', 100, E, false, ['#6E3B28', '#552C1D'], ['mouton', 'agneau', 'chèvre', 'chevre', 'cabri', 'dibi', 'méchoui', 'goat'],
    "Morceaux de mouton ou chèvre avec os et gras visible, grillés (dibi) ou en sauce."),
  al('peau-boeuf', 'Peau de bœuf (kpanman)', 'viandes', [150, 30, 0, 3], '1 portion', 80, E, false, ['#D8C2A0', '#B39C78'], ['kpanman', 'peau de boeuf', 'kanda', 'ponmo', 'wele'],
    "Morceaux de peau de bœuf cuite, gélatineux, beige à brun clair, en sauce."),
  al('poisson-braise', 'Poisson braisé', 'viandes', [170, 22, 0, 9], '1 morceau', 150, E, false, ['#8C6A4A', '#6F5236'], ['poisson braise', 'poisson braisé', 'poisson grillé', 'capitaine', 'tilapia', 'carpe braisée', 'chinchard braisé'],
    "Poisson entier ou en morceaux grillé : peau noircie et marquée par la grille, souvent garni d'oignon et tomate crus."),
  al('poisson-frit', 'Poisson frit', 'viandes', [200, 20, 3, 12], '1 morceau', 150, E, false, ['#A0703F', '#81572C'], ['poisson frit', 'poisson', 'chinchard', 'maquereau', 'sardine', 'carpe frite', 'fried fish'],
    "Poisson frit en tranches ou entier, peau brun doré uniforme et brillante."),
  al('thon-frit', 'Thon frit (garba)', 'viandes', [220, 25, 0, 13], '1 morceau', 120, E, false, ['#8E5A35', '#704526'], ['thon', 'thon frit', 'garba thon'],
    "Gros morceaux de thon frits, chair brun foncé dense, typiques du garba."),
  al('poisson-fume', 'Poisson fumé', 'viandes', [250, 35, 0, 12], '1 morceau', 80, E, false, ['#6E4B2C', '#553820'], ['poisson fume', 'poisson fumé', 'poisson sec', 'kobo', 'adowévi', 'stockfish', 'momoni'],
    "Poisson fumé ou séché, brun foncé à noir, sec, souvent émietté dans les sauces."),
  al('crevettes', 'Crevettes', 'viandes', [100, 20, 0, 1.5], '1 portion', 100, E, false, ['#E58A6B', '#C66F52'], ['crevette', 'crevettes', 'gambas', 'shrimp'],
    "Crevettes roses à orange, entières ou décortiquées."),
  al('crabe', 'Crabe', 'viandes', [90, 18, 0, 1.5], '1 crabe', 100, E, false, ['#C0502A', '#9E3F20'], ['crabe', 'crabes'],
    "Crabe entier ou pinces, carapace orange-rouge, souvent dans la sauce gombo."),
  al('escargot', 'Escargots', 'viandes', [90, 16, 2, 1.5], '5 escargots', 100, E, false, ['#5B4636', '#463428'], ['escargot', 'escargots', 'achatine', 'igbin'],
    "Chair d'escargot géant (achatine), brun gris, ferme, en sauce ou grillée."),
  al('wagashi', 'Wagashi (fromage peul)', 'viandes', [290, 18, 2, 23], '1 tranche', 80, E, false, ['#F3E9D2', '#C9532B'], ['wagashi', 'fromage', 'waragashi', 'gasaru', 'wangash'],
    "Fromage peul de lait de vache : galette ou tranche blanche, souvent à croûte rouge (teintée au sorgho), frite ou en sauce."),

  // ——— Œufs, haricots et autres ———
  al('omelette', 'Omelette', 'autres', [155, 11, 1, 12], '2 œufs', 120, F, false, ['#F2C94C', '#D9AE2E'], ['omelette', 'omelet', 'oeufs brouillés'],
    "Omelette jaune, parfois avec oignon, tomate ou piment."),
  al('oeuf', 'Œuf dur', 'autres', [155, 13, 1, 11], '1 œuf', 50, F, false, ['#FBF3DA', '#F2C94C'], ['oeuf', 'œuf', 'oeufs', 'œufs', 'oeuf dur', 'oeuf bouilli'],
    "Œuf dur entier ou coupé, blanc et jaune visibles."),
  al('haricots', 'Haricots (niébé)', 'autres', [115, 8, 20, 0.5], '1 louche', 150, F, true, ['#8B4A3A', '#6E392C'], ['haricot', 'haricots', 'niebe', 'niébé', 'abobo', 'atassi', 'beans', 'red red', 'cowpea'],
    "Haricots niébé cuits (beiges, bruns ou rouges, à œil noir), entiers, souvent avec huile rouge et gari."),
  al('akara', 'Akara (beignets de haricot)', 'autres', [270, 11, 20, 16], '4 boules', 100, E, false, ['#B8742F', '#985E22'], ['akara', 'accra', 'acarajé', 'ata', 'kosai', 'koose', 'beignets de haricot'],
    "Petites boules frites de pâte de niébé, brun doré irrégulier, intérieur beige dense."),
  al('moi-moi', 'Moin-moin', 'autres', [150, 9, 13, 7], '1 part', 150, E, false, ['#D97A4A', '#B86235'], ['moi moi', 'moin moin', 'moyinmoyin', 'koki', 'ablo haricot'],
    "Gâteau de niébé cuit à la vapeur : pavé ou dôme orange-rose lisse, parfois dans une feuille, peut contenir œuf ou poisson."),
  al('legumes-cuits', 'Légumes cuits', 'autres', [45, 1.2, 9, 0.3], '1 portion', 120, E, true, ['#7FA35A', '#5E7F40'], ['legumes', 'chou', 'carotte', 'aubergine', 'manioc bouilli', 'navet', 'gombo entier'],
    "Gros morceaux de légumes cuits dans le plat : chou, carotte, aubergine, manioc, patate, navet (thiéboudienne, mafé, kedjenou)."),
  al('crudites', 'Crudités', 'autres', [20, 1, 3.5, 0.2], '1 portion', 80, E, true, ['#9BC26B', '#79A04B'], ['salade', 'crudites', 'crudités', 'oignon cru', 'tomate crue', 'concombre'],
    "Salade, tomate, oignon ou concombre crus, sans sauce grasse."),
  al('avocat', 'Avocat', 'autres', [160, 2, 9, 15], '1 demi', 100, F, false, ['#8DA33E', '#6C8128'], ['avocat', 'avocado'],
    "Demi-avocat ou tranches à chair vert clair et beurrée."),
  al('arachides', 'Arachides grillées', 'autres', [590, 25, 16, 49], '1 poignée', 30, F, true, ['#C9935A', '#A87740'], ['arachide grillée', 'arachides', 'cacahuetes', 'cacahuètes', 'groundnuts', 'kuli kuli'],
    "Arachides grillées décortiquées, petites graines brun clair."),
  al('degue', 'Dégué / thiakry', 'autres', [140, 4, 20, 4.5], '1 bol', 200, E, true, ['#F2EBDD', '#D8CDB5'], ['degue', 'dégué', 'thiakry', 'chakery', 'lait caillé', 'yaourt mil', 'fura'],
    "Mil ou couscous mélangé à du lait caillé sucré : bol blanc crémeux avec petits grains."),

  // ——— Fruits et boissons ———
  al('mangue', 'Mangue', 'fruits', [60, 0.8, 15, 0.4], '1 mangue', 200, F, false, ['#F2A93B', '#D68B22'], ['mangue', 'mango'], "Mangue en tranches ou entière, chair orange."),
  al('banane', 'Banane douce', 'fruits', [89, 1.1, 23, 0.3], '1 banane', 120, F, false, ['#F4D35E', '#D8B63F'], ['banane douce', 'banane', 'banana'], "Banane dessert jaune."),
  al('papaye', 'Papaye', 'fruits', [43, 0.5, 11, 0.3], '1 tranche', 150, F, true, ['#F28C4B', '#D67133'], ['papaye', 'papaya'], "Tranches de papaye à chair orange et graines noires."),
  al('ananas', 'Ananas', 'fruits', [50, 0.5, 13, 0.1], '1 tranche', 120, F, true, ['#F1D15C', '#D3B23D'], ['ananas', 'pineapple'], "Tranches ou morceaux d'ananas jaune."),
  al('bissap', 'Bissap sucré', 'fruits', [60, 0, 15, 0], '1 verre', 250, E, true, ['#8E1B3A', '#6D142C'], ['bissap', 'foléré', 'zobo', 'jus d hibiscus', 'sobolo'], "Boisson rouge foncé à l'hibiscus, sucrée."),
  al('gingembre', 'Jus de gingembre', 'fruits', [70, 0, 17, 0], '1 verre', 250, E, true, ['#E7D49A', '#C9B577'], ['gingembre', 'jus de gingembre', 'ginger', 'nyamanku'], "Boisson jaune pâle trouble au gingembre, sucrée."),
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
