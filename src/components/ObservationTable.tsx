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

  // Enabled targets first; otherwise keep the incoming order (visible first, then by transit)
  const orderedObservations = [...observations].sort((a, b) =>
    Number(disabledObjects.has(a.id)) - Number(disabledObjects.has(b.id))
  );
  
  const maxAltitude = (obj: PlannedObject) =>
    (obj.maxAltitudeDuringWindow || obj.timings.transitAltitude).toFixed(0);
  
  return (
    <div className="bg-gray-900">
      {/* One card per target; the list lives in the narrow Targets panel at every screen width */}
      <div>
        {orderedObservations.map((obj) => {
          const isExpanded = expandedRows.has(obj.id);
          const scheduled = scheduledObservations.find(s => s.objectId === obj.id);
          const exposure = getExposureRecommendations(obj.type);
          
          return (
            <div
              key={obj.id}
              className={`border-b border-gray-800 px-3 py-2.5 ${
                !obj.isVisible || disabledObjects.has(obj.id) ? 'opacity-50' : ''
              } ${
                scheduled ? 'bg-blue-900/10' : ''
              }`}
            >
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={!disabledObjects.has(obj.id)}
                  onChange={() => onToggleEnabled?.(obj.id)}
                  className="w-4 h-4 mt-0.5 shrink-0 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                  aria-label={`Include ${obj.name} in the plan`}
                />
                {/* Summary: the whole block toggles the details */}
                <button
                  type="button"
                  onClick={() => onToggleExpanded(obj.id)}
                  aria-expanded={isExpanded}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="flex-1 min-w-0 font-medium text-sm truncate">
                      {obj.commonName ? `${obj.name} ${obj.commonName}` : obj.name}
                      {customSettings[obj.id] && Object.keys(customSettings[obj.id]).length > 0 && (
                        <span className="ml-1.5 text-[10px] uppercase tracking-wide text-blue-400">custom</span>
                      )}
                    </span>
                    <span className={`text-xs font-semibold ${getPriorityColor(obj.priority)}`}>P{obj.priority}</span>
                    <span className="text-gray-500 text-xs w-3">{isExpanded ? '▾' : '▸'}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">
                    {obj.type.replace(/_/g, ' ')}
                    {obj.magnitude && ` · mag ${obj.magnitude.toFixed(1)}`}
                    {' · '}
                    {obj.timings.neverRises ? (
                      <span className="text-gray-500">never rises</span>
                    ) : obj.timings.isCircumpolar ? (
                      <span title="Above the minimum altitude all night">
                        <span className="text-green-400">circumpolar</span> · <span className="text-blue-400">⟂{formatTime(obj.timings.transitTime)}</span> {maxAltitude(obj)}°
                      </span>
                    ) : (
                      <>
                        <span title="Rises above the minimum altitude">↑{formatTime(obj.timings.riseTime)}</span>{' '}
                        <span title="Transit: highest point, and peak altitude tonight" className="text-blue-400">⟂{formatTime(obj.timings.transitTime)}</span>{' '}
                        <span title="Peak altitude in the observing window">{maxAltitude(obj)}°</span>{' '}
                        <span title="Sinks below the minimum altitude">↓{formatTime(obj.timings.setTime)}</span>
                      </>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    <MosaicSummary obj={obj} />
                    {scheduled ? (
                      <span className="text-blue-400">
                        {' '}▶ {formatTime(scheduled.startTime)}–{formatTime(scheduled.endTime)} · {Math.round(scheduled.imagingTime)}m · airmass {scheduled.meanAirmass.toFixed(2)}
                      </span>
                    ) : !obj.isVisible ? (
                      <span className="text-red-400"> · not visible tonight</span>
                    ) : unscheduledReasons[obj.id] ? (
                      <span className="text-amber-400" title={unscheduledReasons[obj.id]}>
                        {' '}⚠ not scheduled: {unscheduledReasons[obj.id].startsWith('Too long') ? 'too long to fit' : 'no free slot'}
                      </span>
                    ) : null}
                  </div>
                </button>
              </div>
              
              {/* Expanded Content */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-gray-700">
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
                        <div>
                          <span className="text-gray-400">Score:</span> {obj.observationScore.toFixed(1)}
                          <span className="text-gray-500"> (a final tiebreaker when scheduling)</span>
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
    </div>
  );
};