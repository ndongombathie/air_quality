import { useState } from 'react';
import { FlatList, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import type { MediaAsset } from '@senair/core';
import { COLORS, CONTENT_MAX_WIDTH, RADIUS, SPACING, TYPE } from '@/theme';
import { ArticleImage } from './ArticleImage';

/** Galerie de photos : défilement horizontal paginé, légende = texte alternatif, points de pagination. */
export function MediaGallery({ photos }: { photos: MediaAsset[] }) {
  const { width } = useWindowDimensions();
  const pageWidth = Math.min(width, CONTENT_MAX_WIDTH) - SPACING.lg * 2;
  const [page, setPage] = useState(0);
  if (photos.length === 0) return null;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / pageWidth));
  const current = photos[Math.min(page, photos.length - 1)];

  return (
    <View style={styles.container} accessibilityLabel={`Galerie de ${photos.length} photos`}>
      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(m) => m.id}
        onScroll={onScroll}
        scrollEventThrottle={32}
        style={{ width: pageWidth, borderRadius: RADIUS.lg }}
        renderItem={({ item }) => <ArticleImage uri={item.url} alt={item.alt} style={{ width: pageWidth, aspectRatio: 4 / 3 }} />}
      />
      <View style={styles.footer}>
        <Text style={styles.caption} numberOfLines={2}>
          {current?.alt || 'Photo sans description'}
        </Text>
        {photos.length > 1 ? (
          <View style={styles.dots} accessibilityLabel={`Photo ${page + 1} sur ${photos.length}`}>
            {photos.map((p, i) => (
              <View key={p.id} style={[styles.dot, i === page && styles.dotActive]} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: SPACING.sm },
  footer: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  caption: { ...TYPE.caption, color: COLORS.textMuted, flex: 1 },
  dots: { flexDirection: 'row', gap: SPACING.xs },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.borderStrong },
  dotActive: { width: 18, backgroundColor: COLORS.primaryText },
});
