// Calbasse : fonction « api ». À coller en entier dans Supabase → Edge Functions → fonction « api » (éditeur), puis Deploy.
// Penser à désactiver « Verify JWT » dans les réglages de la fonction (la fonction vérifie elle-même les connexions).
// FICHIER GÉNÉRÉ depuis supabase/functions/api/ : ne pas modifier ici (npm run installation).

// supabase/functions/api/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

// supabase/functions/api/cinetpay.ts
var ErreurCinetPay = class extends Error {
};
async function creerPaiementCinetPay(config2, d, http = fetch) {
  const reponse = await http(`${config2.urlApi}/payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: config2.apiKey,
      site_id: config2.siteId,
      transaction_id: d.transactionId,
      amount: d.montant,
      // doit être un multiple de 5
      currency: "XOF",
      description: d.description,
      notify_url: `${config2.urlPublique}/cinetpay/notification`,
      return_url: `${config2.urlPublique}/cinetpay/retour`,
      channels: "ALL",
      // Mobile Money, cartes, wallets
      lang: "fr",
      metadata: d.compteId
    })
  });
  const donnees = await reponse.json().catch(() => ({}));
  if (donnees.code !== "201" || !donnees.data?.payment_url) {
    throw new ErreurCinetPay(`Cr\xE9ation du paiement refus\xE9e : ${donnees.code ?? reponse.status} ${donnees.message ?? ""} ${donnees.description ?? ""}`.trim());
  }
  return donnees.data.payment_url;
}
async function verifierPaiementCinetPay(config2, transactionId, http = fetch) {
  const reponse = await http(`${config2.urlApi}/payment/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: config2.apiKey, site_id: config2.siteId, transaction_id: transactionId })
  });
  const donnees = await reponse.json().catch(() => ({}));
  const statut = donnees.data?.status;
  return {
    accepte: donnees.code === "00" && statut === "ACCEPTED",
    echoue: statut === "REFUSED" || statut === "CANCELED",
    montant: donnees.data?.amount !== void 0 ? Number(donnees.data.amount) : null,
    devise: donnees.data?.currency ?? null,
    brut: donnees
  };
}

