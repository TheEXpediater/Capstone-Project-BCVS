import { FaChevronDown } from 'react-icons/fa';
import FloatingActionMenu from './FloatingActionMenu';

export default function BulkActionsMenu({
  actions = [],
  selectedCount = 0,
  label = 'Actions',
  buttonClassName = 'btn btn-outline-primary btn-sm',
  menuWidth = 220,
  isOpen,
  onToggle,
  onClose,
  loading = false,
  disabled = false,
}) {
  if (!selectedCount || !actions.length) {
    return null;
  }

  return (
    <FloatingActionMenu
      isOpen={isOpen}
      onToggle={onToggle}
      onClose={onClose}
      buttonClassName={buttonClassName}
      buttonContent={(
        <>
          <span>{label}</span>
          <FaChevronDown className="ms-2" />
        </>
      )}
      ariaLabel={`${label} menu`}
      menuWidth={menuWidth}
    >
      <div className="list-group list-group-flush">
        {actions.map((action) => (
          <button
            key={action.key || action.label}
            type="button"
            className={`list-group-item list-group-item-action${action.variant === 'danger' ? ' text-danger' : ''}`}
            onClick={() => {
              onClose();
              action.onClick?.();
            }}
            disabled={disabled || loading || action.disabled}
          >
            {action.icon ? <span className="me-2">{action.icon}</span> : null}
            {action.label}
          </button>
        ))}
      </div>
    </FloatingActionMenu>
  );
}
