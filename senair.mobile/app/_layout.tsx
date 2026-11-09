import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
// Imports par graisse : seules les 5 variantes utilisées sont embarquées.
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProviders } from '@/shared/api/AppProviders';
import { configureNotificationHandler } from '@/services/push';
import { BrandSplash } from '@/shared/ui/BrandSplash';
import { COLORS, FONTS } from '@/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
configureNotificationHandler();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    [FONTS.regular]: Manrope_400Regular,
    [FONTS.medium]: Manrope_500Medium,
    [FONTS.semibold]: Manrope_600SemiBold,
    [FONTS.bold]: Manrope_700Bold,
    [FONTS.extrabold]: Manrope_800ExtraBold,
  });
  const ready = fontsLoaded || !!fontError;
  const [splashDone, setSplashDone] = useState(false);
  const finishSplash = useCallback(() => setSplashDone(true), []);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: COLORS.background }} />;

  return (
    <SafeAreaProvider>
      <AppProviders>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerTintColor: COLORS.primaryText,
            headerStyle: { backgroundColor: COLORS.surface },
            headerShadowVisible: false,
            headerTitleStyle: { fontFamily: FONTS.bold, color: COLORS.text },
            headerBackTitle: 'Retour',
            contentStyle: { backgroundColor: COLORS.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="station/[id]" options={{ title: 'Station' }} />
          <Stack.Screen name="articles/[slug]" options={{ headerShown: false }} />
          <Stack.Screen name="comprendre" options={{ title: 'Comprendre' }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="account/index" options={{ title: 'Mon compte' }} />
          <Stack.Screen name="account/login" options={{ title: 'Connexion' }} />
          <Stack.Screen name="account/register" options={{ title: 'Créer un compte' }} />
          <Stack.Screen name="account/notifications" options={{ title: 'Notifications' }} />
        </Stack>
        {splashDone ? null : <BrandSplash onDone={finishSplash} />}
      </AppProviders>
    </SafeAreaProvider>
  );
}
