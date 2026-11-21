import React, { useState, useEffect } from 'react';
import { getMoonUpPeriods, type MoonPhaseInfo, type PlannedObject, type SunTimes } from '../utils/astronomy';
import type { ScheduledObservation } from '../utils/scheduler';
import { FILTER_COLORS } from '../utils/filterColors';

interface SimpleGanttChartProps {
  observations: PlannedObject[];
  moonPhase: MoonPhaseInfo;
  startTime: Date;
  endTime: Date;
  sunTimes: SunTimes;
  isSyncedToDark: boolean;
  onSyncToDark: () => void;
  expandedRows: Set<string>;
  scheduledObservations?: ScheduledObservation[];
}

export const SimpleGanttChart: React.FC<SimpleGanttChartProps> = ({
  observations,
  moonPhase,
  startTime,
  endTime,
  sunTimes,
  isSyncedToDark,
  onSyncToDark,
  scheduledObservations = []
}) => {
  // Responsive hook to detect mobile
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Extend the view - much less on mobile for better visibility
  const extensionHours = isMobile ? 0.25 : 1.5; // 15 minutes on mobile, 1.5 hours on desktop
  
  // Always include sunset and sunrise (plus padding) so the sun markers are visible
  const sunPaddingMs = (isMobile ? 10 : 30) * 60 * 1000;
  const extendedStartTime = new Date(Math.min(
    startTime.getTime() - extensionHours * 60 * 60 * 1000,
    sunTimes.sunset.getTime() - sunPaddingMs
  ));
  const extendedEndTime = new Date(Math.max(
    endTime.getTime() + extensionHours * 60 * 60 * 1000,
    sunTimes.sunrise.getTime() + sunPaddingMs
  ));
  
  // Calculate total duration in minutes (for extended view)
  const totalMinutes = (extendedEndTime.getTime() - extendedStartTime.getTime()) / 60000;
  
  // Generate hour markers
  const hours: Date[] = [];
  const currentHour = new Date(extendedStartTime);
  currentHour.setMinutes(0, 0, 0);
  
  while (currentHour <= extendedEndTime) {
    hours.push(new Date(currentHour));
    currentHour.setHours(currentHour.getHours() + 1);
  }
  
  // Calculate position as percentage (based on extended view)
  const getPosition = (date: Date): number => {
    const minutes = (date.getTime() - extendedStartTime.getTime()) / 60000;
    return (minutes / totalMinutes) * 100;
  };
  
  // Get positions for the actual observation window boundaries
  const observationStartPercent = getPosition(startTime);
  const observationEndPercent = getPosition(endTime);
  
  // Format time for display
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Phoenix'
    });
  };
  
  // Moon rows: always shown in the top row, brighter the fuller it is
  const moonPeriods = getMoonUpPeriods(extendedStartTime, extendedEndTime);
  const moonUpDuringWindow = moonPeriods.some(p => p.riseTime < endTime && p.setTime > startTime);
  const moonLabel = `${moonPhase.emoji} ${moonPhase.phase} · ${moonPhase.illumination.toFixed(0)}%`;
  const moonOpacity = 0.15 + 0.85 * (moonPhase.illumination / 100);
  const moonLabelClass = moonPhase.illumination > 70
    ? 'text-slate-900'
    : 'text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]';
  
  // Night-wide airmass, weighted by imaging time
  const totalImaging = scheduledObservations.reduce((sum, s) => sum + s.imagingTime, 0);
  const nightAirmass = totalImaging > 0
    ? scheduledObservations.reduce((sum, s) => sum + s.meanAirmass * s.imagingTime, 0) / totalImaging
    : null;
  
  // Get priority color
  const getPriorityColor = (priority: number): string => {
    if (priority >= 9) return 'bg-red-600 border-red-700';
    if (priority >= 7) return 'bg-orange-600 border-orange-700';
    if (priority >= 5) return 'bg-yellow-600 border-yellow-700';
    return 'bg-green-600 border-green-700';
  };
  
  // Process observations into timeline blocks
  const timelineBlocks = observations.map(obj => {
    const timings = obj.timings;
    
    // Use actual rise and set times for the full bar extent
    let blockStart: Date;
    let blockEnd: Date;
    
    if (timings.isCircumpolar) {
      // For circumpolar objects, show the full observation window
      blockStart = startTime;
      blockEnd = endTime;
    } else if (timings.riseTime && timings.setTime) {
      // Use actual rise and set times
      blockStart = timings.riseTime;
      blockEnd = timings.setTime;
    } else {
      // Fallback: use observation duration around transit
      const duration = obj.totalObservationTime || 60;
      const transitMs = timings.transitTime ? timings.transitTime.getTime() : startTime.getTime();
      const halfDuration = (duration * 60 * 1000) / 2;
      blockStart = new Date(transitMs - halfDuration);
      blockEnd = new Date(transitMs + halfDuration);
    }
    
    // Calculate which parts are within the observation window
    const visibleStart = new Date(Math.max(blockStart.getTime(), startTime.getTime()));
    const visibleEnd = new Date(Math.min(blockEnd.getTime(), endTime.getTime()));
    
    // Calculate percentages for the full block
    const startPercent = getPosition(blockStart);
    const endPercent = getPosition(blockEnd);
    
    // Calculate percentages for the visible portion
    const visibleStartPercent = getPosition(visibleStart);
    const visibleEndPercent = getPosition(visibleEnd);
    
    return {
      ...obj,
      blockStart,
      blockEnd,
      visibleStart,
      visibleEnd,
      startPercent,
      endPercent,
      widthPercent: endPercent - startPercent,
      visibleStartPercent,
      visibleEndPercent,
      visibleWidthPercent: visibleEndPercent - visibleStartPercent,
      transit: timings.transitTime,
      extendsBeforeWindow: blockStart < startTime,
      extendsAfterWindow: blockEnd > endTime
    };
  });
  
  // Sort by scheduled observation order first, then unscheduled by score
  const sortedBlocks = [...timelineBlocks].sort((a, b) => {
    const aScheduled = scheduledObservations.findIndex(s => s.objectId === a.id);
    const bScheduled = scheduledObservations.findIndex(s => s.objectId === b.id);
    
    // Both scheduled: sort by scheduled order
    if (aScheduled !== -1 && bScheduled !== -1) {
      return aScheduled - bScheduled;
    }
    
    // One scheduled, one not: scheduled comes first
    if (aScheduled !== -1) return -1;
    if (bScheduled !== -1) return 1;
    
    // Both unscheduled: sort by score (higher scores first)
    if (a.observationScore !== b.observationScore) {
      return (b.observationScore || 0) - (a.observationScore || 0);
    }
    // Then by start time for equal scores
    return a.blockStart.getTime() - b.blockStart.getTime();
  });
  
  // Assign rows to avoid overlaps
  const rows: typeof timelineBlocks[] = [];
  sortedBlocks.forEach(block => {
    let placed = false;
    for (let i = 0; i < rows.length; i++) {
      const lastInRow = rows[i][rows[i].length - 1];
      if (lastInRow.blockEnd <= block.blockStart) {
        rows[i].push(block);
        placed = true;
        break;
      }
    }
    if (!placed) {
      rows.push([block]);
    }
  });
  
  return (
    <div className="bg-gray-900 p-0 sm:p-6 rounded-lg">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 sm:mb-4 gap-1 sm:gap-0 px-3 sm:px-0 pt-3 sm:pt-0">
        <h3 className="text-lg sm:text-xl font-bold">Observation Timeline</h3>
        <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400">
          <span>{formatTime(startTime)} - {formatTime(endTime)} MST</span>
          {nightAirmass !== null && (
            <span title="Average airmass across all scheduled imaging, weighted by imaging time (1.0 = straight up)">
              · avg airmass {nightAirmass.toFixed(2)}
            </span>
          )}
          {!isSyncedToDark && <button
            type="button"
            onClick={onSyncToDark}
            className="px-2 py-0.5 rounded border border-indigo-500/60 text-indigo-300 hover:bg-indigo-500/20 text-xs"
            title={`Set the window to astronomical dark: ${formatTime(sunTimes.astroDusk)} - ${formatTime(sunTimes.astroDawn)}`}
          >
            🌌 Sync to dark
          </button>}
        </div>
        <div className="sm:hidden text-xs">
          <span className="text-amber-300">☀↓ {formatTime(sunTimes.sunset)}</span>
          <span className="text-gray-500"> · </span>
          <span className="text-indigo-300">Dark {formatTime(sunTimes.astroDusk)}–{formatTime(sunTimes.astroDawn)}</span>
          <span className="text-gray-500"> · </span>
          <span className="text-amber-300">☀↑ {formatTime(sunTimes.sunrise)}</span>
        </div>
      </div>
      
      {/* SVG definitions for gradients */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="observability-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="20%" stopColor="currentColor" stopOpacity="0.8" />
            <stop offset="50%" stopColor="currentColor" stopOpacity="1" />
            <stop offset="80%" stopColor="currentColor" stopOpacity="0.8" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.3" />
          </linearGradient>
        </defs>
      </svg>
      
      <>
          <div className="bg-gray-800 rounded-none sm:rounded-lg p-0 sm:p-4 overflow-hidden">
            {/* Timeline header with hour markers */}
            <div className="relative h-6 sm:h-8 border-b border-gray-700 mb-2 sm:mb-4 px-2 sm:px-4 pt-2 sm:pt-0">
              {/* Hour markers: every hour on desktop, every 3 hours on mobile */}
              {hours.map((hour, i) => {
                const position = getPosition(hour);
                if (position < 0 || position > 100) return null;
                // Labels are centered on the hour, so skip ones that would hang off the edge on mobile
                const showOnMobile = Number(formatTime(hour).slice(0, 2)) % 3 === 0 && position > 6 && position < 94;
                
                return (
                  <div
                    key={i}
                    className={`absolute text-xs text-gray-400 ${showOnMobile ? '' : 'hidden sm:block'}`}
                    style={{ 
                      left: `${position}%`,
                      transform: 'translateX(-50%)'
                    }}
                  >
                    {formatTime(hour)}
                  </div>
                );
              })}
            </div>
            
            {/* Timeline rows */}
            <div className="relative sm:-mx-4 sm:px-4 pb-2 sm:pb-0" style={{ minHeight: `${(Math.max(rows.length, 1) + 1) * 50 + 20}px` }}>
              {/* Daylight and twilight shading: amber at the sun events, fading to clear at astronomical dark */}
              <div
                className="absolute top-0 bottom-0 pointer-events-none bg-amber-400/15"
                style={{ left: '0', width: `${getPosition(sunTimes.sunset)}%` }}
              />
              <div
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{
                  left: `${getPosition(sunTimes.sunset)}%`,
                  width: `${getPosition(sunTimes.astroDusk) - getPosition(sunTimes.sunset)}%`,
                  background: 'linear-gradient(to right, rgba(251,146,60,0.35), rgba(99,102,241,0.25) 50%, rgba(99,102,241,0))'
                }}
              />
              <div
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{
                  left: `${getPosition(sunTimes.astroDawn)}%`,
                  width: `${getPosition(sunTimes.sunrise) - getPosition(sunTimes.astroDawn)}%`,
                  background: 'linear-gradient(to left, rgba(251,146,60,0.35), rgba(99,102,241,0.25) 50%, rgba(99,102,241,0))'
                }}
              />
              <div
                className="absolute top-0 bottom-0 pointer-events-none bg-amber-400/15"
                style={{ left: `${getPosition(sunTimes.sunrise)}%`, right: '0' }}
              />
              
              {/* Dimmed regions outside observation window */}
              <div
                className="absolute top-0 bottom-0 bg-gray-900/50 pointer-events-none z-20"
                style={{ 
                  left: '0',
                  width: `${observationStartPercent}%`
                }}
              />
              <div
                className="absolute top-0 bottom-0 bg-gray-900/50 pointer-events-none z-20"
                style={{ 
                  left: `${observationEndPercent}%`,
                  right: '0'
                }}
              />
              
              {/* Observation window boundary lines */}
              <div
                className="absolute top-0 bottom-0 border-l-2 border-blue-500/50 z-20"
                style={{ left: `${observationStartPercent}%` }}
              />
              <div
                className="absolute top-0 bottom-0 border-r-2 border-blue-500/50 z-20"
                style={{ left: `${observationEndPercent}%` }}
              />
              
              {/* Sunset/sunrise and astronomical dark markers */}
              {[
                { time: sunTimes.sunset, label: `☀↓ ${formatTime(sunTimes.sunset)}`, title: 'Sunset', lineClass: 'border-l-2 border-amber-400/80', labelClass: 'text-amber-300', labelSide: 'right' },
                { time: sunTimes.astroDusk, label: `Dark ${formatTime(sunTimes.astroDusk)}`, title: 'Astronomical dark begins (Sun 18° below horizon)', lineClass: 'border-l-2 border-dashed border-indigo-400/70', labelClass: 'text-indigo-300', labelSide: 'right' },
                { time: sunTimes.astroDawn, label: `Dark ${formatTime(sunTimes.astroDawn)}`, title: 'Astronomical dark ends (Sun 18° below horizon)', lineClass: 'border-l-2 border-dashed border-indigo-400/70', labelClass: 'text-indigo-300', labelSide: 'left' },
                { time: sunTimes.sunrise, label: `☀↑ ${formatTime(sunTimes.sunrise)}`, title: 'Sunrise', lineClass: 'border-l-2 border-amber-400/80', labelClass: 'text-amber-300', labelSide: 'left' }
              ].map(marker => (
                <div
                  key={marker.title}
                  className="absolute top-0 bottom-0 z-20"
                  style={{ left: `${getPosition(marker.time)}%` }}
                  title={`${marker.title}: ${formatTime(marker.time)} MST`}
                >
                  <div className={`absolute top-0 bottom-0 ${marker.lineClass}`} />
                  <div
                    className={`absolute bottom-0 px-1 text-xs font-semibold whitespace-nowrap hidden sm:block ${marker.labelClass}`}
                    style={{ transform: marker.labelSide === 'left' ? 'translateX(-100%)' : 'translateX(2px)' }}
                  >
                    {marker.label}
                  </div>
                </div>
              ))}
              
              {/* Hour grid lines */}
              {hours.map((hour, i) => {
                const position = getPosition(hour);
                if (position < 0 || position > 100) return null;
                
                return (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-l border-gray-700 opacity-30"
                    style={{ left: `${position}%` }}
                  />
                );
              })}
              
              {/* Moon row */}
              {moonPeriods.map(period => {
                const startPercent = getPosition(period.riseTime);
                const endPercent = getPosition(period.setTime);
                
                return (
                  <div
                    key={period.riseTime.getTime()}
                    className="absolute"
                    style={{
                      left: `${startPercent}%`,
                      width: `${endPercent - startPercent}%`,
                      top: '0',
                      height: '40px'
                    }}
                    title={`Moon
Rise: ${formatTime(period.riseTime)}
Set: ${formatTime(period.setTime)}
${moonPhase.phase}, ${moonPhase.illumination.toFixed(0)}% illuminated`}
                  >
                    <div
                      className="absolute inset-0 rounded-md bg-slate-200 border border-slate-300"
                      style={{ opacity: moonOpacity }}
                    />
                  </div>
                );
              })}
              {moonPeriods.map(period => (
                <div
                  key={`label-${period.riseTime.getTime()}`}
                  className={`absolute px-2 h-10 flex items-center text-xs font-bold whitespace-nowrap pointer-events-none z-30 ${moonLabelClass}`}
                  style={{
                    // Keep the label inside the observation window when the Moon is up during it
                    left: `${Math.max(getPosition(period.riseTime), period.setTime > startTime ? observationStartPercent : 0)}%`,
                    top: '0'
                  }}
                >
                  {moonLabel}
                </div>
              ))}
              {!moonUpDuringWindow && (
                <div
                  className="absolute px-2 h-10 flex items-center text-xs text-gray-400 whitespace-nowrap"
                  style={{ left: `${observationStartPercent}%`, top: '0' }}
                >
                  {moonLabel} • Below horizon all night
                </div>
              )}
              
              {observations.length === 0 && (
                <div className="absolute left-0 right-0 text-center text-sm text-gray-500" style={{ top: '60px' }}>
                  No observations scheduled in this time window
                </div>
              )}
              
              {/* Observation blocks */}
              {rows.map((row, rowIndex) => (
                <div key={rowIndex}>
                  {row.map(block => {
                    const scheduled = scheduledObservations.find(s => s.objectId === block.id);
                    
                    return (
                      <div
                        key={block.id}
                        className="absolute"
                        style={{
                          left: `${block.startPercent}%`,
                          width: `${block.widthPercent}%`,
                          top: `${(rowIndex + 1) * 50}px`,
                          height: '40px'
                        }}
                      >
                        {/* Full bar with gradient showing observability decline */}
                        <div 
                          className={`absolute inset-0 rounded-md ${getPriorityColor(block.priority)}`}
                          style={{
                            opacity: 0.4,
                            filter: scheduled ? 'none' : 'saturate(0.3) brightness(0.8)', // Cool wash for unscheduled
                            maskImage: `linear-gradient(to right, 
                              rgba(0,0,0,0.3) 0%, 
                              rgba(0,0,0,0.5) 5%, 
                              rgba(0,0,0,1) 15%, 
                              rgba(0,0,0,1) 85%, 
                              rgba(0,0,0,0.5) 95%, 
                              rgba(0,0,0,0.3) 100%)`,
                            WebkitMaskImage: `linear-gradient(to right, 
                              rgba(0,0,0,0.3) 0%, 
                              rgba(0,0,0,0.5) 5%, 
                              rgba(0,0,0,1) 15%, 
                              rgba(0,0,0,1) 85%, 
                              rgba(0,0,0,0.5) 95%, 
                              rgba(0,0,0,0.3) 100%)`
                          }}
                        />
                        
                        {/* Visible portion with full opacity */}
                        <div
                          className={`absolute rounded-md transition-all ${
                            getPriorityColor(block.priority)
                          } hover:shadow-md hover:z-10`}
                          style={{
                            left: block.extendsBeforeWindow 
                              ? `${((block.visibleStart.getTime() - block.blockStart.getTime()) / (block.blockEnd.getTime() - block.blockStart.getTime())) * 100}%` 
                              : '0',
                            right: block.extendsAfterWindow
                              ? `${((block.blockEnd.getTime() - block.visibleEnd.getTime()) / (block.blockEnd.getTime() - block.blockStart.getTime())) * 100}%`
                              : '0',
                            top: '0',
                            height: '40px',
                            filter: scheduled ? 'none' : 'saturate(0.3) brightness(0.7)', // Cool wash for unscheduled
                            maskImage: `linear-gradient(to right, 
                              rgba(0,0,0,0.4) 0%, 
                              rgba(0,0,0,0.7) 5%, 
                              rgba(0,0,0,1) 10%, 
                              rgba(0,0,0,1) 90%, 
                              rgba(0,0,0,0.7) 95%, 
                              rgba(0,0,0,0.4) 100%)`,
                            WebkitMaskImage: `linear-gradient(to right, 
                              rgba(0,0,0,0.4) 0%, 
                              rgba(0,0,0,0.7) 5%, 
                              rgba(0,0,0,1) 10%, 
                              rgba(0,0,0,1) 90%, 
                              rgba(0,0,0,0.7) 95%, 
                              rgba(0,0,0,0.4) 100%)`
                          }}
                          title={`${block.commonName || block.name}
Rise: ${formatTime(block.blockStart)}
Transit: ${block.transit ? formatTime(block.transit) : 'N/A'}
Set: ${formatTime(block.blockEnd)}
Photo time: ${Math.round(block.totalObservationTime)} min
Score: ${block.observationScore?.toFixed(1)}`}
                        >
                          <div className="px-2 py-1 h-full flex flex-col justify-center overflow-visible">
                            <div className="text-xs font-bold text-white whitespace-nowrap">
                              {block.commonName ? `${block.name} ${block.commonName}` : block.name}
                            </div>
                            <div className="text-xs text-gray-200 opacity-90 whitespace-nowrap">
                              {Math.round(block.totalObservationTime)}m • Score: {block.observationScore?.toFixed(0)}
                            </div>
                          </div>
                        </div>
                        
                        {/* Transit marker */}
                        {block.transit && (
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-white opacity-50 z-20"
                            style={{
                              left: `${((block.transit.getTime() - block.blockStart.getTime()) / 
                                       (block.blockEnd.getTime() - block.blockStart.getTime())) * 100}%`
                            }}
                          />
                        )}
                        
                        {/* Scheduled observation window, split into one colored section per filter run */}
                        {scheduled && (() => {
                          const blockMs = block.blockEnd.getTime() - block.blockStart.getTime();
                          const percentInBlock = (date: Date) => ((date.getTime() - block.blockStart.getTime()) / blockMs) * 100;
                          const positions = Math.max(0, ...scheduled.segments.map(segment => segment.position));
                          const sections = scheduled.segments.length > 0
                            ? scheduled.segments.map((segment, i) => ({
                                key: segment.startTime.getTime(),
                                startTime: segment.startTime,
                                endTime: segment.endTime,
                                color: FILTER_COLORS[segment.filter],
                                label: positions > 1 ? `Position ${segment.position}/${positions} · ${segment.filter}` : segment.filter,
                                // First section of each mosaic position after the first gets a tick mark
                                startsPosition: segment.position > 1 && scheduled.segments[i - 1].position !== segment.position
                              }))
                            : [{ key: 0, startTime: scheduled.startTime, endTime: scheduled.endTime, color: '#6495ED', label: 'Imaging', startsPosition: false }];
                          return sections.map(section => (
                            <React.Fragment key={section.key}>
                            {section.startsPosition && (
                              <div
                                className="absolute z-30 w-0.5 bg-white/80"
                                style={{ left: `${percentInBlock(section.startTime)}%`, bottom: '0', height: '12px', transform: 'translateX(-1px)' }}
                              />
                            )}
                            <div
                              className="absolute rounded-sm z-30"
                              style={{
                                left: `${percentInBlock(section.startTime)}%`,
                                width: `${percentInBlock(section.endTime) - percentInBlock(section.startTime)}%`,
                                bottom: '0',
                                height: '6px',
                                backgroundColor: section.color,
                                boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.7)' // outline keeps a red filter visible on a red priority bar
                              }}
                              title={`${section.label}: ${formatTime(section.startTime)} - ${formatTime(section.endTime)}
Scheduled: ${formatTime(scheduled.startTime)} - ${formatTime(scheduled.endTime)}
Setup: ${scheduled.setupTime}m, Imaging: ${Math.round(scheduled.imagingTime)}m
Airmass: ${scheduled.meanAirmass.toFixed(2)} avg (altitude ${scheduled.altitudeRange.min.toFixed(0)}°–${scheduled.altitudeRange.max.toFixed(0)}°)`}
                            />
                            </React.Fragment>
                          ));
                        })()}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          
          {/* Legend */}
          <div className="mt-3 sm:mt-4 px-3 sm:px-0 pb-3 sm:pb-0 flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm">
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 bg-red-600 rounded"></div>
              <span className="hidden sm:inline">High Priority (9-10)</span>
              <span className="sm:hidden">High</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 bg-orange-600 rounded"></div>
              <span className="hidden sm:inline">Medium-High (7-8)</span>
              <span className="sm:hidden">Med-High</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 bg-yellow-600 rounded"></div>
              <span className="hidden sm:inline">Medium (5-6)</span>
              <span className="sm:hidden">Medium</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-600 rounded"></div>
              <span className="hidden sm:inline">Low (&lt; 5)</span>
              <span className="sm:hidden">Low</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 bg-slate-200 rounded"></div>
              <span className="hidden sm:inline">Moon up (brighter = fuller)</span>
              <span className="sm:hidden">Moon</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded" style={{ background: 'linear-gradient(to right, rgba(251,146,60,0.6), rgba(99,102,241,0.4))' }}></div>
              <span>Twilight</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="h-3 sm:h-4 border-l-2 border-amber-400/80"></div>
              <span className="hidden sm:inline">Sunset / Sunrise</span>
              <span className="sm:hidden">Sun</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="h-3 sm:h-4 border-l-2 border-dashed border-indigo-400/70"></div>
              <span className="hidden sm:inline">Astronomical dark</span>
              <span className="sm:hidden">Dark</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="w-0.5 h-3 sm:h-4 bg-white opacity-50"></div>
              <span>Transit</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="w-3 sm:w-4 h-1 rounded-sm flex overflow-hidden">
                <div className="flex-1" style={{ backgroundColor: FILTER_COLORS.Luminance }}></div>
                <div className="flex-1" style={{ backgroundColor: FILTER_COLORS.Red }}></div>
                <div className="flex-1" style={{ backgroundColor: FILTER_COLORS.Blue }}></div>
              </div>
              <span className="hidden sm:inline">Scheduled (by filter)</span>
              <span className="sm:hidden">Scheduled</span>
            </div>
          </div>
      </>
    </div>
  );
};