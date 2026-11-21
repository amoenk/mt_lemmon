import type { CustomObjectSettings, FilterRow } from './astronomy';

// Everything a share link or export code carries
export interface ShareSettings {
  selectedDate: string;
  startTime: string;
  endTime: string;
  minAltitude: number;
  setupTime: number;
  filterChangeTime: number;
  positionOverhead: number;
  hiddenObjects: string[];
  customSettings: Record<string, CustomObjectSettings>;
}

const SHARE_VERSION = 3;

const FILTER_CODES: Record<string, string> = {
  Luminance: 'L', Red: 'R', Green: 'G', Blue: 'B', Ha: 'Ha', OIII: 'O3', SII: 'S2', IR850: 'IR', CH4: 'CH4'
};
const FILTER_NAMES = Object.fromEntries(Object.entries(FILTER_CODES).map(([name, code]) => [code, name]));

// One target's overrides as a compact string, e.g. "p10;m2x2;L:20x300;R:10x60b2"
//   p<priority>  m<w>x<h>  <filter>:<count>x<seconds>[b<binning>]
const encodeTarget = (settings: CustomObjectSettings): string => [
  ...(settings.priority ? [`p${settings.priority}`] : []),
  ...(settings.mosaic ? [`m${settings.mosaic.w}x${settings.mosaic.h}`] : []),
  ...(settings.filterRows ?? []).map(row =>
    `${FILTER_CODES[row.filter]}:${row.count}x${row.exposure}${row.binning > 1 ? `b${row.binning}` : ''}`)
].join(';');

const decodeTarget = (encoded: string): CustomObjectSettings => {
  const settings: CustomObjectSettings = {};
  const filterRows: FilterRow[] = [];
  for (const token of encoded.split(';').filter(Boolean)) {
    const row = token.match(/^(\w+):(\d+)x(\d+)(?:b(\d+))?$/);
    const mosaic = token.match(/^m(\d+)x(\d+)$/);
    if (row) {
      filterRows.push({ filter: FILTER_NAMES[row[1]], count: Number(row[2]), exposure: Number(row[3]), binning: Number(row[4] ?? 1) });
    } else if (mosaic) {
      settings.mosaic = { w: Number(mosaic[1]), h: Number(mosaic[2]) };
    } else {
      settings.priority = Number(token.slice(1));
    }
  }
  if (filterRows.length > 0) settings.filterRows = filterRows;
  return settings;
};

const toBase64Url = (text: string): string =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromBase64Url = (code: string): string =>
  new TextDecoder().decode(Uint8Array.from(atob(code.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));

export function encodeShare(settings: ShareSettings): string {
  return toBase64Url(JSON.stringify({
    v: SHARE_VERSION,
    d: settings.selectedDate,
    t: `${settings.startTime}-${settings.endTime}`,
    a: settings.minAltitude,
    u: settings.setupTime,
    f: settings.filterChangeTime,
    o: settings.positionOverhead,
    h: settings.hiddenObjects.join(','),
    c: Object.fromEntries(
      Object.entries(settings.customSettings)
        .map(([name, target]) => [name, encodeTarget(target)])
        .filter(([, encoded]) => encoded !== '')
    )
  }));
}

// Returns null for codes from other versions; throws on codes that aren't valid base64/JSON
export function decodeShare(code: string): ShareSettings | null {
  const parsed = JSON.parse(fromBase64Url(code));
  if (parsed.v !== SHARE_VERSION) return null;
  const [startTime, endTime] = parsed.t.split('-');
  return {
    selectedDate: parsed.d,
    startTime,
    endTime,
    minAltitude: parsed.a,
    setupTime: parsed.u,
    filterChangeTime: parsed.f,
    positionOverhead: parsed.o,
    hiddenObjects: parsed.h === '' ? [] : parsed.h.split(','),
    customSettings: Object.fromEntries(
      Object.entries(parsed.c as Record<string, string>).map(([name, encoded]) => [name, decodeTarget(encoded)])
    )
  };
}