// supabase/functions/_shared/aliments.ts
var categories = [
  { id: "tous", nom: "Tous" },
  { id: "cereales", nom: "P\xE2tes et c\xE9r\xE9ales" },
  { id: "sauces", nom: "Sauces" },
  { id: "viandes", nom: "Viandes et poissons" },
  { id: "autres", nom: "\u0152ufs, haricots et autres" },
  { id: "fruits", nom: "Fruits et boissons" }
];
function al(id, nom, categorie, [kcal, prot, gluc, lip], unite, uniteG, source, suitPortion, [couleur, contour], synonymes, description, uniteNote) {
  return { id, nom, categorie, kcal, prot, gluc, lip, unite, uniteG, uniteNote, source, suitPortion, couleur, contour, synonymes, description };
}
var F = "FAO/INFOODS";
var E = "estime";
var aliments = [
  // ——— Pâtes, céréales, tubercules ———
  al(
    "attieke",
    "Atti\xE9k\xE9",
    "cereales",
    [150, 1, 35, 0.3],
    "1 louche",
    120,
    F,
    true,
    ["#F1E3B8", "#E3CF94"],
    ["attieke", "atieke", "garba", "acheke"],
    "Semoule de manioc ferment\xE9e cuite \xE0 la vapeur : petits grains blanc cass\xE9 \xE0 jaune p\xE2le, l\xE9g\xE8rement collants, en tas a\xE9r\xE9. Grains plus irr\xE9guliers et plus mats que le couscous de bl\xE9 ; plus gros, humides et cuits que le gari (sec, fin, cr\xE8me)."
  ),
  al(
    "akassa",
    "Akassa",
    "cereales",
    [100, 2, 22, 0.5],
    "1 boule",
    150,
    F,
    true,
    ["#E9DCC6", "#D2C1A3"],
    ["akassa", "agidi", "eko", "akasan"],
    "P\xE2te de ma\xEFs ferment\xE9e blanche, lisse, ferme, souvent servie emball\xE9e ou moul\xE9e en pav\xE9/boule dans une feuille. Plus blanche, plus lisse et plus g\xE9lifi\xE9e que la p\xE2te blanche (owo) ; l'ablo est en petits pains spongieux."
  ),
  al(
    "pate-rouge",
    "P\xE2te rouge",
    "cereales",
    [110, 2, 22, 1.5],
    "1 boule",
    200,
    F,
    true,
    ["#C9532B", "#A7411D"],
    ["pate rouge", "amiwo", "amiw\xF4", "djinkoum\xE9", "djenkoume"],
    "P\xE2te de ma\xEFs cuite dans un bouillon de tomate et d'huile : boule ou d\xF4me ORANGE-ROUGE (couleur de sauce tomate), lisse et brillante, souvent avec poulet ou poisson frit. \xC0 ne pas confondre avec l'eba, qui est JAUNE vif et granuleux, ni avec le riz au gras (grains visibles)."
  ),
  al(
    "pate-blanche",
    "P\xE2te blanche (ma\xEFs)",
    "cereales",
    [105, 2, 23, 0.6],
    "1 boule",
    200,
    E,
    true,
    ["#F4EEDC", "#DCD2B6"],
    ["pate", "p\xE2te", "owo", "wo", "ugali", "sadza", "nshima"],
    "P\xE2te \xE9paisse de farine de ma\xEFs : boule ou galette blanc cr\xE8me, MATE, \xE0 la surface l\xE9g\xE8rement irr\xE9guli\xE8re, qu'on d\xE9coupe \xE0 la main, servie surtout avec sauce gombo, sauce l\xE9gumes ou sauce arachide au B\xE9nin et au Togo. Plus mate et plus friable que l'igname pil\xE9e (lisse et brillante) ou l'akassa."
  ),
  al(
    "to-mil",
    "T\xF4 (mil ou sorgho)",
    "cereales",
    [110, 3, 23, 1],
    "1 boule",
    250,
    E,
    true,
    ["#C9B48C", "#A9946C"],
    ["to", "t\xF4", "toh", "tuo zaafi", "tz", "t\xF4 de mil"],
    "P\xE2te de mil, de sorgho ou de ma\xEFs du Sahel : boule beige, grise ou brun clair, plus terne que la p\xE2te de ma\xEFs blanche, servie avec une sauce gluante (gombo, feuilles, baobab)."
  ),
  al(
    "igname-pilee",
    "Igname pil\xE9e",
    "cereales",
    [120, 2, 28, 0.2],
    "1 boule",
    200,
    F,
    true,
    ["#EFE0B8", "#DCC892"],
    ["igname pilee", "agoun", "pounded yam", "iyan", "foutou igname"],
    "Igname bouillie puis pil\xE9e : boule ou forme allong\xE9e BLANC PUR \xE0 ivoire, tr\xE8s lisse, \xE9lastique et l\xE9g\xE8rement brillante, sans grain, souvent pos\xE9e \xE0 c\xF4t\xE9 d'une sauce feuilles (efo riro), egusi ou sauce graine. C'est la p\xE2te blanche la plus courante avec ces sauces ; le foufou de manioc est plus gris et collant, la p\xE2te de ma\xEFs plus mate et cr\xE8me."
  ),
  al(
    "foutou-banane",
    "Foutou banane",
    "cereales",
    [150, 1.2, 36, 0.3],
    "1 boule",
    250,
    E,
    true,
    ["#E9C46A", "#CFA94B"],
    ["foutou banane", "foutou", "foufou banane", "fufu plantain"],
    "Banane plantain (parfois avec manioc) pil\xE9e : boule lisse JAUNE P\xC2LE \xE0 orang\xE9e, compacte et collante, sans grain, servie avec sauce graine ou sauce arachide en C\xF4te d'Ivoire. L'eba est plus jaune vif et granuleux."
  ),
  al(
    "telibo",
    "T\xE9libo / amala",
    "cereales",
    [120, 1.5, 28, 0.3],
    "1 boule",
    250,
    E,
    true,
    ["#6E5A4E", "#54443A"],
    ["telibo", "t\xE9libo", "amala", "lafun", "pate noire", "p\xE2te noire", "pate de cossette", "kokonte", "konkonte"],
    "P\xE2te de cossettes d'igname (ou de manioc) s\xE9ch\xE9es : boule lisse brun gris \xE0 presque noire, brillante, tr\xE8s diff\xE9rente des p\xE2tes blanches. Servie avec sauce feuilles (ewedu), gbegiri ou sauce tomate et viandes."
  ),
  al(
    "foufou",
    "Foufou (manioc)",
    "cereales",
    [160, 1.5, 38, 0.3],
    "1 boule",
    200,
    E,
    true,
    ["#F6F0E2", "#DED3BA"],
    ["foufou", "fufu", "water fufu", "kpokpo", "chikwangue"],
    "P\xE2te de manioc ferment\xE9e : boule blanc GRIS\xC2TRE, un peu translucide et collante, odeur de fermentation. Plus grise et plus terne que l'igname pil\xE9e, qui est d'un blanc pur et brillant."
  ),
  al(
    "placali",
    "Placali",
    "cereales",
    [120, 0.5, 29, 0.2],
    "1 boule",
    250,
    E,
    true,
    ["#EDE8DA", "#CFC7B0"],
    ["placali", "placaly"],
    "P\xE2te de manioc ferment\xE9e ivoirienne, tr\xE8s lisse, \xE9lastique et luisante, blanc gris, servie dans une assiette creuse avec sauce claire, kop\xE8 ou gombo."
  ),
  al(
    "eba",
    "Eba (gari cuit)",
    "cereales",
    [160, 1, 38, 0.3],
    "1 boule",
    200,
    E,
    true,
    ["#EAD39A", "#CDB570"],
    ["eba", "gari cuit", "piron", "piron blanc"],
    "Gari m\xE9lang\xE9 \xE0 l'eau chaude : boule ou rouleau JAUNE vif (gari jaune \xE0 l'huile rouge) ou blanc cass\xE9, surface finement GRANULEUSE ou sabl\xE9e, parfois d\xE9coup\xE9 en tranches ou en boules par 2 ou 3. Servi avec egusi, sauce gombo, sauce feuilles ou viande. Appel\xE9 piron au B\xE9nin et au Togo. Plus jaune et plus granuleux que l'igname pil\xE9e ou la p\xE2te blanche ; la p\xE2te rouge est orange-rouge et lisse ; le piron rouge, cuit dans la sauce tomate, est orange."
  ),
  al(
    "piron-rouge",
    "Piron rouge",
    "cereales",
    [190, 1.5, 35, 5],
    "1 boule",
    150,
    E,
    true,
    ["#E8A04A", "#C98330"],
    ["piron rouge", "gari rouge", "gari \xE0 la sauce", "eba rouge"],
    "Gari cuit dans une sauce tomate \xE0 l'huile rouge (B\xE9nin, Togo) : boules ou d\xF4mes ORANGE \xE0 jaune-orang\xE9, surface GRANULEUSE et sabl\xE9e, souvent servis par 2 ou 3 avec viande de ch\xE8vre ou de mouton grill\xE9e, oignons, tomate et piment. Plus orange et plus gras que l'eba simple ; la p\xE2te rouge (amiwo) est lisse, sans grains."
  ),
  al(
    "banku",
    "Banku",
    "cereales",
    [120, 2, 26, 1],
    "1 boule",
    200,
    E,
    true,
    ["#EFE7D2", "#D6CBAE"],
    ["banku", "akple", "akpl\xE9"],
    "P\xE2te ferment\xE9e de ma\xEFs et manioc : boule blanc cass\xE9 lisse, un peu collante, souvent avec sauce gombo, piment et poisson."
  ),
  al(
    "kenkey",
    "Kenkey",
    "cereales",
    [130, 2.5, 28, 1],
    "1 boule",
    200,
    E,
    true,
    ["#E4D7B6", "#C3B38A"],
    ["kenkey", "dokounou", "dokunu", "komi"],
    "P\xE2te de ma\xEFs ferment\xE9e cuite dans des feuilles (ma\xEFs ou bananier) : boule ou cylindre ferme, beige, surface marqu\xE9e par la feuille, souvent servie avec poisson frit et piment."
  ),
  al(
    "ablo",
    "Ablo",
    "cereales",
    [200, 4, 42, 1],
    "3 pi\xE8ces",
    150,
    E,
    true,
    ["#F7F1E1", "#DED4B9"],
    ["ablo", "abolo"],
    "Petits pains de ma\xEFs (ou riz) cuits \xE0 la vapeur, ronds, blancs, spongieux et l\xE9g\xE8rement sucr\xE9s, servis par 3 \xE0 6 avec poisson frit et sauce tomate-piment."
  ),
  al(
    "gari",
    "Gari",
    "cereales",
    [360, 1, 85, 0.5],
    "1 bol",
    100,
    F,
    true,
    ["#E8C98A", "#CFAE6B"],
    ["gari", "tapioca", "garri"],
    "Semoule de manioc grill\xE9e, s\xE8che, en grains fins jaune p\xE2le ou cr\xE8me, saupoudr\xE9e sur les haricots ou tremp\xE9e dans l'eau. Grains plus fins et plus secs que l'atti\xE9k\xE9.",
    "(sec)"
  ),
  al(
    "baton-manioc",
    "B\xE2ton de manioc",
    "cereales",
    [160, 1, 38, 0.3],
    "1 b\xE2ton",
    150,
    E,
    true,
    ["#E8E1CC", "#C7BC9C"],
    ["baton de manioc", "miondo", "bobolo", "chikwangue", "kwanga"],
    "P\xE2te de manioc ferment\xE9e enroul\xE9e dans des feuilles : b\xE2ton cylindrique, blanc gris \xE0 translucide, tr\xE8s lisse et \xE9lastique."
  ),
  al(
    "riz-au-gras",
    "Riz au gras",
    "cereales",
    [155, 3, 23.7, 5.2],
    "1 assiette",
    300,
    F,
    true,
    ["#F1D9A0", "#D9B96C"],
    ["riz au gras", "riz gras", "jollof", "jollof rice", "riz rouge", "zame", "benachin"],
    "Riz cuit dans une sauce tomate-oignon huileuse : grains s\xE9par\xE9s, orange \xE0 rouge orang\xE9, luisants, parfois avec morceaux de l\xE9gumes. Plus rouge et plus gras que le riz blanc ; le riz du thi\xE9boudienne est plus brun-orang\xE9 et servi avec poisson et gros l\xE9gumes."
  ),
  al(
    "riz-thieb",
    "Riz thi\xE9boudienne",
    "cereales",
    [175, 3.5, 28, 5.5],
    "1 assiette",
    300,
    E,
    true,
    ["#D9A066", "#B9824A"],
    ["thieboudienne", "thi\xE9boudienne", "ceebu jen", "tieb", "thieb", "riz au poisson"],
    "Riz bris\xE9 cuit dans le bouillon de poisson \xE0 la tomate : grains fins cass\xE9s, brun orang\xE9, avec cro\xFBte (xoon) parfois ; servi en plat large avec poisson farci, manioc, chou, carotte, aubergine."
  ),
  al(
    "riz-blanc",
    "Riz blanc",
    "cereales",
    [130, 2.7, 28, 0.3],
    "1 assiette",
    250,
    F,
    true,
    ["#FBF8F0", "#E3DCCB"],
    ["riz blanc", "riz", "riz sauce", "riz nature"],
    "Riz nature cuit, grains blancs. Ce que la sauce pos\xE9e dessus recouvre reste blanc."
  ),
  al(
    "waakye",
    "Waakye / riz-haricot",
    "cereales",
    [150, 5, 28, 1.5],
    "1 assiette",
    300,
    E,
    true,
    ["#8E5B48", "#6F4434"],
    ["waakye", "ayimolou", "riz haricot", "riz au haricot", "watche", "atassi riz"],
    "Riz cuit avec des haricots (ni\xE9b\xE9) : grains brun-rouge \xE0 violac\xE9s parsem\xE9s de haricots, souvent avec spaghetti, gari, \u0153uf, sauce tomate-piment (shito)."
  ),
  al(
    "fonio",
    "Fonio",
    "cereales",
    [120, 2, 26, 0.5],
    "1 assiette",
    200,
    E,
    true,
    ["#EFE3C4", "#D3C29C"],
    ["fonio", "findi"],
    "Tr\xE8s petites graines cuites, plus fines que le couscous, beige clair, l\xE9g\xE8res et a\xE9r\xE9es."
  ),
  al(
    "couscous-mil",
    "Couscous de mil (thi\xE9r\xE9)",
    "cereales",
    [130, 3.5, 27, 1],
    "1 assiette",
    250,
    E,
    true,
    ["#B9A27C", "#977F5A"],
    ["thiere", "thi\xE9r\xE9", "cere", "couscous de mil", "couscous"],
    "Couscous de mil : petits grains gris-beige \xE0 brun, plus fonc\xE9s que l'atti\xE9k\xE9, souvent avec sauce maf\xE9 ou viande."
  ),
  al(
    "spaghetti",
    "Spaghetti",
    "cereales",
    [160, 5.5, 31, 1.5],
    "1 assiette",
    250,
    E,
    true,
    ["#EBC873", "#D2AD55"],
    ["spaghetti", "spaghettis", "pates", "macaroni", "spaghetti saut\xE9"],
    "P\xE2tes longues (ou macaroni), souvent saut\xE9es \xE0 la tomate et \xE0 l'huile, orang\xE9es."
  ),
  al(
    "alloco",
    "Alloco",
    "cereales",
    [250, 1.5, 32, 13],
    "1 portion",
    150,
    E,
    true,
    ["#E59B3A", "#C67D22"],
    ["alloco", "aloco", "dodo", "plantain frit", "banane frite", "kelewele"],
    "Banane plantain m\xFBre frite : rondelles ou d\xE9s jaune-orange \xE0 brun caram\xE9lis\xE9, brillants d'huile."
  ),
  al(
    "banane-plantain",
    "Banane plantain bouillie",
    "cereales",
    [120, 1, 31, 0.2],
    "1 banane",
    180,
    E,
    true,
    ["#E9C46A", "#CFA94B"],
    ["plantain", "banane bouillie", "plantain bouilli", "plantain brais\xE9", "bole", "boli"],
    "Plantain bouilli ou brais\xE9 : gros tron\xE7ons jaunes (bouilli) ou \xE0 peau noircie (brais\xE9, boli), sans huile apparente."
  ),
  al(
    "igname-bouillie",
    "Igname bouillie",
    "cereales",
    [115, 1.5, 27, 0.2],
    "2 morceaux",
    200,
    E,
    true,
    ["#F1E6C8", "#D8C99F"],
    ["igname", "igname bouillie", "yam"],
    "Gros morceaux d'igname cuits \xE0 l'eau, blancs \xE0 jaune p\xE2le, farineux, aux bords nets."
  ),
  al(
    "igname-frite",
    "Igname frite",
    "cereales",
    [230, 2, 32, 10],
    "1 portion",
    150,
    E,
    true,
    ["#E8C27A", "#C9A158"],
    ["igname frite", "yam frite", "dundu"],
    "B\xE2tonnets ou tranches d'igname frits, dor\xE9s, plus \xE9pais et plus p\xE2les que les frites de pomme de terre."
  ),
  al(
    "patate-douce",
    "Patate douce",
    "cereales",
    [90, 1.6, 21, 0.1],
    "1 morceau",
    150,
    E,
    true,
    ["#E8955A", "#C8763E"],
    ["patate douce", "patate"],
    "Patate douce bouillie ou brais\xE9e, chair orange ou blanche."
  ),
  al(
    "frites",
    "Frites",
    "cereales",
    [300, 3, 38, 15],
    "1 portion",
    150,
    E,
    true,
    ["#F0C35A", "#D2A33C"],
    ["frites", "frites de pomme de terre", "chips"],
    "Frites de pomme de terre dor\xE9es, fines et r\xE9guli\xE8res."
  ),
  al(
    "pain",
    "Pain",
    "cereales",
    [270, 9, 53, 2],
    "1 demi-baguette",
    125,
    F,
    true,
    ["#D9A15B", "#B98340"],
    ["pain", "baguette", "tapalapa", "pain de mie"],
    "Pain de type baguette ou tapalapa, cro\xFBte dor\xE9e, souvent fourr\xE9 (omelette, haricot, viande)."
  ),
  al(
    "beignets",
    "Beignets (puff-puff)",
    "cereales",
    [350, 6, 45, 16],
    "3 beignets",
    90,
    E,
    true,
    ["#C98A3E", "#A86E28"],
    ["beignet", "beignets", "puff puff", "puff-puff", "botokoin", "gbofloto", "bofrot", "mikate", "yovo doko", "chin chin"],
    "Boules de p\xE2te de farine frites, brun dor\xE9, rondes et gonfl\xE9es, int\xE9rieur blanc moelleux."
  ),
  al(
    "bouillie",
    "Bouillie (mil ou ma\xEFs)",
    "cereales",
    [60, 1.5, 12, 0.5],
    "1 bol",
    300,
    E,
    true,
    ["#E6D3AE", "#C8B38A"],
    ["bouillie", "koko", "hausa koko", "akassan", "ogi", "pap", "bouillie de mil", "kossam"],
    "Bouillie liquide de mil ou ma\xEFs ferment\xE9, beige \xE0 brun clair, servie au bol, souvent avec beignets."
  ),
  // ——— Sauces ———
  al(
    "sauce-tomate",
    "Sauce tomate",
    "sauces",
    [117, 1.7, 8.3, 9],
    "1 louche",
    60,
    E,
    true,
    ["#C4421C", "#A8371A"],
    ["sauce tomate", "tomate", "sauce rouge", "stew", "shito", "sauce piment\xE9e tomate"],
    "Sauce rouge vif d'huile, tomate, oignon et piment, brillante, sans grains ni feuilles."
  ),
  al(
    "sauce-gombo",
    "Sauce gombo",
    "sauces",
    [60, 2, 5, 3.5],
    "1 louche",
    80,
    F,
    true,
    ["#7E8F3A", "#65742B"],
    ["gombo", "sauce gombo", "okra", "okro", "fetri", "ademe gombo", "sauce gluante", "kop\xE8"],
    "Sauce verte gluante et filante avec rondelles ou morceaux de gombo, souvent avec poisson fum\xE9 ou crabe."
  ),
  al(
    "sauce-graine",
    "Sauce graine",
    "sauces",
    [150, 3, 4, 14],
    "1 louche",
    80,
    F,
    true,
    ["#B5481F", "#93381A"],
    ["sauce graine", "graine", "noix de palme", "banga", "banga soup", "sauce palme", "palm nut soup", "aboloo"],
    "Sauce \xE0 la pulpe de noix de palme : rouge-orang\xE9 profond \xE0 brun-rouge, \xE9paisse, velout\xE9e et huileuse, plus fonc\xE9e et plus cr\xE9meuse que la sauce tomate."
  ),
  al(
    "sauce-arachide",
    "Sauce arachide",
    "sauces",
    [180, 6, 7, 15],
    "1 louche",
    80,
    E,
    true,
    ["#A86A35", "#8A5326"],
    ["arachide", "maf\xE9", "mafe", "domoda", "sauce cacahuete", "groundnut soup", "tigad\xE8gu\xE8na", "sauce arachide"],
    "Sauce \xE0 la p\xE2te d'arachide : brun-orang\xE9, \xE9paisse et opaque, avec huile rouge en surface ; souvent avec viande et gros l\xE9gumes (maf\xE9)."
  ),
  al(
    "sauce-feuilles",
    "Sauce feuilles",
    "sauces",
    [90, 3, 4, 7],
    "1 louche",
    80,
    E,
    true,
    ["#3F6B2E", "#2F5422"],
    ["feuilles", "sauce feuilles", "legumes", "l\xE9gumes", "gboma", "crincrin", "ad\xE9m\xE8", "\xE9pinards", "sauce verte", "baobab", "lalo", "kouka", "efo riro", "pondu", "saka saka", "feuilles de manioc", "ewedu", "ad\xE9m\xE8", "ademe", "cor\xE8te", "gboma dessi"],
    "Sauce de l\xE9gumes-feuilles hach\xE9s (gboma, \xE9pinards, crincrin, manioc, baobab) : vert fonc\xE9, filandreuse, plus ou moins huileuse, parfois avec poisson fum\xE9 ou viande."
  ),
  al(
    "ndole",
    "Ndol\xE8",
    "sauces",
    [180, 8, 6, 14],
    "1 louche",
    100,
    E,
    true,
    ["#4E6A34", "#3B5225"],
    ["ndole", "ndol\xE8", "ndol\xE9"],
    "Feuilles am\xE8res hach\xE9es cuites avec p\xE2te d'arachide : vert fonc\xE9 \xE0 vert kaki, \xE9pais, granuleux, souvent avec crevettes ou viande. Plus clair et plus cr\xE9meux que la sauce feuilles simple."
  ),
  al(
    "eru",
    "Eru / okok",
    "sauces",
    [190, 5, 4, 17],
    "1 louche",
    100,
    E,
    true,
    ["#2F5A2A", "#22441E"],
    ["eru", "okok", "okazi", "afang"],
    "Feuilles finement \xE9minc\xE9es de gnetum cuites dans beaucoup d'huile rouge : vert sombre luisant, filaments fins, avec peau de b\u0153uf ou poisson fum\xE9."
  ),
  al(
    "sauce-egusi",
    "Sauce egusi",
    "sauces",
    [220, 8, 6, 18],
    "1 louche",
    80,
    E,
    true,
    ["#C9A24A", "#A88430"],
    ["egusi", "sauce egusi", "sauce pistache", "agoussi", "gboman egusi", "ngondo"],
    "Graines de courge moulues : sauce jaune-orang\xE9e grumeleuse comme des \u0153ufs brouill\xE9s, souvent avec feuilles vertes, huile rouge et viande."
  ),
  al(
    "sauce-claire",
    "Sauce claire",
    "sauces",
    [35, 2, 3, 1.5],
    "1 louche",
    100,
    E,
    true,
    ["#C76A3A", "#A65428"],
    ["sauce claire", "light soup", "soupe", "pepper soup", "soupe de poisson", "bouillon", "kp\xE8t\xE8"],
    "Bouillon l\xE9ger et liquide rouge-orang\xE9 (tomate, piment), peu gras, avec morceaux de viande ou de poisson, servi dans un bol ou une assiette creuse."
  ),
  al(
    "sauce-yassa",
    "Sauce yassa",
    "sauces",
    [110, 1.5, 9, 8],
    "1 louche",
    100,
    E,
    true,
    ["#D9B65C", "#B8963E"],
    ["yassa", "sauce oignon", "sauce yassa"],
    "Oignons \xE9minc\xE9s fondus au citron et \xE0 la moutarde : sauce jaune p\xE2le \xE0 dor\xE9e, pleine de lamelles d'oignon translucides, parfois avec olives."
  ),
  al(
    "piment",
    "Piment \xE9cras\xE9",
    "sauces",
    [40, 1.5, 5, 2],
    "1 cuill\xE8re",
    20,
    E,
    true,
    ["#B3261E", "#8E1C16"],
    ["piment", "pili pili", "shito", "kp\xE8t\xE8 piment", "sauce piment", "piment vert", "sauce verte de piment"],
    "Piment \xE9cras\xE9 ou en sauce, en petite quantit\xE9 au bord de l'assiette ou dans une coupelle : ROUGE (piment rouge, souvent m\xE9lang\xE9 \xE0 la tomate) ou VERT VIF (piment vert \xE9cras\xE9, pur\xE9e grumeleuse vert clair). Une petite portion de pur\xE9e verte vif \xE0 c\xF4t\xE9 du plat est du piment vert, pas une sauce feuilles (qui est vert fonc\xE9, filandreuse, avec des feuilles hach\xE9es et servie en grande quantit\xE9)."
  ),
  // ——— Viandes et poissons ———
  al(
    "poulet-frit",
    "Poulet frit",
    "viandes",
    [236, 20.7, 5.7, 15],
    "1 cuisse",
    140,
    F,
    false,
    ["#8A4519", "#6E3612"],
    ["poulet frit", "poulet", "cuisse de poulet"],
    "Morceau de poulet frit, peau brun dor\xE9 \xE0 brun fonc\xE9, croustillante et brillante."
  ),
  al(
    "poulet-braise",
    "Poulet brais\xE9",
    "viandes",
    [190, 27, 0, 9],
    "1 cuisse",
    140,
    E,
    false,
    ["#9A5424", "#7B4019"],
    ["poulet braise", "poulet brais\xE9", "poulet bicyclette", "poulet grill\xE9", "poulet piqu\xE9", "poulet yassa", "choukouya poulet"],
    "Poulet grill\xE9 au feu de bois : peau marqu\xE9e, zones noircies, rouge-brun \xE9pic\xE9, plus sec que le poulet frit."
  ),
  al(
    "kedjenou",
    "Kedjenou (poulet mijot\xE9)",
    "viandes",
    [150, 18, 4, 7],
    "1 portion",
    250,
    E,
    false,
    ["#B0602F", "#8E4A21"],
    ["kedjenou", "k\xE9dj\xE9nou", "poulet mijot\xE9", "poulet en sauce", "poulet dg"],
    "Poulet mijot\xE9 avec tomate, oignon, aubergine et piment : morceaux de poulet dans une sauce rouge-orang\xE9 peu grasse avec l\xE9gumes fondus."
  ),
  al(
    "pintade",
    "Pintade",
    "viandes",
    [160, 25, 0, 6.5],
    "1 cuisse",
    140,
    E,
    false,
    ["#6B3D25", "#53301C"],
    ["pintade", "guinea fowl"],
    "Volaille \xE0 chair plus fonc\xE9e que le poulet, souvent brais\xE9e ou en sauce."
  ),
  al(
    "gesiers",
    "G\xE9siers",
    "viandes",
    [150, 25, 0, 5],
    "1 portion",
    100,
    E,
    false,
    ["#7E3B2A", "#61301F"],
    ["gesier", "g\xE9siers", "gesiers", "gizzard"],
    "Petits morceaux ronds et fermes de g\xE9siers de volaille, bruns, saut\xE9s ou en brochette."
  ),
  al(
    "boeuf",
    "Viande de b\u0153uf",
    "viandes",
    [220, 26, 0, 13],
    "1 morceau",
    100,
    F,
    false,
    ["#7A3A24", "#5F2B1A"],
    ["viande", "boeuf", "b\u0153uf", "brochette", "suya", "choukouya", "kilishi", "viande en sauce"],
    "Morceaux de b\u0153uf brun fonc\xE9, en sauce ou grill\xE9s (brochette, suya couvert d'\xE9pices d'arachide rouges)."
  ),
  al(
    "mouton",
    "Viande de mouton ou ch\xE8vre",
    "viandes",
    [250, 25, 0, 16],
    "1 morceau",
    100,
    E,
    false,
    ["#6E3B28", "#552C1D"],
    ["mouton", "agneau", "ch\xE8vre", "chevre", "cabri", "dibi", "m\xE9choui", "goat"],
    "Morceaux de mouton ou ch\xE8vre avec os et gras visible, grill\xE9s (dibi) ou en sauce."
  ),
  al(
    "peau-boeuf",
    "Peau de b\u0153uf (kpanman)",
    "viandes",
    [150, 30, 0, 3],
    "1 portion",
    80,
    E,
    false,
    ["#D8C2A0", "#B39C78"],
    ["kpanman", "peau de boeuf", "kanda", "ponmo", "wele"],
    "Morceaux de peau de b\u0153uf cuite, g\xE9latineux, beige \xE0 brun clair, en sauce."
  ),
  al(
    "tripes",
    "Tripes (shaki)",
    "viandes",
    [85, 12, 0, 4],
    "1 portion",
    100,
    E,
    false,
    ["#D9C9A3", "#B8A57E"],
    ["tripes", "tripe", "shaki", "gras double", "gras-double", "panse", "abats"],
    "Estomac de b\u0153uf cuit : morceaux beige p\xE2le \xE0 jaun\xE2tres, en nid d'abeille ou en feuillets, souvent dans la sauce feuilles ou la sauce tomate."
  ),
  al(
    "poisson-braise",
    "Poisson brais\xE9",
    "viandes",
    [170, 22, 0, 9],
    "1 morceau",
    150,
    E,
    false,
    ["#8C6A4A", "#6F5236"],
    ["poisson braise", "poisson brais\xE9", "poisson grill\xE9", "capitaine", "tilapia", "carpe brais\xE9e", "chinchard brais\xE9"],
    "Poisson entier ou en morceaux grill\xE9 : peau noircie et marqu\xE9e par la grille, souvent garni d'oignon et tomate crus."
  ),
  al(
    "poisson-frit",
    "Poisson frit",
    "viandes",
    [200, 20, 3, 12],
    "1 morceau",
    150,
    E,
    false,
    ["#A0703F", "#81572C"],
    ["poisson frit", "poisson", "chinchard", "maquereau", "sardine", "carpe frite", "fried fish"],
    "Poisson frit en tranches ou entier, peau brun dor\xE9 uniforme et brillante."
  ),
  al(
    "thon-frit",
    "Thon frit (garba)",
    "viandes",
    [220, 25, 0, 13],
    "1 morceau",
    120,
    E,
    false,
    ["#8E5A35", "#704526"],
    ["thon", "thon frit", "garba thon"],
    "Gros morceaux de thon frits, chair brun fonc\xE9 dense, typiques du garba."
  ),
  al(
    "poisson-fume",
    "Poisson fum\xE9",
    "viandes",
    [250, 35, 0, 12],
    "1 morceau",
    80,
    E,
    false,
    ["#6E4B2C", "#553820"],
    ["poisson fume", "poisson fum\xE9", "poisson sec", "kobo", "adow\xE9vi", "stockfish", "momoni"],
    "Poisson fum\xE9 ou s\xE9ch\xE9, brun fonc\xE9 \xE0 noir, sec, souvent \xE9miett\xE9 dans les sauces."
  ),
  al(
    "crevettes",
    "Crevettes",
    "viandes",
    [100, 20, 0, 1.5],
    "1 portion",
    100,
    E,
    false,
    ["#E58A6B", "#C66F52"],
    ["crevette", "crevettes", "gambas", "shrimp"],
    "Crevettes roses \xE0 orange, enti\xE8res ou d\xE9cortiqu\xE9es."
  ),
  al(
    "crabe",
    "Crabe",
    "viandes",
    [90, 18, 0, 1.5],
    "1 crabe",
    100,
    E,
    false,
    ["#C0502A", "#9E3F20"],
    ["crabe", "crabes"],
    "Crabe entier ou pinces, carapace orange-rouge, souvent dans la sauce gombo."
  ),
  al(
    "escargot",
    "Escargots",
    "viandes",
    [90, 16, 2, 1.5],
    "5 escargots",
    100,
    E,
    false,
    ["#5B4636", "#463428"],
    ["escargot", "escargots", "achatine", "igbin"],
    "Chair d'escargot g\xE9ant (achatine), brun gris, ferme, en sauce ou grill\xE9e."
  ),
  al(
    "wagashi",
    "Wagashi (fromage peul)",
    "viandes",
    [290, 18, 2, 23],
    "1 tranche",
    80,
    E,
    false,
    ["#F3E9D2", "#C9532B"],
    ["wagashi", "fromage", "waragashi", "gasaru", "wangash"],
    "Fromage peul de lait de vache : galette ou tranche blanche, souvent \xE0 cro\xFBte rouge (teint\xE9e au sorgho), frite ou en sauce."
  ),
  // ——— Œufs, haricots et autres ———
  al(
    "omelette",
    "Omelette",
    "autres",
    [155, 11, 1, 12],
    "2 \u0153ufs",
    120,
    F,
    false,
    ["#F2C94C", "#D9AE2E"],
    ["omelette", "omelet", "oeufs brouill\xE9s"],
    "Omelette jaune, parfois avec oignon, tomate ou piment."
  ),
  al(
    "oeuf",
    "\u0152uf dur",
    "autres",
    [155, 13, 1, 11],
    "1 \u0153uf",
    50,
    F,
    false,
    ["#FBF3DA", "#F2C94C"],
    ["oeuf", "\u0153uf", "oeufs", "\u0153ufs", "oeuf dur", "oeuf bouilli"],
    "\u0152uf dur entier ou coup\xE9, blanc et jaune visibles."
  ),
  al(
    "haricots",
    "Haricots (ni\xE9b\xE9)",
    "autres",
    [115, 8, 20, 0.5],
    "1 louche",
    150,
    F,
    true,
    ["#8B4A3A", "#6E392C"],
    ["haricot", "haricots", "niebe", "ni\xE9b\xE9", "abobo", "atassi", "beans", "red red", "cowpea"],
    "Haricots ni\xE9b\xE9 cuits (beiges, bruns ou rouges, \xE0 \u0153il noir), entiers, souvent avec huile rouge et gari."
  ),
  al(
    "akara",
    "Akara (beignets de haricot)",
    "autres",
    [270, 11, 20, 16],
    "4 boules",
    100,
    E,
    false,
    ["#B8742F", "#985E22"],
    ["akara", "accra", "acaraj\xE9", "ata", "kosai", "koose", "beignets de haricot"],
    "Petites boules frites de p\xE2te de ni\xE9b\xE9, brun dor\xE9 irr\xE9gulier, int\xE9rieur beige dense."
  ),
  al(
    "moi-moi",
    "Moin-moin",
    "autres",
    [150, 9, 13, 7],
    "1 part",
    150,
    E,
    false,
    ["#D97A4A", "#B86235"],
    ["moi moi", "moin moin", "moyinmoyin", "koki", "ablo haricot"],
    "G\xE2teau de ni\xE9b\xE9 cuit \xE0 la vapeur : pav\xE9 ou d\xF4me orange-rose lisse, parfois dans une feuille, peut contenir \u0153uf ou poisson."
  ),
  al(
    "legumes-cuits",
    "L\xE9gumes cuits",
    "autres",
    [45, 1.2, 9, 0.3],
    "1 portion",
    120,
    E,
    true,
    ["#7FA35A", "#5E7F40"],
    ["legumes", "chou", "carotte", "aubergine", "manioc bouilli", "navet", "gombo entier"],
    "Gros morceaux de l\xE9gumes cuits dans le plat : chou, carotte, aubergine, manioc, patate, navet (thi\xE9boudienne, maf\xE9, kedjenou)."
  ),
  al(
    "salade-mayo",
    "Salade mayonnaise (coleslaw)",
    "autres",
    [150, 1.5, 7, 13],
    "1 portion",
    100,
    E,
    true,
    ["#E9EEC8", "#C9D29A"],
    ["coleslaw", "salade mayonnaise", "salade compos\xE9e", "mac\xE9doine", "salade russe"],
    "L\xE9gumes crus coup\xE9s (chou, carotte, concombre, ma\xEFs, poivron) enrob\xE9s de mayonnaise ou de cr\xE8me : aspect blanc cr\xE9meux et brillant. Beaucoup plus calorique que les crudit\xE9s sans sauce."
  ),
  al(
    "crudites",
    "Crudit\xE9s",
    "autres",
    [20, 1, 3.5, 0.2],
    "1 portion",
    80,
    E,
    true,
    ["#9BC26B", "#79A04B"],
    ["salade", "crudites", "crudit\xE9s", "oignon cru", "tomate crue", "concombre"],
    "Salade, tomate, oignon ou concombre crus, sans sauce grasse (oignons et tomates \xE9minc\xE9s, vinaigrette l\xE9g\xE8re). Avec de la mayonnaise, c'est la salade mayonnaise."
  ),
  al(
    "avocat",
    "Avocat",
    "autres",
    [160, 2, 9, 15],
    "1 demi",
    100,
    F,
    false,
    ["#8DA33E", "#6C8128"],
    ["avocat", "avocado"],
    "Demi-avocat ou tranches \xE0 chair vert clair et beurr\xE9e."
  ),
  al(
    "arachides",
    "Arachides grill\xE9es",
    "autres",
    [590, 25, 16, 49],
    "1 poign\xE9e",
    30,
    F,
    true,
    ["#C9935A", "#A87740"],
    ["arachide grill\xE9e", "arachides", "cacahuetes", "cacahu\xE8tes", "groundnuts", "kuli kuli"],
    "Arachides grill\xE9es d\xE9cortiqu\xE9es, petites graines brun clair."
  ),
  al(
    "degue",
    "D\xE9gu\xE9 / thiakry",
    "autres",
    [140, 4, 20, 4.5],
    "1 bol",
    200,
    E,
    true,
    ["#F2EBDD", "#D8CDB5"],
    ["degue", "d\xE9gu\xE9", "thiakry", "chakery", "lait caill\xE9", "yaourt mil", "fura"],
    "Mil ou couscous m\xE9lang\xE9 \xE0 du lait caill\xE9 sucr\xE9 : bol blanc cr\xE9meux avec petits grains."
  ),
  // ——— Fruits et boissons ———
  al("mangue", "Mangue", "fruits", [60, 0.8, 15, 0.4], "1 mangue", 200, F, false, ["#F2A93B", "#D68B22"], ["mangue", "mango"], "Mangue en tranches ou enti\xE8re, chair orange."),
  al("banane", "Banane douce", "fruits", [89, 1.1, 23, 0.3], "1 banane", 120, F, false, ["#F4D35E", "#D8B63F"], ["banane douce", "banane", "banana"], "Banane dessert jaune."),
  al("papaye", "Papaye", "fruits", [43, 0.5, 11, 0.3], "1 tranche", 150, F, true, ["#F28C4B", "#D67133"], ["papaye", "papaya"], "Tranches de papaye \xE0 chair orange et graines noires."),
  al("ananas", "Ananas", "fruits", [50, 0.5, 13, 0.1], "1 tranche", 120, F, true, ["#F1D15C", "#D3B23D"], ["ananas", "pineapple"], "Tranches ou morceaux d'ananas jaune."),
  al("bissap", "Bissap sucr\xE9", "fruits", [60, 0, 15, 0], "1 verre", 250, E, true, ["#8E1B3A", "#6D142C"], ["bissap", "fol\xE9r\xE9", "zobo", "jus d hibiscus", "sobolo"], "Boisson rouge fonc\xE9 \xE0 l'hibiscus, sucr\xE9e."),
  al("gingembre", "Jus de gingembre", "fruits", [70, 0, 17, 0], "1 verre", 250, E, true, ["#E7D49A", "#C9B577"], ["gingembre", "jus de gingembre", "ginger", "nyamanku"], "Boisson jaune p\xE2le trouble au gingembre, sucr\xE9e.")
];
var index = new Map(aliments.map((a) => [a.id, a]));

