import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { ARTICLE_CATEGORY_LABELS, formatDateTime, type ArticleSummary } from '@senair/core';
import { PressableScale } from '@/shared/ui';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPE } from '@/theme';
import { useArticle } from '../hooks/useArticles';
import { hasVideo, readingMinutes, visualOf } from '../media/mediaRules';
import { useMediaTrust } from '../media/useMediaTrust';
import { ArticleCover } from './ArticleCover';
import { VideoBadge } from './VideoBadge';

/** Grande carte « À la une » : couverture, catégorie, titre, extrait et temps de lecture. */
export function FeaturedArticleCard({ article }: { article: ArticleSummary }) {
  const trust = useMediaTrust();
  const detail = useArticle(article.slug);
  const visual = visualOf(article, trust);
  const minutes = detail.data ? readingMinutes(detail.data.content) : null;
  return (
    <PressableScale
      onPress={() =>
        router.push({
          pathname: '/articles/[slug]',
          params: { slug: article.slug },
        })
      }
      accessibilityRole="link"
      accessibilityLabel={`À la une, ${ARTICLE_CATEGORY_LABELS[article.category]} : ${article.title}`}
      haptics="light"
      style={styles.card}
    >
      <ArticleCover visual={visual} style={styles.image} iconSize={44} autoPlay />
      <View style={styles.flag}>
        <Text style={styles.flagText}>À la une</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Text style={styles.category}>{ARTICLE_CATEGORY_LABELS[article.category]}</Text>
          {hasVideo(article) ? <VideoBadge /> : null}
        </View>
        <Text style={styles.title}>{article.title}</Text>
        <Text style={styles.excerpt} numberOfLines={2}>
          {article.excerpt}
        </Text>
        <View style={styles.footer}>
          <Clock size={14} color={COLORS.textMuted} />
          <Text style={styles.meta}>
            {minutes ? `${minutes} min de lecture, ` : ''}
            {formatDateTime(article.publishedAt)}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  image: { width: '100%', aspectRatio: 16 / 10 },
  flag: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
  },
  flagText: {
    ...TYPE.captionMedium,
    fontFamily: TYPE.smallSemibold.fontFamily,
    color: COLORS.primaryText,
  },
  body: { padding: SPACING.lg + SPACING.xs, gap: SPACING.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  category: { ...TYPE.overline, color: COLORS.primaryText },
  title: { ...TYPE.h2, color: COLORS.text },
  excerpt: { ...TYPE.small, color: COLORS.textSecondary },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs + SPACING.xxs,
    marginTop: SPACING.xs,
  },
  meta: { ...TYPE.caption, color: COLORS.textMuted },
});
