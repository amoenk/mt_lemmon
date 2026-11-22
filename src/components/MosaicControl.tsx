import React from 'react';
import { mosaicCoverage, suggestedMosaic, type Mosaic, type PlannedObject } from '../utils/astronomy';
import { PositiveNumberInput } from './PositiveNumberInput';

// Mosaic grid details for a target, or null for targets without a catalog size
const mosaicInfo = (obj: PlannedObject) => {
  if (!obj.size) return null;
  const coverage = mosaicCoverage(obj.mosaic);
  return {
    size: obj.size,
    coverage,
    suggestion: suggestedMosaic(obj.size),
    coversTarget: coverage.width >= obj.size.width && coverage.height >= obj.size.height
  };
};

const formatArcmin = (area: { width: number; height: number }) =>
  `${area.width.toFixed(0)}'×${area.height.toFixed(0)}'`;

// Read-only: target size, current grid and what it covers, and a warning if it's too small
export const MosaicSummary: React.FC<{ obj: PlannedObject }> = ({ obj }) => {
  const info = mosaicInfo(obj);
  if (!info) {
    return <span>N/A</span>;
  }
  return (
    <div className="space-y-0.5">
      <div>{info.size.width}'×{info.size.height}'</div>
      <div className="text-xs text-gray-400 whitespace-nowrap">
        {obj.mosaic.w}×{obj.mosaic.h} = {formatArcmin(info.coverage)}
      </div>
      {!info.coversTarget && (
        <div className="text-xs text-amber-400 whitespace-nowrap">
          ⚠ needs {info.suggestion.w}×{info.suggestion.h}
        </div>
      )}
    </div>
  );
};

interface MosaicControlProps {
  obj: PlannedObject;
  onChange: (mosaic: Mosaic) => void;
}

// Editable W × H mosaic grid centered on the target, with a button to apply the suggested grid
export const MosaicControl: React.FC<MosaicControlProps> = ({ obj, onChange }) => {
  const info = mosaicInfo(obj);
  if (!info) return null;
  
  const inputClass = 'w-12 px-1.5 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-center';
  
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">
        Mosaic (W × H positions, centered on target)
      </label>
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <PositiveNumberInput
          value={obj.mosaic.w}
          onCommit={(w) => onChange({ ...obj.mosaic, w })}
          className={inputClass}
          label="Mosaic columns"
        />
        <span className="text-gray-500">×</span>
        <PositiveNumberInput
          value={obj.mosaic.h}
          onCommit={(h) => onChange({ ...obj.mosaic, h })}
          className={inputClass}
          label="Mosaic rows"
        />
        <span className="text-gray-400">
          covers {formatArcmin(info.coverage)} · target {info.size.width}'×{info.size.height}'
        </span>
      </div>
      {!info.coversTarget && (
        <button
          onClick={() => onChange(info.suggestion)}
          className="mt-1 text-sm text-amber-400 hover:text-amber-300"
        >
          ⚠ Grid is smaller than the target · use {info.suggestion.w}×{info.suggestion.h}
        </button>
      )}
    </div>
  );
};