// supabase/functions/_shared/plats.ts
var platsComposes = [
  {
    id: "riz-gras-poulet",
    nom: "Riz au gras, poulet frit",
    lignes: [
      { alimentId: "riz-au-gras", grammes: 300 },
      { alimentId: "poulet-frit", grammes: 140 },
      { alimentId: "sauce-tomate", grammes: 60 }
    ],
    noms: [],
    composants: [["riz au gras", "riz gras", "jollof"], ["poulet"]]
  },
  {
    id: "pain-omelette",
    nom: "Pain-omelette",
    lignes: [
      { alimentId: "pain", grammes: 125 },
      { alimentId: "omelette", grammes: 120 }
    ],
    noms: ["pain omelette"],
    composants: [["pain"], ["omelette"]]
  },
  {
    id: "attieke-poisson",
    nom: "Atti\xE9k\xE9, poisson brais\xE9",
    lignes: [
      { alimentId: "attieke", grammes: 240 },
      { alimentId: "poisson-braise", grammes: 150 }
    ],
    noms: [],
    composants: [["attieke"], ["poisson"]]
  },
  {
    id: "pate-rouge-poisson",
    nom: "P\xE2te rouge, poisson frit",
    lignes: [
      { alimentId: "pate-rouge", grammes: 300 },
      { alimentId: "poisson-frit", grammes: 150 },
      { alimentId: "sauce-tomate", grammes: 60 }
    ],
    noms: [],
    composants: [["pate rouge", "amiwo"], ["poisson"]]
  },
  {
    id: "akassa-graine",
    nom: "Akassa, sauce graine, poisson",
    lignes: [
      { alimentId: "akassa", grammes: 300 },
      { alimentId: "sauce-graine", grammes: 160 },
      { alimentId: "poisson-frit", grammes: 100 }
    ],
    noms: [],
    composants: [["akassa"], ["graine"], ["poisson"]]
  },
  {
    id: "pate-gombo",
    nom: "P\xE2te, sauce gombo, viande",
    lignes: [
      { alimentId: "pate-blanche", grammes: 300 },
      { alimentId: "sauce-gombo", grammes: 160 },
      { alimentId: "boeuf", grammes: 100 }
    ],
    noms: [],
    composants: [["pate", "owo", "wo"], ["gombo"], ["viande", "boeuf"]]
  },
  {
    id: "igname-arachide",
    nom: "Igname pil\xE9e, sauce arachide",
    lignes: [
      { alimentId: "igname-pilee", grammes: 300 },
      { alimentId: "sauce-arachide", grammes: 160 },
      { alimentId: "boeuf", grammes: 80 }
    ],
    noms: [],
    composants: [["igname"], ["arachide"]]
  },
  {
    id: "haricots-gari",
    nom: "Haricots, gari, alloco",
    lignes: [
      { alimentId: "haricots", grammes: 250 },
      { alimentId: "gari", grammes: 40 },
      { alimentId: "alloco", grammes: 100 }
    ],
    noms: ["abobo", "atassi", "waakye"],
    composants: [["haricot", "niebe"], ["gari"], ["alloco"]]
  },
  {
    id: "spaghetti-oeuf",
    nom: "Spaghetti, \u0153uf",
    lignes: [
      { alimentId: "spaghetti", grammes: 300 },
      { alimentId: "oeuf", grammes: 100 },
      { alimentId: "sauce-tomate", grammes: 60 }
    ],
    noms: [],
    composants: [["spaghetti"], ["oeuf", "oeufs"]]
  },
  {
    id: "alloco-poisson",
    nom: "Alloco, poisson brais\xE9",
    lignes: [
      { alimentId: "alloco", grammes: 200 },
      { alimentId: "poisson-braise", grammes: 150 }
    ],
    noms: [],
    composants: [["alloco", "dodo"], ["poisson"]]
  },
  {
    id: "garba",
    nom: "Garba (atti\xE9k\xE9, thon frit)",
    lignes: [
      { alimentId: "attieke", grammes: 250 },
      { alimentId: "thon-frit", grammes: 120 },
      { alimentId: "piment", grammes: 20 }
    ],
    noms: ["garba"],
    composants: [["attieke"], ["thon"]]
  },
  {
    id: "thieboudienne",
    nom: "Thi\xE9boudienne",
    lignes: [
      { alimentId: "riz-thieb", grammes: 300 },
      { alimentId: "poisson-frit", grammes: 120 },
      { alimentId: "legumes-cuits", grammes: 120 }
    ],
    noms: ["thieboudienne", "ceebu jen", "thieb", "tieb"],
    composants: [["riz au poisson"]]
  },
  {
    id: "yassa-poulet",
    nom: "Yassa poulet",
    lignes: [
      { alimentId: "riz-blanc", grammes: 250 },
      { alimentId: "poulet-braise", grammes: 140 },
      { alimentId: "sauce-yassa", grammes: 150 }
    ],
    noms: ["yassa", "yassa poulet"],
    composants: [["riz"], ["oignon"], ["poulet"]]
  },
  {
    id: "mafe",
    nom: "Maf\xE9, riz blanc",
    lignes: [
      { alimentId: "riz-blanc", grammes: 250 },
      { alimentId: "sauce-arachide", grammes: 160 },
      { alimentId: "boeuf", grammes: 100 },
      { alimentId: "legumes-cuits", grammes: 80 }
    ],
    noms: ["mafe", "maf\xE9", "domoda"],
    composants: [["riz"], ["arachide"]]
  },
  {
    id: "ndole-plantain",
    nom: "Ndol\xE8, plantain, crevettes",
    lignes: [
      { alimentId: "ndole", grammes: 200 },
      { alimentId: "banane-plantain", grammes: 180 },
      { alimentId: "crevettes", grammes: 50 }
    ],
    noms: ["ndole", "ndol\xE8", "ndol\xE9"],
    composants: []
  },
  {
    id: "eru-fufu",
    nom: "Eru, water fufu",
    lignes: [
      { alimentId: "eru", grammes: 200 },
      { alimentId: "foufou", grammes: 250 },
      { alimentId: "peau-boeuf", grammes: 60 }
    ],
    noms: ["eru", "okok"],
    composants: []
  },
  {
    id: "egusi-eba",
    nom: "Egusi, eba",
    lignes: [
      { alimentId: "sauce-egusi", grammes: 160 },
      { alimentId: "eba", grammes: 250 },
      { alimentId: "boeuf", grammes: 80 }
    ],
    noms: ["egusi"],
    composants: []
  },
  {
    id: "waakye-complet",
    nom: "Waakye complet",
    lignes: [
      { alimentId: "waakye", grammes: 300 },
      { alimentId: "spaghetti", grammes: 60 },
      { alimentId: "oeuf", grammes: 50 },
      { alimentId: "sauce-tomate", grammes: 60 },
      { alimentId: "gari", grammes: 20 }
    ],
    noms: ["waakye", "ayimolou"],
    composants: []
  },
  {
    id: "placali-sauce-claire",
    nom: "Placali, sauce claire",
    lignes: [
      { alimentId: "placali", grammes: 250 },
      { alimentId: "sauce-claire", grammes: 200 },
      { alimentId: "poisson-fume", grammes: 50 }
    ],
    noms: ["placali"],
    composants: []
  },
  {
    id: "foutou-graine",
    nom: "Foutou banane, sauce graine",
    lignes: [
      { alimentId: "foutou-banane", grammes: 250 },
      { alimentId: "sauce-graine", grammes: 160 },
      { alimentId: "poulet-braise", grammes: 100 }
    ],
    noms: [],
    composants: [["foutou"], ["graine"]]
  },
  {
    id: "attieke-kedjenou",
    nom: "Kedjenou, atti\xE9k\xE9",
    lignes: [
      { alimentId: "attieke", grammes: 250 },
      { alimentId: "kedjenou", grammes: 250 }
    ],
    noms: ["kedjenou", "k\xE9dj\xE9nou"],
    composants: []
  },
  {
    id: "ablo-poisson",
    nom: "Ablo, poisson frit",
    lignes: [
      { alimentId: "ablo", grammes: 150 },
      { alimentId: "poisson-frit", grammes: 120 },
      { alimentId: "piment", grammes: 20 }
    ],
    noms: ["ablo"],
    composants: []
  },
  {
    id: "kenkey-poisson",
    nom: "Kenkey, poisson frit",
    lignes: [
      { alimentId: "kenkey", grammes: 200 },
      { alimentId: "poisson-frit", grammes: 120 },
      { alimentId: "piment", grammes: 20 }
    ],
    noms: ["kenkey", "dokounou"],
    composants: []
  },
  {
    id: "banku-okro",
    nom: "Banku, sauce gombo",
    lignes: [
      { alimentId: "banku", grammes: 250 },
      { alimentId: "sauce-gombo", grammes: 160 },
      { alimentId: "poisson-fume", grammes: 50 }
    ],
    noms: ["banku", "akple"],
    composants: []
  },
  {
    id: "to-feuilles",
    nom: "T\xF4, sauce feuilles",
    lignes: [
      { alimentId: "to-mil", grammes: 300 },
      { alimentId: "sauce-feuilles", grammes: 160 }
    ],
    noms: ["to", "t\xF4", "tuo zaafi"],
    composants: []
  },
  {
    id: "bouillie-beignets",
    nom: "Bouillie, beignets",
    lignes: [
      { alimentId: "bouillie", grammes: 300 },
      { alimentId: "beignets", grammes: 90 }
    ],
    noms: [],
    composants: [["bouillie", "koko"], ["beignet", "beignets", "puff puff"]]
  }
];

