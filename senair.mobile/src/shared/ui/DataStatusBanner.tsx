import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Clock, WifiOff } from 'lucide-react-native';
import { DATA_STATUS_LABELS, FRESHNESS_LABELS, formatRelativeTime, isApiError, type DataStatus, type Freshness } from '@senair/core';
import { useApi } from '@/shared/api/AppProviders';
import { COLORS, RADIUS, SPACING, TYPE } from '@/theme';

interface DataStatusBannerProps {
  status?: DataStatus | null;
  freshness?: Freshness | null;
  observedAt?: string | null;
  /** Erreur de la dernière actualisation alors que des données en cache sont affichées. */
  refreshError?: unknown;
}

/**
 * Pastilles discrètes : hors-ligne, données en retard, provenance (texte + icône).
 * Le mode démonstration est signalé une seule fois, par la pastille « Démo » de la barre fixe (AppHeader).
 */
export function DataStatusBanner({ status, freshness, observedAt, refreshError }: DataStatusBannerProps) {
  const { isMock } = useApi();
  const offline = isApiError(refreshError) && (refreshError.kind === 'network' || refreshError.kind === 'timeout');
  const late = freshness === 'stale' || freshness === 'outdated';
  const showProvenance = status && status !== 'mock' && !isMock;
  if (!offline && !late && !showProvenance) return null;

  return (
    <View style={styles.container}>
      {offline ? <Pill icon={<WifiOff size={13} color={COLORS.warning} />} text="Hors-ligne : dernières données disponibles" /> : null}
      {late ? <Pill icon={<Clock size={13} color={COLORS.warning} />} text={`${FRESHNESS_LABELS[freshness]}, ${formatRelativeTime(observedAt)}`} /> : null}
      {showProvenance ? <Pill text={`Provenance : ${DATA_STATUS_LABELS[status]}`} /> : null}
    </View>
  );
}

function Pill({ icon, text }: { icon?: ReactNode; text: string }) {
  return (
    <View style={styles.pill} accessible accessibilityLabel={text}>
      {icon}
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs + SPACING.xxs },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs + SPACING.xxs,
    paddingHorizontal: SPACING.sm + SPACING.xxs,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  text: { ...TYPE.captionMedium, color: COLORS.textSecondary },
});
