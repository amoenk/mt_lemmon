import * as Astronomy from 'astronomy-engine';
import type { DeepSkyObject } from '../data/deepSkyObjects';

export const MT_LEMMON_LOCATION = {
  latitude: 32.4433,
  longitude: -110.7892,
  elevation: 2791 // meters
};

export function raToDecimal(ra: { hours: number; minutes: number; seconds: number }): number {
  return ra.hours + ra.minutes / 60 + ra.seconds / 3600;
}

export function decToDecimal(dec: { degrees: number; minutes: number; seconds: number }): number {
  const sign = dec.degrees < 0 ? -1 : 1;
  return sign * (Math.abs(dec.degrees) + dec.minutes / 60 + dec.seconds / 3600);
}

export function calculateAltitude(
  ra: number, // hours
  dec: number, // degrees
  date: Date,
  longitude: number,
  latitude: number
): number {
  const observer = new Astronomy.Observer(latitude, longitude, MT_LEMMON_LOCATION.elevation);
  
  // Convert RA/Dec to horizontal coordinates
  const time = new Astronomy.AstroTime(date);
  const hor = Astronomy.Horizon(time, observer, ra, dec, 'normal');
  
  return hor.altitude;
}

export function calculateAzimuth(
  ra: number, // hours
  dec: number, // degrees
  date: Date,
  longitude: number,
  latitude: number
): number {
  const observer = new Astronomy.Observer(latitude, longitude, MT_LEMMON_LOCATION.elevation);
  const time = new Astronomy.AstroTime(date);
  const hor = Astronomy.Horizon(time, observer, ra, dec, 'normal');
  return hor.azimuth;
}

export interface ObjectTimings {
  riseTime: Date | null;
  riseAzimuth: number | null;
  transitTime: Date | null;
  transitAltitude: number;
  transitAzimuth: number;
  setTime: Date | null;
  setAzimuth: number | null;
  isCircumpolar: boolean;
  neverRises: boolean;
}

