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
        let transitCheckDate = new Date(checkDate);
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
  gain: string;
  binning: string;
  filters: string[];
  notes: string;
}

export function getMagnificationRecommendation(
  size: { width: number; height: number } | undefined,
  objectType: string
): { magnification: string; eyepiece: string; fov: string; notes: string } {
  // 32" telescope with f/5 = 4064mm focal length
  // const telescopeFocalLength = 4064; // mm (kept for reference)
  
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
  objectType: string,
  _magnitude?: number
): ExposureSettings {
  // Recommendations for 32" f/5 reflector telescope
  // Assuming modern CMOS camera with cooling
  // Default to Luminance only for minimal imaging time
  
  switch(objectType) {
    case 'galaxy':
      return {
        exposureTime: 60,
        gain: 'Unity (100)',
        binning: '1x1',
        filters: ['Luminance'],
        notes: 'Quick luminance capture. Add RGB/Ha filters for color.'
      };
    
    case 'nebula':
    case 'planetary_nebula':
      return {
        exposureTime: 120,
        gain: 'Unity (100)',
        binning: '1x1',
        filters: ['Luminance'],
        notes: 'Luminance only. Add Ha/OIII/SII for narrowband detail.'
      };
    
    case 'globular_cluster':
      return {
        exposureTime: 30,
        gain: 'Unity (100)',
        binning: '1x1',
        filters: ['Luminance'],
        notes: 'Short exposure to prevent core saturation.'
      };
    
    case 'open_cluster':
      return {
        exposureTime: 20,
        gain: 'Unity (100)',
        binning: '1x1',
        filters: ['Luminance'],
        notes: 'Quick capture for star clusters.'
      };
    
    case 'supernova_remnant':
      return {
        exposureTime: 180,
        gain: 'Unity (100)',
        binning: '1x1 or 2x2',
        filters: ['Luminance'],
        notes: 'Luminance baseline. Add Ha/OIII for detail.'
      };
    
    case 'planet':
      return {
        exposureTime: 0.01,
        gain: 'High (200-400)',
        binning: '1x1',
        filters: ['Luminance'],
        notes: 'High frame rate capture. Add filters for detail.'
      };
    
    default:
      return {
        exposureTime: 60,
        gain: 'Unity (100)',
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

export function getMoonPhase(date: Date): { phase: string; illumination: number } {
  const time = new Astronomy.AstroTime(date);
  const illumination = Astronomy.Illumination(Astronomy.Body.Moon, time);
  const moonPhase = Astronomy.MoonPhase(time);
  
  let phaseStr = '';
  if (moonPhase < 7) phaseStr = 'New Moon';
  else if (moonPhase < 14) phaseStr = 'First Quarter';
  else if (moonPhase < 21) phaseStr = 'Full Moon';
  else phaseStr = 'Last Quarter';
  
  return {
    phase: phaseStr,
    illumination: illumination.phase_fraction * 100
  };
}

export function getPlanetPosition(planet: string, date: Date): { ra: number; dec: number; altitude: number; azimuth: number } | null {
  // Convert planet name to Body enum value
  let bodyName = planet;
  if (planet === 'Uranus') bodyName = 'Uranus';
  if (planet === 'Neptune') bodyName = 'Neptune';
  if (planet === 'Jupiter') bodyName = 'Jupiter';
  if (planet === 'Saturn') bodyName = 'Saturn';
  if (planet === 'Mars') bodyName = 'Mars';
  
  const planetBody = (Astronomy.Body as any)[bodyName];
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