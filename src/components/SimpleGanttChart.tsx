import React, { useState, useEffect } from 'react';
import { getMoonUpPeriods, type MoonPhaseInfo, type PlannedObject } from '../utils/astronomy';

interface SimpleGanttChartProps {
  observations: PlannedObject[];
  moonPhase: MoonPhaseInfo;
  startTime: Date;
  endTime: Date;
  expandedRows: Set<string>;
  scheduledObservations?: Array<{
    objectId: string;
    startTime: Date;
    endTime: Date;
    setupTime: number;
    imagingTime: number;
  }>;
}

export const SimpleGanttChart: React.FC<SimpleGanttChartProps> = ({
  observations,
  moonPhase,
  startTime,
  endTime,
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
  
  const extendedStartTime = new Date(startTime.getTime() - extensionHours * 60 * 60 * 1000);
  const extendedEndTime = new Date(endTime.getTime() + extensionHours * 60 * 60 * 1000);
  
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
        <div className="text-xs sm:text-sm text-gray-400">
          {formatTime(startTime)} - {formatTime(endTime)} MST
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
              {/* Mobile: Show only start and end times */}
              <div className="sm:hidden">
                <div className="absolute text-xs text-gray-400 left-0">
                  {formatTime(extendedStartTime)}
                </div>
                <div className="absolute text-xs text-gray-400 right-0">
                  {formatTime(extendedEndTime)}
                </div>
              </div>
              
              {/* Desktop: Show all hour markers */}
              {hours.map((hour, i) => {
                const position = getPosition(hour);
                if (position < 0 || position > 100) return null;
                
                return (
                  <div
                    key={i}
                    className="absolute text-xs text-gray-400 hidden sm:block"
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
                        
                        {/* Scheduled observation window */}
                        {scheduled && (
                          <div
                            className="absolute rounded-sm z-30"
                            style={{
                              left: `${((scheduled.startTime.getTime() - block.blockStart.getTime()) / 
                                       (block.blockEnd.getTime() - block.blockStart.getTime())) * 100}%`,
                              width: `${((scheduled.endTime.getTime() - scheduled.startTime.getTime()) / 
                                        (block.blockEnd.getTime() - block.blockStart.getTime())) * 100}%`,
                              bottom: '0',
                              height: '6px',
                              backgroundColor: '#6495ED', // Cornflower blue
                              boxShadow: '0 -1px 2px rgba(100, 149, 237, 0.5)'
                            }}
                            title={`Scheduled: ${formatTime(scheduled.startTime)} - ${formatTime(scheduled.endTime)}
Setup: ${scheduled.setupTime}m, Imaging: ${Math.round(scheduled.imagingTime)}m`}
                          />
                        )}
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
              <div className="w-0.5 h-3 sm:h-4 bg-white opacity-50"></div>
              <span>Transit</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="w-3 sm:w-4 h-1 rounded-sm" style={{ backgroundColor: '#6495ED' }}></div>
              <span>Scheduled</span>
            </div>
          </div>
      </>
    </div>
  );
};