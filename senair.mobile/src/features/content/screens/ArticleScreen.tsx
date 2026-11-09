import type { ReactNode } from 'react';
import { Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { ArrowLeft, Clock, Share2 } from 'lucide-react-native';
import { ARTICLE_CATEGORY_LABELS, formatDateTime } from '@senair/core';
import { DataStatusBanner, PressableScale, StateView } from '@/shared/ui';
import { useMotion } from '@/shared/motion/useMotion';
import { COLORS, CONTENT_MAX_WIDTH, RADIUS, SHADOWS, SPACING, TOUCH_TARGET, TYPE } from '@/theme';
import { ArticleImage } from '../components/ArticleImage';
import { ArticleVideo } from '../components/ArticleVideo';
import { MediaGallery } from '../components/MediaGallery';
import { useArticle } from '../hooks/useArticles';
import { MarkdownView } from '../markdown/MarkdownView';
import { readingMinutes, safeMedia, visualOf } from '../media/mediaRules';
import { useMediaTrust } from '../media/useMediaTrust';

const COVER_HEIGHT = 300;

function RoundButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} scaleTo={0.92} style={styles.round}>
      {children}
    </PressableScale>
  );
}

export function ArticleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const article = useArticle(typeof slug === 'string' ? slug : '');
  const trust = useMediaTrust();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const motion = useMotion();
  const reduced = useReducedMotion();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  // Parallaxe légère : l'image défile moins vite et s'agrandit quand on tire vers le bas.
  const coverStyle = useAnimatedStyle(() =>
    reduced
      ? {}
      : {
          transform: [
            {
              translateY: interpolate(scrollY.value, [-COVER_HEIGHT, 0, COVER_HEIGHT], [-COVER_HEIGHT / 2, 0, COVER_HEIGHT * 0.4]),
            },
            {
              scale: interpolate(scrollY.value, [-COVER_HEIGHT, 0], [2, 1], 'clamp'),
            },
          ],
        },
  );

  // Barre blanche avec le titre qui apparaît une fois la couverture dépassée.
  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [COVER_HEIGHT - 120, COVER_HEIGHT - 40], [0, 1], 'clamp'),
  }));

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/actualites'));
  const data = article.data;
  const share = () => {
    if (!data) return;
    void Share.share({
      title: data.title,
      message: `${data.title}\n\n${data.excerpt}\n\nLu sur SEN-AIR, la qualité de l'air à Thiès.`,
    }).catch(() => undefined);
  };

  const topBar = (
    <>
      <Animated.View pointerEvents="none" style={[styles.bar, { height: insets.top + TOUCH_TARGET + SPACING.lg }, barStyle]}>
        <Text style={styles.barTitle} numberOfLines={1}>
          {data?.title ?? ''}
        </Text>
      </Animated.View>
      <View style={[styles.topBar, { top: insets.top + SPACING.sm }]}>
        <RoundButton label="Retour" onPress={goBack}>
          <ArrowLeft size={20} color={COLORS.text} />
        </RoundButton>
        {data ? (
          <RoundButton label="Partager l'article" onPress={share}>
            <Share2 size={19} color={COLORS.text} />
          </RoundButton>
        ) : null}
      </View>
    </>
  );

  if (!data) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 72 }]}>
        <View style={styles.pending}>
          {article.isError ? (
            <StateView kind="error" error={article.error} onRetry={() => void article.refetch()} />
          ) : (
            <StateView kind="loading" graphic lines={5} />
          )}
        </View>
        {topBar}
      </View>
    );
  }

  const media = safeMedia(data.media, trust);
  const visual = visualOf(data, trust);
  const photos = media.filter((m) => m.kind === 'image');
  // Sans photo, la première vidéo prend la place de la couverture : elle n'est pas répétée plus bas.
  const headerVideo = visual?.kind === 'video' ? visual.video : null;
  const videos = media.filter((m) => m.kind === 'video' && m.id !== headerVideo?.id);
  const coverHeight = COVER_HEIGHT + insets.top;
  const minutes = readingMinutes(data.content);
  const contentWidth = Math.min(width, CONTENT_MAX_WIDTH);

  return (
    <View style={styles.root}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={styles.scroll}>
        {headerVideo ? (
          <View style={[styles.coverWrap, styles.videoCover, { paddingTop: insets.top + TOUCH_TARGET + SPACING.lg }]}>
            <ArticleVideo
              video={headerVideo}
              style={{
                width: '100%',
                height: COVER_HEIGHT - TOUCH_TARGET - SPACING.lg,
              }}
            />
          </View>
        ) : (
          <Animated.View style={[styles.coverWrap, coverStyle]}>
            <ArticleImage
              uri={visual?.kind === 'image' ? visual.url : null}
              alt={visual?.kind === 'image' ? visual.alt : ''}
              style={{ width: '100%', height: coverHeight }}
              iconSize={56}
            />
          </Animated.View>
        )}
        <View style={[styles.sheet, { width: contentWidth }]}>
          <Animated.View entering={motion.enter(0)} style={styles.head}>
            <Text style={styles.category}>{ARTICLE_CATEGORY_LABELS[data.category]}</Text>
            <Text style={styles.title} accessibilityRole="header">
              {data.title}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>
                {data.author.name}, {data.author.role.toLowerCase()}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Clock size={14} color={COLORS.textMuted} />
              <Text style={styles.meta}>
                {minutes} min de lecture, {formatDateTime(data.publishedAt)}
              </Text>
            </View>
            <DataStatusBanner />
          </Animated.View>
          <Animated.View entering={motion.enter(1)} style={styles.body}>
            <Text style={styles.excerpt}>{data.excerpt}</Text>
            <MarkdownView source={data.content} />
            {photos.length > (visual?.kind === 'image' ? 1 : 0) ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Photos</Text>
                <MediaGallery photos={photos} />
              </View>
            ) : null}
            {videos.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{videos.length > 1 ? 'Vidéos' : 'Vidéo'}</Text>
                {videos.map((v) => (
                  <ArticleVideo key={v.id} video={v} />
                ))}
              </View>
            ) : null}
            {data.tags.length ? (
              <View style={styles.tags}>
                {data.tags.map((t) => (
                  <View key={t} style={styles.tag}>
                    <Text style={styles.tagText}>#{t}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Animated.View>
        </View>
      </Animated.ScrollView>
      {topBar}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  pending: { paddingHorizontal: SPACING.lg },
  scroll: { paddingBottom: SPACING.xxxl, alignItems: 'center' },
  coverWrap: { width: '100%' },
  // Le bas (arrondi de la feuille) recouvre une marge sombre, jamais les contrôles de la vidéo.
  videoCover: { backgroundColor: COLORS.text, paddingBottom: RADIUS.xl },
  sheet: {
    marginTop: -RADIUS.xl,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  head: { gap: SPACING.sm },
  category: { ...TYPE.overline, color: COLORS.primaryText },
  title: { ...TYPE.h1, color: COLORS.text },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs + SPACING.xxs,
  },
  meta: { ...TYPE.small, color: COLORS.textMuted },
  body: { gap: SPACING.lg, marginTop: SPACING.xl },
  excerpt: { ...TYPE.bodyMedium, color: COLORS.textSecondary },
  section: { gap: SPACING.md, marginTop: SPACING.md },
  sectionTitle: { ...TYPE.h2, color: COLORS.text },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  tag: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primarySoft,
  },
  tagText: { ...TYPE.captionMedium, color: COLORS.primaryText },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    justifyContent: 'flex-end',
    paddingHorizontal: TOUCH_TARGET + SPACING.xl,
    paddingBottom: SPACING.md + SPACING.xs,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  barTitle: { ...TYPE.bodySemibold, color: COLORS.text, textAlign: 'center' },
  topBar: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  round: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: TOUCH_TARGET / 2,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.raised,
  },
});
