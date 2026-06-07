import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import api from '../services/api';

const CASHIER_METRICS = [
  ['unpaidCredentialRequests', 'Unpaid Requests'],
  ['paidCredentialRequests', 'Paid Requests'],
  ['paymentQueueCount', 'Payment Queue'],
];

const FULL_METRICS = [
  ['totalStudents', 'Total Students'],
  ['totalMobileUsers', 'Mobile Users'],
  ['verifiedMobileUsers', 'Verified Mobile Users'],
  ['pendingVerificationRequests', 'Pending Verification'],
  ['totalCredentialDrafts', 'Credential Drafts'],
  ['unpaidCredentialRequests', 'Unpaid Requests'],
  ['paidCredentialRequests', 'Paid Requests'],
  ['signedCredentials', 'Signed Credentials'],
  ['claimReadyCredentials', 'Claim Ready'],
  ['claimedCredentials', 'Claimed Credentials'],
  ['anchorQueueCount', 'Anchor Queue'],
];

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString();
}

function getStatusBadge(status) {
  const normalized = String(status || '').toLowerCase();
  if (['paid', 'verified', 'approved', 'claimed', 'signed'].includes(normalized)) return 'text-bg-success';
  if (['pending', 'unpaid', 'draft'].includes(normalized)) return 'text-bg-warning';
  if (['rejected', 'revoked'].includes(normalized)) return 'text-bg-danger';
  return 'text-bg-secondary';
}

function MetricCard({ label, value }) {
  return (
    <div className="col-sm-6 col-xl-3">
      <div className="border rounded-3 bg-white p-3 h-100">
        <div className="text-muted small">{label}</div>
        <div className="fs-3 fw-bold">{formatNumber(value)}</div>
      </div>
    </div>
  );
}

function PaymentQueueTable({ rows = [] }) {
  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body p-4">
        <h2 className="h5 mb-3">Payment Queue</h2>
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th>Payment Code</th>
                <th>Student</th>
                <th>Credential Type</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Requested</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="fw-semibold">{row.paymentCode || 'Not generated'}</td>
                    <td>
                      <div className="fw-semibold">{row.studentName || '-'}</div>
                      <div className="text-muted small">{row.studentNo || '-'}</div>
                    </td>
                    <td>{row.credentialType || 'student_record'}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(row.paymentStatus)} text-uppercase`}>
                        {row.paymentStatus || 'unpaid'}
                      </span>
                    </td>
                    <td>{Number(row.amount || 0) > 0 ? row.amount : 'Not set'}</td>
                    <td>{formatDate(row.createdAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center text-muted py-4">
                    No unpaid payment requests in the queue.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ActivityTable({ rows = [] }) {
  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body p-4">
        <h2 className="h5 mb-3">Recent Credential Activity</h2>
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th>Type</th>
                <th>Title</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td><span className="badge text-bg-secondary">{row.type}</span></td>
                    <td>
                      <div className="fw-semibold">{row.title || '-'}</div>
                      <div className="text-muted small">{row.body || '-'}</div>
                    </td>
                    <td>{formatDate(row.createdAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="text-center text-muted py-4">
                    No recent credential activity.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function VerificationTable({ rows = [] }) {
  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body p-4">
        <h2 className="h5 mb-3">Recent Verification Submissions</h2>
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th>Name</th>
                <th>Student No</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="fw-semibold">{row.fullName || '-'}</div>
                      <div className="text-muted small">{row.email || '-'}</div>
                    </td>
                    <td>{row.submittedStudentNo || '-'}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(row.status)} text-uppercase`}>
                        {row.status || '-'}
                      </span>
                    </td>
                    <td>{formatDate(row.createdAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="text-center text-muted py-4">
                    No recent verification submissions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useSelector((state) => state.auth);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/dashboard/summary');
      setSummary(response.data.data);
      setFeedback('');
    } catch (error) {
      setFeedback(
        error.response?.data?.message ||
        error.message ||
        'Failed to load dashboard summary.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const roleMode = summary?.roleMode || (user?.role === 'cashier' ? 'cashier' : 'registrar');
  const metricDefs = useMemo(
    () => (roleMode === 'cashier' ? CASHIER_METRICS : FULL_METRICS),
    [roleMode]
  );
  const metrics = summary?.metrics || {};

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
        <div>
          <h1 className="h3 mb-1">BCVS Dashboard</h1>
          <p className="text-muted mb-0">
            Welcome back, {user?.fullName || user?.username || 'User'}.
            <span className="ms-1">Role: <strong>{user?.role || 'unknown'}</strong></span>
          </p>
        </div>
        <button className="btn btn-outline-secondary" onClick={loadSummary} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {feedback ? <div className="alert alert-danger mb-0">{feedback}</div> : null}

      {loading ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">Loading analytics...</div>
        </div>
      ) : (
        <>
          <div className="row g-3">
            {metricDefs.map(([key, label]) => (
              <MetricCard key={key} label={label} value={metrics[key]} />
            ))}
          </div>

          {roleMode === 'cashier' ? (
            <PaymentQueueTable rows={summary?.paymentQueue || []} />
          ) : (
            <>
              <div className="row g-4">
                <div className="col-xl-6">
                  <ActivityTable rows={summary?.recentCredentialActivity || []} />
                </div>
                <div className="col-xl-6">
                  <VerificationTable rows={summary?.recentVerificationSubmissions || []} />
                </div>
              </div>

              {roleMode === 'full' ? (
                <PaymentQueueTable rows={summary?.paymentQueue || []} />
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
}
