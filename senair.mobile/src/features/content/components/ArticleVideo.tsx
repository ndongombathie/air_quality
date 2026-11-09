import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { MediaAsset } from '@senair/core';
import { COLORS, RADIUS, SPACING, TYPE } from '@/theme';

/**
 * Vidéo d'article : contrôles natifs, plein écran autorisé, AUCUNE lecture automatique.
 * Le lecteur n'est créé qu'avec une URL déjà validée (https, ou locale en démonstration).
 */
export function ArticleVideo({
  video,
  style,
}: {
  video: MediaAsset;
  /** Cadre imposé (en-tête d'article) : pas de légende, ratio libre. */ style?: StyleProp<ViewStyle>;
}) {
  const player = useVideoPlayer(video.url, (p) => {
    p.loop = false;
  });
  const ratio = video.width && video.height ? video.width / video.height : 16 / 9;
  if (style) {
    return (
      <VideoView
        player={player}
        nativeControls
        fullscreenOptions={{ enable: true }}
        allowsPictureInPicture={false}
        contentFit="contain"
        style={[styles.framed, style]}
        accessibilityLabel={video.alt || 'Vidéo de l’article'}
      />
    );
  }
  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        nativeControls
        fullscreenOptions={{ enable: true }}
        allowsPictureInPicture={false}
        contentFit="contain"
        style={[styles.video, { aspectRatio: ratio }]}
        accessibilityLabel={video.alt || 'Vidéo de l’article'}
      />
      {video.alt ? <Text style={styles.caption}>{video.alt}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: SPACING.sm },
  video: {
    width: '100%',
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.text,
    overflow: 'hidden',
  },
  framed: { backgroundColor: COLORS.text },
  caption: { ...TYPE.caption, color: COLORS.textMuted },
});