export function calculateObjectTimings(
  ra: number,
  dec: number,
  observationDate: Date,
  minAltitude: number = 0
): ObjectTimings {
  
  // For the search window, we need to consider that observations 
  // typically span from evening to morning of the next day
  // Start search a few hours before the observation time
  const startDate = new Date(observationDate);
  startDate.setHours(startDate.getHours() - 6);
  
  // End search well into the next day
  const endDate = new Date(observationDate);
  endDate.setDate(endDate.getDate() + 1);
  endDate.setHours(endDate.getHours() + 12);
  
  let riseTime: Date | null = null;
  let riseAzimuth: number | null = null;
  let setTime: Date | null = null;
  let setAzimuth: number | null = null;
  let transitTime: Date | null = null;
  let transitAltitude = 0;
  let transitAzimuth = 180; // South
  
  // Check if object is circumpolar or never rises
  const maxPossibleAlt = 90 - Math.abs(MT_LEMMON_LOCATION.latitude - dec);
  const minPossibleAlt = dec - (90 - MT_LEMMON_LOCATION.latitude);
  
  
  const isCircumpolar = minPossibleAlt > minAltitude;
  const neverRises = maxPossibleAlt < minAltitude;
  
  if (!neverRises) {
    // Find ALL transits in our search window
    const transits: Array<{time: Date, altitude: number, azimuth: number}> = [];
    let checkDate = new Date(startDate);
    let lastAzimuth = calculateAzimuth(ra, dec, checkDate, MT_LEMMON_LOCATION.longitude, MT_LEMMON_LOCATION.latitude);
    
    while (checkDate < endDate) {
      const altitude = calculateAltitude(ra, dec, checkDate, MT_LEMMON_LOCATION.longitude, MT_LEMMON_LOCATION.latitude);
      const azimuth = calculateAzimuth(ra, dec, checkDate, MT_LEMMON_LOCATION.longitude, MT_LEMMON_LOCATION.latitude);
      
      // Detect meridian crossing (azimuth crosses 180°)
      // For objects that cross the meridian, azimuth goes from < 180 to > 180
      // For circumpolar objects in the north, azimuth might go from > 180 to < 180 (lower culmination)
      const crossesMeridian = (lastAzimuth < 180 && azimuth >= 180) || 
                             (lastAzimuth > 180 && azimuth <= 180);
      
      if (crossesMeridian || (Math.abs(azimuth - 180) < 1 && Math.abs(lastAzimuth - 180) > Math.abs(azimuth - 180))) {
        // Find the exact transit by checking minute by minute around this time
        const transitCheckDate = new Date(checkDate);
        transitCheckDate.setMinutes(transitCheckDate.getMinutes() - 5);
        let bestTransit = { time: new Date(transitCheckDate), altitude, azimuth, diff: Math.abs(azimuth - 180) };
        
        for (let i = 0; i < 10; i++) {
          const checkAlt = calculateAltitude(ra, dec, transitCheckDate, MT_LEMMON_LOCATION.longitude, MT_LEMMON_LOCATION.latitude);
          const checkAz = calculateAzimuth(ra, dec, transitCheckDate, MT_LEMMON_LOCATION.longitude, MT_LEMMON_LOCATION.latitude);
          const diff = Math.abs(checkAz - 180);
          
          if (diff < bestTransit.diff) {
            bestTransit = { time: new Date(transitCheckDate), altitude: checkAlt, azimuth: checkAz, diff };
          }
          
          transitCheckDate.setMinutes(transitCheckDate.getMinutes() + 1);
        }
        
        
        transits.push(bestTransit);
        // Skip ahead to avoid finding the same transit again
        checkDate.setMinutes(checkDate.getMinutes() + 60);
      }
      
      lastAzimuth = azimuth;
      checkDate.setMinutes(checkDate.getMinutes() + 5); // Check every 5 minutes for efficiency
    }
    
    // Filter transits to only include upper culmination with positive altitude
    // For objects at high declination, they may transit near 0° (north) rather than 180° (south)
    // Upper culmination is when the object is at its highest altitude
    const upperTransits = transits.filter(t => t.altitude > 0);
    
    // If we have multiple transits with positive altitude, pick the one with highest altitude
    upperTransits.sort((a, b) => b.altitude - a.altitude);
    
    // Now pick the upper transit closest to the middle of our observation period
    const observationMidpoint = new Date(observationDate);
    observationMidpoint.setHours(observationMidpoint.getHours() + 4); // Roughly middle of night
    
    
    let bestTransit = upperTransits[0];
    if (upperTransits.length > 0) {
      for (const transit of upperTransits) {
        if (Math.abs(transit.time.getTime() - observationMidpoint.getTime()) < 
            Math.abs(bestTransit.time.getTime() - observationMidpoint.getTime())) {
          bestTransit = transit;
        }
      }
      
      transitTime = bestTransit.time;
      transitAltitude = bestTransit.altitude;
      transitAzimuth = bestTransit.azimuth;
      
    }
    
    // Find rise and set times if not circumpolar
    if (!isCircumpolar && transitTime) {
      // Look for rise time before transit
      checkDate = new Date(transitTime);
      checkDate.setHours(checkDate.getHours() - 12); // Start looking 12 hours before transit
      let prevAlt = calculateAltitude(ra, dec, checkDate, MT_LEMMON_LOCATION.longitude, MT_LEMMON_LOCATION.latitude);
      
      while (checkDate < transitTime && !riseTime) {
        const alt = calculateAltitude(ra, dec, checkDate, MT_LEMMON_LOCATION.longitude, MT_LEMMON_LOCATION.latitude);
        
        if (prevAlt < minAltitude && alt >= minAltitude) {
          riseTime = new Date(checkDate);
          riseAzimuth = calculateAzimuth(ra, dec, checkDate, MT_LEMMON_LOCATION.longitude, MT_LEMMON_LOCATION.latitude);
        }
        
        prevAlt = alt;
        checkDate.setMinutes(checkDate.getMinutes() + 1);
      }
      
      // Look for set time after transit
      checkDate = new Date(transitTime);
      checkDate.setMinutes(checkDate.getMinutes() + 30); // Start checking after transit
      prevAlt = calculateAltitude(ra, dec, checkDate, MT_LEMMON_LOCATION.longitude, MT_LEMMON_LOCATION.latitude);
      
      const searchEnd = new Date(transitTime);
      searchEnd.setHours(searchEnd.getHours() + 12); // Search up to 12 hours after transit
      
      while (checkDate < searchEnd && !setTime) {
        const alt = calculateAltitude(ra, dec, checkDate, MT_LEMMON_LOCATION.longitude, MT_LEMMON_LOCATION.latitude);
        
        if (prevAlt >= minAltitude && alt < minAltitude) {
          setTime = new Date(checkDate);
          setAzimuth = calculateAzimuth(ra, dec, checkDate, MT_LEMMON_LOCATION.longitude, MT_LEMMON_LOCATION.latitude);
        }
        
        prevAlt = alt;
        checkDate.setMinutes(checkDate.getMinutes() + 1);
      }
    }
  }
  
  return {
    riseTime,
    riseAzimuth,
    transitTime,
    transitAltitude,
    transitAzimuth,
    setTime,
    setAzimuth,
    isCircumpolar,
    neverRises
  };
}

