import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  FaClipboardCheck,
  FaClock,
  FaFileSignature,
  FaInbox,
  FaMoneyBillWave,
  FaShieldAlt,
  FaSyncAlt,
  FaUserCheck,
  FaUserGraduate,
} from 'react-icons/fa';
import api from '../services/api';

const LATEST_LIMIT = 5;

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function formatShortDate(value) {
  if (!value) return '-';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function titleCase(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || '-';
}

function getStatusBadge(status) {
  const normalized = String(status || '').toLowerCase();

  if (['paid', 'verified', 'approved', 'claimed', 'signed', 'claim_ready'].includes(normalized)) {
    return 'text-bg-success';
  }

  if (['pending', 'unpaid', 'draft', 'queued_for_anchor', 'anchor_scheduled'].includes(normalized)) {
    return 'text-bg-warning';
  }

  if (['rejected', 'revoked', 'failed', 'cancelled'].includes(normalized)) {
    return 'text-bg-danger';
  }

  return 'text-bg-secondary';
}

function EmptyState({ text }) {
  return (
    <div className="text-center text-muted py-4">
      <FaInbox className="mb-2" />
      <div>{text}</div>
    </div>
  );
}

function SummaryCard({ icon, label, value, helper }) {
  const Icon = icon;

  return (
    <div className="col-sm-6 col-xl-3">
      <div className="content-card h-100">
        <div className="content-card-body">
          <div className="d-flex justify-content-between align-items-start gap-3">
            <div>
              <div className="stat-label mb-2">{label}</div>
              <div className="display-6 fw-bold text-dark lh-1">{formatNumber(value)}</div>
            </div>
            <div className="rounded-3 bg-light border d-inline-flex align-items-center justify-content-center p-3 text-secondary">
              <Icon />
            </div>
          </div>
          {helper ? <div className="small text-muted mt-3">{helper}</div> : null}
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, helper }) {
  return (
    <div className="border rounded-3 p-3 bg-light h-100">
      <div className="small text-muted text-uppercase fw-semibold">{label}</div>
      <div className="fs-4 fw-bold text-dark mt-1">{formatNumber(value)}</div>
      {helper ? <div className="small text-muted mt-1">{helper}</div> : null}
    </div>
  );
}

function OperationsSummary({ metrics = {}, roleMode }) {
  const showPaymentQueue = ['cashier', 'full'].includes(roleMode);

  return (
    <div className="content-card h-100">
      <div className="content-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h2 className="h5 mb-1">Credential Operations</h2>
          <p className="text-muted small mb-0">Merged view of active credential processing queues.</p>
        </div>
        <span className="badge text-bg-light border text-secondary">Live summary</span>
      </div>
      <div className="content-card-body">
        <div className="row g-3">
          <div className="col-sm-6 col-xl-3">
            <MiniMetric
              label="Signed"
              value={metrics.signedCredentials}
              helper="Credentials already signed"
            />
          </div>
          <div className="col-sm-6 col-xl-3">
            <MiniMetric
              label="Claim Ready"
              value={metrics.claimReadyCredentials}
              helper="Ready for holder claim"
            />
          </div>
          <div className="col-sm-6 col-xl-3">
            <MiniMetric
              label="Claimed"
              value={metrics.claimedCredentials}
              helper="Released to holders"
            />
          </div>
          <div className="col-sm-6 col-xl-3">
            <MiniMetric
              label="Anchor Queue"
              value={metrics.anchorQueueCount}
              helper="Waiting for anchoring"
            />
          </div>
        </div>

        <div className="row g-3 mt-1">
          <div className={showPaymentQueue ? 'col-md-4' : 'col-md-6'}>
            <div className="d-flex align-items-center gap-3 border rounded-3 p-3 h-100">
              <FaClipboardCheck className="text-secondary" />
              <div>
                <div className="small text-muted">Pending Verification</div>
                <div className="fw-bold text-dark">{formatNumber(metrics.pendingVerificationRequests)}</div>
              </div>
            </div>
          </div>
          {showPaymentQueue ? (
            <div className="col-md-4">
              <div className="d-flex align-items-center gap-3 border rounded-3 p-3 h-100">
                <FaMoneyBillWave className="text-secondary" />
                <div>
                  <div className="small text-muted">Payment Queue</div>
                  <div className="fw-bold text-dark">{formatNumber(metrics.paymentQueueCount)}</div>
                </div>
              </div>
            </div>
          ) : null}
          <div className={showPaymentQueue ? 'col-md-4' : 'col-md-6'}>
            <div className="d-flex align-items-center gap-3 border rounded-3 p-3 h-100">
              <FaShieldAlt className="text-secondary" />
              <div>
                <div className="small text-muted">Verified Mobile Users</div>
                <div className="fw-bold text-dark">{formatNumber(metrics.verifiedMobileUsers)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LatestCredentialActivity({ rows = [] }) {
  const latestRows = rows.slice(0, LATEST_LIMIT);

  return (
    <div className="content-card h-100">
      <div className="content-card-header d-flex justify-content-between align-items-start gap-3">
        <div>
          <h2 className="h5 mb-1">Latest Credential Activity</h2>
          <p className="text-muted small mb-0">Showing the latest {LATEST_LIMIT} updates only.</p>
        </div>
        <span className="badge text-bg-light border text-secondary">{latestRows.length}</span>
      </div>
      <div className="content-card-body p-0">
        {latestRows.length ? (
          <div className="list-group list-group-flush">
            {latestRows.map((row) => (
              <div className="list-group-item px-4 py-3" key={row.id}>
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div className="min-w-0" style={{ minWidth: 0 }}>
                    <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                      <span className="badge text-bg-secondary">{titleCase(row.type)}</span>
                      <span className="small text-muted">{formatShortDate(row.createdAt)}</span>
                    </div>
                    <div className="fw-semibold text-dark text-truncate">{row.title || '-'}</div>
                    <div className="small text-muted text-truncate">{row.body || 'No additional details.'}</div>
                  </div>
                  <FaClock className="text-muted mt-1 flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="No recent credential activity." />
        )}
      </div>
    </div>
  );
}

function LatestVerificationSubmissions({ rows = [] }) {
  const latestRows = rows.slice(0, LATEST_LIMIT);

  return (
    <div className="content-card h-100">
      <div className="content-card-header d-flex justify-content-between align-items-start gap-3">
        <div>
          <h2 className="h5 mb-1">Latest Verification Submissions</h2>
          <p className="text-muted small mb-0">Only the latest {LATEST_LIMIT} submissions are shown.</p>
        </div>
        <span className="badge text-bg-light border text-secondary">{latestRows.length}</span>
      </div>
      <div className="content-card-body p-0">
        {latestRows.length ? (
          <div className="list-group list-group-flush">
            {latestRows.map((row) => (
              <div className="list-group-item px-4 py-3" key={row.id}>
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div className="min-w-0" style={{ minWidth: 0 }}>
                    <div className="fw-semibold text-dark text-truncate">{row.fullName || '-'}</div>
                    <div className="small text-muted text-truncate">{row.email || 'No email provided'}</div>
                    <div className="small text-muted mt-1">
                      Student No: <span className="fw-semibold">{row.submittedStudentNo || '-'}</span>
                      <span className="mx-2">|</span>
                      {formatShortDate(row.createdAt)}
                    </div>
                  </div>
                  <span className={`badge ${getStatusBadge(row.status)} text-uppercase flex-shrink-0`}>
                    {row.status || '-'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="No recent verification submissions." />
        )}
      </div>
    </div>
  );
}

function PaymentQueuePanel({ rows = [] }) {
  const latestRows = rows.slice(0, LATEST_LIMIT);

  return (
    <div className="content-card">
      <div className="content-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h2 className="h5 mb-1">Latest Payment Queue</h2>
          <p className="text-muted small mb-0">Showing the latest {LATEST_LIMIT} unpaid credential requests.</p>
        </div>
        <span className="badge text-bg-warning">For cashier review</span>
      </div>
      <div className="content-card-body p-0">
        {latestRows.length ? (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Payment Code</th>
                  <th>Student</th>
                  <th>Credential</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Requested</th>
                </tr>
              </thead>
              <tbody>
                {latestRows.map((row) => (
                  <tr key={row.id}>
                    <td className="fw-semibold">{row.paymentCode || 'Not generated'}</td>
                    <td>
                      <div className="fw-semibold">{row.studentName || '-'}</div>
                      <div className="text-muted small">{row.studentNo || '-'}</div>
                    </td>
                    <td>{titleCase(row.credentialType || 'student_record')}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(row.paymentStatus)} text-uppercase`}>
                        {row.paymentStatus || 'unpaid'}
                      </span>
                    </td>
                    <td>{Number(row.amount || 0) > 0 ? `PHP ${formatNumber(row.amount)}` : 'Not set'}</td>
                    <td>{formatShortDate(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="No unpaid payment requests in the queue." />
        )}
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
  const metrics = summary?.metrics || {};

  const primaryMetrics = useMemo(() => {
    if (roleMode === 'cashier') {
      return [
        {
          key: 'paymentQueueCount',
          label: 'Payment Queue',
          value: metrics.paymentQueueCount,
          helper: 'Unpaid requests requiring review',
          icon: FaMoneyBillWave,
        },
        {
          key: 'paidCredentialRequests',
          label: 'Paid Requests',
          value: metrics.paidCredentialRequests,
          helper: 'Payment already recorded',
          icon: FaClipboardCheck,
        },
        {
          key: 'unpaidCredentialRequests',
          label: 'Unpaid Requests',
          value: metrics.unpaidCredentialRequests,
          helper: 'Still waiting for payment',
          icon: FaClock,
        },
        {
          key: 'totalCredentialDrafts',
          label: 'Credential Drafts',
          value: metrics.totalCredentialDrafts,
          helper: 'Total credential requests in system',
          icon: FaFileSignature,
        },
      ];
    }

    return [
      {
        key: 'totalStudents',
        label: 'Student Records',
        value: metrics.totalStudents,
        helper: 'Registered student profiles',
        icon: FaUserGraduate,
      },
      {
        key: 'totalCredentialDrafts',
        label: 'Credential Drafts',
        value: metrics.totalCredentialDrafts,
        helper: 'Prepared credential records',
        icon: FaFileSignature,
      },
      {
        key: 'pendingVerificationRequests',
        label: 'Pending Verification',
        value: metrics.pendingVerificationRequests,
        helper: 'Submissions awaiting review',
        icon: FaClipboardCheck,
      },
      {
        key: 'verifiedMobileUsers',
        label: 'Verified Holders',
        value: metrics.verifiedMobileUsers,
        helper: `Out of ${formatNumber(metrics.totalMobileUsers)} mobile users`,
        icon: FaUserCheck,
      },
    ];
  }, [metrics, roleMode]);

  return (
    <div className="dashboard-page">
      <div className="dashboard-hero">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div>
            <h2 className="dashboard-title">Operations Overview</h2>
            <p className="dashboard-subtitle">
              Monitor credential issuance, verification queues, and student record activity.
            </p>
            <div className="small text-muted mt-3">
              Signed in as <strong>{user?.fullName || user?.username || 'User'}</strong>
              <span className="mx-2">|</span>
              Role: <strong>{titleCase(user?.role || 'unknown')}</strong>
            </div>
          </div>
          <button className="btn btn-outline-primary" onClick={loadSummary} disabled={loading}>
            <FaSyncAlt className="me-2" />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {feedback ? <div className="alert alert-danger mb-0">{feedback}</div> : null}

      {loading ? (
        <div className="content-card">
          <div className="content-card-body">Loading dashboard summary...</div>
        </div>
      ) : (
        <>
          <div className="row g-3">
            {primaryMetrics.map((item) => (
              <SummaryCard
                key={item.key}
                icon={item.icon}
                label={item.label}
                value={item.value}
                helper={item.helper}
              />
            ))}
          </div>

          {roleMode === 'cashier' ? (
            <PaymentQueuePanel rows={summary?.paymentQueue || []} />
          ) : (
            <>
              <OperationsSummary metrics={metrics} roleMode={roleMode} />

              <div className="row g-4">
                <div className="col-xl-6">
                  <LatestCredentialActivity rows={summary?.recentCredentialActivity || []} />
                </div>
                <div className="col-xl-6">
                  <LatestVerificationSubmissions rows={summary?.recentVerificationSubmissions || []} />
                </div>
              </div>

              {roleMode === 'full' ? (
                <PaymentQueuePanel rows={summary?.paymentQueue || []} />
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
}
