/**
 * Page Leaflet STATIQUE : aucune donnée n'y est interpolée.
 * Leaflet 1.9.4 depuis unpkg avec empreintes SRI ; tuiles OpenStreetMap.
 * Les données arrivent par `window.__senair.receive(json)` (voir protocol.ts) ;
 * tout texte est posé via `textContent` (jamais innerHTML).
 */
export const LEAFLET_MAP_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src https://unpkg.com 'unsafe-inline'; style-src https://unpkg.com 'unsafe-inline'; img-src https://tile.openstreetmap.org data:; connect-src 'none'" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #E4F2FC; }
  .leaflet-container { font: 12px/1.4 -apple-system, Roboto, sans-serif; }
  .senair-marker { box-sizing: border-box; display: flex; align-items: center; justify-content: center;
    width: 38px; height: 38px; border-radius: 19px; border: 3px solid #A7B8C7; background: #FFFFFF; color: #0E2233;
    box-shadow: 0 2px 8px rgba(30, 124, 192, 0.25); font: 800 13px/1 -apple-system, Roboto, sans-serif;
    font-variant-numeric: tabular-nums; }
  .senair-user { width: 14px; height: 14px; border-radius: 7px; background: #2F98DE; border: 3px solid #FFFFFF;
    box-shadow: 0 0 0 6px rgba(47, 152, 222, 0.22); }
  .leaflet-bar { border: 1px solid #E1ECF5 !important; border-radius: 12px !important; overflow: hidden;
    box-shadow: 0 6px 20px rgba(30, 124, 192, 0.10) !important; }
  .leaflet-bar a, .leaflet-bar a:hover { width: 36px !important; height: 36px !important; line-height: 36px !important;
    color: #17639A !important; background: #FFFFFF !important; border-bottom: 1px solid #E1ECF5 !important; }
  .leaflet-control-attribution { background: rgba(255, 255, 255, 0.85) !important; border-radius: 8px 0 0 0; color: #5E7487; }
  .leaflet-control-attribution a { color: #17639A; }
  .senair-error { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    padding: 24px; text-align: center; font: 15px sans-serif; color: #0E2233; background: #E4F2FC; }
</style>
</head>
<body>
<div id="map"></div>
<script>
(function () {
  var map = null, stationLayer = null, heatLayer = null, userLayer = null;
  var COLOR = /^#[0-9a-fA-F]{6}$/;

  function send(message) {
    var json = JSON.stringify(message);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(json);
    else if (window.parent && window.parent !== window) window.parent.postMessage(json, '*');
  }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isPoint(p) { return p && isNum(p.latitude) && isNum(p.longitude); }
  function str(v) { return typeof v === 'string' ? v : ''; }

  function init(m) {
    if (map || !isPoint(m.center) || !isNum(m.zoom)) return;
    map = L.map('map', { preferCanvas: true, zoomControl: true, attributionControl: true }).setView([m.center.latitude, m.center.longitude], m.zoom);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; contributeurs OpenStreetMap'
    }).addTo(map);
    heatLayer = L.layerGroup().addTo(map);
    stationLayer = L.layerGroup().addTo(map);
    userLayer = L.layerGroup().addTo(map);
  }

  function stations(m) {
    if (!map || !Array.isArray(m.stations)) return;
    stationLayer.clearLayers();
    m.stations.forEach(function (s) {
      if (!isPoint(s) || typeof s.id !== 'string') return;
      var el = document.createElement('div');
      el.className = 'senair-marker';
      if (COLOR.test(s.color)) el.style.borderColor = s.color;
      if (COLOR.test(s.textColor)) el.style.color = s.textColor;
      el.textContent = str(s.label);
      var marker = L.marker([s.latitude, s.longitude], {
        icon: L.divIcon({ html: el, className: '', iconSize: [38, 38], iconAnchor: [19, 19] }),
        title: str(s.title),
        alt: str(s.title),
        keyboard: true
      });
      marker.on('click', function () { send({ type: 'station:select', id: s.id }); });
      stationLayer.addLayer(marker);
    });
  }

  function heatmap(m) {
    if (!map || !Array.isArray(m.cells) || !isNum(m.halfLat) || !isNum(m.halfLon)) return;
    heatLayer.clearLayers();
    var opacity = isNum(m.opacity) ? Math.min(Math.max(m.opacity, 0), 1) : 0.35;
    m.cells.forEach(function (c) {
      if (!isPoint(c) || !COLOR.test(c.color)) return;
      L.rectangle(
        [[c.latitude - m.halfLat, c.longitude - m.halfLon], [c.latitude + m.halfLat, c.longitude + m.halfLon]],
        { stroke: false, fillColor: c.color, fillOpacity: opacity, interactive: false }
      ).addTo(heatLayer);
    });
  }

  function user(m) {
    if (!map) return;
    userLayer.clearLayers();
    if (!isPoint(m.position)) return;
    L.marker([m.position.latitude, m.position.longitude], {
      icon: L.divIcon({ className: '', html: '<div class="senair-user"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }),
      interactive: false
    }).addTo(userLayer);
  }

  function focus(m) {
    if (map && isPoint(m.center) && isNum(m.zoom)) map.setView([m.center.latitude, m.center.longitude], m.zoom);
  }

  var HANDLERS = { init: init, stations: stations, heatmap: heatmap, user: user, focus: focus };

  window.__senair = {
    receive: function (json) {
      var m;
      try { m = JSON.parse(json); } catch (e) { return; }
      if (!m || typeof m.type !== 'string' || !Object.prototype.hasOwnProperty.call(HANDLERS, m.type)) return;
      HANDLERS[m.type](m);
    }
  };

  if (typeof L === 'undefined') {
    var div = document.createElement('div');
    div.className = 'senair-error';
    div.textContent = 'Carte indisponible hors connexion. Utilisez la liste des stations ci-dessous.';
    document.body.appendChild(div);
  } else {
    send({ type: 'ready' });
  }
})();
</script>
</body>
</html>`;