export interface ExposureSettings {
  exposureTime: number; // seconds
  binning: string;
  filters: string[];
  notes: string;
}

// One line of a target's imaging plan: `count` frames of `exposure` seconds through `filter`
export interface FilterRow {
  filter: string;
  exposure: number; // seconds per frame
  count: number;
  binning: number; // 1 = 1x1, 2 = 2x2
}

// Mosaic grid: w columns × h rows of camera positions, centered on the target
export interface Mosaic {
  w: number;
  h: number;
}

// Per-target overrides saved in localStorage and share links
export interface CustomObjectSettings {
  priority?: number; // 1-10
  filterRows?: FilterRow[];
  mosaic?: Mosaic;
}

// Schulman 32" (f/7, 5695 mm) with SkyCenter's STX-16803 (4096 × 9 µm = 36.864 mm square sensor)
const TELESCOPE_FOCAL_LENGTH_MM = 5695;
const SENSOR_SIZE_MM = 36.864;
export const FIELD_OF_VIEW_ARCMIN =
  2 * Math.atan(SENSOR_SIZE_MM / 2 / TELESCOPE_FOCAL_LENGTH_MM) * (180 / Math.PI) * 60;
export const MOSAIC_OVERLAP = 0.1;
export const SINGLE_POSITION: Mosaic = { w: 1, h: 1 };

// Sky covered by `positions` frames in a line, each overlapping the next by MOSAIC_OVERLAP
const coverageArcmin = (positions: number): number =>
  FIELD_OF_VIEW_ARCMIN * (positions - MOSAIC_OVERLAP * (positions - 1));

export function mosaicCoverage(mosaic: Mosaic): { width: number; height: number } {
  return { width: coverageArcmin(mosaic.w), height: coverageArcmin(mosaic.h) };
}

// Smallest grid whose coverage contains the target's size
export function suggestedMosaic(size: { width: number; height: number }): Mosaic {
  const positionsFor = (arcmin: number) =>
    Math.max(1, Math.ceil((arcmin - FIELD_OF_VIEW_ARCMIN) / (FIELD_OF_VIEW_ARCMIN * (1 - MOSAIC_OVERLAP))) + 1);
  return { w: positionsFor(size.width), h: positionsFor(size.height) };
}

export const DEFAULT_FRAMES_PER_FILTER = 10;
export const DOWNLOAD_MINUTES_PER_FRAME = 0.5;

export function defaultFilterRows(exposure: ExposureSettings): FilterRow[] {
  return exposure.filters.map(filter => ({
    filter,
    exposure: exposure.exposureTime,
    count: DEFAULT_FRAMES_PER_FILTER,
    binning: 1
  }));
}

// Number of times the wheel moves while running the rows in order
function filterChanges(rows: FilterRow[]): number {
  return rows.filter((row, i) => i > 0 && row.filter !== rows[i - 1].filter).length;
}

function rowMinutes(row: FilterRow): number {
  return row.count * (row.exposure / 60 + DOWNLOAD_MINUTES_PER_FRAME);
}

// Total imaging time for a target's rows, including filter changes (setup between targets is separate)
export function sequenceMinutes(rows: FilterRow[], filterChangeMinutes: number): number {
  return rows.reduce((sum, row) => sum + rowMinutes(row), 0) + filterChanges(rows) * filterChangeMinutes;
}

// Total time for a target: the filter sequence at every mosaic position, plus moving between positions.
// Getting to the first position is covered by the setup time between targets.
export function targetMinutes(
  rows: FilterRow[],
  mosaic: Mosaic,
  filterChangeMinutes: number,
  positionOverheadMinutes: number
): number {
  const positions = mosaic.w * mosaic.h;
  return positions * sequenceMinutes(rows, filterChangeMinutes) + (positions - 1) * positionOverheadMinutes;
}

