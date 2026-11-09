import { useWindowDimensions } from 'react-native';
import { TABLET_BREAKPOINT } from '@/theme';

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  return { width, height, isTablet, columns: isTablet ? 2 : 1 };
}
