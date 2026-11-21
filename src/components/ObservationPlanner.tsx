import React, { useState, useMemo, useEffect } from 'react';
import { deepSkyObjects } from '../data/deepSkyObjects';
import { solarSystemObjects } from '../data/solarSystemObjects';
import { 
  getMoonPhase, 
  calculateAltitude,
  raToDecimal,
  decToDecimal,
  MT_LEMMON_LOCATION,
  getPlanetPosition,
  calculateObjectTimings,
  getExposureRecommendations,
  getSunTimes,
  getDarkWindow,
  defaultFilterRows,
  targetMinutes,
  filterSegments,
  SINGLE_POSITION,
  type PlannedObject,
  type CustomObjectSettings,
  type FilterSegment
} from '../utils/astronomy';
import { SimpleGanttChart } from './SimpleGanttChart';
import { FilterControls } from './FilterControls';
import { ObservationTable } from './ObservationTable';
import { encodeShare, decodeShare } from '../utils/shareCode';

const DEFAULT_OBSERVATION_DATE = '2027-01-09';
const DEFAULT_FILTER_CHANGE_MINUTES = 1;
const DEFAULT_POSITION_OVERHEAD_MINUTES = 2;
export const ObservationPlanner: React.FC = () => {
  // Check URL params first, then localStorage, then defaults
  const loadSettingWithUrlParam = <T,>(key: string, urlParam: string, defaultValue: T): T => {
    // Check URL params first
    const urlParams = new URLSearchParams(window.location.search);
    const urlValue = urlParams.get(urlParam);
    if (urlValue !== null) {
      try {
        if (typeof defaultValue === 'number') {
          return Number(urlValue) as T;
        }
        return urlValue as T;
      } catch {
        // Fall through to localStorage
      }
    }
    
    // Then check localStorage
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      try {
        return JSON.parse(stored);
      } catch {
        return defaultValue;
      }
    }
    return defaultValue;
  };

  // Load settings from URL params if present
  const loadSettingsFromUrl = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const settings = urlParams.get('s');
    if (settings) {
      try {
        return decodeShare(settings);
      } catch (error) {
        console.error('Failed to parse URL settings:', error);
      }
    }
    return null;
  };

  const urlSettings = loadSettingsFromUrl();

  const [selectedDate, setSelectedDate] = useState<string>(() => 
    urlSettings?.selectedDate ?? loadSettingWithUrlParam('observationDate', 'date', DEFAULT_OBSERVATION_DATE)
  );
  const [startTime, setStartTime] = useState<string>(() => 
    urlSettings?.startTime ?? loadSettingWithUrlParam('startTime', 'start', getDarkWindow(selectedDate).startTime)
  );
  const [endTime, setEndTime] = useState<string>(() => 
    urlSettings?.endTime ?? loadSettingWithUrlParam('endTime', 'end', getDarkWindow(selectedDate).endTime)
  );
  const [minAltitude, setMinAltitude] = useState<number>(() =>
    urlSettings?.minAltitude ?? loadSettingWithUrlParam('minAltitude', 'alt', 15)
  );
  const [setupTime, setSetupTime] = useState<number>(() =>
    urlSettings?.setupTime ?? loadSettingWithUrlParam('setupTime', 'setup', 10)
  );
  const [isNightMode, setIsNightMode] = useState<boolean>(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [disabledObjects, setDisabledObjects] = useState<Set<string>>(() => {
    if (urlSettings) {
      return new Set(urlSettings.hiddenObjects);
    }
    const stored = localStorage.getItem('disabledObjects');
    return stored ? new Set<string>(JSON.parse(stored)) : new Set<string>();
  });
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importValue, setImportValue] = useState('');
  const [exportValue, setExportValue] = useState('');
  const [shareableLink, setShareableLink] = useState('');
  const [copiedButton, setCopiedButton] = useState<'code' | 'link' | 'list' | null>(null);

  const [filterChangeTime, setFilterChangeTime] = useState<number>(() =>
    urlSettings?.filterChangeTime ?? loadSettingWithUrlParam('filterChangeTime', 'fc', DEFAULT_FILTER_CHANGE_MINUTES)
  );

  const [positionOverhead, setPositionOverhead] = useState<number>(() =>
    urlSettings?.positionOverhead ?? loadSettingWithUrlParam('positionOverhead', 'po', DEFAULT_POSITION_OVERHEAD_MINUTES)
  );

  const [customSettings, setCustomSettings] = useState<Record<string, CustomObjectSettings>>(() => {
    if (urlSettings?.customSettings) {
      return urlSettings.customSettings;
    }
    const stored = localStorage.getItem('customObjectSettingsV2');
    return stored ? JSON.parse(stored) : {};
  });

  // Remove the share code from the URL once read, including codes that couldn't be loaded
  // (e.g. from an older version), so they aren't parsed again on every render
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('s');
    window.history.replaceState({}, '', url.toString());
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem('observationDate', JSON.stringify(selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    localStorage.setItem('startTime', JSON.stringify(startTime));
  }, [startTime]);

  useEffect(() => {
    localStorage.setItem('endTime', JSON.stringify(endTime));
  }, [endTime]);

  useEffect(() => {
    localStorage.setItem('minAltitude', JSON.stringify(minAltitude));
  }, [minAltitude]);

  useEffect(() => {
    localStorage.setItem('setupTime', JSON.stringify(setupTime));
  }, [setupTime]);

  useEffect(() => {
    localStorage.setItem('disabledObjects', JSON.stringify(Array.from(disabledObjects)));
  }, [disabledObjects]);

  useEffect(() => {
    localStorage.setItem('filterChangeTime', JSON.stringify(filterChangeTime));
  }, [filterChangeTime]);

  useEffect(() => {
    localStorage.setItem('positionOverhead', JSON.stringify(positionOverhead));
  }, [positionOverhead]);

  useEffect(() => {
    localStorage.setItem('customObjectSettingsV2', JSON.stringify(customSettings));
  }, [customSettings]);

  useEffect(() => {
    if (isNightMode) {
      document.body.classList.add('night-mode');
    } else {
      document.body.classList.remove('night-mode');
    }
  }, [isNightMode]);

  const observationDate = useMemo(() => {
    try {
      // Create date in MST/Arizona time (UTC-7, no DST)
      // We append the timezone offset to ensure consistent interpretation
      const dateTimeString = `${selectedDate}T${startTime}:00-07:00`;
      const date = new Date(dateTimeString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        const fallback = new Date();
        fallback.setHours(22, 0, 0, 0); // Default to 22:00
        return fallback;
      }
      
      return date;
    } catch {
      const fallback = new Date();
      fallback.setHours(22, 0, 0, 0);
      return fallback;
    }
  }, [selectedDate, startTime]);
  
  const observationEndDate = useMemo(() => {
    try {
      // Handle end time, accounting for next-day rollover
      const [hours] = endTime.split(':').map(Number);
      const endDateString = hours < 12 
        ? `${selectedDate}T${endTime}:00-07:00` // Next day (after midnight)
        : `${selectedDate}T${endTime}:00-07:00`; // Same day
      
      const date = new Date(endDateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        const fallback = new Date(observationDate);
        fallback.setDate(fallback.getDate() + 1);
        fallback.setHours(6, 0, 0, 0); // Default to 06:00 next day
        return fallback;
      }
      
      if (hours < 12) {
        // Add one day if end time is after midnight
        date.setDate(date.getDate() + 1);
      }
      
      return date;
    } catch {
      const fallback = new Date(observationDate);
      fallback.setDate(fallback.getDate() + 1);
      fallback.setHours(6, 0, 0, 0);
      return fallback;
    }
  }, [selectedDate, endTime, observationDate]);
  
  const moonInfo = useMemo(() => getMoonPhase(observationDate), [observationDate]);
  const sunTimes = useMemo(() => getSunTimes(selectedDate), [selectedDate]);
  const darkWindow = useMemo(() => getDarkWindow(selectedDate), [selectedDate]);
  const isSyncedToDark = startTime === darkWindow.startTime && endTime === darkWindow.endTime;

  const syncToDarkWindow = (date: string) => {
    const darkWindow = getDarkWindow(date);
    setStartTime(darkWindow.startTime);
    setEndTime(darkWindow.endTime);
  };

  const changeDate = (date: string) => {
    setSelectedDate(date);
    syncToDarkWindow(date);
  };
  
  const allObjects = useMemo((): PlannedObject[] => {
    const deepSky = deepSkyObjects.map(obj => {
      const ra = raToDecimal(obj.ra);
      const dec = decToDecimal(obj.dec);
      const currentAlt = calculateAltitude(ra, dec, observationDate, MT_LEMMON_LOCATION.longitude, MT_LEMMON_LOCATION.latitude);
      const timings = calculateObjectTimings(ra, dec, observationDate, minAltitude);
      
      // Calculate max altitude during observation window
      let maxAltitudeDuringWindow = 0;
      const checkInterval = 15; // Check every 15 minutes
      const totalMinutes = (observationEndDate.getTime() - observationDate.getTime()) / 60000;
      const steps = Math.ceil(totalMinutes / checkInterval);
      
      for (let i = 0; i <= steps; i++) {
        const checkTime = new Date(observationDate.getTime() + (i * checkInterval * 60000));
        const alt = calculateAltitude(ra, dec, checkTime, MT_LEMMON_LOCATION.longitude, MT_LEMMON_LOCATION.latitude);
        if (alt > maxAltitudeDuringWindow) {
          maxAltitudeDuringWindow = alt;
        }
      }
      
      const exposure = getExposureRecommendations(obj.type);
      
      // Use custom settings if available
      const objectCustomSettings = customSettings[obj.name];
      const filterRows = objectCustomSettings?.filterRows ?? defaultFilterRows(exposure);
      const activeFilters = [...new Set(filterRows.map(row => row.filter))];
      const mosaic = objectCustomSettings?.mosaic ?? SINGLE_POSITION;
      const totalObservationTime = targetMinutes(filterRows, mosaic, filterChangeTime, positionOverhead);
      
      // Check if object is visible during our observation window
      let isVisible = false;
      if (!timings.neverRises && timings.transitAltitude >= minAltitude) {
        // Object can rise above minimum altitude, but is it visible during our window?
        if (timings.isCircumpolar) {
          // Always visible
          isVisible = true;
        } else if (timings.riseTime && timings.setTime) {
          // Check if the object is above minAltitude during our observation window
          const obsStart = observationDate.getTime();
          const obsEnd = observationEndDate.getTime();
          const riseTime = timings.riseTime.getTime();
          const setTime = timings.setTime.getTime();
          
          // Object is visible if it's up during any part of our window
          isVisible = (riseTime <= obsEnd && setTime >= obsStart);
        }
      }
      
      
      const priorityMap: { [key: string]: number } = {
        'must_have': 10,
        'high': 8,
        'medium': 5,
        'low': 3
      };
      const defaultPriority = priorityMap[obj.priority] || 5;
      const priorityValue = objectCustomSettings?.priority || defaultPriority;
      
      let observationScore = 0;
      if (isVisible && timings.transitTime) {
        const minutesFromTransit = Math.abs(timings.transitTime.getTime() - observationDate.getTime()) / (1000 * 60);
        const timeScore = Math.max(0, 100 - (minutesFromTransit / 60) * 10);
        const altScore = Math.min(100, (timings.transitAltitude / 90) * 100);
        const flexibilityScore = 100 - Math.min(80, totalObservationTime * 0.5);
        
        observationScore = ((timeScore * 0.4 + altScore * 0.3 + flexibilityScore * 0.3) * (priorityValue / 5));
      }
      
      const observableDuration = timings.setTime && timings.riseTime 
        ? (timings.setTime.getTime() - timings.riseTime.getTime()) / 60000
        : 0;
      
      return {
        id: obj.name,
        name: obj.name,
        commonName: obj.commonName,
        type: obj.type,
        priority: priorityValue,
        defaultPriority,
        magnitude: obj.magnitude,
        size: obj.size,
        currentAltitude: currentAlt,
        timings,
        maxAltitudeDuringWindow,
        exposure,
        activeFilters,
        filterRows,
        mosaic,
        isVisible,
        totalObservationTime,
        observationScore,
        observableDuration
      };
    });

    const planets = solarSystemObjects.filter(obj => obj.type === 'planet').map(planet => {
      const position = getPlanetPosition(planet.name, observationDate);
      
      if (position) {
        const timings = calculateObjectTimings(position.ra, position.dec, observationDate, minAltitude);
        
        // Calculate max altitude during observation window for planets
        let maxAltitudeDuringWindow = 0;
        const checkInterval = 15; // Check every 15 minutes
        const totalMinutes = (observationEndDate.getTime() - observationDate.getTime()) / 60000;
        const steps = Math.ceil(totalMinutes / checkInterval);
        
        for (let i = 0; i <= steps; i++) {
          const checkTime = new Date(observationDate.getTime() + (i * checkInterval * 60000));
          const planetPosAtTime = getPlanetPosition(planet.name, checkTime);
          if (planetPosAtTime) {
            const alt = calculateAltitude(planetPosAtTime.ra, planetPosAtTime.dec, checkTime, MT_LEMMON_LOCATION.longitude, MT_LEMMON_LOCATION.latitude);
            if (alt > maxAltitudeDuringWindow) {
              maxAltitudeDuringWindow = alt;
            }
          }
        }
        const exposure = getExposureRecommendations('planet');
        
        // Use custom settings if available
        const objectCustomSettings = customSettings[planet.name];
        const filterRows = objectCustomSettings?.filterRows ?? defaultFilterRows(exposure);
        const activeFilters = [...new Set(filterRows.map(row => row.filter))];
        
        // Planets are captured as video: a fixed capture time per filter
        const captureTime = 10;
        const totalObservationTime = captureTime * filterRows.length;
        
        const isVisible = timings.transitAltitude >= minAltitude;
        
        const priorityMap: { [key: string]: number } = {
          'must_have': 10,
          'high': 8,
          'medium': 5,
          'low': 3
        };
        const defaultPriority = priorityMap[planet.priority] || 5;
        const priorityValue = objectCustomSettings?.priority || defaultPriority;
        
        let observationScore = 0;
        if (isVisible && timings.transitTime) {
          const minutesFromTransit = Math.abs(timings.transitTime.getTime() - observationDate.getTime()) / (1000 * 60);
          const timeScore = Math.max(0, 100 - (minutesFromTransit / 60) * 10);
          const altScore = Math.min(100, (timings.transitAltitude / 90) * 100);
          const flexibilityScore = 100 - Math.min(80, totalObservationTime * 0.5);
          
          observationScore = ((timeScore * 0.4 + altScore * 0.3 + flexibilityScore * 0.3) * (priorityValue / 5));
        }
        
        const observableDuration = timings.setTime && timings.riseTime 
          ? (timings.setTime.getTime() - timings.riseTime.getTime()) / 60000
          : 0;
        
        return {
          id: planet.name,
          name: planet.name,
          type: 'planet',
          priority: priorityValue,
          defaultPriority,
          size: undefined,
          currentAltitude: position.altitude,
          timings,
          maxAltitudeDuringWindow,
          exposure,
          activeFilters,
          filterRows,
          mosaic: SINGLE_POSITION,
          isVisible,
          totalObservationTime,
          observationScore,
          observableDuration
        };
      }
      return null;
    }).filter((item): item is NonNullable<typeof item> => item !== null);

    const combined = [...deepSky, ...planets];
    
    return combined.sort((a, b) => {
      // First, separate visible from non-visible
      if (a.isVisible !== b.isVisible) {
        return a.isVisible ? -1 : 1;
      }
      
      // Sort by transit time (earlier transits first)
      const aTransitTime = a.timings.transitTime?.getTime() || Number.MAX_SAFE_INTEGER;
      const bTransitTime = b.timings.transitTime?.getTime() || Number.MAX_SAFE_INTEGER;
      
      return aTransitTime - bTransitTime;
    });
  }, [observationDate, observationEndDate, minAltitude, customSettings, filterChangeTime, positionOverhead]);

  const visibleObjects = allObjects.filter(obj => obj.isVisible && !disabledObjects.has(obj.id));

  // Schedule observations based on priority and availability
  const scheduledObservations = useMemo(() => {
    const scheduled: Array<{
      objectId: string;
      startTime: Date;
      endTime: Date;
      setupTime: number; // minutes
      imagingTime: number; // minutes
      segments: FilterSegment[];
    }> = [];
    
    const windowEnd = observationEndDate.getTime();
    const stepMs = 5 * 60 * 1000;
    const setupMs = setupTime * 60 * 1000;

    const altitudeAt = (obj: PlannedObject, time: Date): number | null => {
      const ra = obj.type === 'planet' 
        ? (obj.timings.transitTime ? getPlanetPosition(obj.name, time)?.ra : 0)
        : raToDecimal(deepSkyObjects.find(d => d.name === obj.name)?.ra || {hours: 0, minutes: 0, seconds: 0});
      const dec = obj.type === 'planet'
        ? (obj.timings.transitTime ? getPlanetPosition(obj.name, time)?.dec : 0)
        : decToDecimal(deepSkyObjects.find(d => d.name === obj.name)?.dec || {degrees: 0, minutes: 0, seconds: 0});
      if (!ra || !dec) return null;
      return calculateAltitude(ra, dec, time, MT_LEMMON_LOCATION.longitude, MT_LEMMON_LOCATION.latitude);
    };

    const imagingMinutes = (obj: PlannedObject) => obj.totalObservationTime;

    // Fits if it's above the minimum altitude at both ends of the imaging run and finishes inside the window
    const fitsAt = (obj: PlannedObject, start: Date): boolean => {
      const end = new Date(start.getTime() + imagingMinutes(obj) * 60 * 1000);
      if (end.getTime() > windowEnd) return false;
      const startAltitude = altitudeAt(obj, start);
      const endAltitude = altitudeAt(obj, end);
      return startAltitude !== null && endAltitude !== null
        && startAltitude >= minAltitude && endAltitude >= minAltitude;
    };

    // Highest priority first, then highest score
    const candidates = [...visibleObjects].sort((a, b) =>
      b.priority - a.priority || b.observationScore - a.observationScore
    );
    const unscheduled = new Set(candidates.map(obj => obj.id));

    // Walk forward through the night: at each slot take the best object that fits,
    // otherwise wait a few minutes and try again
    let currentTime = observationDate.getTime();
    let isFirstObject = true;
    while (unscheduled.size > 0) {
      const slotStart = new Date(isFirstObject ? currentTime : currentTime + setupMs);
      if (slotStart.getTime() >= windowEnd) break;

      const obj = candidates.find(o => unscheduled.has(o.id) && fitsAt(o, slotStart));
      if (!obj) {
        currentTime += stepMs;
        continue;
      }

      const imagingTimeOnly = imagingMinutes(obj);
      const endTime = new Date(slotStart.getTime() + imagingTimeOnly * 60 * 1000);
      scheduled.push({
        objectId: obj.id,
        startTime: slotStart,
        endTime,
        setupTime: isFirstObject ? 0 : setupTime, // No setup for first object, it's at start of session
        imagingTime: imagingTimeOnly,
        // Planets are video captures with no per-frame plan to break down
        segments: obj.type === 'planet' ? [] : filterSegments(obj.filterRows, obj.mosaic, slotStart, filterChangeTime, positionOverhead)
      });
      unscheduled.delete(obj.id);
      currentTime = endTime.getTime();
      isFirstObject = false;
    }
    
    return scheduled;
  }, [visibleObjects, observationDate, observationEndDate, minAltitude, setupTime, filterChangeTime, positionOverhead]);

  // Why each visible, enabled target missed the schedule
  const unscheduledReasons = useMemo(() => {
    const windowStart = observationDate.getTime();
    const windowEnd = observationEndDate.getTime();
    const reasons: Record<string, string> = {};
    for (const obj of visibleObjects) {
      if (scheduledObservations.some(s => s.objectId === obj.id)) continue;
      const { riseTime, setTime, isCircumpolar } = obj.timings;
      const availableMinutes = isCircumpolar || !riseTime || !setTime
        ? (windowEnd - windowStart) / 60000
        : (Math.min(setTime.getTime(), windowEnd) - Math.max(riseTime.getTime(), windowStart)) / 60000;
      const needed = Math.round(obj.totalObservationTime);
      reasons[obj.id] = needed > availableMinutes
        ? `Too long to fit: needs ${needed} min, but it's above ${minAltitude}° for only ${Math.max(0, Math.round(availableMinutes))} min tonight`
        : `No free slot: other targets fill the time it's up (needs ${needed} min)`;
    }
    return reasons;
  }, [visibleObjects, scheduledObservations, observationDate, observationEndDate, minAltitude]);

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const toggleObjectEnabled = (id: string) => {
    const newDisabled = new Set(disabledObjects);
    if (newDisabled.has(id)) {
      newDisabled.delete(id);
    } else {
      newDisabled.add(id);
    }
    setDisabledObjects(newDisabled);
  };

  const updateObjectSettings = (objectId: string, settings: CustomObjectSettings) => {
    setCustomSettings(prev => ({
      ...prev,
      [objectId]: settings
    }));
  };

  const handleExport = () => {
    const compressed = encodeShare({
      selectedDate,
      startTime,
      endTime,
      minAltitude,
      setupTime,
      filterChangeTime,
      positionOverhead,
      hiddenObjects: Array.from(disabledObjects),
      customSettings
    });
    
    // Add prefix to identify it as our settings
    const exportString = `MTLEMMON:${compressed}`;
    setExportValue(exportString);
    
    // Generate shareable link
    const url = new URL(window.location.href);
    url.searchParams.set('s', compressed);
    setShareableLink(url.toString());
    
    setShowExportModal(true);
  };

  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  const handleImport = () => {
    try {
      const importString = importValue.trim();
      
      // Check prefix
      if (!importString.startsWith('MTLEMMON:')) {
        setImportError('Invalid import string. Make sure you copied the entire code.');
        setTimeout(() => setImportError(null), 3000);
        return;
      }
      
      // Decode
      const compressed = importString.slice(9); // Remove 'MTLEMMON:' prefix
      const settings = decodeShare(compressed);
      
      if (!settings) {
        setImportError('This code is from an older version of the planner. Export a new one.');
        setTimeout(() => setImportError(null), 3000);
        return;
      }
      
      // Apply settings
      setSelectedDate(settings.selectedDate);
      setStartTime(settings.startTime);
      setEndTime(settings.endTime);
      setMinAltitude(settings.minAltitude);
      setSetupTime(settings.setupTime);
      setFilterChangeTime(settings.filterChangeTime);
      setPositionOverhead(settings.positionOverhead);
      setDisabledObjects(new Set(settings.hiddenObjects));
      setCustomSettings(settings.customSettings);
      
      setImportSuccess(true);
      setTimeout(() => {
        setShowImportModal(false);
        setImportValue('');
        setImportSuccess(false);
      }, 1500);
    } catch (error) {
      console.error('Failed to import settings:', error);
      setImportError('Failed to import settings. Please check the code and try again.');
      setTimeout(() => setImportError(null), 3000);
    }
  };

  const resetSettings = () => {
    // Clear all localStorage
    localStorage.removeItem('observationDate');
    localStorage.removeItem('startTime');
    localStorage.removeItem('endTime');
    localStorage.removeItem('minAltitude');
    localStorage.removeItem('setupTime');
    localStorage.removeItem('disabledObjects');
    localStorage.removeItem('filterChangeTime');
    localStorage.removeItem('positionOverhead');
    localStorage.removeItem('customObjectSettingsV2');
    
    // Reset to defaults
    setSelectedDate(DEFAULT_OBSERVATION_DATE);
    syncToDarkWindow(DEFAULT_OBSERVATION_DATE);
    setMinAltitude(15);
    setSetupTime(10);
    setFilterChangeTime(DEFAULT_FILTER_CHANGE_MINUTES);
    setPositionOverhead(DEFAULT_POSITION_OVERHEAD_MINUTES);
    setDisabledObjects(new Set());
    setCustomSettings({});
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 overflow-x-hidden">
      <header className="bg-black/50 backdrop-blur-sm border-b border-gray-800">
        <div className="container-content">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="text-xl sm:text-2xl">🔭</div>
              <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                <span className="sm:hidden">Mt. Lemmon 32"</span>
                <span className="hidden sm:inline">Mt. Lemmon Sky Center - 32" Telescope</span>
              </h1>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              <button
                onClick={handleExport}
                className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 rounded-lg transition-all bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700"
                title="Export settings to shareable code"
              >
                <span className="text-sm sm:text-base">📤</span>
                <span className="text-xs sm:text-sm font-medium hidden sm:inline">Export</span>
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 rounded-lg transition-all bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700"
                title="Import settings from code"
              >
                <span className="text-sm sm:text-base">📥</span>
                <span className="text-xs sm:text-sm font-medium hidden sm:inline">Import</span>
              </button>
              <button
                onClick={resetSettings}
                className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 rounded-lg transition-all bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700"
                title="Reset all settings to defaults"
              >
                <span className="text-sm sm:text-base">↺</span>
                <span className="text-xs sm:text-sm font-medium hidden sm:inline">Reset</span>
              </button>
              <button
                onClick={() => setIsNightMode(!isNightMode)}
                className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 rounded-lg transition-all ${
                  isNightMode 
                    ? 'bg-red-900/30 text-red-400 border border-red-800 hover:bg-red-900/50' 
                    : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
                }`}
              >
                <span className="text-sm sm:text-base">{isNightMode ? '🔴' : '🌙'}</span>
                <span className="text-xs sm:text-sm font-medium">
                  <span className="hidden sm:inline">{isNightMode ? 'Night Vision' : 'Normal Mode'}</span>
                  <span className="sm:hidden">{isNightMode ? 'Night' : 'Normal'}</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="main-content">
        {/* Gantt Chart - Full width on mobile */}
        {visibleObjects.length > 0 && (
          <div className="gantt-section">
            <SimpleGanttChart
              observations={visibleObjects}
              moonPhase={moonInfo}
              startTime={observationDate}
              endTime={observationEndDate}
              sunTimes={sunTimes}
              isSyncedToDark={isSyncedToDark}
              onSyncToDark={() => syncToDarkWindow(selectedDate)}
              expandedRows={expandedRows}
              scheduledObservations={scheduledObservations}
            />
          </div>
        )}

        {/* Filter Controls */}
        <div className="container-content">
          <FilterControls
          observationDate={selectedDate}
          startTime={startTime}
          endTime={endTime}
          minAltitude={minAltitude}
          setupTime={setupTime}
          filterChangeTime={filterChangeTime}
          positionOverhead={positionOverhead}
          onDateChange={changeDate}
          onStartTimeChange={setStartTime}
          onEndTimeChange={setEndTime}
          onMinAltitudeChange={setMinAltitude}
          onSetupTimeChange={setSetupTime}
          onFilterChangeTimeChange={setFilterChangeTime}
          onPositionOverheadChange={setPositionOverhead}
          />
        </div>

        {/* Conditions Info */}
        <div className="container-content">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-gray-900 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-2xl">📍</span>
              <h3 className="font-semibold">Location</h3>
            </div>
            <p className="text-sm text-gray-400">Mt. Lemmon Sky Center</p>
            <p className="text-xs text-gray-500">32.44°N, 110.79°W • 2,791m</p>
            <p className="text-xs text-gray-500">MST (UTC-7, no DST)</p>
          </div>
          
          <div className="bg-gray-900 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-2xl">🌙</span>
              <h3 className="font-semibold">Moon Phase</h3>
            </div>
            <p className="text-sm text-gray-400">{moonInfo.phase}</p>
            <p className="text-xs text-gray-500">{moonInfo.illumination.toFixed(0)}% illuminated</p>
          </div>
          
          <div className="bg-gray-900 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-2xl">✨</span>
              <h3 className="font-semibold">Observable</h3>
            </div>
            <p className="text-2xl font-bold text-blue-400">{visibleObjects.length}</p>
            <p className="text-xs text-gray-500">
              of {allObjects.length} objects visible
            </p>
          </div>
          </div>
        </div>

        {/* Observation Table */}
        <div className="container-content">
          <ObservationTable
          observations={allObjects}
          expandedRows={expandedRows}
          scheduledObservations={scheduledObservations}
          unscheduledReasons={unscheduledReasons}
          disabledObjects={disabledObjects}
          customSettings={customSettings}
          onToggleExpanded={toggleExpanded}
          onToggleEnabled={toggleObjectEnabled}
          onUpdateSettings={updateObjectSettings}
        />
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-lg p-6 max-w-3xl w-full">
            <h2 className="text-xl font-bold mb-4">Export Settings</h2>
            
            {/* Export Code Section */}
            <div className="mb-6">
              <p className="text-sm text-gray-400 mb-2">
                Import Code (paste this into the import dialog):
              </p>
              <textarea
                value={exportValue}
                readOnly
                className="w-full h-24 p-3 bg-gray-800 border border-gray-700 rounded text-sm font-mono"
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(exportValue);
                  setCopiedButton('code');
                  setTimeout(() => {
                    setCopiedButton(null);
                    setShowExportModal(false);
                    setShareableLink('');
                  }, 1500);
                }}
                className={`mt-2 px-3 py-1 text-sm rounded transition-all ${
                  copiedButton === 'code' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {copiedButton === 'code' ? 'Copied ✓' : 'Copy Import Code'}
              </button>
            </div>
            
            {/* Observation List Section */}
            <div className="mb-4">
              <p className="text-sm text-gray-400 mb-2">
                Observation Plan (text format for sharing):
              </p>
              <textarea
                value={(() => {
                  const formatTime = (date: Date) => 
                    date.toLocaleTimeString('en-US', { 
                      hour12: false,
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'America/Phoenix'
                    });
                  
                  if (scheduledObservations.length === 0) {
                    return 'No observations scheduled';
                  }
                  
                  let list = `Observation Plan for ${selectedDate}\n`;
                  list += `${formatTime(observationDate)} - ${formatTime(observationEndDate)} MST\n\n`;
                  
                  scheduledObservations.forEach((sched, idx) => {
                    const obj = visibleObjects.find(o => o.id === sched.objectId);
                    if (obj) {
                      const name = obj.commonName ? `${obj.name} ${obj.commonName}` : obj.name;
                      list += `${idx + 1}. ${formatTime(sched.startTime)} - ${formatTime(sched.endTime)}: ${name} (${Math.round(sched.imagingTime)}m)\n`;
                    }
                  });
                  
                  return list;
                })()}
                readOnly
                className="w-full h-32 p-3 bg-gray-800 border border-gray-700 rounded text-sm font-mono"
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
              <button
                onClick={() => {
                  const formatTime = (date: Date) => 
                    date.toLocaleTimeString('en-US', { 
                      hour12: false,
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'America/Phoenix'
                    });
                  
                  let list = `Observation Plan for ${selectedDate}\n`;
                  list += `${formatTime(observationDate)} - ${formatTime(observationEndDate)} MST\n\n`;
                  
                  scheduledObservations.forEach((sched, idx) => {
                    const obj = visibleObjects.find(o => o.id === sched.objectId);
                    if (obj) {
                      const name = obj.commonName ? `${obj.name} ${obj.commonName}` : obj.name;
                      list += `${idx + 1}. ${formatTime(sched.startTime)} - ${formatTime(sched.endTime)}: ${name} (${Math.round(sched.imagingTime)}m)\n`;
                    }
                  });
                  
                  navigator.clipboard.writeText(list);
                  setCopiedButton('list');
                  setTimeout(() => {
                    setCopiedButton(null);
                  }, 1500);
                }}
                className={`mt-2 px-3 py-1 text-sm rounded transition-all ${
                  copiedButton === 'list' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {copiedButton === 'list' ? 'Copied ✓' : 'Copy Observation List'}
              </button>
            </div>
            
            {/* Shareable Link Section */}
            <div className="mb-4">
              <p className="text-sm text-gray-400 mb-2">
                Shareable Link (opens directly with your settings):
              </p>
              <textarea
                value={shareableLink}
                readOnly
                className="w-full h-16 p-3 bg-gray-800 border border-gray-700 rounded text-sm font-mono"
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareableLink);
                  setCopiedButton('link');
                  setTimeout(() => {
                    setCopiedButton(null);
                    setShowExportModal(false);
                    setShareableLink('');
                  }, 1500);
                }}
                className={`mt-2 px-3 py-1 text-sm rounded transition-all ${
                  copiedButton === 'link' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {copiedButton === 'link' ? 'Copied ✓' : 'Copy Link'}
              </button>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setShareableLink('');
                  setCopiedButton(null);
                }}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full">
            <h2 className="text-xl font-bold mb-4">Import Settings</h2>
            <p className="text-sm text-gray-400 mb-4">
              Paste a settings code below to import:
            </p>
            <textarea
              value={importValue}
              onChange={(e) => setImportValue(e.target.value)}
              placeholder="Paste MTLEMMON:... code here"
              className="w-full h-32 p-3 bg-gray-800 border border-gray-700 rounded text-sm font-mono placeholder-gray-500"
              autoFocus
            />
            {importError && (
              <div className="mt-2 p-2 bg-red-900/30 border border-red-700 rounded text-red-400 text-sm">
                {importError}
              </div>
            )}
            {importSuccess && (
              <div className="mt-2 p-2 bg-green-900/30 border border-green-700 rounded text-green-400 text-sm">
                Settings imported successfully! ✓
              </div>
            )}
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={handleImport}
                disabled={importSuccess}
                className={`px-4 py-2 rounded transition-all ${
                  importSuccess
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {importSuccess ? 'Imported ✓' : 'Import'}
              </button>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportValue('');
                  setImportError(null);
                  setImportSuccess(false);
                }}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};