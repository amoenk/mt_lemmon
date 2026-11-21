import React from 'react';
import { mosaicCoverage, suggestedMosaic, type Mosaic, type PlannedObject } from '../utils/astronomy';
import { PositiveNumberInput } from './PositiveNumberInput';

interface MosaicControlProps {
  obj: PlannedObject;
  onChange: (mosaic: Mosaic) => void;
}

// Target size plus a W × H mosaic grid centered on the target, with a hint when the grid
// doesn't cover the whole target
export const MosaicControl: React.FC<MosaicControlProps> = ({ obj, onChange }) => {
  if (!obj.size || obj.type === 'planet') {
    return <span>{obj.size ? `${obj.size.width}'×${obj.size.height}'` : 'N/A'}</span>;
  }
  
  const coverage = mosaicCoverage(obj.mosaic);
  const suggestion = suggestedMosaic(obj.size);
  const coversTarget = coverage.width >= obj.size.width && coverage.height >= obj.size.height;
  const inputClass = 'w-10 px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs text-center';
  
  return (
    <div className="space-y-1">
      <div>{obj.size.width}'×{obj.size.height}'</div>
      <div className="flex items-center gap-1 text-xs text-gray-400">
        <PositiveNumberInput
          value={obj.mosaic.w}
          onCommit={(w) => onChange({ ...obj.mosaic, w })}
          className={inputClass}
          label="Mosaic columns"
        />
        <span>×</span>
        <PositiveNumberInput
          value={obj.mosaic.h}
          onCommit={(h) => onChange({ ...obj.mosaic, h })}
          className={inputClass}
          label="Mosaic rows"
        />
        <span className="whitespace-nowrap">
          = {coverage.width.toFixed(0)}'×{coverage.height.toFixed(0)}'
        </span>
      </div>
      {!coversTarget && (
        <button
          onClick={() => onChange(suggestion)}
          className="text-xs text-amber-400 hover:text-amber-300 whitespace-nowrap"
          title={`The grid covers less than the target's ${obj.size.width}'×${obj.size.height}'. Click to use ${suggestion.w}×${suggestion.h}.`}
        >
          ⚠ needs {suggestion.w}×{suggestion.h}
        </button>
      )}
    </div>
  );
};
