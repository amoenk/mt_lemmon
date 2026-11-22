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

// Read-only, one line: target size and grid (with coverage when it's a real mosaic), plus a warning if it's too small
export const MosaicSummary: React.FC<{ obj: PlannedObject }> = ({ obj }) => {
  const info = mosaicInfo(obj);
  if (!info) return <span>size n/a</span>;
  const isMosaic = obj.mosaic.w * obj.mosaic.h > 1;
  return (
    <span>
      {info.size.width}'×{info.size.height}' · {obj.mosaic.w}×{obj.mosaic.h}
      {isMosaic && <span className="text-gray-500"> ({formatArcmin(info.coverage)})</span>}
      {!info.coversTarget && (
        <span className="text-amber-400" title={`The ${obj.mosaic.w}×${obj.mosaic.h} grid covers ${formatArcmin(info.coverage)}, less than the target. Set the mosaic in Custom Settings.`}>
          {' '}⚠ needs {info.suggestion.w}×{info.suggestion.h}
        </span>
      )}
    </span>
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
