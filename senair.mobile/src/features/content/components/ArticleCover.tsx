import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useReducedMotion } from 'react-native-reanimated';
import { Play } from 'lucide-react-native';
import type { MediaAsset } from '@senair/core';
import { COLORS } from '@/theme';
import type { ArticleVisual } from '../media/mediaRules';
import { ArticleImage } from './ArticleImage';

interface ArticleCoverProps {
  visual: ArticleVisual;
  style: StyleProp<ViewStyle>;
  iconSize?: number;
  /** Lecture muette en boucle (grande carte). Sinon, première image figée avec un bouton lecture. */
  autoPlay?: boolean;
}

/** Aperçu vidéo sans son ni contrôles : il illustre la carte, la lecture se fait dans l'article. */
function VideoPreview({ video, autoPlay, iconSize }: { video: MediaAsset; autoPlay: boolean; iconSize: number }) {
  const player = useVideoPlayer(video.url, (p) => {
    p.muted = true;
    p.loop = true;
    if (autoPlay) p.play();
  });
  return (
    <>
      <VideoView player={player} nativeControls={false} contentFit="cover" style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View
        style={[
          styles.play,
          {
            width: iconSize * 1.6,
            height: iconSize * 1.6,
            borderRadius: iconSize,
          },
        ]}
        pointerEvents="none"
      >
        <Play size={iconSize * 0.7} color={COLORS.surface} fill={COLORS.surface} />
      </View>
    </>
  );
}

/** Couverture d'article : la photo, sinon la vidéo, sinon un pictogramme. */
export function ArticleCover({ visual, style, iconSize = 28, autoPlay = false }: ArticleCoverProps) {
  const reduced = useReducedMotion();
  if (visual?.kind !== 'video') {
    return <ArticleImage uri={visual?.url ?? null} alt={visual?.alt ?? ''} style={style} iconSize={iconSize} />;
  }
  return (
    <View style={[styles.frame, style]} accessible accessibilityLabel={visual.video.alt || 'Vidéo'}>
      <VideoPreview video={visual.video} autoPlay={autoPlay && !reduced} iconSize={iconSize} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: COLORS.text,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  play: {
    position: 'relative',
    zIndex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
