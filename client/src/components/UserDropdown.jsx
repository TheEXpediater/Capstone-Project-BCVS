import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FaChevronDown,
  FaCog,
  FaKey,
  FaSignOutAlt,
  FaUser,
} from 'react-icons/fa';
import UserAvatar from './UserAvatar';
import { formatRole } from '../features/profile/roleLabels';

export default function UserDropdown({ user, onLogout, onResetPassword }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const canOpenSystemSettings = user?.role === 'developer';

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function closeAndRun(action) {
    setOpen(false);
    action?.();
  }

  return (
    <div className="user-dropdown" ref={menuRef}>
      <button
        className="user-dropdown-toggle"
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <UserAvatar user={user} size="sm" />
        <span className="user-dropdown-meta">
          <strong>{user?.fullName || user?.username || 'Unknown user'}</strong>
          <small>{formatRole(user?.role)}</small>
        </span>
        <FaChevronDown className={`user-dropdown-chevron ${open ? 'open' : ''}`} />
      </button>

      {open ? (
        <div className="user-dropdown-menu" role="menu">
          <Link className="user-dropdown-item" to="/profile" role="menuitem" onClick={() => setOpen(false)}>
            <FaUser />
            <span>Profile</span>
          </Link>
          <Link
            className="user-dropdown-item"
            to={canOpenSystemSettings ? '/system-settings' : '/profile'}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <FaCog />
            <span>Settings</span>
          </Link>
          <button
            className="user-dropdown-item"
            type="button"
            role="menuitem"
            onClick={() => closeAndRun(onResetPassword)}
          >
            <FaKey />
            <span>Reset Password</span>
          </button>
          <div className="user-dropdown-divider" />
          <button
            className="user-dropdown-item text-danger"
            type="button"
            role="menuitem"
            onClick={() => closeAndRun(onLogout)}
          >
            <FaSignOutAlt />
            <span>Logout</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
