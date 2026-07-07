import { useEffect, useMemo, useState } from 'react';
import { FaFileSignature } from 'react-icons/fa';
import { buildCreateVcDraftPayload } from './createVcDraftPayload';

function formatStudentLabel(student) {
  if (!student) return 'selected student';
  if (student.studentName && student.studentNo) {
    return `${student.studentName} (${student.studentNo})`;
  }
  return student.studentName || student.studentNo || 'selected student';
}

export default function CreateVcDraftModal({
  open,
  title = 'Create VC Draft',
  subtitle = 'Create a VC draft for the selected student.',
  student,
  students = [],
  loading = false,
  submitting = false,
  onClose,
  onConfirm,
}) {
  const [credentialType, setCredentialType] = useState('tor');
  const [anchorNow, setAnchorNow] = useState(false);
  const [anchorCost, setAnchorCost] = useState(20);
  const [studentSelection, setStudentSelection] = useState('');

  useEffect(() => {
    if (!open) return;

    if (student) {
      setStudentSelection(student._id || '');
    } else if (students.length === 1) {
      setStudentSelection(students[0]._id || '');
    } else {
      setStudentSelection('');
    }
  }, [open, student, students]);

  useEffect(() => {
    if (!open) {
      setCredentialType('tor');
      setAnchorNow(false);
      setAnchorCost(20);
      setStudentSelection('');
    }
  }, [open]);

  const selectedStudent = useMemo(() => {
    if (student) return student;
    return students.find((item) => item._id === studentSelection) || null;
  }, [student, students, studentSelection]);

  if (!open) return null;

  const payload = buildCreateVcDraftPayload({ credentialType, anchorNow, anchorCost });

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 className="h5 mb-1">{title}</h2>
                <p className="text-muted mb-0 small">{subtitle}</p>
              </div>
              <button type="button" className="btn-close" onClick={onClose} disabled={submitting || loading} aria-label="Close" />
            </div>
            <div className="modal-body">
              <div className="alert alert-info border mb-3">
                <div className="fw-semibold mb-1">Target student</div>
                <div>{formatStudentLabel(selectedStudent)}</div>
              </div>

              {students.length > 1 ? (
                <div className="mb-3">
                  <label className="form-label fw-semibold">Student</label>
                  <select
                    className="form-select"
                    value={studentSelection}
                    onChange={(event) => setStudentSelection(event.target.value)}
                    disabled={submitting || loading}
                  >
                    <option value="">Choose a student</option>
                    {students.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.studentName || item.studentNo || item._id}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Credential Type</label>
                  <select
                    className="form-select"
                    value={credentialType}
                    onChange={(event) => setCredentialType(event.target.value)}
                    disabled={submitting || loading}
                  >
                    <option value="tor">TOR</option>
                    <option value="diploma">Diploma</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Anchor Now</label>
                  <div className="btn-group w-100" role="group" aria-label="Anchor now">
                    <button
                      type="button"
                      className={`btn ${anchorNow ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setAnchorNow(true)}
                      disabled={submitting || loading}
                    >
                      YES
                    </button>
                    <button
                      type="button"
                      className={`btn ${!anchorNow ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setAnchorNow(false)}
                      disabled={submitting || loading}
                    >
                      NO
                    </button>
                  </div>
                  {anchorNow ? (
                    <div className="mt-2">
                      <label className="form-label fw-semibold">Anchor Cost</label>
                      <div className="input-group">
                        <span className="input-group-text">PHP</span>
                        <input
                          type="number"
                          min="0"
                          className="form-control"
                          value={anchorCost}
                          onChange={(event) => setAnchorCost(event.target.value)}
                          disabled={submitting || loading}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-3">
                <div className="fw-semibold mb-2">Summary</div>
                <div className="small text-muted">
                  Creating a {credentialType === 'diploma' ? 'Diploma' : 'TOR'} draft with {anchorNow ? 'same-day' : 'scheduled'} anchoring.
                </div>
                <div className="small text-muted mt-1">
                  Estimated total: PHP {Number(payload.anchorNowFee || 0) + 150}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={submitting || loading}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => onConfirm(payload)}
                disabled={submitting || loading || !selectedStudent}
              >
                {submitting ? 'Creating...' : <><FaFileSignature className="me-2" />Create VC Draft</>}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
