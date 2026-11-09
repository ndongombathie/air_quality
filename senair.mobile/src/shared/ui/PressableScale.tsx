import { useState, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { haptic, type HapticKind } from '@/shared/motion/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Style ajouté pendant l'appui (ex. fond sky50). */
  pressedStyle?: StyleProp<ViewStyle>;
  /** Échelle au toucher (0.97 par défaut ; 0.94 pour les petites cibles). */
  scaleTo?: number;
  /** Retour haptique, réservé aux actions principales. */
  haptics?: HapticKind;
}

const SPRING = { damping: 18, stiffness: 320, mass: 0.6 };

/** Pressable avec léger rétrécissement en ressort (et haptique optionnelle). */
export function PressableScale({ children, style, pressedStyle, scaleTo = 0.97, haptics, onPressIn, onPressOut, onPress, ...rest }: PressableScaleProps) {
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        setPressed(true);
        if (!reduced) scale.value = withSpring(scaleTo, SPRING);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        scale.value = withSpring(1, SPRING);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptics) haptic(haptics);
        onPress?.(e);
      }}
      style={[style, pressed && pressedStyle, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}
