import { deepSkyObjects } from '../data/deepSkyObjects';
import {
  airmass,
  calculateAltitude,
  decToDecimal,
  filterSegments,
  targetMinutes,
  raToDecimal,
  MT_LEMMON_LOCATION,
  type FilterRow,
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
  imagingTime: number; // minutes, including gap-fill frames
  rows: FilterRow[]; // the plan's rows with any gap-fill frames added
  extraFrames: number; // frames added to fill gaps (per mosaic position)
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

// Altitude of a target at a moment
const altitudeAt = (obj: PlannedObject, time: Date): number => {
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
  
  const booked: Array<{
    start: number;
    end: number;
    obj: PlannedObject;
    rows: FilterRow[];
    altitudes: number[];
    usable: boolean[];
  }> = [];
  const unscheduledReasons: Record<string, string> = {};
  
  // Grid points covering [start, end]: from the last point at or before start to the first at or after end
  const spanIndexes = (start: number, end: number): number[] => {
    const first = Math.floor((start - windowStart) / gridMs);
    const last = grid.findIndex(t => t >= end);
    return Array.from({ length: last - first + 1 }, (_, k) => first + k);
  };
  
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
      booked.push({ start: best.start, end: best.start + durationMs, obj, rows: obj.filterRows, altitudes, usable });
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
  
  // Fill gaps: repeatedly add the one extra frame, across all targets, whose added time has the lowest
  // airmass, at the start or end of its block. Frames go to the plan's rows in proportion to their counts,
  // and each row grows to at most twice its planned count.
  for (;;) {
    let bestExtension: { block: typeof booked[number]; rows: FilterRow[]; start: number; end: number; cost: number } | null = null;
    for (const block of booked) {
      const plan = block.obj.filterRows;
      // Row that's furthest behind its share of extra frames
      const candidates = block.rows
        .map((row, i) => ({ i, share: (row.count - plan[i].count + 1) / plan[i].count }))
        .filter(({ i }) => block.rows[i].count < plan[i].count * 2)
        .sort((a, b) => a.share - b.share);
      if (candidates.length === 0) continue;
      const rows = block.rows.map((row, i) => (i === candidates[0].i ? { ...row, count: row.count + 1 } : row));
      const addedMs = targetMinutes(rows, block.obj.mosaic, options.filterChangeTime, options.positionOverhead) * 60000
        - (block.end - block.start);
      const others = booked.filter(b => b !== block);
      for (const [start, end, edge] of [
        [block.start - addedMs, block.end, block.start - addedMs],
        [block.start, block.end + addedMs, block.end + addedMs]
      ]) {
        if (start < windowStart || end > windowEnd) continue;
        if (!others.every(b => start >= b.end + setupMs || end + setupMs <= b.start)) continue;
        if (!spanIndexes(start, end).every(i => block.usable[i])) continue;
        const cost = airmass(block.altitudes[Math.round((edge - windowStart) / gridMs)]);
        if (!bestExtension || cost < bestExtension.cost) {
          bestExtension = { block, rows, start, end, cost };
        }
      }
    }
    if (!bestExtension) break;
    Object.assign(bestExtension.block, { rows: bestExtension.rows, start: bestExtension.start, end: bestExtension.end });
  }
  
  const scheduled = booked
    .sort((a, b) => a.start - b.start)
    .map((b, i) => {
      const indexes = spanIndexes(b.start, b.end);
      const blockAltitudes = indexes.map(k => b.altitudes[k]);
      return {
        objectId: b.obj.id,
        startTime: new Date(b.start),
        endTime: new Date(b.end),
        setupTime: i === 0 ? 0 : options.setupTime,
        imagingTime: (b.end - b.start) / 60000,
        rows: b.rows,
        extraFrames: b.rows.reduce((sum, row, k) => sum + row.count - b.obj.filterRows[k].count, 0),
        segments: filterSegments(b.rows, b.obj.mosaic, new Date(b.start), options.filterChangeTime, options.positionOverhead),
        meanAirmass: blockAltitudes.reduce((sum, alt) => sum + airmass(alt), 0) / blockAltitudes.length,
        altitudeRange: { min: Math.min(...blockAltitudes), max: Math.max(...blockAltitudes) }
      };
    });
  
  return { scheduled, unscheduledReasons };
}
