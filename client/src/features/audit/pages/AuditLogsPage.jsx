import { useEffect, useMemo, useState } from 'react';
import {
  FaEye,
  FaTrash,
  FaSyncAlt,
  FaSearch,
  FaTimes,
  FaClipboardList,
} from 'react-icons/fa';
import {
  bulkDeleteAuditLogs,
  deleteAuditLog,
  getAuditLogs,
} from '../auditAPI';

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

function formatDate(value) {
  if (!value) return '—';

  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
}

function titleCase(value = '') {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function actionLabel(value = '') {
  return String(value || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function safeJson(value) {
  try {
    return JSON.stringify(value || {}, null, 2);
  } catch {
    return '{}';
  }
}

function statusBadge(status) {
  if (status === 'success') return 'text-bg-success';
  if (status === 'failed') return 'text-bg-danger';
  return 'text-bg-secondary';
}

function LogDetailsModal({ log, onClose }) {
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
                  {actionLabel(log.action)} • {titleCase(log.module)}
                </p>
              </div>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>

            <div className="modal-body">
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <div className="border rounded-3 p-3 h-100">
                    <div className="small text-muted mb-1">Who</div>
                    <div className="fw-semibold">
                      {log.actor?.fullName || log.actor?.username || log.actor?.email || 'System'}
                    </div>
                    <div className="small text-muted">
                      {log.actor?.email || '—'}
                    </div>
                    <div className="small text-muted">
                      {titleCase(log.actor?.kind || '')} • {titleCase(log.actor?.role || '')}
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="border rounded-3 p-3 h-100">
                    <div className="small text-muted mb-1">When</div>
                    <div className="fw-semibold">{formatDate(log.createdAt)}</div>
                    <div className="small text-muted">
                      Status: <span className={`badge ${statusBadge(log.status)}`}>{titleCase(log.status)}</span>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="border rounded-3 p-3 h-100">
                    <div className="small text-muted mb-1">Module</div>
                    <div className="fw-semibold">{titleCase(log.module)}</div>
                    <div className="small text-muted">{actionLabel(log.action)}</div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="border rounded-3 p-3 h-100">
                    <div className="small text-muted mb-1">Target</div>
                    <div className="fw-semibold">{log.target?.label || log.target?.id || '—'}</div>
                    <div className="small text-muted">
                      {log.target?.type ? titleCase(log.target.type) : '—'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border rounded-3 p-3 mb-3">
                <div className="small text-muted mb-1">Description</div>
                <div>{log.description || log.label || 'No description recorded.'}</div>
              </div>

              <div className="row g-3">
                <div className="col-md-6">
                  <div className="border rounded-3 p-3 h-100">
                    <div className="small text-muted mb-2">Request</div>
                    <div className="small">
                      <div><strong>Method:</strong> {log.request?.method || '—'}</div>
                      <div><strong>Path:</strong> {log.request?.path || '—'}</div>
                      <div><strong>IP:</strong> {log.request?.ipAddress || '—'}</div>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="border rounded-3 p-3 h-100">
                    <div className="small text-muted mb-2">Metadata</div>
                    <pre className="small bg-light border rounded p-2 mb-0" style={{ maxHeight: 220, overflow: 'auto' }}>
                      {safeJson(log.metadata)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
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

export default function AuditLogsPage() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  });
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [filters, setFilters] = useState({
    search: '',
    module: '',
    actorKind: '',
    status: '',
  });

  const allSelected = useMemo(
    () => rows.length > 0 && rows.every((row) => selectedIds.includes(row._id)),
    [rows, selectedIds]
  );

  async function loadLogs(nextPage = pagination.page) {
    try {
      setLoading(true);
      setFeedback({ type: '', text: '' });

      const data = await getAuditLogs({
        page: nextPage,
        limit: pagination.limit,
        search: filters.search || undefined,
        module: filters.module || undefined,
        actorKind: filters.actorKind || undefined,
        status: filters.status || undefined,
      });

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

  function toggleOne(id) {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(rows.map((row) => row._id));
    }
  }

  async function handleDeleteOne(id) {
    if (!window.confirm('Delete this audit log?')) return;

    try {
      await deleteAuditLog(id);
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

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  function clearFilters() {
    setFilters({
      search: '',
      module: '',
      actorKind: '',
      status: '',
    });
    setTimeout(() => loadLogs(1), 0);
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-hero">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div className="text-start">
            <div className="d-flex align-items-center gap-2 mb-2">
              <FaClipboardList className="text-primary" />
              <h1 className="dashboard-title mb-0">Action Logs</h1>
            </div>
            <p className="dashboard-subtitle">
              Review MIS activity, credential actions, web-user changes, and minimal mobile activity.
            </p>
          </div>

          <button className="btn btn-outline-primary" onClick={() => loadLogs(pagination.page)} disabled={loading}>
            <FaSyncAlt className="me-2" />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {feedback.text ? (
        <div className={`alert alert-${feedback.type || 'info'} mb-0`}>
          {feedback.text}
        </div>
      ) : null}

      <div className="content-card">
        <div className="content-card-header">
          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <label className="form-label small text-muted">Search</label>
              <div className="input-group">
                <span className="input-group-text"><FaSearch /></span>
                <input
                  className="form-control"
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Search user, module, action, target..."
                />
              </div>
            </div>

            <div className="col-md-2">
              <label className="form-label small text-muted">Module</label>
              <select
                className="form-select"
                name="module"
                value={filters.module}
                onChange={handleFilterChange}
              >
                {MODULE_OPTIONS.map((item) => (
                  <option key={item || 'all'} value={item}>
                    {item ? titleCase(item) : 'All modules'}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-2">
              <label className="form-label small text-muted">Actor</label>
              <select
                className="form-select"
                name="actorKind"
                value={filters.actorKind}
                onChange={handleFilterChange}
              >
                {ACTOR_KIND_OPTIONS.map((item) => (
                  <option key={item || 'all'} value={item}>
                    {item ? titleCase(item) : 'All actors'}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-2">
              <label className="form-label small text-muted">Status</label>
              <select
                className="form-select"
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
              >
                <option value="">All status</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="info">Info</option>
              </select>
            </div>

            <div className="col-md-2 d-flex gap-2">
              <button className="btn btn-primary flex-fill" onClick={() => loadLogs(1)}>
                Apply
              </button>
              <button className="btn btn-outline-secondary" onClick={clearFilters} title="Clear filters">
                <FaTimes />
              </button>
            </div>
          </div>
        </div>

        <div className="content-card-body">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <div className="small text-muted">
              Showing {rows.length} of {pagination.total} log(s)
            </div>

            <button
              className="btn btn-outline-danger btn-sm"
              onClick={handleBulkDelete}
              disabled={!selectedIds.length}
            >
              <FaTrash className="me-2" />
              Delete Selected ({selectedIds.length})
            </button>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead>
                <tr>
                  <th style={{ width: 42 }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  </th>
                  <th>Time</th>
                  <th>Who</th>
                  <th>Role</th>
                  <th>Module</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" className="text-center text-muted py-4">
                      Loading action logs...
                    </td>
                  </tr>
                ) : rows.length ? (
                  rows.map((log) => (
                    <tr key={log._id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(log._id)}
                          onChange={() => toggleOne(log._id)}
                        />
                      </td>

                      <td>
                        <div className="small">{formatDate(log.createdAt)}</div>
                      </td>

                      <td>
                        <div className="fw-semibold">
                          {log.actor?.fullName || log.actor?.username || 'System'}
                        </div>
                        <div className="small text-muted">
                          {log.actor?.email || titleCase(log.actor?.kind || '')}
                        </div>
                      </td>

                      <td>
                        <span className="badge text-bg-light border">
                          {titleCase(log.actor?.role || 'system')}
                        </span>
                      </td>

                      <td>{titleCase(log.module)}</td>

                      <td>
                        <div className="fw-semibold">{actionLabel(log.action)}</div>
                        <div className="small text-muted">{log.label || log.description || ''}</div>
                      </td>

                      <td>
                        <div>{log.target?.label || log.target?.id || '—'}</div>
                        <div className="small text-muted">
                          {log.target?.type ? titleCase(log.target.type) : ''}
                        </div>
                      </td>

                      <td>
                        <span className={`badge ${statusBadge(log.status)}`}>
                          {titleCase(log.status)}
                        </span>
                      </td>

                      <td className="text-end">
                        <div className="btn-group">
                          <button
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => setSelectedLog(log)}
                          >
                            <FaEye className="me-1" />
                            View
                          </button>
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => handleDeleteOne(log._id)}
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="text-center text-muted py-4">
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

      <LogDetailsModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
}