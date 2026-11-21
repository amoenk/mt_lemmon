import React from 'react';
import { DEFAULT_FRAMES_PER_FILTER, type FilterRow, type PlannedObject } from '../utils/astronomy';
import { FILTER_COLORS } from '../utils/filterColors';

const filtersForType = (type: string): string[] => {
  if (type === 'planet') {
    return ['Luminance', 'IR850', 'Red', 'Green', 'Blue', 'CH4'];
  }
  if (type === 'nebula' || type === 'planetary_nebula' || type === 'supernova_remnant') {
    return ['Luminance', 'Ha', 'OIII', 'SII', 'Red', 'Green', 'Blue'];
  }
  return ['Luminance', 'Red', 'Green', 'Blue', 'Ha'];
};

// Positive whole-number input. Keeps what's being typed (including an empty field) as a draft
// and only commits values of 1 or more, so clearing "10" and typing "20" gives 20.
const PositiveNumberInput: React.FC<{
  value: number;
  onCommit: (value: number) => void;
  className: string;
  label: string;
}> = ({ value, onCommit, className, label }) => {
  const [draft, setDraft] = React.useState<string | null>(null);
  return (
    <input
      type="number"
      min="1"
      value={draft ?? value}
      onChange={(e) => {
        setDraft(e.target.value);
        const parsed = Number(e.target.value);
        if (Number.isInteger(parsed) && parsed >= 1) {
          onCommit(parsed);
        }
      }}
      onBlur={() => setDraft(null)}
      className={className}
      aria-label={label}
    />
  );
};

interface FilterRowsEditorProps {
  obj: PlannedObject;
  onChange: (rows: FilterRow[]) => void;
}

// Edit a target's imaging plan: one row per filter run (filter, exposure, frame count, binning)
export const FilterRowsEditor: React.FC<FilterRowsEditorProps> = ({ obj, onChange }) => {
  const rows = obj.filterRows;
  const filters = filtersForType(obj.type);
  const isPlanet = obj.type === 'planet';
  
  const updateRow = (index: number, changes: Partial<FilterRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...changes } : row)));
  
  const inputClass = 'px-1.5 py-1 bg-gray-700 border border-gray-600 rounded text-sm';
  
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-2">
        Filter Plan · {Math.round(obj.totalObservationTime)} min imaging
      </label>
      <div className="space-y-2">
        {rows.map((row, i) => (
          // Phones: filter and remove on one line, frames/exposure/binning on the next. Wider screens: one line.
          <div key={i} className="flex flex-wrap items-center gap-1.5 text-sm">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: FILTER_COLORS[row.filter] }}
            />
            <select
              value={row.filter}
              onChange={(e) => updateRow(i, { filter: e.target.value })}
              className={`${inputClass} w-28`}
              aria-label="Filter"
            >
              {filters.map(filter => <option key={filter} value={filter}>{filter}</option>)}
            </select>
            {!isPlanet && (
              <div className="flex items-center gap-1.5 w-full sm:w-auto pl-4 sm:pl-0 order-last sm:order-none">
                <PositiveNumberInput
                  value={row.count}
                  onCommit={(count) => updateRow(i, { count })}
                  className={`${inputClass} w-14`}
                  label="Frames"
                />
                <span className="text-gray-500">×</span>
                <PositiveNumberInput
                  value={row.exposure}
                  onCommit={(exposure) => updateRow(i, { exposure })}
                  className={`${inputClass} w-16`}
                  label="Exposure seconds"
                />
                <span className="text-gray-500">s</span>
                <select
                  value={row.binning}
                  onChange={(e) => updateRow(i, { binning: Number(e.target.value) })}
                  className={`${inputClass} w-16`}
                  aria-label="Binning"
                >
                  <option value={1}>1×1</option>
                  <option value={2}>2×2</option>
                </select>
              </div>
            )}
            <button
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              disabled={rows.length === 1}
              className="ml-auto px-1.5 text-gray-400 hover:text-red-400 disabled:opacity-30"
              aria-label="Remove filter row"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() => {
          const last = rows[rows.length - 1];
          const nextFilter = filters.find(f => !rows.some(row => row.filter === f)) ?? last.filter;
          onChange([...rows, { ...last, filter: nextFilter, count: DEFAULT_FRAMES_PER_FILTER }]);
        }}
        className="mt-2 text-sm text-blue-400 hover:text-blue-300"
      >
        + Add filter
      </button>
    </div>
  );
};
