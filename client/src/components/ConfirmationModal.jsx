export default function ConfirmationModal({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  busy = false,
  onCancel,
  onConfirm,
  children,
}) {
  if (!open) return null;

  return (
    <>
      <div className="modal d-block enterprise-modal" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <h2 className="h5 mb-0">{title}</h2>
              <button
                type="button"
                className="btn-close"
                onClick={onCancel}
                disabled={busy}
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              {message ? <p className="mb-0">{message}</p> : null}
              {children}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onCancel} disabled={busy}>
                {cancelText}
              </button>
              <button className={`btn btn-${variant}`} onClick={onConfirm} disabled={busy}>
                {busy ? 'Processing...' : confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