// supabase/functions/_shared/vision.ts
var idsAliments = aliments.map((a) => a.id);
function nomCategorie(id) {
  return categories.find((c) => c.id === id)?.nom ?? id;
}
function texteCatalogue() {
  const parCategorie = /* @__PURE__ */ new Map();
  for (const a of aliments) {
    const lignes = parCategorie.get(a.categorie) ?? [];
    lignes.push(
      `- ${a.id} \u2014 ${a.nom}` + (a.synonymes.length ? ` (aussi : ${a.synonymes.join(", ")})` : "") + `
  Aspect : ${a.description}
  Mesure habituelle : ${a.unite} \u2248 ${a.uniteG} g${a.uniteNote ? ` ${a.uniteNote}` : ""}`
    );
    parCategorie.set(a.categorie, lignes);
  }
  const sections = [...parCategorie.entries()].map(([cat, lignes]) => `### ${nomCategorie(cat)}
${lignes.join("\n")}`);
  const plats = platsComposes.map((p) => `- ${p.nom} : ${p.lignes.map((l) => `${l.alimentId} ${l.grammes} g`).join(" + ")}`).join("\n");
  return `## Aliments connus (choisis uniquement parmi ces identifiants)

${sections.join("\n\n")}

## Plats courants et grammages d'une portion moyenne

${plats}`;
}
var CONSIGNES = `Tu es le moteur de reconnaissance de Calbasse, une application de suivi nutritionnel pour l'Afrique de l'Ouest et du Centre. Tu connais tr\xE8s bien les plats du B\xE9nin, du Togo, de C\xF4te d'Ivoire, du S\xE9n\xE9gal, du Ghana, du Nigeria, du Cameroun, du Burkina Faso, du Mali et des pays voisins, et tu reconnais aussi les aliments du monde entier : fruits et l\xE9gumes, produits industriels, cuisine europ\xE9enne, asiatique, am\xE9ricaine.

\xC0 partir de la photo d'un repas (et d'un indice facultatif \xE9crit par l'utilisateur), identifie chaque composant visible et estime son poids.

## Identifier

1. Nomme d'abord, classe ensuite. Regarde la photo et dis ce que tu vois r\xE9ellement, quel que soit le pays d'origine de l'aliment. C'est seulement ensuite que tu cherches l'identifiant correspondant dans la base. Couleur, texture et grain priment sur le nom : une p\xE2te brun fonc\xE9 n'est pas une p\xE2te blanche, m\xEAme si les deux s'appellent \xAB p\xE2te \xBB. Les descriptions \xAB Aspect \xBB signalent les confusions fr\xE9quentes (atti\xE9k\xE9 / couscous / gari, akassa / p\xE2te blanche / ablo, igname pil\xE9e / foufou / placali, sauce graine / sauce tomate / sauce arachide, riz au gras / thi\xE9boudienne\u2026).
2. INTERDIT : remplacer un aliment par un autre sous pr\xE9texte qu'il lui ressemble ou qu'il est dans la base. La base est courte et tr\xE8s incompl\xE8te : elle ne contient presque aucun aliment hors d'Afrique de l'Ouest \u2014 ni pomme, ni raisin, ni pizza, ni yaourt, ni fromage. C'est normal. Un aliment absent s'\xE9crit \xAB inconnu \xBB avec sa description (\xAB pomme \xBB, \xAB part de pizza \xBB), et jamais l'identifiant d'un sosie. Un faux aliment est une erreur bien plus grave qu'un aliment hors base : l'utilisateur voit un plat qu'il n'a pas mang\xE9.
3. Avant de r\xE9pondre, relis chaque ligne : si l'identifiant choisi ne d\xE9crit pas exactement ce que montre la photo, remplace-le par \xAB inconnu \xBB et d\xE9cris l'aliment.
4. Chaque composant distinct (f\xE9culent, sauce, viande ou poisson, accompagnement, boisson) devient une ligne. Dans une sauce, distingue viande et poisson : la viande a des fibres, du gras, des os ou de la peau \xE9paisse ; le poisson a des ar\xEAtes, une peau fine \xE9caill\xE9e et une chair qui s'effeuille. Un poulet ou une viande cuits dans une sauce s'\xE9crivent en deux lignes : la viande, puis la sauce.
5. Compte chaque sauce comme une ligne s\xE9par\xE9e du f\xE9culent qu'elle accompagne, m\xEAme si elle est en partie cach\xE9e dessous.
6. L'indice de l'utilisateur est une information forte : il sait ce qu'il mange. Suis-le quand la photo ne le contredit pas nettement. S'il nomme un plat local, utilise ce nom. S'il contredit clairement la photo, suis la photo et baisse la confiance.

## Estimer le poids

7. Ne devine pas un poids d'un coup. Proc\xE8de en trois temps.
   a) Trouve l'\xE9chelle. Cherche un objet de taille connue : assiette plate 24 \xE0 26 cm, assiette creuse 22 cm, bol 15 cm, cuill\xE8re \xE0 soupe 8 cm de long, fourchette 19 cm, canette 12 cm de haut, main d'adulte 18 cm, pouce 6 cm. Si rien ne donne l'\xE9chelle, suppose une assiette plate courante et baisse nettement la confiance de la ligne : la photo seule ne dit pas si un aliment est petit et proche ou gros et loin.
   b) Juge le volume, pas la surface. Deux assiettes couvertes pareil peuvent peser du simple au double : ce qui compte est l'\xE9paisseur du tas.
   c) Convertis le volume en grammes. Sauces et liquides \u2248 1 g pour 1 ml ; f\xE9culents cuits tass\xE9s (riz, p\xE2te, couscous) \u2248 0,8 g/ml ; viande et poisson \u2248 1 g/ml ; salade et feuilles crues \u2248 0,2 g/ml ; aliments frits et a\xE9r\xE9s \u2248 0,5 g/ml.
8. Aliment rond et entier (fruit, tubercule, boule de p\xE2te) : mesure son diam\xE8tre avec le rep\xE8re d'\xE9chelle, puis lis ce tableau, valable pour tout ce qui est \xE0 peu pr\xE8s sph\xE9rique : 6 cm \u2248 100 g, 7 cm \u2248 150 g, 8 cm \u2248 220 g, 9 cm \u2248 300 g, 10 cm \u2248 400 g. Le poids suit le cube du diam\xE8tre : un fruit \xE0 peine plus large est beaucoup plus lourd.
9. Rep\xE8res pour les aliments absents de la base. Ce sont des ordres de grandeur pour un sp\xE9cimen MOYEN, pas des r\xE9ponses \xE0 recopier : descends ou monte franchement d\xE8s que la photo montre un aliment petit ou gros. Pomme, orange : petite 100 g, moyenne 150 g, grosse 220 g. Banane \xE9pluch\xE9e : petite 80 g, moyenne 120 g, grosse 170 g. \u0152uf 55 g. Tranche de pain 30 g. Part de pizza 125 g. Pot de yaourt 125 g. Verre 250 ml. Bouteille individuelle 500 ml.
10. La mesure habituelle donn\xE9e dans la base est un rep\xE8re, pas une r\xE9ponse : estime ce qui est r\xE9ellement dans l'assiette. Une louche de sauce p\xE8se environ 80 g, une boule de p\xE2te 150 \xE0 250 g, une cuisse de poulet environ 140 g. Une portion d\xE9passe rarement 2000 g.
11. Plat familial ou plateau partag\xE9 : estime la portion d'un adulte et dis-le dans la remarque.
12. Huile. Les plats frits et les sauces de la base incluent d\xE9j\xE0 leur huile de cuisson habituelle : ne la compte pas une deuxi\xE8me fois. N'ajoute une ligne d'huile (huile_palme ou huile_vegetale) que pour un exc\xE8s visible : flaque au fond de l'assiette, couche d'huile en surface d'une sauce, aliments luisants de gras.

## R\xE9pondre

13. Confiance : \xAB haute \xBB si tu es s\xFBr, \xAB moyenne \xBB si un aliment proche est possible, \xAB basse \xBB si tu devines (photo floue, sauce qui cache tout, aucune \xE9chelle). Donne alors 1 \xE0 3 alternatives plausibles. Mieux vaut une confiance honn\xEAte qu'une fausse certitude : l'utilisateur corrige en un geste.
14. Si la photo ne montre pas de nourriture, r\xE9ponds estUnRepas = false et aucune ligne.
15. Le nom du plat : le nom courant (\xAB Garba \xBB, \xAB Thi\xE9boudienne \xBB, \xAB Riz au gras, poulet frit \xBB, \xAB Pomme \xBB). Les noms de plats locaux (atti\xE9k\xE9, amiwo, gari, alloco) ne se traduisent pas.
16. La remarque est courte et en fran\xE7ais ; laisse-la vide si tu n'as rien d'utile \xE0 dire.`;
function texteSysteme() {
  return `${CONSIGNES}

${texteCatalogue()}`;
}
function texteDemande(indice) {
  const texteIndice = indice.trim() ? `Indice de l'utilisateur : \xAB ${indice.trim().slice(0, 300)} \xBB` : "Pas d'indice de l'utilisateur.";
  return `${texteIndice}
Identifie les composants de ce repas.`;
}
var CONFIANCES = ["haute", "moyenne", "basse"];
var enumConfiance = { type: "string", enum: [...CONFIANCES] };
var schemaJson = {
  type: "object",
  properties: {
    estUnRepas: { type: "boolean" },
    nomDuPlat: { type: "string", description: "Nom courant du plat, tel qu'on le dit en Afrique de l'Ouest et du Centre" },
    confianceGlobale: enumConfiance,
    composants: {
      type: "array",
      items: {
        type: "object",
        properties: {
          alimentId: { type: "string", enum: [...idsAliments, "inconnu"], description: "Identifiant de la base, ou 'inconnu' si l'aliment n'y est pas" },
          grammes: { type: "number", description: "Poids estim\xE9 de ce qui est dans l'assiette, en grammes" },
          confiance: enumConfiance,
          alternatives: { type: "array", items: { type: "string", enum: [...idsAliments] }, description: "Jusqu'\xE0 3 autres identifiants plausibles, du plus au moins probable" },
          description: { type: "string", description: "Ce que tu vois, en quelques mots (obligatoire si 'inconnu')" }
        },
        required: ["alimentId", "grammes", "confiance", "alternatives", "description"],
        additionalProperties: false
      }
    },
    remarque: { type: "string", description: "Courte remarque utile \xE0 l'utilisateur, en fran\xE7ais, ou cha\xEEne vide" }
  },
  required: ["estUnRepas", "nomDuPlat", "confianceGlobale", "composants", "remarque"],
  additionalProperties: false
};
var connus = /* @__PURE__ */ new Set([...idsAliments, "inconnu"]);
var estConfiance = (v) => CONFIANCES.includes(v);
function validerReponse(valeur) {
  if (typeof valeur !== "object" || valeur === null) return null;
  const r = valeur;
  if (typeof r.estUnRepas !== "boolean" || !Array.isArray(r.composants)) return null;
  const composants = [];
  for (const c of r.composants) {
    if (typeof c !== "object" || c === null) return null;
    const x = c;
    if (typeof x.alimentId !== "string" || !connus.has(x.alimentId)) return null;
    if (typeof x.grammes !== "number" || !Number.isFinite(x.grammes)) return null;
    if (!estConfiance(x.confiance)) return null;
    const alternatives = Array.isArray(x.alternatives) ? x.alternatives.filter((a) => typeof a === "string" && connus.has(a)) : [];
    composants.push({
      alimentId: x.alimentId,
      grammes: x.grammes,
      confiance: x.confiance,
      alternatives,
      description: typeof x.description === "string" ? x.description : ""
    });
  }
  return {
    estUnRepas: r.estUnRepas,
    nomDuPlat: typeof r.nomDuPlat === "string" ? r.nomDuPlat : "",
    confianceGlobale: estConfiance(r.confianceGlobale) ? r.confianceGlobale : "moyenne",
    composants,
    remarque: typeof r.remarque === "string" ? r.remarque : ""
  };
}
function lireJson(texte) {
  try {
    return JSON.parse(texte.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, ""));
  } catch {
    return void 0;
  }
}
function normaliser2(r) {
  const lignes = [];
  const inconnus = [];
  for (const c of r.composants) {
    const grammes = Math.min(2e3, Math.max(5, Math.round(c.grammes / 5) * 5));
    if (c.alimentId === "inconnu") {
      inconnus.push({ description: c.description || "Aliment non reconnu", grammes });
      continue;
    }
    const alternatives = [...new Set(c.alternatives)].filter((a) => a !== c.alimentId).slice(0, 3);
    const existante = lignes.find((l) => l.alimentId === c.alimentId);
    if (existante) {
      existante.grammes += grammes;
      continue;
    }
    lignes.push({ alimentId: c.alimentId, grammes, confiance: c.confiance, alternatives });
  }
  return {
    estUnRepas: r.estUnRepas && (lignes.length > 0 || inconnus.length > 0),
    nom: r.nomDuPlat.trim(),
    confiance: r.confianceGlobale,
    lignes,
    inconnus,
    remarque: r.remarque.trim()
  };
}
function corpsRodium(p) {
  const contenu = [
    { type: "image_url", image_url: { url: `data:${p.typeImage};base64,${p.image}` } },
    { type: "text", text: p.texte }
  ];
  if (!p.avecSchema) contenu.push({ type: "text", text: `R\xE9ponds uniquement avec un objet JSON conforme \xE0 ce sch\xE9ma :
${JSON.stringify(schemaJson)}` });
  return {
    model: p.modele,
    max_tokens: 8192,
    messages: [
      { role: "system", content: p.systeme },
      { role: "user", content: contenu }
    ],
    ...p.reflexion ? { reasoning_effort: p.reflexion } : {},
    response_format: p.avecSchema ? { type: "json_schema", json_schema: { name: "repas", schema: schemaJson } } : { type: "json_object" }
  };
}

