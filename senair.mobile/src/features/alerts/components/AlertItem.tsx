import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, MapPin, Megaphone, Trash2 } from 'lucide-react-native';
import { ALERT_STATUS_LABELS, AQI_LEVELS, REFERENCE_LABELS, formatMeasure, formatRelativeTime, type Alert } from '@senair/core';
import { LevelChip, PressableScale } from '@/shared/ui';
import { pollutantLabel } from '@/shared/format/display';
import { CARD_PADDING, COLORS, RADIUS, SHADOWS, SPACING, TYPE } from '@/theme';

interface AlertItemProps {
  alert: Alert;
  /** Mes alertes : appelée à la première ouverture d'une alerte non lue. */
  onRead?: () => void;
  /** Mes alertes : retire l'alerte de ma liste. */
  onDelete?: () => void;
}

/**
 * Alerte : carte blanche à liseré de niveau, dépliable pour le message et les recommandations.
 * Comme une notification : un point bleu signale une alerte non lue ; l'ouvrir la marque comme lue.
 */
export function AlertItem({ alert, onRead, onDelete }: AlertItemProps) {
  const [open, setOpen] = useState(false);
  const unread = alert.read === false;
  const level = AQI_LEVELS[alert.severity];
  const place = alert.stationName ?? alert.zoneName ?? 'Thiès';
  const active = alert.status === 'active';
  // Carte = zone cliquable (déplier) + bouton Supprimer à côté : jamais un bouton dans un bouton.
  return (
    <View style={[styles.card, unread && styles.cardUnread]}>
      <View style={[styles.accent, { backgroundColor: level.color }]} />
      <PressableScale
        onPress={() => {
          if (!open && unread) onRead?.();
          setOpen((v) => !v);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${unread ? 'Non lue. ' : ''}${alert.title}. Niveau ${level.label}. ${place}. ${ALERT_STATUS_LABELS[alert.status]}.`}
        accessibilityHint={open ? 'Masquer le détail' : 'Afficher le détail'}
        style={styles.body}
        pressedStyle={styles.pressed}
      >
        <View style={styles.header}>
          <LevelChip level={alert.severity} short />
          <View style={[styles.status, active && styles.statusActive]}>
            <Text style={[styles.statusText, active && styles.statusTextActive]}>{ALERT_STATUS_LABELS[alert.status]}</Text>
          </View>
          <View style={styles.spacer} />
          <Text style={[styles.time, unread && styles.timeUnread]}>{formatRelativeTime(alert.startedAt)}</Text>
          {unread ? <View style={styles.unreadDot} /> : null}
        </View>
        {alert.origin === 'manual' ? (
          <View style={styles.manual}>
            <Megaphone size={13} color={COLORS.primaryText} />
            <Text style={styles.manualText}>Publiée par les autorités</Text>
          </View>
        ) : null}
        <Text style={styles.title}>{alert.title}</Text>
        <View style={styles.placeRow}>
          <MapPin size={13} color={COLORS.textMuted} />
          <Text style={styles.place}>{place}</Text>
        </View>
        {alert.origin === 'sensor' ? (
          <View style={styles.valueRow}>
            <Text style={styles.value}>
              {pollutantLabel(alert.pollutant)} : {formatMeasure(alert.value)} {alert.unit}
            </Text>
            <Text style={styles.threshold}>
              seuil {REFERENCE_LABELS[alert.reference]} {formatMeasure(alert.threshold)} {alert.unit}
            </Text>
          </View>
        ) : null}
        {open ? (
          <View style={styles.details}>
            <Text style={styles.message}>{alert.message}</Text>
            {alert.recommendations.map((reco) => (
              <View key={reco} style={styles.reco}>
                <View style={styles.bullet} />
                <Text style={styles.recoText}>{reco}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.toggle}>
          <Text style={styles.toggleText}>{open ? 'Masquer' : 'Conseils et détail'}</Text>
          {open ? <ChevronUp size={16} color={COLORS.primaryText} /> : <ChevronDown size={16} color={COLORS.primaryText} />}
        </View>
      </PressableScale>
      {open && onDelete ? (
        <PressableScale onPress={onDelete} accessibilityRole="button" accessibilityLabel="Supprimer cette alerte de ma liste" style={styles.delete}>
          <Trash2 size={16} color={COLORS.danger} />
          <Text style={styles.deleteText}>Supprimer</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: CARD_PADDING,
    paddingLeft: CARD_PADDING + SPACING.xs,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  body: { gap: SPACING.sm },
  cardUnread: { borderColor: COLORS.selectedBorder, backgroundColor: COLORS.surface },
  pressed: { opacity: 0.85 },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  status: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xxs, borderRadius: RADIUS.pill, backgroundColor: COLORS.surfaceSubtle },
  statusActive: { backgroundColor: COLORS.primarySoft },
  statusText: { ...TYPE.captionMedium, color: COLORS.textSecondary },
  statusTextActive: { color: COLORS.primaryText },
  spacer: { flex: 1 },
  time: { ...TYPE.caption, color: COLORS.textMuted },
  timeUnread: { color: COLORS.primaryText, fontFamily: TYPE.captionMedium.fontFamily },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.primary },
  manual: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  manualText: { ...TYPE.captionMedium, color: COLORS.primaryText },
  delete: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, alignSelf: 'flex-start', paddingVertical: SPACING.xs, marginTop: SPACING.xs },
  deleteText: { ...TYPE.smallSemibold, color: COLORS.danger },
  title: { ...TYPE.h3, color: COLORS.text },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  place: { ...TYPE.small, color: COLORS.textSecondary },
  valueRow: { gap: SPACING.xxs },
  value: { ...TYPE.smallSemibold, color: COLORS.text, fontVariant: ['tabular-nums'] },
  threshold: { ...TYPE.caption, color: COLORS.textMuted },
  details: { gap: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  message: { ...TYPE.body, color: COLORS.text },
  reco: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  bullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.primary, marginTop: 8 },
  recoText: { ...TYPE.small, color: COLORS.textSecondary, flex: 1 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  toggleText: { ...TYPE.smallSemibold, color: COLORS.primaryText },
});
