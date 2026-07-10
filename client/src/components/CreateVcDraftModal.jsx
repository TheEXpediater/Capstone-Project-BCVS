import { useEffect, useMemo, useState } from 'react';
import { FaArrowLeft, FaFileSignature, FaListAlt, FaTimes } from 'react-icons/fa';
import {
  DEFAULT_TOR_REMARKS,
  buildCreateVcDraftPayload,
  getCreateVcPricingSummary,
  normalizeCreateVcAnchorMode,
  normalizeCreateVcCredentialType,
  normalizeCreateVcRemarks,
} from './createVcDraftPayload';

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'PHP',
  }).format(Number(value || 0));
}

function credentialTypeLabel(value) {
  return normalizeCreateVcCredentialType(value) === 'diploma'
    ? 'Diploma'
    : 'Transcript of Records (TOR)';
}

function anchorModeLabel(value) {
  return normalizeCreateVcAnchorMode(value) === 'anchor_now'
    ? 'Anchor Now - priority anchoring'
    : 'Default Anchoring - scheduled after 7 days';
}

function getStudentId(student) {
  return String(student?._id || student?.id || student?.studentId || '');
}

function getStudentProgram(student) {
  return (
    student?.programCode ||
    student?.programName ||
    student?.program ||
    student?.curriculum?.program ||
    student?.curriculum?.programName ||
    ''
  );
}

