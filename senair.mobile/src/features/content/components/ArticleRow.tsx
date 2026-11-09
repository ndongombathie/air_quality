import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ARTICLE_CATEGORY_LABELS, formatDateTime, type ArticleSummary } from '@senair/core';
import { PressableScale } from '@/shared/ui';
import { COLORS, RADIUS, SPACING, TYPE } from '@/theme';
import { hasVideo, visualOf } from '../media/mediaRules';
import { useMediaTrust } from '../media/useMediaTrust';
import { ArticleCover } from './ArticleCover';
import { VideoBadge } from './VideoBadge';

/** Ligne d'article : miniature, catégorie, titre sur deux lignes, date et badge vidéo. */
export function ArticleRow({ article }: { article: ArticleSummary }) {
  const trust = useMediaTrust();
  const visual = visualOf(article, trust);
  return (
    <PressableScale
      onPress={() =>
        router.push({
          pathname: '/articles/[slug]',
          params: { slug: article.slug },
        })
      }
      accessibilityRole="link"
      accessibilityLabel={`${ARTICLE_CATEGORY_LABELS[article.category]} : ${article.title}`}
      style={styles.row}
      pressedStyle={styles.pressed}
    >
      <ArticleCover visual={visual} style={styles.thumb} iconSize={20} />
      <View style={styles.texts}>
        <Text style={styles.category}>{ARTICLE_CATEGORY_LABELS[article.category]}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {article.title}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.date}>{formatDateTime(article.publishedAt)}</Text>
          {hasVideo(article) ? <VideoBadge /> : null}
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pressed: { backgroundColor: COLORS.background },
  thumb: { width: 96, height: 96, borderRadius: RADIUS.md },
  texts: { flex: 1, gap: SPACING.xs, justifyContent: 'center' },
  category: { ...TYPE.overline, color: COLORS.primaryText },
  title: { ...TYPE.h3, color: COLORS.text },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  date: { ...TYPE.caption, color: COLORS.textMuted },
});
