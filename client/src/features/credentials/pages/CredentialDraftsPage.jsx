import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { hasValidStoredAuth } from '../../auth/authStorage';
import {
  createCredentialClaimToken,
  getCredentialDraftById,
  listCredentialPayments,
  listCredentialDrafts,
  markCredentialPaymentPaid,
  rejectCredentialDraft,
  scheduleCredentialAnchor,
  signCredentialDraft,
  submitCredentialDraft,
} from '../credentialsAPI';

function formatDate(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString();
}

function getStatusBadge(status) {
  const map = {
    draft: 'text-bg-secondary',
    for_signature: 'text-bg-warning',
    signed: 'text-bg-primary',
    claim_ready: 'text-bg-info',
    claimed: 'text-bg-success',
    shared: 'text-bg-success',
    revoked: 'text-bg-dark',
    rejected: 'text-bg-danger',
    queued_for_anchor: 'text-bg-info',
    anchored: 'text-bg-success',
  };

  return map[status] || 'text-bg-secondary';
}

function isPaid(draft) {
  return String(draft?.paymentStatus || 'unpaid').toLowerCase() === 'paid';
}

function getPaymentBadge(draft) {
  return isPaid(draft) ? 'text-bg-success' : 'text-bg-warning';
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 'Not set';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'PHP',
  }).format(amount);
}

const CLAIM_QR_STATUSES = new Set(['signed', 'claim_ready', 'anchored']);

