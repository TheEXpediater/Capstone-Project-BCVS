export const ROLE_LABELS = {
  developer: 'MIS',
  super_admin: 'Admin',
  admin: 'Registrar',
  cashier: 'Cashier',
  student: 'Student',
};

export const WEB_ROLE_OPTIONS = [
  { value: 'developer', label: 'MIS' },
  { value: 'super_admin', label: 'Admin' },
  { value: 'admin', label: 'Registrar' },
  { value: 'cashier', label: 'Cashier' },
];

export function formatRole(role) {
  return ROLE_LABELS[role] || String(role || 'Unknown').replace(/_/g, ' ');
}

export function canEditProfileRole(user) {
  return ['developer', 'super_admin'].includes(user?.role);
}