export interface FilterSegment {
  filter: string;
  position: number; // 1-based mosaic position
  startTime: Date;
  endTime: Date;
}

// When each row runs at each mosaic position, starting at `start`. All filters are finished at one
// position before moving to the next. Within a position, a filter change happens before any row
// whose filter differs from the previous row's.
export function filterSegments(
  rows: FilterRow[],
  mosaic: Mosaic,
  start: Date,
  filterChangeMinutes: number,
  positionOverheadMinutes: number
): FilterSegment[] {
  let time = start.getTime();
  const segments: FilterSegment[] = [];
  for (let position = 1; position <= mosaic.w * mosaic.h; position++) {
    if (position > 1) {
      time += positionOverheadMinutes * 60000;
    }
    rows.forEach((row, i) => {
      if (i > 0 && row.filter !== rows[i - 1].filter) {
        time += filterChangeMinutes * 60000;
      }
      const startTime = new Date(time);
      time += rowMinutes(row) * 60000;
      segments.push({ filter: row.filter, position, startTime, endTime: new Date(time) });
    });
  }
  return segments;
}

export interface PlannedObject {
  id: string;
  name: string;
  commonName?: string;
  type: string;
  priority: number;
  defaultPriority: number;
  magnitude?: number;
  size?: { width: number; height: number };
  currentAltitude: number;
  timings: ObjectTimings;
  maxAltitudeDuringWindow: number;
  exposure: ExposureSettings;
  activeFilters: string[];
  filterRows: FilterRow[];
  mosaic: Mosaic;
  isVisible: boolean;
  totalObservationTime: number; // minutes of imaging, excluding setup between targets
  observationScore: number;
  observableDuration: number;
}

export function getMagnificationRecommendation(
  size: { width: number; height: number } | undefined,
  objectType: string
): { magnification: string; eyepiece: string; fov: string; notes: string } {
  // 32" telescope at f/7 = 5695mm focal length
  
  if (!size) {
    return {
      magnification: 'Medium (100-200x)',
      eyepiece: '20-40mm',
      fov: '~0.5°',
      notes: 'Start with medium power and adjust'
    };
  }
  
  const maxDimension = Math.max(size.width, size.height); // arcminutes
  
  // For planets, use high magnification
  if (objectType === 'planet') {
    // Planets are tiny (< 1 arcmin)
    return {
      magnification: 'High (300-500x)',
      eyepiece: '8-13mm',
      fov: '~0.15°',
      notes: 'Use highest power seeing permits. Barlow recommended.'
    };
  }
  
  // For extended objects, choose based on size
  if (maxDimension > 120) {
    // Very large objects (> 2 degrees)
    return {
      magnification: 'Lowest (50-80x)',
      eyepiece: '50-80mm or 2" wide-field',
      fov: '~1.5-2°',
      notes: 'Use widest field eyepiece. May need mosaic.'
    };
  } else if (maxDimension > 60) {
    // Large objects (1-2 degrees)
    return {
      magnification: 'Low (80-120x)',
      eyepiece: '35-50mm',
      fov: '~1°',
      notes: 'Wide field recommended for full view.'
    };
  } else if (maxDimension > 20) {
    // Medium objects (20-60 arcmin)
    return {
      magnification: 'Low-Medium (120-180x)',
      eyepiece: '22-35mm',
      fov: '~0.5-0.7°',
      notes: 'Good balance of field and magnification.'
    };
  } else if (maxDimension > 5) {
    // Small-medium objects (5-20 arcmin)
    return {
      magnification: 'Medium (180-250x)',
      eyepiece: '16-22mm',
      fov: '~0.3-0.4°',
      notes: 'Standard magnification for most DSOs.'
    };
  } else {
    // Small objects (< 5 arcmin)
    return {
      magnification: 'Medium-High (250-350x)',
      eyepiece: '11-16mm',
      fov: '~0.2°',
      notes: objectType === 'planetary_nebula' 
        ? 'Use OIII filter for best contrast.' 
        : 'Higher power for detail in small objects.'
    };
  }
}

