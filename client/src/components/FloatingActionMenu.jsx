import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function getMenuPosition(trigger, menu, width) {
  if (!trigger) return {};

  const rect = trigger.getBoundingClientRect();
  const gap = 6;
  const viewportPadding = 12;
  const menuWidth = width || menu?.offsetWidth || 220;
  const menuHeight = menu?.offsetHeight || 220;
  const left = Math.min(
    window.innerWidth - menuWidth - viewportPadding,
    Math.max(viewportPadding, rect.right - menuWidth)
  );
  let top = rect.bottom + gap;

  if (top + menuHeight > window.innerHeight - viewportPadding) {
    const aboveTop = rect.top - menuHeight - gap;
    if (aboveTop >= viewportPadding) {
      top = aboveTop;
    }
  }

  return {
    position: 'fixed',
    top,
    left,
    minWidth: menuWidth,
    zIndex: 1085,
  };
}

export default function FloatingActionMenu({
  isOpen,
  onToggle,
  onClose,
  buttonClassName = 'btn btn-outline-secondary btn-sm',
  buttonContent,
  ariaLabel = 'Open actions',
  menuWidth = 220,
  children,
}) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [position, setPosition] = useState({});

  useEffect(() => {
    if (!isOpen) return undefined;

    function updatePosition() {
      setPosition(getMenuPosition(triggerRef.current, menuRef.current, menuWidth));
    }

    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, menuWidth]);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handlePointerDown(event) {
      if (
        triggerRef.current?.contains(event.target) ||
        menuRef.current?.contains(event.target)
      ) {
        return;
      }

      onClose();
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <span className="floating-action-menu">
      <button
        ref={triggerRef}
        type="button"
        className={buttonClassName}
        onClick={onToggle}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
      >
        {buttonContent}
      </button>

      {isOpen
        ? createPortal(
            <div
              ref={menuRef}
              className="floating-action-menu-panel card shadow-sm text-start"
              style={position}
              role="menu"
            >
              {children}
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
