import { Redirect } from 'expo-router';
import { useStore } from '../state/store';

export default function Accueil() {
  const { etat } = useStore();
  return <Redirect href={etat.profil ? '/(onglets)' : '/onboarding'} />;
}