export function getExposureRecommendations(
  objectType: string
): ExposureSettings {
  // Default imaging plan per object type for the 32" f/7 Ritchey-Chrétien.
  // Exposure lengths are placeholders until SkyCenter advises for their STX-16803 CCD.
  // Default to Luminance only for minimal imaging time
  
  switch(objectType) {
    case 'galaxy':
      return {
        exposureTime: 60,
        binning: '1x1',
        filters: ['Luminance'],
        notes: 'Quick luminance capture. Add RGB/Ha filters for color.'
      };
    
    case 'nebula':
    case 'planetary_nebula':
      return {
        exposureTime: 120,
        binning: '1x1',
        filters: ['Luminance'],
        notes: 'Luminance only. Add Ha/OIII/SII for narrowband detail.'
      };
    
    case 'globular_cluster':
      return {
        exposureTime: 30,
        binning: '1x1',
        filters: ['Luminance'],
        notes: 'Short exposure to prevent core saturation.'
      };
    
    case 'open_cluster':
      return {
        exposureTime: 20,
        binning: '1x1',
        filters: ['Luminance'],
        notes: 'Quick capture for star clusters.'
      };
    
    case 'supernova_remnant':
      return {
        exposureTime: 180,
        binning: '1x1 or 2x2',
        filters: ['Luminance'],
        notes: 'Luminance baseline. Add Ha/OIII for detail.'
      };
    
    case 'planet':
      return {
        exposureTime: 0.01,
        binning: '1x1',
        filters: ['Luminance'],
        notes: 'High frame rate capture. Add filters for detail.'
      };
    
    default:
      return {
        exposureTime: 60,
        binning: '1x1',
        filters: ['Luminance'],
        notes: 'Quick luminance capture.'
      };
  }
}

export function calculateTransitTime(
  _ra: number,
  _dec: number,
  date: Date,
  longitude: number,
  latitude: number
): Date | null {
  const observer = new Astronomy.Observer(latitude, longitude, MT_LEMMON_LOCATION.elevation);
  const startTime = new Astronomy.AstroTime(date);
  
  // Find when object crosses meridian (highest point)
  const transit = Astronomy.SearchHourAngle(
    Astronomy.Body.Earth,
    observer,
    0, // hour angle = 0 at transit
    startTime,
    +1 // search forward
  );
  
  if (transit && 'time' in transit) {
    return transit.time.date;
  }
  
  return null;
}

export function isObjectVisible(
  object: DeepSkyObject,
  date: Date,
  minAltitude: number = 30
): boolean {
  const ra = raToDecimal(object.ra);
  const dec = decToDecimal(object.dec);
  
  // Check altitude at multiple times during the night
  const checkTimes = [];
  for (let hour = 22; hour <= 30; hour++) { // 10pm to 6am next day
    const checkDate = new Date(date);
    checkDate.setHours(hour % 24);
    if (hour >= 24) {
      checkDate.setDate(checkDate.getDate() + 1);
    }
    checkTimes.push(checkDate);
  }
  
  // Object is visible if it's above minimum altitude at any point
  return checkTimes.some(time => {
    const alt = calculateAltitude(ra, dec, time, MT_LEMMON_LOCATION.longitude, MT_LEMMON_LOCATION.latitude);
    return alt >= minAltitude;
  });
}

export interface MoonPhaseInfo {
  phase: string;
  emoji: string;
  illumination: number; // percent
}

const MOON_PHASES = [
  { phase: 'New Moon', emoji: '🌑' },
  { phase: 'Waxing Crescent', emoji: '🌒' },
  { phase: 'First Quarter', emoji: '🌓' },
  { phase: 'Waxing Gibbous', emoji: '🌔' },
  { phase: 'Full Moon', emoji: '🌕' },
  { phase: 'Waning Gibbous', emoji: '🌖' },
  { phase: 'Last Quarter', emoji: '🌗' },
  { phase: 'Waning Crescent', emoji: '🌘' }
];

export function getMoonPhase(date: Date): MoonPhaseInfo {
  const time = new Astronomy.AstroTime(date);
  const illumination = Astronomy.Illumination(Astronomy.Body.Moon, time);
  // Ecliptic longitude difference from the Sun: 0° = new, 90° = first quarter, 180° = full, 270° = last quarter
  const moonPhase = Astronomy.MoonPhase(time);
  const { phase, emoji } = MOON_PHASES[Math.round(moonPhase / 45) % 8];
  
  return {
    phase,
    emoji,
    illumination: illumination.phase_fraction * 100
  };
}