function StudentList({ students = [], compact = false }) {
  return (
    <div className="table-responsive border rounded">
      <table className="table table-sm align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th>Student No.</th>
            <th>Student Name</th>
            <th>Program</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr key={getStudentId(student) || `${student.studentNo}-${student.studentName}`}>
              <td className="fw-semibold">{student.studentNo || '-'}</td>
              <td>{student.studentName || '-'}</td>
              <td>{getStudentProgram(student) || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {compact && students.length > 8 ? (
        <div className="small text-muted px-3 py-2 border-top">
          Showing all {students.length} selected records.
        </div>
      ) : null}
    </div>
  );
}

function ResultList({ rows = [], success = false }) {
  if (!rows.length) return null;

  return (
    <div className="table-responsive border rounded">
      <table className="table table-sm align-middle mb-0">
        <tbody>
          {rows.map((row) => (
            <tr key={`${success ? 'created' : 'failed'}-${row.studentId || row.credentialId || row.studentNo}`}>
              <td style={{ width: 36 }}>
                <span className={`badge ${success ? 'text-bg-success' : 'text-bg-danger'}`}>
                  {success ? 'OK' : 'Failed'}
                </span>
              </td>
              <td>
                <div className="fw-semibold">{row.studentName || row.studentNo || row.studentId || 'Student'}</div>
                <div className="small text-muted">
                  {row.studentNo ? `${row.studentNo} - ` : ''}
                  {success
                    ? `Draft ${row.credentialId || row.draftId || 'created'}`
                    : row.reason || row.message || 'Unable to create draft.'}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CreateVcDraftModal({
  open,
  mode = 'single',
  student = null,
  students = [],
  submitting = false,
  error = '',
  onClose,
  onConfirm,
  onOpenCredentials,
}) {
  const isBulk = mode === 'bulk';
  const [step, setStep] = useState(isBulk ? 'students' : 'credential');
  const [credentialType, setCredentialType] = useState('tor');
  const [remarks, setRemarks] = useState(DEFAULT_TOR_REMARKS);
  const [anchorMode, setAnchorMode] = useState('default');
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState(null);
  const [localSubmitting, setLocalSubmitting] = useState(false);

  const normalizedStudents = useMemo(
    () => {
      const rows = mode === 'single' && student ? [student] : students;
      return rows.filter((item) => getStudentId(item));
    },
    [mode, student, students]
  );
  const pricing = getCreateVcPricingSummary(anchorMode, normalizedStudents.length || 1);
  const payload = buildCreateVcDraftPayload({ credentialType, remarks, anchorMode });
  const busy = submitting || localSubmitting;
  const canClose = !busy;

  useEffect(() => {
    if (!open) return;
    setStep(isBulk ? 'students' : 'credential');
    setCredentialType('tor');
    setRemarks(DEFAULT_TOR_REMARKS);
    setAnchorMode('default');
    setErrorMessage('');
    setResult(null);
    setLocalSubmitting(false);
  }, [open, isBulk]);

  if (!open) return null;

  function close() {
    if (canClose) onClose?.();
  }

  function changeCredentialType(nextValue) {
    const nextType = normalizeCreateVcCredentialType(nextValue);
    setCredentialType(nextType);
    setRemarks((current) =>
      nextType === 'tor' ? normalizeCreateVcRemarks(nextType, current) : ''
    );
    setErrorMessage('');
  }

  function continueFromCredential() {
    if (credentialType === 'tor') {
      setRemarks((current) => normalizeCreateVcRemarks('tor', current));
    }
    setStep('anchoring');
  }

  async function confirmCreate() {
    if (busy) return;

    try {
      setLocalSubmitting(true);
      setErrorMessage('');
      const data = await onConfirm?.(payload);
      if (isBulk) {
        setResult(data || null);
        setStep('results');
      }
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to create VC draft.'
      );
    } finally {
      setLocalSubmitting(false);
    }
  }

  function goBack() {
    setErrorMessage('');
    if (step === 'credential') {
      if (isBulk) setStep('students');
      return;
    }

    if (step === 'anchoring') {
      setStep('credential');
      return;
    }

    if (step === 'confirm') {
      setStep('anchoring');
    }
  }

  const title = isBulk ? 'Create VC Drafts' : 'Create VC Draft';
  const subtitle = isBulk
    ? 'Create credential drafts for the selected student records.'
    : 'Create a credential draft from this student record.';

  return (
    <>
      <div className="modal d-block enterprise-modal" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 className="h5 mb-1">{title}</h2>
                <p className="text-muted mb-0 small">{subtitle}</p>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={close}
                disabled={!canClose}
                aria-label="Close"
              />
            </div>

            <div className="modal-body">
              {error || errorMessage ? (
                <div className="alert alert-danger">{error || errorMessage}</div>
              ) : null}

              {step !== 'results' ? (
                <div className="d-flex flex-wrap gap-2 mb-3 small">
                  {['students', 'credential', 'anchoring', 'confirm']
                    .filter((item) => isBulk || item !== 'students')
                    .map((item) => (
                      <span
                        key={item}
                        className={`badge ${step === item ? 'text-bg-success' : 'text-bg-light border'}`}
                      >
                        {item === 'students'
                          ? 'Affected Students'
                          : item === 'credential'
                            ? 'Credential'
                            : item === 'anchoring'
                              ? 'Anchoring'
                              : 'Confirm'}
                      </span>
                    ))}
                </div>
              ) : null}

              {step === 'students' ? (
                <div className="d-flex flex-column gap-3">
                  <div className="alert alert-info border mb-0">
                    <div className="fw-semibold">Selected students: {normalizedStudents.length}</div>
                    <div className="small">Review every affected record before selecting credential options.</div>
                  </div>
                  <StudentList students={normalizedStudents} compact />
                </div>
              ) : null}

              {step === 'credential' ? (
                <div className="d-flex flex-column gap-3">
                  <div className="alert alert-light border mb-0">
                    <div className="fw-semibold">
                      {isBulk ? `Selected students: ${normalizedStudents.length}` : 'Affected student'}
                    </div>
                    <div className="mt-2">
                      <StudentList students={normalizedStudents} />
                    </div>
                  </div>

                  <div>
                    <label className="form-label fw-semibold">Credential Type</label>
                    <div className="d-flex flex-column gap-2">
                      <label className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="createVcCredentialType"
                          value="tor"
                          checked={credentialType === 'tor'}
                          onChange={(event) => changeCredentialType(event.target.value)}
                          disabled={busy}
                        />
                        <span className="form-check-label">Transcript of Records (TOR)</span>
                      </label>
                      <label className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="createVcCredentialType"
                          value="diploma"
                          checked={credentialType === 'diploma'}
                          onChange={(event) => changeCredentialType(event.target.value)}
                          disabled={busy}
                        />
                        <span className="form-check-label">Diploma</span>
                      </label>
                    </div>
                  </div>

                  {credentialType === 'tor' ? (
                    <div>
                      <label className="form-label fw-semibold" htmlFor="create-vc-remarks">
                        Remarks
                      </label>
                      <input
                        id="create-vc-remarks"
                        className="form-control"
                        value={remarks}
                        onChange={(event) => setRemarks(event.target.value)}
                        onBlur={() => setRemarks((current) => normalizeCreateVcRemarks('tor', current))}
                        disabled={busy}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {step === 'anchoring' ? (
                <div className="d-flex flex-column gap-3">
                  <label className="form-label fw-semibold mb-0">Anchor Timing</label>
                  <label className="border rounded p-3 d-flex gap-3">
                    <input
                      className="form-check-input mt-1"
                      type="radio"
                      name="createVcAnchorMode"
                      value="default"
                      checked={anchorMode === 'default'}
                      onChange={(event) => setAnchorMode(event.target.value)}
                      disabled={busy}
                    />
                    <span>
                      <span className="fw-semibold d-block">Default Anchoring - scheduled after 7 days</span>
                      <span className="small text-muted">No priority anchoring fee is added.</span>
                    </span>
                  </label>
                  <label className="border rounded p-3 d-flex gap-3">
                    <input
                      className="form-check-input mt-1"
                      type="radio"
                      name="createVcAnchorMode"
                      value="anchor_now"
                      checked={anchorMode === 'anchor_now'}
                      onChange={(event) => setAnchorMode(event.target.value)}
                      disabled={busy}
                    />
                    <span>
                      <span className="fw-semibold d-block">Anchor Now - priority anchoring</span>
                      <span className="small text-muted">
                        Adds {formatCurrency(pricing.anchorNowFee || 20)} per credential through server pricing.
                      </span>
                    </span>
                  </label>
                </div>
              ) : null}

              {step === 'confirm' ? (
                <div className="d-flex flex-column gap-3">
                  <div className="alert alert-warning border mb-0">
                    Credential drafts will be created only after confirmation.
                  </div>
                  <div>
                    <div className="fw-semibold mb-2">
                      Affected students: {normalizedStudents.length}
                    </div>
                    <StudentList students={normalizedStudents} compact />
                  </div>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="small text-muted">Credential Type</div>
                      <div className="fw-semibold">{credentialTypeLabel(credentialType)}</div>
                    </div>
                    {credentialType === 'tor' ? (
                      <div className="col-md-6">
                        <div className="small text-muted">TOR Remarks</div>
                        <div className="fw-semibold">{payload.remarks}</div>
                      </div>
                    ) : null}
                    <div className="col-md-6">
                      <div className="small text-muted">Anchor Timing</div>
                      <div className="fw-semibold">{anchorModeLabel(anchorMode)}</div>
                    </div>
                  </div>
                  <div className="border rounded p-3">
                    <div className="row g-2 small">
                      <div className="col-md-6 d-flex justify-content-between gap-3">
                        <span>Base amount per credential</span>
                        <strong>{formatCurrency(pricing.baseAmount)}</strong>
                      </div>
                      <div className="col-md-6 d-flex justify-content-between gap-3">
                        <span>Anchor Now fee per credential</span>
                        <strong>{formatCurrency(pricing.anchorNowFee)}</strong>
                      </div>
                      <div className="col-md-6 d-flex justify-content-between gap-3">
                        <span>Estimated total per credential</span>
                        <strong>{formatCurrency(pricing.totalPerCredential)}</strong>
                      </div>
                      <div className="col-md-6 d-flex justify-content-between gap-3">
                        <span>Estimated bulk total</span>
                        <strong>{formatCurrency(pricing.totalAmount)}</strong>
                      </div>
                    </div>
                    <div className="form-text mt-2">
                      The server calculates the final payable amount from configured pricing.
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 'results' ? (
                <div className="d-flex flex-column gap-3">
                  <div className={`alert ${result?.failedCount ? 'alert-warning' : 'alert-success'} mb-0`}>
                    <div className="fw-semibold">Bulk Create VC completed</div>
                    <div>Successful: {result?.successCount || 0}</div>
                    <div>Failed: {result?.failedCount || 0}</div>
                  </div>
                  <ResultList rows={result?.created || []} success />
                  <ResultList rows={result?.failed || []} />
                </div>
              ) : null}
            </div>

            <div className="modal-footer">
              {step === 'results' ? (
                <>
                  <button className="btn btn-outline-secondary" onClick={close}>
                    Close
                  </button>
                  <button className="btn btn-primary" onClick={onOpenCredentials}>
                    <FaListAlt className="me-2" />
                    Open Credential Drafts
                  </button>
                </>
              ) : (
                <>
                  {step !== 'students' && (isBulk || step !== 'credential') ? (
                    <button className="btn btn-outline-secondary me-auto" onClick={goBack} disabled={busy}>
                      <FaArrowLeft className="me-2" />
                      Back
                    </button>
                  ) : null}
                  <button className="btn btn-outline-secondary" onClick={close} disabled={!canClose}>
                    <FaTimes className="me-2" />
                    Cancel
                  </button>
                  {step === 'students' ? (
                    <button
                      className="btn btn-primary"
                      onClick={() => setStep('credential')}
                      disabled={!normalizedStudents.length || busy}
                    >
                      Continue
                    </button>
                  ) : null}
                  {step === 'credential' ? (
                    <button className="btn btn-primary" onClick={continueFromCredential} disabled={busy}>
                      Continue
                    </button>
                  ) : null}
                  {step === 'anchoring' ? (
                    <button className="btn btn-primary" onClick={() => setStep('confirm')} disabled={busy}>
                      Continue
                    </button>
                  ) : null}
                  {step === 'confirm' ? (
                    <button
                      className="btn btn-success"
                      onClick={confirmCreate}
                      disabled={busy || !normalizedStudents.length}
                    >
                      {busy ? (
                        'Creating...'
                      ) : (
                        <>
                          <FaFileSignature className="me-2" />
                          Confirm and Create VC Drafts
                        </>
                      )}
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
