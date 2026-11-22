import React, { useEffect, useRef } from 'react';

interface DialogProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string; // Tailwind max-width class
  layer?: string; // Tailwind z-index class, for dialogs opened on top of another dialog
}

// Centered modal. Closes on Escape, the ✕ button, or a click on the backdrop.
// With dialogs stacked, Escape only closes the topmost one (the last in the page).
export const Dialog: React.FC<DialogProps> = ({ title, onClose, children, maxWidth = 'max-w-2xl', layer = 'z-50' }) => {
  const panel = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (e.key === 'Escape' && dialogs[dialogs.length - 1] === panel.current) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  
  return (
    <div
      className={`fixed inset-0 ${layer} bg-black/60 flex items-center justify-center p-4`}
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-gray-900 border border-gray-700 rounded-lg w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white px-2" aria-label="Close">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// Yes/no confirmation for destructive actions
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ title, message, confirmLabel, onConfirm, onCancel }) => (
  <Dialog title={title} onClose={onCancel} maxWidth="max-w-md" layer="z-[60]">
    <p className="text-sm text-gray-300">{message}</p>
    <div className="flex justify-end gap-2 mt-5">
      <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700">
        Cancel
      </button>
      <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-red-700 text-white hover:bg-red-600">
        {confirmLabel}
      </button>
    </div>
  </Dialog>
);
