/**
 * Fondations visuelles de Calbasse (voir design/maquettes/Fondations.dc.html).
 */
export const couleurs = {
  terreCuite: '#B04A1C', // action
  terreFoncee: '#7A3416', // accent texte
  terreDouce: '#F8E3D4', // sélection
  feuille: '#2E6B3E', // sourcé, validé
  feuilleDouce: '#E2F0E2',
  encre: '#2B1810', // texte
  encre2: '#6B5444', // secondaire
  sable: '#F3E6CB', // surfaces
  fond: '#FBF5EA',
  traits: '#E8DAC0',
  traitsFonces: '#D9C5A0',
  piste: '#F0E1C6', // fond des jauges
  blanc: '#FFFFFF',
  peche: '#FFC9A6', // accent sur fond encre
  sableClair: '#E9D3BA',
  // Écrans sombres (scanner)
  nuit: '#1E120B',
  nuit2: '#3A2619',
  nuit3: '#2E1D12',
  nuitTrait: '#5A402B',
} as const;

/** Plus Jakarta Sans, une famille par graisse (React Native ne synthétise pas les graisses). */
export const polices = {
  400: 'PlusJakartaSans_400Regular',
  500: 'PlusJakartaSans_500Medium',
  600: 'PlusJakartaSans_600SemiBold',
  700: 'PlusJakartaSans_700Bold',
  800: 'PlusJakartaSans_800ExtraBold',
} as const;

export type Graisse = keyof typeof polices;

export const rayons = {
  pastille: 999,
  carte: 18,
  grandeCarte: 24,
  bouton: 16,
} as const;
