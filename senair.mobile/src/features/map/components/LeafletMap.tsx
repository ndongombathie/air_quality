import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { THIES_CENTER, type GeoPoint } from '@senair/core';
import { COLORS } from '@/theme';
import { LEAFLET_MAP_HTML } from '../leaflet/mapHtml';
import { parseMapMessage, toInjectedScript, type MapHeatCell, type MapStationMarker, type ToMapMessage } from '../leaflet/protocol';

export interface LeafletMapHandle {
  focus(point: GeoPoint, zoom?: number): void;
}

interface LeafletMapProps {
  stations: MapStationMarker[];
  heat: { cells: MapHeatCell[]; halfLat: number; halfLon: number } | null;
  userPosition: GeoPoint | null;
  onSelectStation: (stationId: string) => void;
}

const SOURCE = { html: LEAFLET_MAP_HTML };
const ORIGIN_WHITELIST = ['about:blank'];

/** WebView Leaflet : HTML statique, données poussées en JSON, messages entrants validés. */
export const LeafletMap = forwardRef<LeafletMapHandle, LeafletMapProps>(function LeafletMap(
  { stations, heat, userPosition, onSelectStation },
  ref,
) {
  const webView = useRef<ComponentRef<typeof WebView>>(null);
  const [ready, setReady] = useState(false);
  const knownIds = useMemo(() => new Set(stations.map((s) => s.id)), [stations]);

  const post = useCallback((message: ToMapMessage) => webView.current?.injectJavaScript(toInjectedScript(message)), []);

  useImperativeHandle(ref, () => ({ focus: (center, zoom = 15) => post({ type: 'focus', center, zoom }) }), [post]);

  useEffect(() => {
    if (ready) post({ type: 'stations', stations });
  }, [ready, stations, post]);

  useEffect(() => {
    if (ready) post({ type: 'heatmap', cells: heat?.cells ?? [], halfLat: heat?.halfLat ?? 0, halfLon: heat?.halfLon ?? 0, opacity: 0.35 });
  }, [ready, heat, post]);

  useEffect(() => {
    if (ready) post({ type: 'user', position: userPosition });
  }, [ready, userPosition, post]);

  const onMessage = (event: WebViewMessageEvent) => {
    const message = parseMapMessage(event.nativeEvent.data, knownIds);
    if (!message) return;
    if (message.type === 'ready') {
      post({ type: 'init', center: THIES_CENTER, zoom: 13 });
      setReady(true);
    } else {
      onSelectStation(message.id);
    }
  };

  return (
    <View style={styles.container} accessibilityLabel="Carte des stations de Thiès" importantForAccessibility="no-hide-descendants">
      <WebView
        ref={webView}
        source={SOURCE}
        originWhitelist={ORIGIN_WHITELIST}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess={false}
        allowsInlineMediaPlayback={false}
        setSupportMultipleWindows={false}
        onContentProcessDidTerminate={(): void => {
          setReady(false);
          webView.current?.reload();
        }}
        style={styles.webview}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden', backgroundColor: COLORS.surfaceSubtle },
  webview: { flex: 1, backgroundColor: COLORS.surfaceSubtle },
});
