import React, { useState } from 'react';
import { Dialog, ConfirmDialog } from './Dialog';
import { FilterControls } from './FilterControls';

interface SettingsDialogProps extends React.ComponentProps<typeof FilterControls> {
  isSyncedToDark: boolean;
  onSyncToDark: () => void;
  onReset: () => void;
  onClose: () => void;
}

// Night settings (date, window, altitude, overheads) plus Reset. Changes apply immediately.
export const SettingsDialog: React.FC<SettingsDialogProps> = ({ isSyncedToDark, onSyncToDark, onReset, onClose, ...controls }) => {
  const [confirmingReset, setConfirmingReset] = useState(false);
  
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
          message="This clears the date, times and settings, which targets are hidden, and every target's custom priority, filter plan and mosaic. It can't be undone. Export first if you want to keep this plan."
          confirmLabel="Reset"
          onCancel={() => setConfirmingReset(false)}
          onConfirm={() => {
            onReset();
            setConfirmingReset(false);
            onClose();
          }}
        />
      )}
    </>
  );
};
