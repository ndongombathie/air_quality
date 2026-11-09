import { StyleSheet, Text, View } from 'react-native';
import { CloudOff, Inbox } from 'lucide-react-native';
import { toUserMessage } from '@senair/core';
import { COLORS, SPACING, TYPE } from '@/theme';
import { Button } from './Button';
import { SkeletonCard } from './Skeleton';

type StateViewProps =
  | { kind: 'loading'; lines?: number; graphic?: boolean }
  | { kind: 'error'; error: unknown; onRetry?: () => void }
  | { kind: 'empty'; message: string; hint?: string; actionLabel?: string; onAction?: () => void };

/** États communs : squelette de chargement, erreur avec « Réessayer », vide avec une phrase et une action. */
export function StateView(props: StateViewProps) {
  if (props.kind === 'loading') return <SkeletonCard lines={props.lines} graphic={props.graphic} />;
  if (props.kind === 'error') {
    return (
      <View style={styles.container} accessibilityRole="alert">
        <CloudOff size={28} color={COLORS.textMuted} strokeWidth={1.8} />
        <Text style={styles.message}>{toUserMessage(props.error)}</Text>
        {props.onRetry ? <Button label="Réessayer" variant="secondary" onPress={props.onRetry} /> : null}
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <Inbox size={28} color={COLORS.textMuted} strokeWidth={1.8} />
      <Text style={styles.message}>{props.message}</Text>
      {props.hint ? <Text style={styles.hint}>{props.hint}</Text> : null}
      {props.actionLabel && props.onAction ? <Button label={props.actionLabel} variant="secondary" onPress={props.onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xl, paddingHorizontal: SPACING.lg, gap: SPACING.md },
  message: { ...TYPE.body, color: COLORS.textSecondary, textAlign: 'center' },
  hint: { ...TYPE.small, color: COLORS.textMuted, textAlign: 'center' },
});
