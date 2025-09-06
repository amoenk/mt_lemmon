import React from 'react';

interface FilterControlsProps {
  observationDate: string;
  startTime: string;
  endTime: string;
  minAltitude: number;
  showDeepSky: boolean;
  showSolarSystem: boolean;
  nightMode: boolean;
  onDateChange: (date: string) => void;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  onMinAltitudeChange: (altitude: number) => void;
  onShowDeepSkyChange: (show: boolean) => void;
  onShowSolarSystemChange: (show: boolean) => void;
  onNightModeChange: (mode: boolean) => void;
}

export const FilterControls: React.FC<FilterControlsProps> = ({
  observationDate,
  startTime,
  endTime,
  minAltitude,
  showDeepSky,
  showSolarSystem,
  nightMode,
  onDateChange,
  onStartTimeChange,
  onEndTimeChange,
  onMinAltitudeChange,
  onShowDeepSkyChange,
  onShowSolarSystemChange,
  onNightModeChange
}) => {
  return (
    <div className="bg-gray-900 p-6 rounded-lg">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showDeepSky}
              onChange={(e) => onShowDeepSkyChange(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-300">Deep Sky</span>
          </label>
          
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showSolarSystem}
              onChange={(e) => onShowSolarSystemChange(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-300">Solar System</span>
          </label>
        </div>
        
        <div className="flex items-center">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={nightMode}
              onChange={(e) => onNightModeChange(e.target.checked)}
              className="w-4 h-4 text-red-600 bg-gray-800 border-gray-600 rounded focus:ring-red-500"
            />
            <span className="text-sm text-gray-300">Night Vision Mode</span>
          </label>
        </div>
      </div>
    </div>
  );
};