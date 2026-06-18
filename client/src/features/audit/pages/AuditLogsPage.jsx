import { useEffect, useMemo, useState } from 'react';
import {
  FaEye,
  FaFilter,
  FaSearch,
  FaSyncAlt,
  FaTimes,
  FaTrash,
} from 'react-icons/fa';
import {
  bulkDeleteAuditLogs,
  deleteAuditLog,
  getAuditLogs,
} from '../auditAPI';

const ACTION_LABELS = {
  UPDATE_DRAFT: 'Updated credential draft',
  SUBMIT_DRAFT: 'Submitted credential draft',
  REJECT_DRAFT: 'Rejected credential draft',
  SIGN_DRAFT: 'Signed credential',
  GENERATE_CLAIM_QR: 'Generated claim QR',
  GENERATE_CLAIM_OVERRIDE_QR: 'Generated override claim QR',
  DELETE_DRAFT: 'Deleted credential draft',
  MARK_PAYMENT_PAID: 'Marked payment as paid',
  SCHEDULE_ANCHOR: 'Scheduled anchoring',
  PROCESS_ANCHOR_QUEUE: 'Processed anchor queue',
  CLAIM_CREDENTIAL: 'Student claimed credential',
  MOBILE_REQUEST_CREDENTIAL: 'Student requested credential',
  CREATE_VERIFICATION_SESSION: 'Created verification session',
  APPROVE_VERIFICATION: 'Approved verification request',
  DENY_VERIFICATION: 'Denied verification request',
  WEB_LOGIN: 'Web login',
  MOBILE_LOGIN: 'Mobile login',
  UPDATE_NETWORK_SETTINGS: 'Updated network settings',
  UPDATE_SYSTEM_SETTINGS: 'Updated system settings',
};

const MODULE_OPTIONS = [
  '',
  'auth',
  'users',
  'roles',
  'credentials',
  'verification',
  'students',
  'curriculum',
  'contracts',
  'settings',
  'network',
  'mobile',
  'system',
];

const ACTOR_KIND_OPTIONS = ['', 'web', 'mobile', 'system'];
const ROLE_OPTIONS = ['', 'developer', 'super_admin', 'admin', 'cashier', 'student', 'system'];

function formatDate(value) {
  if (!value) return '-';

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString();
}

