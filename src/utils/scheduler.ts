import { deepSkyObjects } from '../data/deepSkyObjects';
import {
  airmass,
  calculateAltitude,
  decToDecimal,
  filterSegments,
  getPlanetPosition,
  raToDecimal,
  MT_LEMMON_LOCATION,
  type FilterSegment,
  type PlannedObject
} from './astronomy';

// The Schulman's equatorial fork mount tracks within ±5.2 hours of the meridian (SkyCenter spec sheet)
export const MAX_HOUR_ANGLE_HOURS = 5.2;
const GRID_MINUTES = 5;
const SIDEREAL_HOURS_PER_SOLAR_HOUR = 1.00273791;

export interface ScheduledObservation {
  objectId: string;
  startTime: Date;
  endTime: Date;
  setupTime: number; // minutes before this target (0 for the night's first)
  imagingTime: number; // minutes
  segments: FilterSegment[];
  meanAirmass: number;
  altitudeRange: { min: number; max: number }; // degrees over the block
}

export interface ScheduleOptions {
  windowStart: Date;
  windowEnd: Date;
  minAltitude: number;
  setupTime: number; // minutes between targets
  filterChangeTime: number;
  positionOverhead: number;
}

// Altitude of a target at a moment, for both catalog objects and planets
const altitudeAt = (obj: PlannedObject, time: Date): number => {
  if (obj.type === 'planet') {
    const position = getPlanetPosition(obj.name, time)!;
    return calculateAltitude(position.ra, position.dec, time, MT_LEMMON_LOCATION.longitude, MT_LEMMON_LOCATION.latitude);
  }
  const catalog = deepSkyObjects.find(d => d.name === obj.name)!;
  return calculateAltitude(raToDecimal(catalog.ra), decToDecimal(catalog.dec), time, MT_LEMMON_LOCATION.longitude, MT_LEMMON_LOCATION.latitude);
};

// Hours from the meridian, negative while rising (east), in [-12, 12)
const hourAngleAt = (obj: PlannedObject, time: number): number => {
  const hours = ((time - obj.timings.transitTime!.getTime()) / 3600000) * SIDEREAL_HOURS_PER_SOLAR_HOUR;
  return ((hours + 12) % 24 + 24) % 24 - 12;
};

// Places each target in the free slot with the lowest average airmass (which centers it on transit when
// nothing is in the way), highest priority first. Within a priority, lower-transiting targets go first
// because they lose the most by being moved off transit. A target is only placed where every point of
// its block is above the minimum altitude and within the mount's hour-angle limit.
export function scheduleNight(
  objects: PlannedObject[],
  options: ScheduleOptions
): { scheduled: ScheduledObservation[]; unscheduledReasons: Record<string, string> } {
  const windowStart = options.windowStart.getTime();
  const windowEnd = options.windowEnd.getTime();
  const gridMs = GRID_MINUTES * 60000;
  const setupMs = options.setupTime * 60000;
  
  const grid: number[] = [];
  for (let t = windowStart; t < windowEnd; t += gridMs) grid.push(t);
  grid.push(windowEnd);
  
  const order = [...objects].sort((a, b) =>
    b.priority - a.priority
    || a.timings.transitAltitude - b.timings.transitAltitude
    || b.observationScore - a.observationScore
  );
  
  const booked: Array<{ start: number; end: number; obj: PlannedObject; meanAirmass: number; altitudeRange: { min: number; max: number } }> = [];
  const unscheduledReasons: Record<string, string> = {};
  
  for (const obj of order) {
    const altitudes = grid.map(t => altitudeAt(obj, new Date(t)));
    const usable = grid.map((t, i) =>
      altitudes[i] >= options.minAltitude && Math.abs(hourAngleAt(obj, t)) <= MAX_HOUR_ANGLE_HOURS);
    const durationMs = obj.totalObservationTime * 60000;
    
    let best: { start: number; first: number; last: number; meanAirmass: number } | null = null;
    for (let first = 0; first < grid.length && grid[first] + durationMs <= windowEnd; first++) {
      const start = grid[first];
      const end = start + durationMs;
      // Last grid point at or after the block's end
      const last = grid.findIndex(t => t >= end);
      const blockIndexes = Array.from({ length: last - first + 1 }, (_, k) => first + k);
      if (!blockIndexes.every(i => usable[i])) continue;
      if (!booked.every(b => start >= b.end + setupMs || end + setupMs <= b.start)) continue;
      const meanAirmass = blockIndexes.reduce((sum, i) => sum + airmass(altitudes[i]), 0) / blockIndexes.length;
      if (!best || meanAirmass < best.meanAirmass) {
        best = { start, first, last, meanAirmass };
      }
    }
    
    if (best) {
      const blockAltitudes = altitudes.slice(best.first, best.last + 1);
      booked.push({
        start: best.start,
        end: best.start + durationMs,
        obj,
        meanAirmass: best.meanAirmass,
        altitudeRange: { min: Math.min(...blockAltitudes), max: Math.max(...blockAltitudes) }
      });
      continue;
    }
    
    // Longest stretch tonight when the target is high enough and within the mount's reach
    let longestRun = 0;
    let run = 0;
    usable.forEach(ok => {
      run = ok ? run + 1 : 0;
      longestRun = Math.max(longestRun, run);
    });
    const availableMinutes = Math.max(0, (longestRun - 1) * GRID_MINUTES);
    const needed = Math.round(obj.totalObservationTime);
    unscheduledReasons[obj.id] = needed > availableMinutes
      ? `Too long to fit: needs ${needed} min, but it's above ${options.minAltitude}° and within the mount's ±${MAX_HOUR_ANGLE_HOURS} h reach for at most ${availableMinutes} min in a row tonight`
      : `No free slot: higher-priority targets fill the time it's up (needs ${needed} min)`;
  }
  
  const scheduled = booked
    .sort((a, b) => a.start - b.start)
    .map((b, i) => ({
      objectId: b.obj.id,
      startTime: new Date(b.start),
      endTime: new Date(b.end),
      setupTime: i === 0 ? 0 : options.setupTime,
      imagingTime: b.obj.totalObservationTime,
      // Planets are video captures with no per-frame plan to break down
      segments: b.obj.type === 'planet'
        ? []
        : filterSegments(b.obj.filterRows, b.obj.mosaic, new Date(b.start), options.filterChangeTime, options.positionOverhead),
      meanAirmass: b.meanAirmass,
      altitudeRange: b.altitudeRange
    }));
  
  return { scheduled, unscheduledReasons };
}
