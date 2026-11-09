import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useMotion } from '@/shared/motion/useMotion';
import { DataStatusBanner, ScreenTitle, SkyBackdrop, StateView } from '@/shared/ui';
import { useRefresh } from '@/shared/hooks/useRefresh';
import { COLORS, CONTENT_MAX_WIDTH, SPACING, TYPE } from '@/theme';
import { AlertFiltersBar } from '../components/AlertFiltersBar';
import { AlertItem } from '../components/AlertItem';
import { useAlertActions, useAlertHistory, useUnreadAlertCount, type AlertFilters } from '../hooks/useAlerts';

export function AlertsScreen() {
  const motion = useMotion();
  const [filters, setFilters] = useState<AlertFilters>({ severities: [] });
  const alerts = useAlertHistory(filters);
  const unread = useUnreadAlertCount();
  const actions = useAlertActions();
  const { refreshing, onRefresh } = useRefresh(alerts.refetch);
  const items = useMemo(() => alerts.data?.pages.flatMap((p) => p.items) ?? [], [alerts.data]);

  const header = (
    <View>
      <SkyBackdrop height={240} />
      <View style={styles.headerInner}>
        <ScreenTitle
          title="Alertes"
          subtitle={alerts.personal ? 'Les alertes de vos quartiers, des 30 derniers jours' : 'Les dépassements de seuils à Thiès, des 30 derniers jours'}
        />
        <DataStatusBanner refreshError={alerts.isRefetchError ? alerts.error : null} />
        <AlertFiltersBar filters={filters} onChange={setFilters} />
        {alerts.personal && unread > 0 ? (
          <View style={styles.unreadRow}>
            <Text style={styles.unreadText}>{unread > 1 ? `${unread} alertes non lues` : '1 alerte non lue'}</Text>
            <Pressable onPress={() => actions.readAll.mutate()} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.readAll}>Tout marquer comme lu</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );

  const empty = alerts.data ? (
    <StateView kind="empty" message="Aucune alerte pour ces critères." hint="Modifiez les filtres pour élargir la recherche." />
  ) : alerts.isError ? (
    <StateView kind="error" error={alerts.error} onRetry={() => void alerts.refetch()} />
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
        keyExtractor={(alert) => alert.id}
        renderItem={({ item, index }) => (
          <Animated.View entering={motion.enter(index % 8)} layout={motion.layout} style={styles.item}>
            <AlertItem
              alert={item}
              onRead={alerts.personal ? () => actions.markRead.mutate(item.id) : undefined}
              onDelete={alerts.personal ? () => actions.dismiss.mutate(item.id) : undefined}
            />
          </Animated.View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={<View style={styles.item}>{empty}</View>}
        ListFooterComponent={alerts.isFetchingNextPage ? <ActivityIndicator color={COLORS.primaryText} style={styles.footer} /> : undefined}
        onEndReached={() => {
          if (alerts.hasNextPage && !alerts.isFetchingNextPage) void alerts.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={COLORS.primaryText} colors={[COLORS.primaryText]} />
        }
        contentContainerStyle={styles.content}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: SPACING.xxxl },
  headerInner: { paddingHorizontal: SPACING.lg, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  item: { paddingHorizontal: SPACING.lg, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  skeletons: { gap: SPACING.md },
  unreadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  unreadText: { ...TYPE.smallSemibold, color: COLORS.text },
  readAll: { ...TYPE.smallSemibold, color: COLORS.primaryText },
  footer: { marginVertical: SPACING.lg },
});