// supabase/functions/api/rodium.ts
var ErreurVision = class extends Error {
  statut;
  code;
  constructor(message, statut, code) {
    super(message);
    this.statut = statut;
    this.code = code;
  }
};
var RefusModele = class extends Error {
};
var ReponseIllisible = class extends Error {
};
var systeme = texteSysteme();
var schemaAccepte = true;
function creerVision(cfg, http = fetch) {
  async function appeler(corps) {
    let reponse;
    try {
      reponse = await http(`${cfg.urlApi.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.cleApi}` },
        body: JSON.stringify(corps),
        signal: AbortSignal.timeout(cfg.delaiMs ?? 6e4)
      });
    } catch (e) {
      throw new ErreurVision(`RodiumAI injoignable : ${e instanceof Error ? e.message : e}`, 503, "reseau");
    }
    const donnees = await reponse.json().catch(() => ({}));
    return { statut: reponse.status, donnees };
  }
  return async (image, typeImage, indice) => {
    const requete = (avecSchema) => corpsRodium({ systeme, texte: texteDemande(indice), image, typeImage, modele: cfg.modele, reflexion: cfg.reflexion, avecSchema });
    let { statut, donnees } = await appeler(requete(schemaAccepte));
    if (statut === 400 && schemaAccepte) {
      schemaAccepte = false;
      ({ statut, donnees } = await appeler(requete(false)));
    }
    if (statut < 200 || statut >= 300) {
      const err = typeof donnees.error === "object" ? donnees.error : void 0;
      const code = err?.code ?? donnees.error_code;
      const message = err?.message ?? (typeof donnees.error === "string" ? donnees.error : donnees.message) ?? `HTTP ${statut}`;
      throw new ErreurVision(`RodiumAI ${statut}${code ? ` (${code})` : ""} : ${message}`, statut, code);
    }
    const choix = donnees.choices?.[0];
    if (choix?.finish_reason === "content_filter" || choix?.message?.refusal) throw new RefusModele("Le mod\xE8le a d\xE9clin\xE9 cette image");
    const texte = choix?.message?.content;
    if (!texte) throw new ReponseIllisible(`R\xE9ponse vide (fin : ${choix?.finish_reason ?? "inconnue"})`);
    const json = lireJson(texte);
    if (json === void 0) throw new ReponseIllisible("R\xE9ponse non exploitable");
    const brut = validerReponse(json);
    if (!brut) throw new ReponseIllisible("R\xE9ponse non conforme");
    return {
      resultat: normaliser2(brut),
      usage: { ...typeof donnees.usage === "object" ? donnees.usage : {}, cost_rodi: donnees.cost_rodi },
      modele: cfg.modele
    };
  };
}

