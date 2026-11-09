import { useState } from 'react';
import Animated from 'react-native-reanimated';
import { useMotion } from '@/shared/motion/useMotion';
import { StyleSheet, Text } from 'react-native';
import { AQI_LEVEL_IDS, AQI_LEVELS, MEDICAL_DISCLAIMER, type AqiLevel, type HealthProfileId } from '@senair/core';
import { Button, ChipGroup, DataStatusBanner, Disclaimer, Screen, ScreenTitle, SectionHeader, StateView } from '@/shared/ui';
import { useSession } from '@/shared/api/AppProviders';
import { useRefresh } from '@/shared/hooks/useRefresh';
import { formatAqi } from '@/shared/format/display';
import { useAirQualitySummary } from '@/features/air-quality/hooks/useAirQuality';
import { COLORS, SPACING, TYPE } from '@/theme';
import { GuidanceCard } from '../components/GuidanceCard';
import { ProfilePicker } from '../components/ProfilePicker';
import { useHealthGuidance } from '../hooks/useHealthGuidance';

const LEVEL_OPTIONS = AQI_LEVEL_IDS.map((id) => ({ value: id, label: AQI_LEVELS[id].shortLabel, dotColor: AQI_LEVELS[id].color }));

export function HealthScreen() {
  const { user } = useSession();
  const motion = useMotion();
  const [profile, setProfile] = useState<HealthProfileId | null>(null);
  const [pickedLevel, setPickedLevel] = useState<AqiLevel | null>(null);
  const summary = useAirQualitySummary();
  const activeProfile = profile ?? user?.healthProfile ?? 'general';
  const level = pickedLevel ?? summary.data?.level ?? null;
  const guidance = useHealthGuidance(activeProfile, level);
  const { refreshing, onRefresh } = useRefresh(summary.refetch, level && guidance.refetch);

  return (
    <Screen topInset={false} refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <ScreenTitle title="Santé" subtitle="Recommandations selon votre profil et la qualité de l'air" />
      <DataStatusBanner status={summary.data?.status} freshness={summary.data?.freshness} observedAt={summary.data?.observedAt} />

      <SectionHeader title="Votre profil" subtitle={user?.healthProfile ? 'Pré-sélectionné depuis votre compte' : 'Non enregistré : choix local uniquement'} />
      <ProfilePicker selected={activeProfile} onSelect={setProfile} />

      <SectionHeader
        title="Niveau d'IQA"
        subtitle={
          summary.data
            ? `Actuellement à ${summary.data.name} : ${formatAqi(summary.data.aqi)} (${summary.data.level ? AQI_LEVELS[summary.data.level].label : 'indisponible'})`
            : 'Choisissez un niveau'
        }
      />
      <ChipGroup options={LEVEL_OPTIONS} isSelected={(v) => v === level} onToggle={setPickedLevel} />
      {pickedLevel ? (
        <Button label="Revenir au niveau actuel" variant="ghost" onPress={() => setPickedLevel(null)} style={styles.reset} />
      ) : null}

      <SectionHeader title="Recommandations" />
      {!level ? (
        <StateView kind="empty" message="Niveau d'IQA indisponible : sélectionnez un niveau ci-dessus." />
      ) : !guidance.data ? (
        guidance.isError ? (
          <StateView kind="error" error={guidance.error} onRetry={() => void guidance.refetch()} />
        ) : (
          <StateView kind="loading" />
        )
      ) : guidance.data.length === 0 ? (
        <StateView kind="empty" message="Pas de recommandation spécifique pour ce profil et ce niveau." />
      ) : (
        guidance.data.map((g, i) => (
          <Animated.View key={`${g.profile}-${g.level}-${g.title}`} entering={motion.enter(i)} layout={motion.layout}>
            <GuidanceCard guidance={g} />
          </Animated.View>
        ))
      )}

      <Disclaimer text={guidance.data?.[0]?.disclaimer ?? MEDICAL_DISCLAIMER} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  reset: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
