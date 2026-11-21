import React from 'react';

interface FilterControlsProps {
  observationDate: string;
  startTime: string;
  endTime: string;
  minAltitude: number;
  setupTime: number;
  filterChangeTime: number;
  onDateChange: (date: string) => void;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  onMinAltitudeChange: (altitude: number) => void;
  onSetupTimeChange: (time: number) => void;
  onFilterChangeTimeChange: (time: number) => void;
}

export const FilterControls: React.FC<FilterControlsProps> = ({
  observationDate,
  startTime,
  endTime,
  minAltitude,
  setupTime,
  filterChangeTime,
  onDateChange,
  onStartTimeChange,
  onEndTimeChange,
  onMinAltitudeChange,
  onSetupTimeChange,
  onFilterChangeTimeChange
}) => {
  return (
    <div className="bg-gray-900 p-4 sm:p-6 rounded-lg">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Observation Date
          </label>
          <input
            type="date"
            value={observationDate}
            onChange={(e) => {
              const newDate = e.target.value;
              // Validate the date before passing it up
              const testDate = new Date(newDate);
              if (!isNaN(testDate.getTime())) {
                onDateChange(newDate);
              } else {
                console.warn('Invalid date entered:', newDate);
              }
            }}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Start Time (MST)
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => onStartTimeChange(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            End Time (MST)
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => onEndTimeChange(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Min Altitude: {minAltitude}°
          </label>
          <input
            type="range"
            min="0"
            max="60"
            value={minAltitude}
            onChange={(e) => onMinAltitudeChange(Number(e.target.value))}
            className="w-full"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Setup Time: {setupTime} min
          </label>
          <input
            type="range"
            min="5"
            max="30"
            step="5"
            value={setupTime}
            onChange={(e) => onSetupTimeChange(Number(e.target.value))}
            className="w-full"
          />
          <div className="text-xs text-gray-500 mt-1">
            Time for slewing, focusing, and alignment between targets
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Filter Change: {filterChangeTime} min
          </label>
          <input
            type="range"
            min="0"
            max="5"
            step="0.5"
            value={filterChangeTime}
            onChange={(e) => onFilterChangeTimeChange(Number(e.target.value))}
            className="w-full"
          />
          <div className="text-xs text-gray-500 mt-1">
            Wheel move plus refocus, each time the filter changes within a target
          </div>
        </div>
      </div>
    </div>
  );
};