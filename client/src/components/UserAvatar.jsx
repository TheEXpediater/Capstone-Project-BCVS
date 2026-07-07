import { FaUserCircle } from 'react-icons/fa';
import { resolveAssetUrl } from '../services/api';

function initialsFor(user = {}) {
  const name = user.fullName || user.username || user.email || '';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);

  if (!parts.length) return '';

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function UserAvatar({
  user,
  size = 'md',
  className = '',
  button = false,
  onClick,
  title,
}) {
  const imageUrl = resolveAssetUrl(user?.profilePicture);
  const initials = initialsFor(user);
  const Component = button ? 'button' : 'div';

  return (
    <Component
      type={button ? 'button' : undefined}
      className={`user-avatar user-avatar-${size} ${button ? 'user-avatar-button' : ''} ${className}`.trim()}
      onClick={onClick}
      title={title}
      aria-label={button ? title || 'Profile image' : undefined}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" />
      ) : initials ? (
        <span>{initials}</span>
      ) : (
        <FaUserCircle aria-hidden="true" />
      )}
    </Component>
  );
}
