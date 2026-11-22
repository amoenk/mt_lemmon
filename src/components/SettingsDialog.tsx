import React, { useState } from 'react';
import { Dialog, ConfirmDialog } from './Dialog';
import { FilterControls } from './FilterControls';

interface SettingsDialogProps extends React.ComponentProps<typeof FilterControls> {
  isSyncedToDark: boolean;
  onSyncToDark: () => void;
  onReset: () => void;
  onClose: () => void;
  targetsAreAutomatic: boolean;
  targetsChosenFor: string | null; // night the current manual selection was made for
  onPickBestTargets: () => void;
}

// "Sat, Jan 9, 2027" for a YYYY-MM-DD night
const formatNight = (date: string) =>
  new Date(`${date}T12:00:00-07:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Phoenix'
  });

// Night settings (date, window, altitude, overheads) plus Reset. Changes apply immediately.
export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  isSyncedToDark, onSyncToDark, onReset, onClose, targetsAreAutomatic, targetsChosenFor, onPickBestTargets, ...controls
}) => {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [confirmingPick, setConfirmingPick] = useState(false);
  const night = formatNight(controls.observationDate);
  const dateChangedSinceChoice = !targetsAreAutomatic && targetsChosenFor !== null && targetsChosenFor !== controls.observationDate;
  
  return (
    <>
      <Dialog title="⚙ Settings" onClose={onClose}>
        <FilterControls {...controls} />
        {!isSyncedToDark && (
          <button
            onClick={onSyncToDark}
            className="mt-4 px-3 py-1.5 rounded border border-indigo-500/60 text-indigo-300 hover:bg-indigo-500/20 text-sm"
          >
            🌌 Sync start/end to astronomical dark
          </button>
        )}
        <div className="mt-6 pt-4 border-t border-gray-800">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Targets</h3>
          {targetsAreAutomatic ? (
            <p className="text-sm text-gray-400">
              Picked automatically: the highest-priority targets that fit {night}. This follows the date until you change
              any target's checkbox, which makes the selection your own.
            </p>
          ) : (
            <>
              {dateChangedSinceChoice && (
                <p className="text-sm text-amber-400 mb-2">
                  ⚠ Your target selection was made for {formatNight(targetsChosenFor)}, but the date is now {night}.
                </p>
              )}
              <p className="text-sm text-gray-400 mb-3">
                You've chosen which targets are enabled. The planner can re-pick them for {night}.
              </p>
              <button
                onClick={() => setConfirmingPick(true)}
                className={`px-3 py-1.5 rounded border text-sm ${dateChangedSinceChoice
                  ? 'border-amber-500/70 text-amber-300 hover:bg-amber-500/10'
                  : 'border-gray-600 text-gray-300 hover:bg-gray-800'}`}
              >
                ✨ Pick best targets for this night…
              </button>
            </>
          )}
        </div>
        <div className="mt-6 pt-4 border-t border-gray-800 flex items-center justify-between gap-4">
          <p className="text-xs text-gray-500">Changes apply immediately.</p>
          <button
            onClick={() => setConfirmingReset(true)}
            className="px-4 py-2 rounded-lg bg-gray-800 border border-red-900 text-red-400 hover:bg-red-950"
          >
            ↺ Reset everything…
          </button>
        </div>
      </Dialog>
      {confirmingReset && (
        <ConfirmDialog
          title="Reset everything?"
          message="This clears your times and settings and every target's custom priority, filter plan and mosaic. The date goes back to the next moonless night, and targets are picked automatically again. It can't be undone. Export first if you want to keep this plan."
          confirmLabel="Reset"
          onCancel={() => setConfirmingReset(false)}
          onConfirm={() => {
            onReset();
            setConfirmingReset(false);
            onClose();
          }}
        />
      )}
      {confirmingPick && (
        <ConfirmDialog
          title="Pick best targets?"
          message={`The planner will schedule every target that's visible on ${night}, highest priority first, and enable only the ones that fit. This replaces which targets are currently enabled. Priorities, filter plans and mosaics you've set are kept. Until you change a checkbox again, the selection follows the date automatically.`}
          confirmLabel="Pick targets"
          onCancel={() => setConfirmingPick(false)}
          onConfirm={() => {
            onPickBestTargets();
            setConfirmingPick(false);
          }}
        />
      )}
    </>
  );
};