function DraftDetailsModal({ draft, onClose }) {
  if (!draft) return null;

  const profile = draft.profileSnapshot || {};
  const grades = draft.gradesSnapshot || [];
  const signedProof = draft.signedCredential?.proof || null;

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-xl modal-dialog-centered">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 className="h5 mb-1">Credential Draft Details</h2>
                <p className="text-muted mb-0 small">
                  {draft.studentNo} — {draft.studentName}
                </p>
              </div>

              <button
                type="button"
                className="btn-close"
                onClick={onClose}
                aria-label="Close"
              />
            </div>

            <div className="modal-body d-flex flex-column gap-4">
              <div className="row g-3">
                <div className="col-md-3">
                  <div className="small text-muted">Status</div>
                  <div>
                    <span className={`badge ${getStatusBadge(draft.status)}`}>
                      {draft.status}
                    </span>
                  </div>
                </div>

                <div className="col-md-3">
                  <div className="small text-muted">Payment</div>
                  <div>
                    <span className={`badge ${getPaymentBadge(draft)}`}>
                      {isPaid(draft) ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                </div>

                <div className="col-md-3">
                  <div className="small text-muted">Created</div>
                  <div className="fw-semibold">{formatDate(draft.createdAt)}</div>
                </div>

                <div className="col-md-3">
                  <div className="small text-muted">Submitted</div>
                  <div className="fw-semibold">{formatDate(draft.submittedAt)}</div>
                </div>

                <div className="col-md-3">
                  <div className="small text-muted">Signed</div>
                  <div className="fw-semibold">{formatDate(draft.signedAt)}</div>
                </div>
              </div>

              <div className="border rounded-3 p-3 bg-light">
                <h3 className="h6 mb-3">Payment</h3>
                <div className="row g-3">
                  <div className="col-md-3">
                    <div className="small text-muted">Payment Code</div>
                    <div className="fw-semibold">{draft.paymentCode || 'Not generated'}</div>
                  </div>

                  <div className="col-md-3">
                    <div className="small text-muted">Receipt No</div>
                    <div className="fw-semibold">{draft.receiptNo || 'Not paid yet'}</div>
                  </div>

                  <div className="col-md-3">
                    <div className="small text-muted">Amount</div>
                    <div className="fw-semibold">{formatCurrency(draft.amount)}</div>
                  </div>

                  <div className="col-md-3">
                    <div className="small text-muted">Paid At</div>
                    <div className="fw-semibold">{formatDate(draft.paidAt)}</div>
                  </div>
                </div>
              </div>

              <div className="border rounded-3 p-3 bg-light">
                <h3 className="h6 mb-3">Student Snapshot</h3>

                <div className="row g-3">
                  <div className="col-md-4">
                    <div className="small text-muted">Student No</div>
                    <div className="fw-semibold">{profile.studentNo || '—'}</div>
                  </div>

                  <div className="col-md-4">
                    <div className="small text-muted">Student Name</div>
                    <div className="fw-semibold">{profile.studentName || '—'}</div>
                  </div>

                  <div className="col-md-4">
                    <div className="small text-muted">Program</div>
                    <div className="fw-semibold">
                      {profile.programCode || '—'} {profile.programName || ''}
                    </div>
                  </div>

                  <div className="col-md-4">
                    <div className="small text-muted">Curriculum Year</div>
                    <div className="fw-semibold">
                      {draft.curriculumSnapshot?.curriculumYear ||
                        profile.curriculumYear ||
                        '—'}
                    </div>
                  </div>

                  <div className="col-md-4">
                    <div className="small text-muted">Graduated</div>
                    <div className="fw-semibold">
                      {profile.graduated ? 'Yes' : 'No'}
                    </div>
                  </div>

                  <div className="col-md-4">
                    <div className="small text-muted">Major</div>
                    <div className="fw-semibold">{profile.major || '—'}</div>
                  </div>
                </div>

                {draft.notes ? (
                  <div className="mt-3">
                    <div className="small text-muted">Draft Notes</div>
                    <div className="fw-semibold">{draft.notes}</div>
                  </div>
                ) : null}

                {draft.rejectionReason ? (
                  <div className="mt-3 alert alert-danger mb-0">
                    <strong>Rejection reason:</strong> {draft.rejectionReason}
                  </div>
                ) : null}
              </div>

              <div className="border rounded-3 p-3">
                <h3 className="h6 mb-3">Grades Snapshot</h3>

                {grades.length === 0 ? (
                  <div className="alert alert-light border mb-0">
                    No grades included in this draft.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Year</th>
                          <th>Semester</th>
                          <th>Subject Code</th>
                          <th>Subject Title</th>
                          <th>Units</th>
                          <th>Grade</th>
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grades.map((grade, index) => (
                          <tr key={grade._id || `${grade.subjectCode}-${index}`}>
                            <td>{grade.yearLevel || '—'}</td>
                            <td>{grade.semester || '—'}</td>
                            <td className="fw-semibold">{grade.subjectCode || '—'}</td>
                            <td>{grade.subjectTitle || '—'}</td>
                            <td>{grade.units ?? 0}</td>
                            <td>{grade.finalGrade || '—'}</td>
                            <td>{grade.remarks || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {signedProof ? (
                <div className="border rounded-3 p-3 bg-light">
                  <h3 className="h6 mb-3">Signature Proof</h3>
                  <div className="small mb-2">
                    <strong>Type:</strong> {signedProof.type}
                  </div>
                  <div className="small mb-2">
                    <strong>Created:</strong> {formatDate(signedProof.created)}
                  </div>
                  <div className="small mb-2 text-break">
                    <strong>Verification Method:</strong> {signedProof.verificationMethod}
                  </div>
                  <div className="small text-break">
                    <strong>Credential Hash:</strong> {draft.credentialHash || '—'}
                  </div>
                </div>
              ) : null}

              <div className="border rounded-3 p-3 bg-light">
                <h3 className="h6 mb-3">Anchoring Queue</h3>
                <div className="row g-3">
                  <div className="col-md-3">
                    <div className="small text-muted">Anchor Mode</div>
                    <div className="fw-semibold">{draft.anchorMode || 'none'}</div>
                  </div>

                  <div className="col-md-3">
                    <div className="small text-muted">Anchor Status</div>
                    <div className="fw-semibold">{draft.anchorStatus || 'not_requested'}</div>
                  </div>

                  <div className="col-md-3">
                    <div className="small text-muted">Scheduled Anchor</div>
                    <div className="fw-semibold">{formatDate(draft.scheduledAnchorAt)}</div>
                  </div>

                  <div className="col-md-3">
                    <div className="small text-muted">Contract Address</div>
                    <div className="fw-semibold text-break">
                      {draft.contractAddress || '—'}
                    </div>
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

      <div className="modal-backdrop show" onClick={onClose} />
    </>
  );
}

function ClaimQrModal({ claimQr, onClose, onRefresh }) {
  const [remainingSeconds, setRemainingSeconds] = useState(
    claimQr?.initialRemainingSeconds || 0
  );

  useEffect(() => {
    if (!claimQr) return undefined;

    const timer = window.setInterval(() => {
      setRemainingSeconds(
        Math.max(0, Math.floor(((claimQr.expiresAtMs || 0) - Date.now()) / 1000))
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [claimQr]);

  if (!claimQr) return null;

  const isExpired = remainingSeconds <= 0;
  const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const seconds = String(remainingSeconds % 60).padStart(2, '0');

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 className="h5 mb-1">Claim QR</h2>
                <p className="text-muted mb-0 small">
                  {claimQr.credential?.studentNo || 'Student'} - scan with the mobile app.
                </p>
              </div>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>

            <div className="modal-body text-center">
              {claimQr.dataUrl ? (
                <img
                  src={claimQr.dataUrl}
                  width="260"
                  height="260"
                  alt="Credential claim QR"
                  className="border rounded-3 p-2 bg-white"
                />
              ) : null}

              <div className="mt-3">
                <div className={`badge ${isExpired ? 'text-bg-danger' : 'text-bg-success'}`}>
                  {isExpired ? 'Expired' : `Expires in ${minutes}:${seconds}`}
                </div>
              </div>

              <div className="small text-muted mt-3 text-break">
                {claimQr.claimUri}
              </div>

              <div className="alert alert-light border mt-3 mb-0 text-start small">
                The QR contains only a temporary claim token. The signed VC is delivered only
                after the student signs in and claims it from the backend.
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onRefresh}>
                Refresh List
              </button>
              <button className="btn btn-primary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="modal-backdrop show" onClick={onClose} />
    </>
  );
}

export default function CredentialDraftsPage() {
  const auth = useMemo(() => hasValidStoredAuth(), []);
  const currentRole = auth?.user?.role || '';

  const [rows, setRows] = useState([]);
  const [paymentRows, setPaymentRows] = useState([]);
  const [activeTab, setActiveTab] = useState(currentRole === 'cashier' ? 'payments' : 'drafts');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('unpaid');
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [claimQr, setClaimQr] = useState(null);

  const loadDrafts = useCallback(
    async (nextStatus = statusFilter) => {
      try {
        setLoading(true);
        const data = await listCredentialDrafts(
          nextStatus ? { status: nextStatus } : {}
        );
        setRows(data || []);
      } catch (error) {
        setFeedback({
          type: 'danger',
          text:
            error?.response?.data?.message ||
            error?.message ||
            'Failed to load credential drafts.',
        });
      } finally {
        setLoading(false);
      }
    },
    [statusFilter]
  );

  const loadPayments = useCallback(async () => {
    try {
      setPaymentLoading(true);
      const data = await listCredentialPayments({
        paymentStatus: paymentStatusFilter,
        search: paymentSearch,
      });
      setPaymentRows(data || []);
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to load payment requests.',
      });
    } finally {
      setPaymentLoading(false);
    }
  }, [paymentSearch, paymentStatusFilter]);

  useEffect(() => {
    if (currentRole !== 'cashier') {
      loadDrafts();
    }
    if (currentRole === 'cashier') {
      loadPayments();
    }
  }, [currentRole, loadDrafts, loadPayments]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (currentRole !== 'cashier') {
        loadDrafts().catch(() => {});
      } else {
        loadPayments().catch(() => {});
      }
    }, 15000);

    return () => window.clearInterval(timer);
  }, [currentRole, loadDrafts, loadPayments]);

  async function openDraft(id) {
    try {
      setBusyId(id);
      const data = await getCredentialDraftById(id);
      setSelectedDraft(data);
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to load credential draft details.',
      });
    } finally {
      setBusyId('');
    }
  }

  async function handleSubmit(id) {
    const approved = window.confirm('Submit this draft to the registrar?');
    if (!approved) return;

    try {
      setBusyId(id);
      await submitCredentialDraft(id);
      setFeedback({
        type: 'success',
        text: 'Draft submitted to registrar successfully.',
      });
      await loadDrafts();
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to submit draft.',
      });
    } finally {
      setBusyId('');
    }
  }

  async function handleReject(id) {
    const rejectionReason =
      window.prompt('Enter rejection reason', 'Please correct the student record first.') || '';

    const approved = window.confirm('Reject this draft?');
    if (!approved) return;

    try {
      setBusyId(id);
      await rejectCredentialDraft(id, { rejectionReason });
      setFeedback({
        type: 'success',
        text: 'Draft rejected successfully.',
      });
      await loadDrafts();
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to reject draft.',
      });
    } finally {
      setBusyId('');
    }
  }

  async function handleSign(id) {
    const draft = rows.find((item) => item._id === id);
    if (draft && !isPaid(draft)) {
      setFeedback({
        type: 'warning',
        text: 'Payment is required before signing.',
      });
      return;
    }

    const approved = window.confirm('Sign this credential draft now?');
    if (!approved) return;

    try {
      setBusyId(id);
      await signCredentialDraft(id);
      setFeedback({
        type: 'success',
        text: 'Credential draft signed successfully.',
      });
      await loadDrafts();
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to sign draft.',
      });
    } finally {
      setBusyId('');
    }
  }

  async function handleMarkPaid(item) {
    const approved = window.confirm(
      `Mark payment ${item.paymentCode || item._id} as paid?`
    );
    if (!approved) return;

    try {
      setBusyId(item._id);
      await markCredentialPaymentPaid(item._id);
      setFeedback({
        type: 'success',
        text: 'Payment marked as paid. Receipt number generated and student notified.',
      });
      await loadPayments();
      if (currentRole !== 'cashier') {
        await loadDrafts();
      }
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to mark payment as paid.',
      });
    } finally {
      setBusyId('');
    }
  }

  async function handleViewQr(id) {
    try {
      setBusyId(id);
      const data = await createCredentialClaimToken(id);
      const dataUrl = await QRCode.toDataURL(data.claimUri, {
        margin: 2,
        width: 260,
      });

      setClaimQr({
        ...data,
        dataUrl,
        expiresAtMs: data.expiresAt ? new Date(data.expiresAt).getTime() : 0,
        initialRemainingSeconds: data.expiresAt
          ? Math.max(0, Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000))
          : 0,
      });
      setFeedback({
        type: 'success',
        text: 'Claim QR generated. The credential is now ready for mobile claim.',
      });
      await loadDrafts();
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to generate claim QR.',
      });
    } finally {
      setBusyId('');
    }
  }

  async function handleQueueSameDay(id) {
    const approved = window.confirm('Queue this signed credential for same-day anchoring?');
    if (!approved) return;

    try {
      setBusyId(id);
      await scheduleCredentialAnchor(id, { anchorMode: 'same_day' });
      setFeedback({
        type: 'success',
        text: 'Credential queued for same-day anchoring.',
      });
      await loadDrafts();
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to queue same-day anchoring.',
      });
    } finally {
      setBusyId('');
    }
  }

  async function handleQueueSettingsSchedule(id) {
    const approved = window.confirm(
      'Schedule this signed credential for anchoring after one week?'
    );
    if (!approved) return;

    try {
      setBusyId(id);
      await scheduleCredentialAnchor(id, { anchorMode: 'scheduled' });
      setFeedback({
        type: 'success',
        text: 'Credential scheduled for anchoring.',
      });
      await loadDrafts();
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to queue scheduled anchoring.',
      });
    } finally {
      setBusyId('');
    }
  }

  const filters = [
    { label: 'All', value: '' },
    { label: 'Draft', value: 'draft' },
    { label: 'For Signature', value: 'for_signature' },
    { label: 'Signed', value: 'signed' },
    { label: 'Claim Ready', value: 'claim_ready' },
    { label: 'Claimed', value: 'claimed' },
    { label: 'Anchored', value: 'anchored' },
  ];

  const tabs = [
    ...(currentRole === 'cashier'
      ? [{ key: 'payments', label: 'Payments' }]
      : []),
    ...(currentRole !== 'cashier'
      ? [
          { key: 'drafts', label: 'Drafts' },
          { key: 'signing', label: 'Signing' },
          { key: 'anchor', label: 'Anchor' },
        ]
      : []),
  ];
  const draftRows = activeTab === 'signing'
    ? rows.filter((item) => item.status === 'for_signature')
    : activeTab === 'anchor'
      ? rows.filter((item) => ['signed', 'queued_for_anchor', 'anchored'].includes(item.status))
      : rows;

  return (
    <>
      <div className="d-flex flex-column gap-4">
        <div>
          <h1 className="h3 mb-1">VC</h1>
          <p className="text-muted mb-0">
            Manage requests, cashier payments, registrar signing, claim QR generation, and anchoring.
          </p>
        </div>

        {feedback.text ? (
          <div className={`alert alert-${feedback.type} mb-0`}>{feedback.text}</div>
        ) : null}

        <div className="d-flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`btn ${activeTab === tab.key ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'payments' ? (
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h2 className="h5 mb-1">Cashier Payment Table</h2>
                  <p className="text-muted mb-0">
                    Search a payment code and mark requests as paid after collecting payment.
                  </p>
                </div>

                <button
                  className="btn btn-outline-secondary"
                  onClick={loadPayments}
                  disabled={paymentLoading}
                >
                  {paymentLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              <div className="row g-3 align-items-end mb-3">
                <div className="col-md-6">
                  <label className="form-label">Search</label>
                  <input
                    className="form-control"
                    value={paymentSearch}
                    onChange={(event) => setPaymentSearch(event.target.value)}
                    placeholder="Payment code, receipt, student no, or name"
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Payment Status</label>
                  <select
                    className="form-select"
                    value={paymentStatusFilter}
                    onChange={(event) => setPaymentStatusFilter(event.target.value)}
                  >
                    <option value="">All</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div className="col-md-3 d-grid">
                  <button className="btn btn-primary" onClick={loadPayments} disabled={paymentLoading}>
                    Apply
                  </button>
                </div>
              </div>

              {paymentLoading ? (
                <div className="text-muted">Loading payment requests...</div>
              ) : paymentRows.length === 0 ? (
                <div className="alert alert-light border mb-0">No payment requests found.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle">
                    <thead>
                      <tr>
                        <th>Payment Code</th>
                        <th>Student No</th>
                        <th>Student Name</th>
                        <th>Credential Type</th>
                        <th>Request Date</th>
                        <th>Payment Status</th>
                        <th>Amount</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentRows.map((item) => (
                        <tr key={item._id}>
                          <td className="fw-semibold">{item.paymentCode || 'Not generated'}</td>
                          <td>{item.studentNo}</td>
                          <td>{item.studentName}</td>
                          <td>{item.credentialType || 'student_record'}</td>
                          <td>{formatDate(item.createdAt)}</td>
                          <td>
                            <span className={`badge ${getPaymentBadge(item)}`}>
                              {isPaid(item) ? 'Paid' : 'Unpaid'}
                            </span>
                            {item.receiptNo ? (
                              <div className="small text-muted mt-1">{item.receiptNo}</div>
                            ) : null}
                          </td>
                          <td>{formatCurrency(item.amount)}</td>
                          <td>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleMarkPaid(item)}
                              disabled={busyId === item._id || isPaid(item)}
                            >
                              {isPaid(item) ? 'Paid' : 'Mark as Paid'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {activeTab !== 'payments' ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
              <div>
                <h2 className="h5 mb-1">Draft Queue</h2>
                <p className="text-muted mb-0">
                  Review, sign, reject, and queue anchoring here.
                </p>
              </div>

              <button
                className="btn btn-outline-secondary"
                onClick={() => loadDrafts()}
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            <div className="d-flex flex-wrap gap-2 mb-3">
              {filters.map((item) => (
                <button
                  key={item.value || 'all'}
                  className={`btn btn-sm ${
                    statusFilter === item.value ? 'btn-primary' : 'btn-outline-primary'
                  }`}
                  onClick={() => setStatusFilter(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-muted">Loading drafts...</div>
            ) : draftRows.length === 0 ? (
              <div className="alert alert-light border mb-0">
                No credential drafts found for this filter.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Status</th>
                      <th>Payment</th>
                      <th>Anchor</th>
                      <th>Created</th>
                      <th>Signed</th>
                      <th style={{ minWidth: 360 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draftRows.map((item) => (
                      <tr key={item._id}>
                        <td>
                          <div className="fw-semibold">{item.studentName}</div>
                          <div className="small text-muted">{item.studentNo}</div>
                        </td>

                        <td>
                          <span className={`badge ${getStatusBadge(item.status)}`}>
                            {item.status}
                          </span>
                        </td>

                        <td>
                          <span className={`badge ${getPaymentBadge(item)}`}>
                            {isPaid(item) ? 'Paid' : 'Unpaid'}
                          </span>
                          <div className="small text-muted mt-1">
                            {isPaid(item)
                              ? activeTab === 'signing'
                                ? 'Ready to Sign.'
                                : item.receiptNo || 'Payment received'
                              : 'Unpaid - waiting for cashier payment.'}
                          </div>
                        </td>

                        <td>
                          <div className="small">
                            <div><strong>Mode:</strong> {item.anchorMode || 'none'}</div>
                            <div><strong>When:</strong> {formatDate(item.scheduledAnchorAt)}</div>
                          </div>
                        </td>

                        <td>{formatDate(item.createdAt)}</td>
                        <td>{formatDate(item.signedAt)}</td>

                        <td>
                          <div className="d-flex flex-wrap gap-2">
                            <button
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => openDraft(item._id)}
                              disabled={busyId === item._id}
                            >
                              {busyId === item._id ? 'Opening...' : 'View'}
                            </button>

                            {item.status === 'draft' ? (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleSubmit(item._id)}
                                disabled={busyId === item._id}
                              >
                                Submit to Registrar
                              </button>
                            ) : null}

                            {item.status === 'for_signature' && currentRole === 'super_admin' ? (
                              <>
                                <button
                                  className="btn btn-success btn-sm"
                                  onClick={() => handleSign(item._id)}
                                  disabled={busyId === item._id || !isPaid(item)}
                                  title={!isPaid(item) ? 'Payment is required before signing.' : ''}
                                >
                                  Sign
                                </button>

                                {!isPaid(item) ? (
                                  <span className="small text-warning align-self-center">
                                    Payment is required before signing.
                                  </span>
                                ) : null}

                                <button
                                  className="btn btn-outline-danger btn-sm"
                                  onClick={() => handleReject(item._id)}
                                  disabled={busyId === item._id}
                                >
                                  Reject
                                </button>
                              </>
                            ) : null}

                            {CLAIM_QR_STATUSES.has(item.status) &&
                            currentRole === 'super_admin' ? (
                              <button
                                className="btn btn-info btn-sm"
                                onClick={() => handleViewQr(item._id)}
                                disabled={busyId === item._id}
                              >
                                {busyId === item._id
                                  ? 'Preparing...'
                                  : item.status === 'claim_ready'
                                    ? 'View QR'
                                    : 'Generate QR'}
                              </button>
                            ) : null}

                            {item.status === 'signed' && currentRole === 'super_admin' ? (
                              <>
                                <button
                                  className="btn btn-warning btn-sm"
                                  onClick={() => handleQueueSameDay(item._id)}
                                  disabled={busyId === item._id}
                                >
                                  Anchor Now
                                </button>

                                <button
                                  className="btn btn-outline-warning btn-sm"
                                  onClick={() => handleQueueSettingsSchedule(item._id)}
                                  disabled={busyId === item._id}
                                >
                                  Schedule After One Week
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        ) : null}
      </div>

      <DraftDetailsModal
        draft={selectedDraft}
        onClose={() => setSelectedDraft(null)}
      />

      <ClaimQrModal
        key={claimQr?.claimUri || 'claim-qr'}
        claimQr={claimQr}
        onRefresh={() => loadDrafts()}
        onClose={async () => {
          setClaimQr(null);
          await loadDrafts();
        }}
      />
    </>
  );
}
