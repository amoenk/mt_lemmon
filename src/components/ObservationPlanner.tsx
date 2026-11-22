import React, { useState, useMemo, useEffect } from 'react';
import { deepSkyObjects } from '../data/deepSkyObjects';
import { 
  getMoonPhase, 
  calculateAltitude,
  raToDecimal,
  decToDecimal,
  MT_LEMMON_LOCATION,
  calculateObjectTimings,
  getExposureRecommendations,
  getSunTimes,
  getDarkWindow,
  nextMoonlessNight,
  defaultFilterRows,
  targetMinutes,
  SINGLE_POSITION,
  DEFAULT_MOSAIC_OVERLAP_PERCENT,
  suggestedMosaic,
  mosaicCoverage,
  type PlannedObject,
  type CustomObjectSettings
} from '../utils/astronomy';
import { SimpleGanttChart } from './SimpleGanttChart';
import { SettingsDialog } from './SettingsDialog';
import { ObservationTable } from './ObservationTable';
import { encodeShare, decodeShare } from '../utils/shareCode';
import { scheduleNight } from '../utils/scheduler';

const DEFAULT_FILTER_CHANGE_MINUTES = 1;
const DEFAULT_POSITION_OVERHEAD_MINUTES = 2;
const DESKTOP_QUERY = '(min-width: 1024px)';
const DEFAULT_TARGETS_PANEL_WIDTH = 440;
const MIN_TARGETS_PANEL_WIDTH = 320;
const MAX_TARGETS_PANEL_FRACTION = 0.6;
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

  // Evergreen default: the next moonless night from today
  const [defaultDate] = useState(() => nextMoonlessNight(new Date()));

  const [selectedDate, setSelectedDate] = useState<string>(() => 
    urlSettings?.selectedDate ?? loadSettingWithUrlParam('observationDate', 'date', defaultDate)
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
  // Which targets are turned off. null means automatic: enable the highest-priority targets that fit the
  // night (recomputed as the night changes) until the user edits a checkbox, imports, or opens a link.
  const [manualDisabledObjects, setManualDisabledObjects] = useState<Set<string> | null>(() => {
    if (urlSettings) {
      return new Set(urlSettings.hiddenObjects);
    }
    const stored = localStorage.getItem('disabledObjects');
    return stored ? new Set<string>(JSON.parse(stored)) : null;
  });
  // The night a manual selection was made for, to flag when the date has since changed
  const [targetsChosenFor, setTargetsChosenFor] = useState<string | null>(() =>
    urlSettings ? urlSettings.selectedDate : JSON.parse(localStorage.getItem('targetsChosenFor') ?? 'null')
  );
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

  const [mosaicOverlap, setMosaicOverlap] = useState<number>(() =>
    urlSettings?.mosaicOverlap ?? loadSettingWithUrlParam('mosaicOverlap', 'overlap', DEFAULT_MOSAIC_OVERLAP_PERCENT)
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
    if (manualDisabledObjects) {
      localStorage.setItem('disabledObjects', JSON.stringify(Array.from(manualDisabledObjects)));
    } else {
      localStorage.removeItem('disabledObjects');
    }
  }, [manualDisabledObjects]);

  useEffect(() => {
    localStorage.setItem('targetsChosenFor', JSON.stringify(targetsChosenFor));
  }, [targetsChosenFor]);

  useEffect(() => {
    localStorage.setItem('filterChangeTime', JSON.stringify(filterChangeTime));
  }, [filterChangeTime]);

  useEffect(() => {
    localStorage.setItem('positionOverhead', JSON.stringify(positionOverhead));
  }, [positionOverhead]);

  useEffect(() => {
    localStorage.setItem('mosaicOverlap', JSON.stringify(mosaicOverlap));
  }, [mosaicOverlap]);

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
      // Default grid: the smallest that covers the catalog size at the current overlap
      const overlap = mosaicOverlap / 100;
      const suggestedGrid = obj.size ? suggestedMosaic(obj.size, overlap) : SINGLE_POSITION;
      const mosaic = objectCustomSettings?.mosaic ?? suggestedGrid;
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
        suggestedMosaic: suggestedGrid,
        mosaicCoverage: mosaicCoverage(mosaic, overlap),
        isVisible,
        totalObservationTime,
        observationScore,
        observableDuration
      };
    });

    return deepSky.sort((a, b) => {
      // First, separate visible from non-visible
      if (a.isVisible !== b.isVisible) {
        return a.isVisible ? -1 : 1;
      }
      
      // Sort by transit time (earlier transits first)
      const aTransitTime = a.timings.transitTime?.getTime() || Number.MAX_SAFE_INTEGER;
      const bTransitTime = b.timings.transitTime?.getTime() || Number.MAX_SAFE_INTEGER;
      
      return aTransitTime - bTransitTime;
    });
  }, [observationDate, observationEndDate, minAltitude, customSettings, filterChangeTime, positionOverhead, mosaicOverlap]);

  const scheduleOptions = useMemo(() => ({
    windowStart: observationDate,
    windowEnd: observationEndDate,
    minAltitude,
    setupTime,
    filterChangeTime,
    positionOverhead
  }), [observationDate, observationEndDate, minAltitude, setupTime, filterChangeTime, positionOverhead]);

  // Automatic pick: schedule every visible target by priority and turn off the ones that don't fit
  const disabledObjects = useMemo(() => {
    if (manualDisabledObjects) return manualDisabledObjects;
    const { scheduled } = scheduleNight(allObjects.filter(obj => obj.isVisible), scheduleOptions);
    const fits = new Set(scheduled.map(s => s.objectId));
    return new Set(allObjects.filter(obj => !fits.has(obj.id)).map(obj => obj.id));
  }, [manualDisabledObjects, allObjects, scheduleOptions]);

  const visibleObjects = useMemo(
    () => allObjects.filter(obj => obj.isVisible && !disabledObjects.has(obj.id)),
    [allObjects, disabledObjects]
  );

  // Each target in its lowest-airmass free slot, highest priority first
  const { scheduled: scheduledObservations, unscheduledReasons } = useMemo(
    () => scheduleNight(visibleObjects, scheduleOptions),
    [visibleObjects, scheduleOptions]
  );

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  // Editing a checkbox turns the current selection (automatic or not) into the user's own
  const toggleObjectEnabled = (id: string) => {
    const newDisabled = new Set(disabledObjects);
    if (newDisabled.has(id)) {
      newDisabled.delete(id);
    } else {
      newDisabled.add(id);
    }
    setManualDisabledObjects(newDisabled);
    setTargetsChosenFor(selectedDate);
  };

  // Back to automatic: the highest-priority targets that fit the current night
  const pickBestTargets = () => {
    setManualDisabledObjects(null);
    setTargetsChosenFor(null);
  };

  // Layout: settings dialog and the targets panel (right column on desktop, full-screen overlay below 1024px)
  const [showSettings, setShowSettings] = useState(false);
  const [mobileTargetsOpen, setMobileTargetsOpen] = useState(false);
  const [targetsPanelOpen, setTargetsPanelOpen] = useState<boolean>(() =>
    JSON.parse(localStorage.getItem('targetsPanelOpen') ?? 'true')
  );
  const [targetsPanelWidth, setTargetsPanelWidth] = useState<number>(() =>
    JSON.parse(localStorage.getItem('targetsPanelWidth') ?? String(DEFAULT_TARGETS_PANEL_WIDTH))
  );
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setIsDesktop(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    localStorage.setItem('targetsPanelOpen', JSON.stringify(targetsPanelOpen));
  }, [targetsPanelOpen]);

  useEffect(() => {
    localStorage.setItem('targetsPanelWidth', JSON.stringify(targetsPanelWidth));
  }, [targetsPanelWidth]);

  // Drag the handle to resize: the panel sits at the right edge, so its width is the distance from the pointer to the edge
  const startPanelResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const onMove = (move: PointerEvent) => {
      const maxWidth = window.innerWidth * MAX_TARGETS_PANEL_FRACTION;
      setTargetsPanelWidth(Math.round(Math.min(maxWidth, Math.max(MIN_TARGETS_PANEL_WIDTH, window.innerWidth - move.clientX))));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
    };
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
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
      mosaicOverlap,
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
      setMosaicOverlap(settings.mosaicOverlap);
      setManualDisabledObjects(new Set(settings.hiddenObjects));
      setTargetsChosenFor(settings.selectedDate);
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
    localStorage.removeItem('targetsChosenFor');
    localStorage.removeItem('filterChangeTime');
    localStorage.removeItem('positionOverhead');
    localStorage.removeItem('mosaicOverlap');
    localStorage.removeItem('customObjectSettingsV2');
    
    // Reset to defaults
    setSelectedDate(defaultDate);
    syncToDarkWindow(defaultDate);
    setMinAltitude(15);
    setSetupTime(10);
    setFilterChangeTime(DEFAULT_FILTER_CHANGE_MINUTES);
    setPositionOverhead(DEFAULT_POSITION_OVERHEAD_MINUTES);
    setMosaicOverlap(DEFAULT_MOSAIC_OVERLAP_PERCENT);
    pickBestTargets();
    setCustomSettings({});
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 overflow-hidden">
      <header className="shrink-0 bg-black/50 backdrop-blur-sm border-b border-gray-800">
        <div className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="text-xl sm:text-2xl">🔭</div>
              <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                <span className="sm:hidden">Mt. Lemmon 32"</span>
                <span className="hidden sm:inline">Mt. Lemmon Sky Center - 32" Telescope</span>
              </h1>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <button
                onClick={() => (isDesktop ? setTargetsPanelOpen(!targetsPanelOpen) : setMobileTargetsOpen(true))}
                className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 rounded-lg transition-all bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 ${isDesktop && targetsPanelOpen ? 'ring-1 ring-blue-500/60' : ''}`}
                title={isDesktop ? (targetsPanelOpen ? 'Hide the targets panel' : 'Show the targets panel') : 'Show targets'}
              >
                <span className="text-sm sm:text-base">📋</span>
                <span className="text-xs sm:text-sm font-medium">Targets ({visibleObjects.length})</span>
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 rounded-lg transition-all bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700"
                title="Date, times and settings"
              >
                <span className="text-sm sm:text-base">⚙</span>
                <span className="text-xs sm:text-sm font-medium hidden sm:inline">Settings</span>
              </button>
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

      <div className="flex flex-1 min-h-0">
        {/* Main column: timeline and conditions, scrolls on its own */}
        <main className="flex-1 min-w-0 overflow-y-auto py-4 sm:py-6 space-y-6">
          {visibleObjects.length > 0 ? (
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
          ) : (
            <div className="px-4 sm:px-6 lg:px-8 text-gray-400">
              No targets are visible and enabled for this night. Open Targets to enable some, or Settings to change the date or window.
            </div>
          )}

          {/* Conditions Info */}
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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
        </main>

        {/* Drag handle to resize the targets panel (desktop) */}
        {isDesktop && targetsPanelOpen && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize targets panel"
            onPointerDown={startPanelResize}
            className="w-1.5 shrink-0 cursor-col-resize bg-gray-800 hover:bg-blue-500/60 active:bg-blue-500"
          />
        )}

        {/* Targets panel: right-side column on desktop, full-screen overlay on smaller screens */}
        {(isDesktop ? targetsPanelOpen : mobileTargetsOpen) && (
          <aside
            className={isDesktop
              ? 'shrink-0 flex flex-col min-h-0 bg-gray-950'
              : 'fixed inset-0 z-40 flex flex-col bg-gray-950'}
            style={isDesktop ? { width: targetsPanelWidth } : undefined}
          >
            <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-800">
              {isDesktop ? (
                <h2 className="font-bold">Targets <span className="font-normal text-gray-400">· {visibleObjects.length} of {allObjects.length} enabled and visible</span></h2>
              ) : (
                <button onClick={() => setMobileTargetsOpen(false)} className="text-blue-400 hover:text-blue-300 font-medium">
                  ← Back
                </button>
              )}
              {isDesktop ? (
                <button
                  onClick={() => setTargetsPanelOpen(false)}
                  className="text-gray-400 hover:text-white text-sm px-2"
                  title="Hide the targets panel"
                >
                  Hide →
                </button>
              ) : (
                <h2 className="font-bold">Targets <span className="font-normal text-gray-400">· {visibleObjects.length}</span></h2>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
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
          </aside>
        )}
      </div>

      {showSettings && (
        <SettingsDialog
          observationDate={selectedDate}
          startTime={startTime}
          endTime={endTime}
          minAltitude={minAltitude}
          setupTime={setupTime}
          filterChangeTime={filterChangeTime}
          positionOverhead={positionOverhead}
          mosaicOverlap={mosaicOverlap}
          onDateChange={changeDate}
          onStartTimeChange={setStartTime}
          onEndTimeChange={setEndTime}
          onMinAltitudeChange={setMinAltitude}
          onSetupTimeChange={setSetupTime}
          onFilterChangeTimeChange={setFilterChangeTime}
          onPositionOverheadChange={setPositionOverhead}
          onMosaicOverlapChange={setMosaicOverlap}
          isSyncedToDark={isSyncedToDark}
          onSyncToDark={() => syncToDarkWindow(selectedDate)}
          onReset={resetSettings}
          targetsAreAutomatic={manualDisabledObjects === null}
          targetsChosenFor={targetsChosenFor}
          onPickBestTargets={pickBestTargets}
          onClose={() => setShowSettings(false)}
        />
      )}

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