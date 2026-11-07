export default function UndoToast({
  message,
  onUndo,
  onDismiss,
}: {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fety-undo-toast" role="status">
      <span>{message}</span>
      <button type="button" className="fety-undo-toast-btn" onClick={onUndo}>
        Undo
      </button>
      <button type="button" className="fety-undo-toast-dismiss" aria-label="Dismiss" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}
