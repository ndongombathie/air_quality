import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Newspaper } from 'lucide-react-native';
import { COLORS } from '@/theme';

interface ArticleImageProps {
  uri: string | null;
  alt: string;
  style: StyleProp<ViewStyle>;
  iconSize?: number;
}

/** Image d'article : fond bleu ciel en attendant, fondu à l'arrivée, pictogramme si aucune photo. */
export function ArticleImage({ uri, alt, style, iconSize = 28 }: ArticleImageProps) {
  return (
    <View style={[styles.frame, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={300}
          accessibilityLabel={alt || undefined}
          accessible={!!alt}
          recyclingKey={uri}
        />
      ) : (
        <Newspaper size={iconSize} color={COLORS.selectedBorder} strokeWidth={1.6} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: COLORS.surfaceSubtle, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
