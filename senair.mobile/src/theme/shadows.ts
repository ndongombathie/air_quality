import type { ViewStyle } from 'react-native';
import { DesignTokens } from '@senair/core';

/** Ombres CSS de DesignTokens (prop `boxShadow`, prise en charge par RN ≥ 0.76 et le web). */
export const SHADOWS = {
  card: { boxShadow: DesignTokens.SHADOW.card },
  raised: { boxShadow: DesignTokens.SHADOW.raised },
} as const satisfies Record<string, ViewStyle>;