function titleCase(value = '') {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function actionLabel(value = '') {
  return ACTION_LABELS[value] || titleCase(value);
}

function actorName(log) {
  return log.actor?.fullName || log.actor?.username || log.actor?.email || 'System';
}

function targetLabel(log) {
  return log.target?.label || log.target?.id || '-';
}

function safeJson(value) {
  try {
    return JSON.stringify(value || {}, null, 2);
  } catch {
    return '{}';
  }
}

function FilterModal({ filters, onChange, onApply, onClear, onClose }) {
  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 className="h5 mb-1">Filter Action Logs</h2>
                <p className="text-muted mb-0 small">Narrow logs by module, user type, role, date, or status.</p>
              </div>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>

            <div className="modal-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label small text-muted">Module</label>
                  <select className="form-select" name="module" value={filters.module} onChange={onChange}>
                    {MODULE_OPTIONS.map((item) => (
                      <option key={item || 'all'} value={item}>
                        {item ? titleCase(item) : 'All modules'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label small text-muted">Actor type</label>
                  <select className="form-select" name="actorKind" value={filters.actorKind} onChange={onChange}>
                    {ACTOR_KIND_OPTIONS.map((item) => (
                      <option key={item || 'all'} value={item}>
                        {item ? titleCase(item) : 'All actors'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label small text-muted">Role</label>
                  <select className="form-select" name="role" value={filters.role} onChange={onChange}>
                    {ROLE_OPTIONS.map((item) => (
                      <option key={item || 'all'} value={item}>
                        {item ? titleCase(item) : 'All roles'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label small text-muted">Status</label>
                  <select className="form-select" name="status" value={filters.status} onChange={onChange}>
                    <option value="">All status</option>
                    <option value="success">Success</option>
                    <option value="failed">Failed</option>
                    <option value="info">Info</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label small text-muted">Date from</label>
                  <input className="form-control" type="date" name="from" value={filters.from} onChange={onChange} />
                </div>

                <div className="col-md-6">
                  <label className="form-label small text-muted">Date to</label>
                  <input className="form-control" type="date" name="to" value={filters.to} onChange={onChange} />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClear}>
                <FaTimes className="me-2" />
                Clear
              </button>
              <button className="btn btn-primary" onClick={onApply}>
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" onClick={onClose} />
    </>
  );
}

function LogDetailsModal({ log, onClose, onDelete }) {
  if (!log) return null;

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 className="h5 mb-1">Action Log Details</h2>
                <p className="text-muted mb-0 small">
                  {actionLabel(log.action)} - {titleCase(log.module)}
                </p>
              </div>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>

            <div className="modal-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="border rounded-3 p-3 h-100">
                    <div className="small text-muted">User</div>
                    <div className="fw-semibold">{actorName(log)}</div>
                    <div className="small text-muted">{log.actor?.email || titleCase(log.actor?.kind || 'system')}</div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="border rounded-3 p-3 h-100">
                    <div className="small text-muted">Role</div>
                    <div className="fw-semibold">{titleCase(log.actor?.role || 'system')}</div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="border rounded-3 p-3 h-100">
                    <div className="small text-muted">Module</div>
                    <div className="fw-semibold">{titleCase(log.module)}</div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="border rounded-3 p-3 h-100">
                    <div className="small text-muted">Action</div>
                    <div className="fw-semibold">{actionLabel(log.action)}</div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="border rounded-3 p-3 h-100">
                    <div className="small text-muted">Target</div>
                    <div className="fw-semibold">{targetLabel(log)}</div>
                    <div className="small text-muted">{log.target?.type ? titleCase(log.target.type) : '-'}</div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="border rounded-3 p-3 h-100">
                    <div className="small text-muted">Timestamp</div>
                    <div className="fw-semibold">{formatDate(log.createdAt)}</div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="border rounded-3 p-3 h-100">
                    <div className="small text-muted">IP</div>
                    <div className="fw-semibold text-break">{log.request?.ipAddress || '-'}</div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="border rounded-3 p-3 h-100">
                    <div className="small text-muted">Request path</div>
                    <div className="fw-semibold text-break">{log.request?.path || '-'}</div>
                  </div>
                </div>
              </div>

              <div className="border rounded-3 p-3 mt-3">
                <div className="small text-muted mb-1">Safe metadata</div>
                <div>{log.description || log.label || 'No description recorded.'}</div>
                <details className="mt-3">
                  <summary className="fw-semibold">Advanced details</summary>
                  <pre className="small bg-light border rounded p-2 mt-2 mb-0" style={{ maxHeight: 220, overflow: 'auto' }}>
                    {safeJson(log.metadata)}
                  </pre>
                </details>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-danger" onClick={() => onDelete(log._id)}>
                <FaTrash className="me-2" />
                Delete
              </button>
              <button className="btn btn-outline-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

export default function AuditLogsPage({ embedded = false }) {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  });
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [filters, setFilters] = useState({
    search: '',
    module: '',
    actorKind: '',
    role: '',
    status: '',
    from: '',
    to: '',
  });

  const allSelected = useMemo(
    () => rows.length > 0 && rows.every((row) => selectedIds.includes(row._id)),
    [rows, selectedIds]
  );

  function requestParams(nextPage, nextFilters = filters) {
    return {
      page: nextPage,
      limit: pagination.limit,
      search: nextFilters.search || undefined,
      module: nextFilters.module || undefined,
      actorKind: nextFilters.actorKind || undefined,
      role: nextFilters.role || undefined,
      status: nextFilters.status || undefined,
      from: nextFilters.from || undefined,
      to: nextFilters.to || undefined,
    };
  }

  async function loadLogs(nextPage = pagination.page, nextFilters = filters) {
    try {
      setLoading(true);
      setFeedback({ type: '', text: '' });

      const data = await getAuditLogs(requestParams(nextPage, nextFilters));

      setRows(data.logs || []);
      setPagination(data.pagination || {
        page: nextPage,
        limit: 20,
        total: 0,
        pages: 1,
      });
      setSelectedIds([]);
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to load audit logs.',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs(1);
  }, []);

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  function applyFilters() {
    setShowFilterModal(false);
    loadLogs(1);
  }

  function clearFilters() {
    const nextFilters = {
      search: '',
      module: '',
      actorKind: '',
      role: '',
      status: '',
      from: '',
      to: '',
    };
    setFilters(nextFilters);
    setShowFilterModal(false);
    loadLogs(1, nextFilters);
  }

  function toggleOne(id) {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  }

  function toggleAll() {
    setSelectedIds(allSelected ? [] : rows.map((row) => row._id));
  }

  async function handleDeleteOne(id) {
    if (!window.confirm('Delete this audit log?')) return;

    try {
      await deleteAuditLog(id);
      setSelectedLog(null);
      setFeedback({ type: 'success', text: 'Audit log deleted.' });
      await loadLogs(pagination.page);
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to delete audit log.',
      });
    }
  }

  async function handleBulkDelete() {
    if (!selectedIds.length) return;

    if (!window.confirm(`Delete ${selectedIds.length} selected audit log(s)?`)) {
      return;
    }

    try {
      await bulkDeleteAuditLogs(selectedIds);
      setFeedback({ type: 'success', text: 'Selected audit logs deleted.' });
      await loadLogs(pagination.page);
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to delete selected audit logs.',
      });
    }
  }

  return (
    <div className={embedded ? '' : 'dashboard-page'}>
      {!embedded ? (
        <div className="dashboard-hero">
          <div className="text-start">
            <h1 className="dashboard-title mb-1">Action Logs</h1>
            <p className="dashboard-subtitle">Review MIS activity and credential actions.</p>
          </div>
        </div>
      ) : null}

      {feedback.text ? (
        <div className={`alert alert-${feedback.type || 'info'} mb-3`}>
          {feedback.text}
        </div>
      ) : null}

      <div className="content-card">
        <div className="content-card-header">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div>
              <h2 className="h5 mb-1">Action Logs</h2>
              <p className="text-muted mb-0 small">Readable audit trail for MIS review.</p>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => loadLogs(pagination.page)} disabled={loading}>
                <FaSyncAlt className="me-2" />
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                className="btn btn-outline-danger btn-sm"
                onClick={handleBulkDelete}
                disabled={!selectedIds.length}
              >
                <FaTrash className="me-2" />
                Delete Selected ({selectedIds.length})
              </button>
            </div>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
            <div className="input-group" style={{ maxWidth: 420 }}>
              <span className="input-group-text"><FaSearch /></span>
              <input
                className="form-control"
                name="search"
                value={filters.search}
                onChange={handleFilterChange}
                placeholder="Search user, module, action, target..."
              />
              <button className="btn btn-primary" onClick={() => loadLogs(1)}>
                Search
              </button>
            </div>
            <button className="btn btn-outline-secondary" onClick={() => setShowFilterModal(true)} title="Filters">
              <FaFilter />
            </button>
          </div>
        </div>

        <div className="content-card-body">
          <div className="small text-muted mb-3">
            Showing {rows.length} of {pagination.total} log(s)
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Module</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>View</th>
                  <th style={{ width: 64 }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all logs" />
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="text-center text-muted py-4">
                      Loading action logs...
                    </td>
                  </tr>
                ) : rows.length ? (
                  rows.map((log) => (
                    <tr key={log._id}>
                      <td className="small">{formatDate(log.createdAt)}</td>
                      <td>
                        <div className="fw-semibold">{actorName(log)}</div>
                        <div className="small text-muted">{log.actor?.email || titleCase(log.actor?.kind || '')}</div>
                      </td>
                      <td>
                        <span className="badge text-bg-light border">
                          {titleCase(log.actor?.role || 'system')}
                        </span>
                      </td>
                      <td>{titleCase(log.module)}</td>
                      <td>{actionLabel(log.action)}</td>
                      <td>
                        <div>{targetLabel(log)}</div>
                        <div className="small text-muted">{log.target?.type ? titleCase(log.target.type) : ''}</div>
                      </td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-primary" onClick={() => setSelectedLog(log)}>
                            <FaEye className="me-1" />
                            View
                          </button>
                          <button className="btn btn-outline-danger" onClick={() => handleDeleteOne(log._id)} title="Delete log">
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(log._id)}
                          onChange={() => toggleOne(log._id)}
                          aria-label={`Select log ${log._id}`}
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="text-center text-muted py-4">
                      No audit logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
            <button
              className="btn btn-outline-secondary btn-sm"
              disabled={pagination.page <= 1 || loading}
              onClick={() => loadLogs(pagination.page - 1)}
            >
              Previous
            </button>

            <div className="small text-muted">
              Page {pagination.page} of {pagination.pages}
            </div>

            <button
              className="btn btn-outline-secondary btn-sm"
              disabled={pagination.page >= pagination.pages || loading}
              onClick={() => loadLogs(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showFilterModal ? (
        <FilterModal
          filters={filters}
          onChange={handleFilterChange}
          onApply={applyFilters}
          onClear={clearFilters}
          onClose={() => setShowFilterModal(false)}
        />
      ) : null}

      <LogDetailsModal
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
        onDelete={handleDeleteOne}
      />
    </div>
  );
}
