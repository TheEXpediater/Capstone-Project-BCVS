import { useEffect, useMemo, useState } from 'react';
import { hasValidStoredAuth } from '../../auth/authStorage';
import {
  getCredentialDraftById,
  listCredentialDrafts,
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
    rejected: 'text-bg-danger',
    queued_for_anchor: 'text-bg-info',
    anchored: 'text-bg-success',
  };

  return map[status] || 'text-bg-secondary';
}

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

export default function CredentialDraftsPage() {
  const auth = useMemo(() => hasValidStoredAuth(), []);
  const currentRole = auth?.user?.role || '';

  const [rows, setRows] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [selectedDraft, setSelectedDraft] = useState(null);

  async function loadDrafts(nextStatus = statusFilter) {
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
  }

  useEffect(() => {
    loadDrafts(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

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
      'Queue this signed credential using the anchor interval from System Settings?'
    );
    if (!approved) return;

    try {
      setBusyId(id);
      await scheduleCredentialAnchor(id, { anchorMode: 'scheduled' });
      setFeedback({
        type: 'success',
        text: 'Credential queued using settings schedule.',
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
    { label: 'Queued', value: 'queued_for_anchor' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'Anchored', value: 'anchored' },
  ];

  return (
    <>
      <div className="d-flex flex-column gap-4">
        <div>
          <h1 className="h3 mb-1">VC Drafts</h1>
          <p className="text-muted mb-0">
            Staff admin prepares and submits drafts. Registrar signs and schedules anchoring.
          </p>
        </div>

        {feedback.text ? (
          <div className={`alert alert-${feedback.type} mb-0`}>{feedback.text}</div>
        ) : null}

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
            ) : rows.length === 0 ? (
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
                      <th>Anchor</th>
                      <th>Created</th>
                      <th>Signed</th>
                      <th style={{ minWidth: 360 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((item) => (
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
                                  disabled={busyId === item._id}
                                >
                                  Sign
                                </button>

                                <button
                                  className="btn btn-outline-danger btn-sm"
                                  onClick={() => handleReject(item._id)}
                                  disabled={busyId === item._id}
                                >
                                  Reject
                                </button>
                              </>
                            ) : null}

                            {item.status === 'signed' && currentRole === 'super_admin' ? (
                              <>
                                <button
                                  className="btn btn-warning btn-sm"
                                  onClick={() => handleQueueSameDay(item._id)}
                                  disabled={busyId === item._id}
                                >
                                  Queue Same Day
                                </button>

                                <button
                                  className="btn btn-outline-warning btn-sm"
                                  onClick={() => handleQueueSettingsSchedule(item._id)}
                                  disabled={busyId === item._id}
                                >
                                  Use Settings Schedule
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
      </div>

      <DraftDetailsModal
        draft={selectedDraft}
        onClose={() => setSelectedDraft(null)}
      />
    </>
  );
}