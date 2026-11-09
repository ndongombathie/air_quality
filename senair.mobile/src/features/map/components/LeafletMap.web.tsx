/**
 * Variante web (aperçu navigateur) : même page Leaflet statique dans une iframe `srcDoc`.
 * Les données passent par `__senair.receive(json)` ; les messages entrants sont validés
 * (source = notre iframe, type et identifiant de station connus).
 */
import { createElement, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { THIES_CENTER, type GeoPoint } from '@senair/core';
import { COLORS } from '@/theme';
import { LEAFLET_MAP_HTML } from '../leaflet/mapHtml';
import { parseMapMessage, type MapHeatCell, type MapStationMarker, type ToMapMessage } from '../leaflet/protocol';

export interface LeafletMapHandle {
  focus(point: GeoPoint, zoom?: number): void;
}

interface LeafletMapProps {
  stations: MapStationMarker[];
  heat: { cells: MapHeatCell[]; halfLat: number; halfLon: number } | null;
  userPosition: GeoPoint | null;
  onSelectStation: (stationId: string) => void;
}

type SenairWindow = Window & { __senair?: { receive(json: string): void } };

export const LeafletMap = forwardRef<LeafletMapHandle, LeafletMapProps>(function LeafletMap(
  { stations, heat, userPosition, onSelectStation },
  ref,
) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const knownIds = useMemo(() => new Set(stations.map((s) => s.id)), [stations]);

  const post = useCallback((message: ToMapMessage) => {
    const target = frame.current?.contentWindow as SenairWindow | null | undefined;
    target?.__senair?.receive(JSON.stringify(message));
  }, []);

  useImperativeHandle(ref, () => ({ focus: (center, zoom = 15) => post({ type: 'focus', center, zoom }) }), [post]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || typeof event.data !== 'string') return;
      const message = parseMapMessage(event.data, knownIds);
      if (!message) return;
      if (message.type === 'ready') {
        post({ type: 'init', center: THIES_CENTER, zoom: 13 });
        setReady(true);
      } else onSelectStation(message.id);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [knownIds, onSelectStation, post]);

  useEffect(() => {
    if (ready) post({ type: 'stations', stations });
  }, [ready, stations, post]);
  useEffect(() => {
    if (ready) post({ type: 'heatmap', cells: heat?.cells ?? [], halfLat: heat?.halfLat ?? 0, halfLon: heat?.halfLon ?? 0, opacity: 0.35 });
  }, [ready, heat, post]);
  useEffect(() => {
    if (ready) post({ type: 'user', position: userPosition });
  }, [ready, userPosition, post]);

  return (
    <View style={styles.container} accessibilityLabel="Carte des stations de Thiès">
      {createElement('iframe', {
        ref: frame,
        srcDoc: LEAFLET_MAP_HTML,
        title: 'Carte des stations de Thiès',
        sandbox: 'allow-scripts allow-same-origin',
        style: { border: 0, width: '100%', height: '100%' },
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden', backgroundColor: COLORS.surfaceSubtle },
});
