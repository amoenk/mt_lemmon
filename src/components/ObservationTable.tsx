import React from 'react';
import { getExposureRecommendations, getMagnificationRecommendation, type PlannedObject, type CustomObjectSettings } from '../utils/astronomy';
import { FilterRowsEditor } from './FilterRowsEditor';
import type { ScheduledObservation } from '../utils/scheduler';
import { MosaicControl, MosaicSummary } from './MosaicControl';

interface ObservationTableProps {
  observations: PlannedObject[];
  expandedRows: Set<string>;
  scheduledObservations?: ScheduledObservation[];
  unscheduledReasons: Record<string, string>;
  disabledObjects?: Set<string>;
  customSettings?: Record<string, CustomObjectSettings>;
  onToggleExpanded: (id: string) => void;
  onToggleEnabled?: (id: string) => void;
  onUpdateSettings?: (objectId: string, settings: CustomObjectSettings) => void;
}

export const ObservationTable: React.FC<ObservationTableProps> = ({
  observations,
  expandedRows,
  scheduledObservations = [],
  unscheduledReasons,
  disabledObjects = new Set(),
  customSettings = {},
  onToggleExpanded,
  onToggleEnabled,
  onUpdateSettings
}) => {
  const [tempPriorities, setTempPriorities] = React.useState<Record<string, number>>({});
  const formatTime = (date: Date | null): string => {
    if (!date) return 'N/A';
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Phoenix'
    });
  };

  const formatAzimuth = (az: number | null): string => {
    if (az === null) return 'N/A';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(az / 45) % 8;
    return `${az.toFixed(0)}° ${directions[index]}`;
  };

  const getPriorityColor = (priority: number): string => {
    if (priority >= 9) return 'text-red-400';
    if (priority >= 7) return 'text-orange-400';
    if (priority >= 5) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      {/* Mobile Card View */}
      <div className="block md:hidden">
        {observations.map((obj) => {
          const isExpanded = expandedRows.has(obj.id);
          const isScheduled = scheduledObservations.some(s => s.objectId === obj.id);
          const exposure = getExposureRecommendations(obj.type);
          
          return (
            <div
              key={obj.id}
              className={`border-b border-gray-800 p-4 ${
                !obj.isVisible || disabledObjects.has(obj.id) ? 'opacity-50' : ''
              } ${
                isScheduled ? 'bg-blue-900/10' : ''
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3 flex-1">
                  <input
                    type="checkbox"
                    checked={!disabledObjects.has(obj.id)}
                    onChange={() => onToggleEnabled?.(obj.id)}
                    className="w-4 h-4 mt-1 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium">
                      {obj.commonName ? `${obj.name} ${obj.commonName}` : obj.name}
                      {!obj.isVisible && <span className="text-xs text-red-400 ml-2">(Not visible)</span>}
                      {customSettings[obj.id] && Object.keys(customSettings[obj.id]).length > 0 && (
                        <span className="text-xs text-blue-400 ml-2">(Custom)</span>
                      )}
                      {unscheduledReasons[obj.id] && (
                        <div className="text-xs text-amber-400 mt-1">⚠ Not scheduled: {unscheduledReasons[obj.id]}</div>
                      )}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      {obj.type} • <span className={getPriorityColor(obj.priority)}>P{obj.priority}</span>
                      {obj.magnitude && ` • Mag ${obj.magnitude.toFixed(1)}`}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Key Info Grid */}
              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div>
                  <span className="text-gray-500">Transit:</span>
                  <div className="font-medium text-blue-400">{formatTime(obj.timings.transitTime)}</div>
                </div>
                <div>
                  <span className="text-gray-500">Max Alt:</span>
                  <div className="font-medium">{obj.maxAltitudeDuringWindow ? obj.maxAltitudeDuringWindow.toFixed(0) : obj.timings.transitAltitude.toFixed(0)}°</div>
                </div>
                <div>
                  <span className="text-gray-500">Score:</span>
                  <div className="font-bold">{obj.observationScore?.toFixed(1) || '—'}</div>
                </div>
                <div>
                  <span className="text-gray-500">Rise/Set:</span>
                  <div className="text-xs">
                    {obj.timings.neverRises ? (
                      <span className="text-gray-500">Never rises</span>
                    ) : obj.timings.isCircumpolar ? (
                      <span className="text-green-400">Circumpolar</span>
                    ) : (
                      <div>
                        ↑{formatTime(obj.timings.riseTime)} ↓{formatTime(obj.timings.setTime)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Size / Mosaic:</span>
                  <div className="font-medium">
                    <MosaicSummary obj={obj} />
                  </div>
                </div>
              </div>
              
              {/* Expand Button */}
              <button
                onClick={() => onToggleExpanded(obj.id)}
                className="text-blue-400 hover:text-blue-300 text-sm w-full text-left"
              >
                {isExpanded ? '▼ Hide Details' : '▶ Show Details'}
              </button>
              
              {/* Expanded Content */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-bold text-sm mb-2">Observation Details</h4>
                      <div className="space-y-1 text-sm">
                        <div>
                          <span className="text-gray-400">Rise:</span>{' '}
                          {obj.timings.isCircumpolar ? 'Always visible' : 
                            `${formatTime(obj.timings.riseTime)} at ${formatAzimuth(obj.timings.riseAzimuth)}`}
                        </div>
                        <div>
                          <span className="text-gray-400">Transit:</span>{' '}
                          {formatTime(obj.timings.transitTime)} at {obj.timings.transitAltitude.toFixed(0)}° altitude, {formatAzimuth(obj.timings.transitAzimuth)}
                        </div>
                        <div>
                          <span className="text-gray-400">Set:</span>{' '}
                          {obj.timings.isCircumpolar ? 'Always visible' : 
                            `${formatTime(obj.timings.setTime)} at ${formatAzimuth(obj.timings.setAzimuth)}`}
                        </div>
                        <div>
                          <span className="text-gray-400">Observation Window:</span>{' '}
                          {Math.round(obj.observableDuration)} minutes around transit
                        </div>
                        {(() => {
                          const scheduled = scheduledObservations.find(s => s.objectId === obj.id);
                          if (scheduled) {
                            return (
                              <div className="mt-2 p-2 bg-blue-900/20 border border-blue-600 rounded">
                                <div className="font-bold text-blue-400">Scheduled Observation:</div>
                                <div>
                                  <span className="text-gray-400">Start:</span>{' '}
                                  <span className="text-blue-300">{formatTime(scheduled.startTime)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-400">End:</span>{' '}
                                  <span className="text-blue-300">{formatTime(scheduled.endTime)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-400">Setup:</span> {scheduled.setupTime} min,{' '}
                                  <span className="text-gray-400">Imaging:</span> {Math.round(scheduled.imagingTime)} min
                                </div>
                                <div>
                                  <span className="text-gray-400">Frames:</span>{' '}
                                  {scheduled.rows.map(row => `${row.filter} ${row.count}×${row.exposure}s`).join(', ')}
                                  {scheduled.extraFrames > 0 && <span className="text-green-400"> (+{scheduled.extraFrames} gap fill)</span>}
                                </div>
                                <div>
                                  <span className="text-gray-400">Airmass:</span> {scheduled.meanAirmass.toFixed(2)} avg,{' '}
                                  <span className="text-gray-400">Altitude:</span> {scheduled.altitudeRange.min.toFixed(0)}°–{scheduled.altitudeRange.max.toFixed(0)}°
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-bold text-sm mb-2">Visual & Imaging Recommendations (32" f/7)</h4>
                      <div className="space-y-2">
                        {(() => {
                          const magRec = getMagnificationRecommendation(obj.size, obj.type);
                          return (
                            <div className="pb-2 border-b border-gray-700">
                              <div className="font-semibold text-gray-300 mb-1">Visual Observation:</div>
                              <div className="space-y-1 text-sm">
                                <div>
                                  <span className="text-gray-400">Magnification:</span> {magRec.magnification}
                                </div>
                                <div>
                                  <span className="text-gray-400">Eyepiece:</span> {magRec.eyepiece}
                                </div>
                                <div>
                                  <span className="text-gray-400">Field of View:</span> {magRec.fov}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {magRec.notes}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                        <div>
                          <div className="font-semibold text-gray-300 mb-1">Imaging:</div>
                          <div className="space-y-1 text-sm">
                            <div>
                              <span className="text-gray-400">Filter Plan:</span>{' '}
                              {obj.filterRows.map(row => `${row.filter} ${row.count}×${row.exposure}s${row.binning > 1 ? ` ${row.binning}×${row.binning}` : ''}`).join(' → ')}
                            </div>
                            <div className="text-xs text-gray-500 mt-2">
                              {exposure.notes}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Custom Settings */}
                    <div className="p-3 bg-gray-800 rounded-lg">
                      <h4 className="font-bold text-sm mb-3">Custom Settings</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">
                            Priority (1-10)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="1"
                              max="10"
                              value={tempPriorities[obj.id] ?? customSettings[obj.id]?.priority ?? obj.defaultPriority ?? obj.priority}
                              onChange={(e) => {
                                const newPriority = parseInt(e.target.value);
                                setTempPriorities(prev => ({ ...prev, [obj.id]: newPriority }));
                              }}
                              onMouseUp={(e) => {
                                const newPriority = parseInt((e.target as HTMLInputElement).value);
                                onUpdateSettings?.(obj.id, {
                                  ...customSettings[obj.id],
                                  priority: newPriority
                                });
                                setTempPriorities(prev => {
                                  const newState = { ...prev };
                                  delete newState[obj.id];
                                  return newState;
                                });
                              }}
                              onTouchEnd={(e) => {
                                const newPriority = parseInt((e.target as HTMLInputElement).value);
                                onUpdateSettings?.(obj.id, {
                                  ...customSettings[obj.id],
                                  priority: newPriority
                                });
                                setTempPriorities(prev => {
                                  const newState = { ...prev };
                                  delete newState[obj.id];
                                  return newState;
                                });
                              }}
                              className="flex-1"
                            />
                            <span className="w-8 text-center font-medium">
                              {tempPriorities[obj.id] ?? customSettings[obj.id]?.priority ?? obj.defaultPriority ?? obj.priority}
                            </span>
                          </div>
                        </div>
                        
                        <MosaicControl
                          obj={obj}
                          onChange={(mosaic) => onUpdateSettings?.(obj.id, {
                            ...customSettings[obj.id],
                            mosaic
                          })}
                        />
                        
                        <FilterRowsEditor
                          obj={obj}
                          onChange={(filterRows) => onUpdateSettings?.(obj.id, {
                            ...customSettings[obj.id],
                            filterRows
                          })}
                        />
                        
                        {customSettings[obj.id] && (
                          <button
                            onClick={() => onUpdateSettings?.(obj.id, {})}
                            className="text-sm text-blue-400 hover:text-blue-300"
                          >
                            Reset to defaults
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Desktop Table View */}
      <table className="w-full hidden md:table">
        <thead>
          <tr className="bg-gray-800 text-left">
            <th className="px-4 py-3 text-sm font-medium text-gray-300">Enable</th>
            <th className="px-4 py-3 text-sm font-medium text-gray-300">Name</th>
            <th className="px-4 py-3 text-sm font-medium text-gray-300">Type</th>
            <th className="px-4 py-3 text-sm font-medium text-gray-300">Priority</th>
            <th className="px-4 py-3 text-sm font-medium text-gray-300">Score</th>
            <th className="px-4 py-3 text-sm font-medium text-gray-300">Rise/Set (MST)</th>
            <th className="px-4 py-3 text-sm font-medium text-gray-300">Transit (MST)</th>
            <th className="px-4 py-3 text-sm font-medium text-gray-300">Max Alt (Window)</th>
            <th className="px-4 py-3 text-sm font-medium text-gray-300">Size</th>
            <th className="px-4 py-3 text-sm font-medium text-gray-300">Mag</th>
            <th className="px-4 py-3 text-sm font-medium text-gray-300">Actions</th>
          </tr>
        </thead>
        <tbody>
          {observations.map((obj) => {
            const isExpanded = expandedRows.has(obj.id);
            const isScheduled = scheduledObservations.some(s => s.objectId === obj.id);
            const exposure = getExposureRecommendations(obj.type);
            
            return (
              <React.Fragment key={obj.id}>
                <tr className={`border-t border-gray-800 hover:bg-gray-800/50 ${
                  !obj.isVisible || disabledObjects.has(obj.id) ? 'opacity-50' : ''
                } ${
                  isScheduled ? 'bg-blue-900/10 dark:bg-blue-900/15' : ''
                }`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={!disabledObjects.has(obj.id)}
                      onChange={() => onToggleEnabled?.(obj.id)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {obj.commonName ? `${obj.name} ${obj.commonName}` : obj.name}
                    {!obj.isVisible && <span className="text-xs text-red-400 ml-2">(Not visible)</span>}
                    {customSettings[obj.id] && Object.keys(customSettings[obj.id]).length > 0 && (
                      <span className="text-xs text-blue-400 ml-2">(Custom)</span>
                    )}
                    {unscheduledReasons[obj.id] && (
                      <div className="text-xs text-amber-400 mt-1 max-w-xs">⚠ Not scheduled: {unscheduledReasons[obj.id]}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{obj.type}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={getPriorityColor(obj.priority)}>
                      {obj.priority}/10
                      {customSettings[obj.id]?.priority && (
                        <span className="text-xs text-blue-400 ml-1">*</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="font-bold">{obj.observationScore?.toFixed(1) || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {obj.timings.neverRises ? (
                      <span className="text-gray-500">Never rises</span>
                    ) : obj.timings.isCircumpolar ? (
                      <span className="text-green-400">Circumpolar</span>
                    ) : (
                      <div className="flex flex-col space-y-1">
                        <span>↑ {formatTime(obj.timings.riseTime)}</span>
                        <span>↓ {formatTime(obj.timings.setTime)}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-blue-400">
                    {formatTime(obj.timings.transitTime)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {obj.maxAltitudeDuringWindow ? obj.maxAltitudeDuringWindow.toFixed(0) : obj.timings.transitAltitude.toFixed(0)}°
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <MosaicSummary obj={obj} />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {obj.magnitude ? obj.magnitude.toFixed(1) : 'N/A'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onToggleExpanded(obj.id)}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      {isExpanded ? '▼ Hide' : '▶ Details'}
                    </button>
                  </td>
                </tr>
                
                {isExpanded && (
                  <tr>
                    <td colSpan={11} className="px-4 py-3 bg-gray-800/50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-bold text-sm mb-2">Observation Details</h4>
                          <div className="space-y-1 text-sm">
                            <div>
                              <span className="text-gray-400">Rise:</span>{' '}
                              {obj.timings.isCircumpolar ? 'Always visible' : 
                                `${formatTime(obj.timings.riseTime)} at ${formatAzimuth(obj.timings.riseAzimuth)}`}
                            </div>
                            <div>
                              <span className="text-gray-400">Transit:</span>{' '}
                              {formatTime(obj.timings.transitTime)} at {obj.timings.transitAltitude.toFixed(0)}° altitude, {formatAzimuth(obj.timings.transitAzimuth)}
                            </div>
                            <div>
                              <span className="text-gray-400">Set:</span>{' '}
                              {obj.timings.isCircumpolar ? 'Always visible' : 
                                `${formatTime(obj.timings.setTime)} at ${formatAzimuth(obj.timings.setAzimuth)}`}
                            </div>
                            <div>
                              <span className="text-gray-400">Observation Window:</span>{' '}
                              {Math.round(obj.observableDuration)} minutes around transit
                            </div>
                            {(() => {
                              const scheduled = scheduledObservations.find(s => s.objectId === obj.id);
                              if (scheduled) {
                                return (
                                  <div className="mt-2 p-2 bg-blue-900/20 border border-blue-600 rounded">
                                    <div className="font-bold text-blue-400">Scheduled Observation:</div>
                                    <div>
                                      <span className="text-gray-400">Start:</span>{' '}
                                      <span className="text-blue-300">{formatTime(scheduled.startTime)}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-400">End:</span>{' '}
                                      <span className="text-blue-300">{formatTime(scheduled.endTime)}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-400">Setup:</span> {scheduled.setupTime} min,{' '}
                                      <span className="text-gray-400">Imaging:</span> {Math.round(scheduled.imagingTime)} min
                                    </div>
                                    <div>
                                      <span className="text-gray-400">Frames:</span>{' '}
                                      {scheduled.rows.map(row => `${row.filter} ${row.count}×${row.exposure}s`).join(', ')}
                                      {scheduled.extraFrames > 0 && <span className="text-green-400"> (+{scheduled.extraFrames} gap fill)</span>}
                                    </div>
                                    <div>
                                      <span className="text-gray-400">Airmass:</span> {scheduled.meanAirmass.toFixed(2)} avg,{' '}
                                      <span className="text-gray-400">Altitude:</span> {scheduled.altitudeRange.min.toFixed(0)}°–{scheduled.altitudeRange.max.toFixed(0)}°
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-bold text-sm mb-2">Visual & Imaging Recommendations (32" f/7)</h4>
                          <div className="space-y-2">
                            {(() => {
                              const magRec = getMagnificationRecommendation(obj.size, obj.type);
                              return (
                                <div className="pb-2 border-b border-gray-700">
                                  <div className="font-semibold text-gray-300 mb-1">Visual Observation:</div>
                                  <div className="space-y-1 text-sm">
                                    <div>
                                      <span className="text-gray-400">Magnification:</span> {magRec.magnification}
                                    </div>
                                    <div>
                                      <span className="text-gray-400">Eyepiece:</span> {magRec.eyepiece}
                                    </div>
                                    <div>
                                      <span className="text-gray-400">Field of View:</span> {magRec.fov}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {magRec.notes}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                            <div>
                              <div className="font-semibold text-gray-300 mb-1">Imaging:</div>
                              <div className="space-y-1 text-sm">
                                <div>
                                  <span className="text-gray-400">Filter Plan:</span>{' '}
                                  {obj.filterRows.map(row => `${row.filter} ${row.count}×${row.exposure}s${row.binning > 1 ? ` ${row.binning}×${row.binning}` : ''}`).join(' → ')}
                                </div>
                                <div className="text-xs text-gray-500 mt-2">
                                  {exposure.notes}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Custom Settings */}
                        <div className="mt-4 p-3 bg-gray-800 rounded-lg">
                          <h4 className="font-bold text-sm mb-3">Custom Settings</h4>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm text-gray-400 mb-1">
                                Priority (1-10)
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="range"
                                  min="1"
                                  max="10"
                                  value={tempPriorities[obj.id] ?? customSettings[obj.id]?.priority ?? obj.defaultPriority ?? obj.priority}
                                  onChange={(e) => {
                                    const newPriority = parseInt(e.target.value);
                                    setTempPriorities(prev => ({ ...prev, [obj.id]: newPriority }));
                                  }}
                                  onMouseUp={(e) => {
                                    const newPriority = parseInt((e.target as HTMLInputElement).value);
                                    onUpdateSettings?.(obj.id, {
                                      ...customSettings[obj.id],
                                      priority: newPriority
                                    });
                                    setTempPriorities(prev => {
                                      const newState = { ...prev };
                                      delete newState[obj.id];
                                      return newState;
                                    });
                                  }}
                                  onTouchEnd={(e) => {
                                    const newPriority = parseInt((e.target as HTMLInputElement).value);
                                    onUpdateSettings?.(obj.id, {
                                      ...customSettings[obj.id],
                                      priority: newPriority
                                    });
                                    setTempPriorities(prev => {
                                      const newState = { ...prev };
                                      delete newState[obj.id];
                                      return newState;
                                    });
                                  }}
                                  className="flex-1"
                                />
                                <span className="w-8 text-center font-medium">
                                  {tempPriorities[obj.id] ?? customSettings[obj.id]?.priority ?? obj.defaultPriority ?? obj.priority}
                                </span>
                                {customSettings[obj.id]?.priority && obj.defaultPriority && 
                                 customSettings[obj.id].priority !== obj.defaultPriority && (
                                  <span className="text-xs text-gray-500">
                                    (default: {obj.defaultPriority})
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <MosaicControl
                              obj={obj}
                              onChange={(mosaic) => onUpdateSettings?.(obj.id, {
                                ...customSettings[obj.id],
                                mosaic
                              })}
                            />
                            
                            <FilterRowsEditor
                              obj={obj}
                              onChange={(filterRows) => onUpdateSettings?.(obj.id, {
                                ...customSettings[obj.id],
                                filterRows
                              })}
                            />
                            
                            {customSettings[obj.id] && (
                              <button
                                onClick={() => onUpdateSettings?.(obj.id, {})}
                                className="text-sm text-blue-400 hover:text-blue-300"
                              >
                                Reset to defaults
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};