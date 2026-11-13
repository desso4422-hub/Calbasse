import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BrouillonProvider } from '../state/brouillon';
import { StoreProvider, useStore } from '../state/store';
import { useFileScans } from '../state/fileScans';
import { useSynchroCompte } from '../state/synchro';
import { couleurs } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Navigation() {
  const { pret } = useStore();
  useSynchroCompte();
  useFileScans();
  const [policesChargees] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const charge = pret && policesChargees;

  useEffect(() => {
    if (charge) SplashScreen.hideAsync().catch(() => {});
  }, [charge]);

  if (!charge) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: couleurs.fond } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(onglets)" />
        <Stack.Screen name="scanner" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="resultat" />
        <Stack.Screen name="detail" />
        <Stack.Screen name="choisir" options={{ presentation: 'modal' }} />
        <Stack.Screen name="premium" options={{ presentation: 'modal' }} />
        <Stack.Screen name="telephone" options={{ presentation: 'modal' }} />
        <Stack.Screen name="coach/index" />
        <Stack.Screen name="coach/[id]" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <BrouillonProvider>
          <Navigation />
        </BrouillonProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
