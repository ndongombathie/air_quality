import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { LocateFixed, LogIn } from 'lucide-react-native';
import { requestCurrentPosition } from '@/services/location';
import { BrandLogo, Button, PressableScale, SkyBackdrop } from '@/shared/ui';
import { useMotion } from '@/shared/motion/useMotion';
import { COLORS, RADIUS, SPACING, TOUCH_TARGET, TYPE } from '@/theme';
import { AlertIllustration, AqiIllustration, LocationIllustration } from '../components/Illustrations';
import { completeOnboarding } from '../useOnboardingStatus';

interface Slide {
  key: string;
  title: string;
  text: string;
}

const SLIDES: Slide[] = [
  {
    key: 'iqa',
    title: "L'IQA, un chiffre pour l'air que vous respirez",
    text: "De 0 à plus de 300 : plus il est bas, plus l'air est sain. La couleur et le libellé vous disent tout de suite si l'air est bon, modéré ou mauvais.",
  },
  {
    key: 'position',
    title: "L'air près de chez vous",
    text: "Autorisez votre position pour voir l'IQA de votre quartier. C'est facultatif : sans position, SEN-AIR affiche l'IQA de Thiès.",
  },
  {
    key: 'alerts',
    title: 'Soyez prévenu à temps',
    text: 'Créez un compte gratuit pour recevoir une alerte quand la pollution dépasse les seuils dans vos zones. Vous pourrez le faire plus tard.',
  },
];

function Dot({ active }: { active: boolean }) {
  const style = useAnimatedStyle(() => ({ width: withSpring(active ? 22 : 8, { damping: 16 }), opacity: withSpring(active ? 1 : 0.4) }));
  return <Animated.View style={[styles.dot, style]} />;
}

export function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const motion = useMotion();
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const [page, setPage] = useState(0);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const goTo = (index: number) => {
    scroller.current?.scrollTo({ x: index * width, animated: !motion.reduced });
    setPage(index);
  };
  const finish = async (then?: () => void) => {
    await completeOnboarding();
    router.replace('/');
    then?.();
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  };

  const askLocation = async () => {
    setLocating(true);
    const result = await requestCurrentPosition();
    setLocating(false);
    setLocationMessage(result.status === 'granted' ? 'Position autorisée. Merci !' : result.message);
  };

  const extras: Record<string, ReactNode> = {
    position: (
      <View style={styles.extra}>
        <Button
          label="Autoriser ma position"
          variant="secondary"
          icon={<LocateFixed size={18} color={COLORS.primaryText} />}
          loading={locating}
          onPress={() => void askLocation()}
        />
        {locationMessage ? (
          <Text style={styles.extraText} accessibilityLiveRegion="polite">
            {locationMessage}
          </Text>
        ) : null}
      </View>
    ),
    alerts: (
      <View style={styles.extra}>
        <Button
          label="Créer un compte ou me connecter"
          variant="secondary"
          icon={<LogIn size={18} color={COLORS.primaryText} />}
          onPress={() => void finish(() => router.push('/account/login'))}
        />
      </View>
    ),
  };

  const last = page === SLIDES.length - 1;

  return (
    <View style={styles.root}>
      <SkyBackdrop height={insets.top + 420} />
      <View style={[styles.top, { paddingTop: insets.top + SPACING.sm }]}>
        <BrandLogo size={30} />
        {!last ? (
          <PressableScale onPress={() => void finish()} accessibilityRole="button" accessibilityLabel="Passer l'introduction" style={styles.skip}>
            <Text style={styles.skipText}>Passer</Text>
          </PressableScale>
        ) : null}
      </View>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
      >
        {SLIDES.map((slide, i) => (
          <View key={slide.key} style={[styles.slide, { width }]} aria-hidden={i !== page}>
            <Animated.View entering={motion.fadeIn(100)} style={styles.illustration}>
              {slide.key === 'iqa' ? <AqiIllustration active={page === 0} /> : slide.key === 'position' ? <LocationIllustration /> : <AlertIllustration />}
            </Animated.View>
            <Text style={styles.title} accessibilityRole="header">
              {slide.title}
            </Text>
            <Text style={styles.text}>{slide.text}</Text>
            {extras[slide.key]}
          </View>
        ))}
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + SPACING.lg }]}>
        <View style={styles.dots} accessibilityLabel={`Étape ${page + 1} sur ${SLIDES.length}`}>
          {SLIDES.map((s, i) => (
            <Dot key={s.key} active={i === page} />
          ))}
        </View>
        <Button label={last ? "C'est parti" : 'Suivant'} onPress={() => (last ? void finish() : goTo(page + 1))} style={styles.next} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg },
  skip: { minHeight: TOUCH_TARGET, minWidth: TOUCH_TARGET, paddingHorizontal: SPACING.md, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill },
  skipText: { ...TYPE.smallSemibold, color: COLORS.primaryText },
  slide: { paddingHorizontal: SPACING.xl, alignItems: 'center', paddingTop: SPACING.xl },
  illustration: { marginBottom: SPACING.xxl },
  title: { ...TYPE.h1, color: COLORS.text, textAlign: 'center' },
  text: { ...TYPE.body, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.md, maxWidth: 420 },
  extra: { marginTop: SPACING.xl, alignSelf: 'stretch', gap: SPACING.sm, alignItems: 'center' },
  extraText: { ...TYPE.small, color: COLORS.textSecondary, textAlign: 'center' },
  bottom: { paddingHorizontal: SPACING.xl, gap: SPACING.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.sm },
  dot: { height: 8, borderRadius: 4, backgroundColor: COLORS.primaryText },
  next: { alignSelf: 'stretch' },
});