// supabase/functions/api/core.ts
var TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
var TAILLE_MAX_IMAGE = 7e6;
var TAILLE_MAX_CORPS = 9e6;
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
};
function repondre(statut, corps) {
  return new Response(statut === 204 ? null : JSON.stringify(corps), {
    status: statut,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS }
  });
}
var compteDe = (restants, limite, premium) => ({ premium, scansRestants: restants, limite, telephone: null });
var PLANS = ["mensuel", "annuel"];
async function lireCorps(req) {
  if (Number(req.headers.get("content-length") ?? 0) > TAILLE_MAX_CORPS) return null;
  try {
    const texte = await req.text();
    if (texte.length > TAILLE_MAX_CORPS) return null;
    const v = JSON.parse(texte);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}
function creerGestionnaire(d) {
  const { depots: depots2, vision: vision2, config: config2 } = d;
  const http = d.http ?? fetch;
  async function confirmerPaiement(transactionId) {
    const p = await depots2.lirePaiement(transactionId);
    if (!p || p.statut !== "en_attente" || !config2.cinetpay) return p?.statut ?? null;
    const s = await verifierPaiementCinetPay(config2.cinetpay, transactionId, http);
    if (s.accepte) {
      if (s.devise === "XOF" && s.montant !== null && s.montant >= p.montant) {
        await depots2.validerPaiement(transactionId, config2.tarifs[p.plan].jours);
        return "accepte";
      }
      console.error(`Paiement ${transactionId} accept\xE9 mais montant ou devise inattendus`, s.brut);
      return "en_attente";
    }
    if (s.echoue) {
      await depots2.refuserPaiement(transactionId);
      return "refuse";
    }
    return "en_attente";
  }
  return async (req) => {
    if (req.method === "OPTIONS") return repondre(204, null);
    const chemin = new URL(req.url).pathname.replace(/^\/(functions\/v1\/)?api(?=\/|$)/, "").replace(/\/+$/, "") || "/";
    const methode = req.method;
    if (methode === "GET" && chemin === "/sante") {
      return repondre(200, { ok: true, modele: config2.modele, paiement: !!config2.cinetpay, tarifs: config2.tarifs, scansGratuits: config2.gratuit, scansPremium: config2.premium });
    }
    if (chemin === "/cinetpay/retour") {
      return new Response(null, { status: 302, headers: { Location: "calbasse://premium", ...CORS } });
    }
    if (chemin === "/cinetpay/notification") {
      if (methode === "POST") {
        try {
          const texte = await req.text();
          const champs = (req.headers.get("content-type") ?? "").includes("json") ? JSON.parse(texte) : Object.fromEntries(new URLSearchParams(texte));
          if (champs.cpm_trans_id) await confirmerPaiement(String(champs.cpm_trans_id));
        } catch (e) {
          console.error("Notification CinetPay non trait\xE9e :", e);
        }
      }
      return repondre(200, { ok: true });
    }
    const jeton = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
    if (!jeton) return repondre(401, { erreur: "Connexion requise." });
    const utilisateur = await depots2.utilisateur(jeton).catch(() => null);
    if (!utilisateur) return repondre(401, { erreur: "Session expir\xE9e." });
    try {
      if (methode === "GET" && chemin === "/compte") {
        const e = await depots2.etatCompte(utilisateur.id, config2.gratuit, config2.premium);
        return repondre(200, compteDe(e.restants, e.limite, e.premium));
      }
      if (methode === "POST" && chemin === "/scan") return await scanner(utilisateur.id, req);
      if (chemin === "/sauvegarde" && (methode === "GET" || methode === "PUT")) {
        if (!utilisateur.email) return repondre(403, { erreur: "Ajoute ton e-mail pour sauvegarder tes donn\xE9es.", code: "sans_email" });
        if (methode === "GET") {
          const s = await depots2.lireSauvegarde(utilisateur.id);
          return repondre(200, { revision: s.revision, donnees: s.donnees ?? null, misAJour: s.maj_le });
        }
        const c = await lireCorps(req);
        if (!c || !c.donnees || typeof c.donnees !== "object" || Array.isArray(c.donnees) || !Number.isInteger(c.base) || c.base < 0) return repondre(400, { erreur: "Requ\xEAte illisible." });
        if (JSON.stringify(c.donnees).length > 25e5) return repondre(413, { erreur: "Sauvegarde trop volumineuse." });
        const r = await depots2.ecrireSauvegarde(utilisateur.id, c.donnees, c.base);
        return r.statut === "ok" ? repondre(200, { revision: r.revision }) : repondre(409, { erreur: "Un autre t\xE9l\xE9phone a sauvegard\xE9 entre-temps.", code: "conflit", revision: r.revision });
      }
      if (methode === "POST" && chemin === "/corrections") {
        const c = await lireCorps(req);
        if (!c || typeof c.scanId !== "string" || !Array.isArray(c.proposees) || !Array.isArray(c.finales)) return repondre(400, { erreur: "Requ\xEAte illisible." });
        if (JSON.stringify(c).length > 4e4) return repondre(413, { erreur: "Correction trop volumineuse." });
        const ok = await depots2.enregistrerCorrection(utilisateur.id, { scanId: c.scanId, proposees: c.proposees, finales: c.finales });
        return ok ? repondre(200, { ok: true }) : repondre(404, { erreur: "Scan introuvable." });
      }
      if (methode === "POST" && chemin === "/signalements") {
        const s = await lireCorps(req);
        if (!s || typeof s.alimentId !== "string" || !/^[\w-]{1,80}$/.test(s.alimentId) || typeof s.jour !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s.jour)) {
          return repondre(400, { erreur: "Requ\xEAte illisible." });
        }
        await depots2.enregistrerSignalement(utilisateur.id, { jour: s.jour, alimentId: s.alimentId, repasNom: typeof s.repasNom === "string" ? s.repasNom.slice(0, 200) : null });
        return repondre(200, { ok: true });
      }
      if (methode === "POST" && chemin === "/codes") {
        const c = await lireCorps(req);
        if (!c || typeof c.code !== "string" || c.code.length > 40) return repondre(400, { erreur: "Code incorrect.", code: "invalide" });
        const r = await depots2.utiliserCode(utilisateur.id, c.code);
        if (r.statut === "invalide") return repondre(400, { erreur: "Code incorrect. V\xE9rifie-le et r\xE9essaie.", code: "invalide" });
        if (r.statut === "deja_utilise") return repondre(409, { erreur: "Ce code a d\xE9j\xE0 \xE9t\xE9 utilis\xE9.", code: "deja_utilise" });
        if (r.statut === "trop_essais") return repondre(429, { erreur: "Trop d\u2019essais. R\xE9essaie dans une heure ou \xE9cris-nous.", code: "trop_essais" });
        const e = await depots2.etatCompte(utilisateur.id, config2.gratuit, config2.premium);
        return repondre(200, { ok: true, compte: compteDe(e.restants, e.limite, e.premium) });
      }
      if (methode === "POST" && chemin === "/paiements") {
        if (!config2.cinetpay) return repondre(503, { erreur: "Le paiement en ligne n'est pas encore disponible. Utilise un code d'activation.", code: "paiement_indisponible" });
        const c = await lireCorps(req);
        const plan = c?.plan;
        if (!PLANS.includes(plan)) return repondre(400, { erreur: "Formule inconnue." });
        const transactionId = await depots2.creerPaiement(utilisateur.id, plan, config2.tarifs[plan].montant);
        try {
          const urlPaiement = await creerPaiementCinetPay(config2.cinetpay, { transactionId, montant: config2.tarifs[plan].montant, description: `Calbasse Premium ${plan}`, compteId: utilisateur.id }, http);
          return repondre(201, { transactionId, urlPaiement });
        } catch (e) {
          await depots2.refuserPaiement(transactionId).catch(() => {
          });
          console.error("Paiement non cr\xE9\xE9 :", e);
          return repondre(502, { erreur: "Le paiement n\u2019a pas pu d\xE9marrer. R\xE9essaie dans un instant." });
        }
      }
      const suivi = /^\/paiements\/([A-Z0-9]+)$/.exec(chemin);
      if (methode === "GET" && suivi) {
        const p = await depots2.lirePaiement(suivi[1]);
        if (!p || p.user_id !== utilisateur.id) return repondre(404, { erreur: "Paiement introuvable." });
        const statut = await confirmerPaiement(p.id).catch(() => p.statut);
        const e = await depots2.etatCompte(utilisateur.id, config2.gratuit, config2.premium);
        return repondre(200, { statut, compte: compteDe(e.restants, e.limite, e.premium) });
      }
      if (methode === "DELETE" && chemin === "/compte") {
        await depots2.supprimerCompte(utilisateur.id);
        return repondre(200, { ok: true });
      }
      return repondre(404, { erreur: "Route inconnue." });
    } catch (e) {
      console.error("Erreur interne :", e);
      return repondre(500, { erreur: "Erreur interne." });
    }
  };
  async function scanner(id, req) {
    const corps = await lireCorps(req);
    if (!corps) return repondre(400, { erreur: "Requ\xEAte illisible ou photo trop lourde." });
    const image = typeof corps.image === "string" ? corps.image.replace(/^data:[^,]+,/, "") : "";
    if (!image) return repondre(400, { erreur: "Photo manquante." });
    if (image.length > TAILLE_MAX_IMAGE) return repondre(413, { erreur: "Photo trop lourde." });
    const typeImage = TYPES.includes(corps.typeImage) ? corps.typeImage : "image/jpeg";
    const indice = typeof corps.indice === "string" ? corps.indice.slice(0, 300) : "";
    const cle = typeof corps.cle === "string" && /^[\w-]{8,64}$/.test(corps.cle) ? corps.cle : crypto.randomUUID();
    const r = await depots2.reserverScan(id, cle, config2.gratuit, config2.premium, config2.budget, config2.parMinute);
    switch (r.statut) {
      case "deja":
        return repondre(200, { ...r.resultat, compte: compteDe(r.restants, r.limite, r.premium) });
      case "en_cours":
        return repondre(503, { erreur: "Analyse d\xE9j\xE0 en cours, r\xE9essaie dans un instant.", code: "en_cours" });
      case "quota":
        return repondre(402, { erreur: "Tu as utilis\xE9 tous tes scans du jour.", code: "quota", ...compteDe(0, r.limite, r.premium) });
      case "trop_vite":
        return repondre(429, { erreur: "Doucement : r\xE9essaie dans une minute.", code: "trop_vite" });
      case "budget":
        return repondre(403, { erreur: "Calbasse est tr\xE8s sollicit\xE9 aujourd'hui. R\xE9essaie demain.", code: "budget" });
    }
    const scanId = r.scan_id;
    const debut = Date.now();
    let resultat;
    let usage;
    let modele;
    try {
      ({ resultat, usage, modele } = await vision2(image, typeImage, indice));
    } catch (e) {
      await depots2.echouerScan(scanId, String(e)).catch(() => {
      });
      return erreurVision(e);
    }
    const reponse = { scanId, ...resultat };
    const restants = resultat.estUnRepas ? r.restants : Math.min(r.limite, r.restants + 1);
    await depots2.terminerScan(scanId, { resultat: reponse, modele, dureeMs: Date.now() - debut, usage, compte: resultat.estUnRepas }).catch((e) => {
      console.error("R\xE9sultat non enregistr\xE9 :", e);
    });
    return repondre(200, { ...reponse, compte: compteDe(restants, r.limite, r.premium) });
  }
}
function erreurVision(e) {
  if (e instanceof RefusModele) return repondre(422, { erreur: "Cette photo n'a pas pu \xEAtre analys\xE9e." });
  if (e instanceof ReponseIllisible) return repondre(502, { erreur: "Analyse incompl\xE8te, r\xE9essaie." });
  if (e instanceof ErreurVision && (e.statut === 429 || e.statut === 503 || e.code === "reseau")) {
    return repondre(503, { erreur: "Service tr\xE8s demand\xE9, r\xE9essaie dans un instant." });
  }
  if (e instanceof ErreurVision) {
    console.error(`ALERTE service de vision ${e.statut} : ${e.message}`);
    return repondre(503, { erreur: "Analyse indisponible pour le moment." });
  }
  console.error(e);
  return repondre(500, { erreur: "Erreur interne." });
}