export interface MoonUpPeriod {
  riseTime: Date;
  setTime: Date;
}

// Periods when the Moon is above the horizon that overlap [from, to]
export function getMoonUpPeriods(from: Date, to: Date): MoonUpPeriod[] {
  const observer = new Astronomy.Observer(
    MT_LEMMON_LOCATION.latitude,
    MT_LEMMON_LOCATION.longitude,
    MT_LEMMON_LOCATION.elevation
  );
  const searchRise = (start: Date, limitDays: number) =>
    Astronomy.SearchRiseSet(Astronomy.Body.Moon, observer, +1, start, limitDays)!.date;
  const searchSet = (start: Date) =>
    Astronomy.SearchRiseSet(Astronomy.Body.Moon, observer, -1, start, 2)!.date;
  
  // If the Moon sets before it next rises, it's already up at `from`, so start from the previous rise
  const nextRise = searchRise(from, 2);
  let riseTime = searchSet(from) < nextRise ? searchRise(from, -2) : nextRise;
  
  const periods: MoonUpPeriod[] = [];
  while (riseTime < to) {
    const setTime = searchSet(riseTime);
    periods.push({ riseTime, setTime });
    riseTime = searchRise(setTime, 2);
  }
  return periods;
}

export function getPlanetPosition(planet: string, date: Date): { ra: number; dec: number; altitude: number; azimuth: number } | null {
  // Convert planet name to Body enum value
  let bodyName = planet;
  if (planet === 'Uranus') bodyName = 'Uranus';
  if (planet === 'Neptune') bodyName = 'Neptune';
  if (planet === 'Jupiter') bodyName = 'Jupiter';
  if (planet === 'Saturn') bodyName = 'Saturn';
  if (planet === 'Mars') bodyName = 'Mars';
  
  const planetBody = Astronomy.Body[bodyName as keyof typeof Astronomy.Body];
  if (planetBody === undefined) return null;
  
  const time = new Astronomy.AstroTime(date);
  const observer = new Astronomy.Observer(
    MT_LEMMON_LOCATION.latitude,
    MT_LEMMON_LOCATION.longitude,
    MT_LEMMON_LOCATION.elevation
  );
  
  const equ = Astronomy.Equator(planetBody, time, observer, false, true);
  const hor = Astronomy.Horizon(time, observer, equ.ra, equ.dec, 'normal');
  
  return {
    ra: equ.ra,
    dec: equ.dec,
    altitude: hor.altitude,
    azimuth: hor.azimuth
  };
}
export interface SunTimes {
  sunset: Date;
  astroDusk: Date; // Sun reaches -18°: astronomical dark begins
  astroDawn: Date; // Sun rises past -18°: astronomical dark ends
  sunrise: Date;
}

// Sun events for the night beginning on `date` (YYYY-MM-DD, Mt. Lemmon local time, UTC-7)
export function getSunTimes(date: string): SunTimes {
  const observer = new Astronomy.Observer(
    MT_LEMMON_LOCATION.latitude,
    MT_LEMMON_LOCATION.longitude,
    MT_LEMMON_LOCATION.elevation
  );
  const noon = new Date(`${date}T12:00:00-07:00`);
  return {
    sunset: Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, -1, noon, 1)!.date,
    astroDusk: Astronomy.SearchAltitude(Astronomy.Body.Sun, observer, -1, noon, 1, -18)!.date,
    astroDawn: Astronomy.SearchAltitude(Astronomy.Body.Sun, observer, +1, noon, 1, -18)!.date,
    sunrise: Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, noon, 1)!.date
  };
}

const toPhoenixHHMM = (date: Date): string =>
  date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Phoenix'
  });

// Observation window covering astronomical darkness, as HH:MM strings.
// Start rounds up and end rounds down so the window stays inside full dark.
export function getDarkWindow(date: string): { startTime: string; endTime: string } {
  const { astroDusk, astroDawn } = getSunTimes(date);
  const minute = 60000;
  return {
    startTime: toPhoenixHHMM(new Date(Math.ceil(astroDusk.getTime() / minute) * minute)),
    endTime: toPhoenixHHMM(new Date(Math.floor(astroDawn.getTime() / minute) * minute))
  };
}
