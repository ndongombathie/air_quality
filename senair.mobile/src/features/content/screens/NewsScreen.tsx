import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ARTICLE_CATEGORY_LABELS, type ArticleCategory } from '@senair/core';
import { ChipGroup, DataStatusBanner, ScreenTitle, SkyBackdrop, StateView } from '@/shared/ui';
import { useRefresh } from '@/shared/hooks/useRefresh';
import { useMotion } from '@/shared/motion/useMotion';
import { COLORS, CONTENT_MAX_WIDTH, SPACING, TYPE } from '@/theme';
import { ArticleRow } from '../components/ArticleRow';
import { ComprendreCard } from '../components/ComprendreCard';
import { FeaturedArticleCard } from '../components/FeaturedArticleCard';
import { useArticles, useFeaturedArticle } from '../hooks/useArticles';

type CategoryFilter = ArticleCategory | 'all';

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'Tout' },
  ...(Object.keys(ARTICLE_CATEGORY_LABELS) as ArticleCategory[]).map((value) => ({ value, label: ARTICLE_CATEGORY_LABELS[value] })),
];

/** Onglet Actualités : à la une, catégories, fil paginé, accès à « Comprendre ». */
export function NewsScreen() {
  const motion = useMotion();
  const [category, setCategory] = useState<CategoryFilter>('all');
  const featured = useFeaturedArticle();
  const articles = useArticles(category === 'all' ? null : category);
  const { refreshing, onRefresh } = useRefresh(featured.refetch, articles.refetch);

  const showFeatured = category === 'all' && featured.data;
  const items = useMemo(() => {
    const all = articles.data?.pages.flatMap((p) => p.items) ?? [];
    return showFeatured ? all.filter((a) => a.id !== featured.data?.id) : all;
  }, [articles.data, showFeatured, featured.data]);

  const header = (
    <View>
      <SkyBackdrop height={260} />
      <View style={styles.inner}>
        <ScreenTitle title="Actualités" subtitle="Informations, alertes et conseils sur l'air de Thiès" />
        <DataStatusBanner />
        {showFeatured && featured.data ? (
          <Animated.View entering={motion.enter(0)} style={styles.block}>
            <FeaturedArticleCard article={featured.data} />
          </Animated.View>
        ) : null}
        <Animated.View entering={motion.enter(1)} style={styles.block}>
          <ComprendreCard />
        </Animated.View>
        <Text style={styles.listTitle} accessibilityRole="header">
          Toutes les actualités
        </Text>
        <ChipGroup options={CATEGORY_OPTIONS} isSelected={(v) => v === category} onToggle={setCategory} />
      </View>
    </View>
  );

  const empty = articles.data ? (
    <StateView kind="empty" message="Aucune actualité dans cette catégorie." actionLabel="Voir tout" onAction={() => setCategory('all')} />
  ) : articles.isError ? (
    <StateView kind="error" error={articles.error} onRetry={() => void articles.refetch()} />
  ) : (
    <View style={styles.skeletons}>
      <StateView kind="loading" lines={2} />
      <StateView kind="loading" lines={2} />
    </View>
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={items}
        keyExtractor={(a) => a.id}
        renderItem={({ item, index }) => (
          <Animated.View entering={motion.enter(index % 8)} layout={motion.layout} style={styles.item}>
            <ArticleRow article={item} />
          </Animated.View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={<View style={styles.item}>{empty}</View>}
        ListFooterComponent={articles.isFetchingNextPage ? <ActivityIndicator color={COLORS.primaryText} style={styles.footer} /> : undefined}
        onEndReached={() => {
          if (articles.hasNextPage && !articles.isFetchingNextPage) void articles.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={COLORS.primaryText} colors={[COLORS.primaryText]} />}
        contentContainerStyle={styles.content}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: SPACING.xxxl },
  inner: { paddingHorizontal: SPACING.lg, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  block: { marginTop: SPACING.lg },
  listTitle: { ...TYPE.h2, color: COLORS.text, marginTop: SPACING.xxl, marginBottom: SPACING.md },
  item: { paddingHorizontal: SPACING.lg, marginTop: SPACING.md, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  skeletons: { gap: SPACING.md },
  footer: { marginVertical: SPACING.lg },
});