// supabase/functions/api/index.ts
var env = (nom) => Deno.env.get(nom) ?? void 0;
var entier = (nom, defaut) => {
  const n = Number(env(nom));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : defaut;
};
var cleApi = env("RODIUMAI_API_KEY");
if (!cleApi) console.error("RODIUMAI_API_KEY manquante : les scans \xE9choueront. Ajoute-la dans les secrets de la fonction.");
var supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false }
});
var urlPublique = `${env("SUPABASE_URL")}/functions/v1/api`;
var config = {
  modele: env("RODIUMAI_MODELE") ?? "google/gemini-3.1-flash-lite",
  gratuit: entier("SCANS_GRATUITS", 1),
  premium: entier("SCANS_PREMIUM", 10),
  budget: entier("BUDGET_JOUR", 300),
  parMinute: entier("SCANS_PAR_MINUTE", 6),
  tarifs: {
    mensuel: { montant: entier("PRIX_MENSUEL", 1500), jours: 30 },
    annuel: { montant: entier("PRIX_ANNUEL", 12e3), jours: 365 }
  },
  cinetpay: env("CINETPAY_API_KEY") && env("CINETPAY_SITE_ID") ? { apiKey: env("CINETPAY_API_KEY"), siteId: env("CINETPAY_SITE_ID"), urlApi: (env("CINETPAY_URL_API") ?? "https://api-checkout.cinetpay.com/v2").replace(/\/+$/, ""), urlPublique } : null
};
function verifier(r) {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
var depots = {
  async utilisateur(jeton) {
    const { data, error } = await supabase.auth.getUser(jeton);
    return error || !data.user ? null : { id: data.user.id, email: data.user.email || null };
  },
  async lireSauvegarde(id) {
    return verifier(await supabase.rpc("lire_sauvegarde", { p_user: id }));
  },
  async ecrireSauvegarde(id, donnees, base) {
    return verifier(await supabase.rpc("ecrire_sauvegarde", { p_user: id, p_donnees: donnees, p_base: base }));
  },
  async reserverScan(id, cle, gratuit, premium, budget, parMinute) {
    return verifier(await supabase.rpc("reserver_scan", { p_user: id, p_cle: cle, p_gratuit: gratuit, p_premium: premium, p_budget: budget, p_par_minute: parMinute }));
  },
  async terminerScan(scanId, p) {
    verifier(await supabase.rpc("terminer_scan", { p_scan: scanId, p_resultat: p.resultat, p_modele: p.modele, p_duree: p.dureeMs, p_usage: p.usage, p_compte: p.compte }));
  },
  async echouerScan(scanId, erreur) {
    verifier(await supabase.rpc("echouer_scan", { p_scan: scanId, p_erreur: erreur }));
  },
  async etatCompte(id, gratuit, premium) {
    return verifier(await supabase.rpc("etat_compte", { p_user: id, p_gratuit: gratuit, p_premium: premium }));
  },
  async utiliserCode(id, code) {
    return verifier(await supabase.rpc("utiliser_code", { p_user: id, p_code: code }));
  },
  async creerPaiement(id, plan, montant) {
    return verifier(await supabase.rpc("creer_paiement", { p_user: id, p_plan: plan, p_montant: montant }));
  },
  async lirePaiement(transactionId) {
    return verifier(await supabase.rpc("lire_paiement", { p_id: transactionId })) ?? null;
  },
  async validerPaiement(transactionId, jours) {
    verifier(await supabase.rpc("valider_paiement", { p_id: transactionId, p_jours: jours }));
  },
  async refuserPaiement(transactionId) {
    verifier(await supabase.rpc("refuser_paiement", { p_id: transactionId }));
  },
  async enregistrerCorrection(id, c) {
    const scan = verifier(await supabase.from("scans").select("id").eq("id", c.scanId).eq("user_id", id).maybeSingle());
    if (!scan) return false;
    verifier(await supabase.from("corrections").upsert({ user_id: id, scan_id: c.scanId, proposees: c.proposees, finales: c.finales }, { onConflict: "scan_id" }));
    return true;
  },
  async enregistrerSignalement(id, s) {
    verifier(
      await supabase.from("signalements").upsert({ user_id: id, jour: s.jour, aliment_id: s.alimentId, repas_nom: s.repasNom }, { onConflict: "user_id,jour,aliment_id", ignoreDuplicates: true })
    );
  },
  async supprimerCompte(id) {
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw new Error(error.message);
  }
};
var vision = creerVision({
  cleApi: cleApi ?? "",
  urlApi: env("RODIUMAI_BASE_URL") ?? "https://api.rodiumai.io/v1",
  modele: config.modele,
  reflexion: ["minimal", "low", "medium", "high"].find((n) => n === env("REFLEXION"))
});
Deno.serve(creerGestionnaire({ depots, vision, config }));
