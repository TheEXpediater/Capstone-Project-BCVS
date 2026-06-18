import { useCallback, useEffect, useMemo, useState } from 'react';
import { searchStudents } from '../studentsAPI';
import {
  approveVerificationSubmission,
  getVerificationSubmission,
  listVerificationSubmissions,
  rejectVerificationSubmission,
} from '../../verification/verificationAPI';

const API_ORIGIN = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api'
)
  .replace(/\/api\/?$/, '')
  .replace(/\/+$/, '');

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function formatDate(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString();
}

function proofUrl(value) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_ORIGIN}${value.startsWith('/') ? value : `/${value}`}`;
}

function ProofImage({ label, src }) {
  const url = proofUrl(src);

  return (
    <div className="col-md-3">
      <div className="small text-muted mb-2">{label}</div>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt={label}
            className="img-fluid rounded border"
            style={{ maxHeight: 220, objectFit: 'cover', width: '100%' }}
          />
        </a>
      ) : (
        <div className="border rounded p-3 text-muted small">No image submitted.</div>
      )}
    </div>
  );
}

function LivenessCheck({ submission }) {
  const passed = Boolean(submission?.livenessPassed || submission?.answers?.livenessPassed);
  const method = submission?.livenessMethod || submission?.answers?.livenessMethod || 'FaceVerifier local liveness';
  const passedAt = submission?.livenessPassedAt || submission?.answers?.livenessPassedAt;

  return (
    <div className="col-md-3">
      <div className="small text-muted mb-2">Liveness Check</div>
      <div className="border rounded p-3 h-100">
        <div>
          <span className={`badge ${passed ? 'text-bg-success' : 'text-bg-warning'}`}>
            {passed ? 'Passed' : 'Not recorded'}
          </span>
        </div>
        <div className="small mt-3">
          <strong>Method:</strong> {method}
        </div>
        <div className="small mt-2">
          <strong>Passed At:</strong> {passedAt ? formatDate(passedAt) : 'Not recorded'}
        </div>
      </div>
    </div>
  );
}

function AnswersList({ answers }) {
  const entries = Object.entries(answers || {});

  if (!entries.length) {
    return <div className="text-muted small">No answers submitted.</div>;
  }

  return (
    <div className="row g-2">
      {entries.map(([key, value]) => (
        <div className="col-md-6" key={key}>
          <div className="small text-muted">{key}</div>
          <div className="fw-semibold">{String(value || '—')}</div>
        </div>
      ))}
    </div>
  );
}

function ReviewModal({
  submission,
  selectedStudent,
  studentResults,
  studentSearch,
  searching,
  acting,
  onClose,
  onSearchChange,
  onSearch,
  onSelectStudent,
  onApprove,
  onReject,
}) {
  if (!submission) return null;

  const answers = submission.answers || {};

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 className="h5 mb-1">Review Verification Request</h2>
                <p className="text-muted mb-0 small">{submission.email}</p>
              </div>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>

            <div className="modal-body">
              <section className="mb-4">
                <h3 className="h6">Submitted account</h3>
                <div className="row g-3">
                  <div className="col-md-3">
                    <div className="small text-muted">Name</div>
                    <div className="fw-semibold">{submission.fullName || '—'}</div>
                  </div>
                  <div className="col-md-3">
                    <div className="small text-muted">Email</div>
                    <div className="fw-semibold">{submission.email || '—'}</div>
                  </div>
                  <div className="col-md-3">
                    <div className="small text-muted">Submitted student no</div>
                    <div className="fw-semibold">{submission.submittedStudentNo || '—'}</div>
                  </div>
                  <div className="col-md-3">
                    <div className="small text-muted">Submitted date</div>
                    <div className="fw-semibold">{formatDate(submission.createdAt)}</div>
                  </div>
                </div>
              </section>

              <section className="mb-4">
                <h3 className="h6">Uploaded proof</h3>
                <div className="row g-3">
                  <ProofImage label="Valid ID front" src={submission.idFrontUrl} />
                  <ProofImage label="Valid ID back" src={submission.idBackUrl} />
                  <ProofImage label="Selfie proof" src={submission.selfieUrl} />
                  <LivenessCheck submission={submission} />
                </div>
              </section>

              <section className="mb-4">
                <h3 className="h6">Answers</h3>
                <AnswersList answers={answers} />
              </section>

              <section className="mb-4">
                <h3 className="h6">Search official student record</h3>
                <div className="input-group mb-3">
                  <input
                    className="form-control"
                    value={studentSearch}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Search by student number, name, or program"
                  />
                  <button className="btn btn-outline-primary" onClick={onSearch} disabled={searching}>
                    {searching ? 'Searching...' : 'Search'}
                  </button>
                </div>

                <div className="table-responsive border rounded">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Student No</th>
                        <th>Name</th>
                        <th>Program</th>
                        <th>Curriculum Year</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentResults.length ? (
                        studentResults.map((student) => (
                          <tr key={student._id}>
                            <td className="fw-semibold">{student.studentNo}</td>
                            <td>{student.studentName}</td>
                            <td>{student.programCode || student.programName || '—'}</td>
                            <td>{student.curriculumYear || '—'}</td>
                            <td>
                              <button
                                className={`btn btn-sm ${
                                  selectedStudent?._id === student._id ? 'btn-primary' : 'btn-outline-primary'
                                }`}
                                onClick={() => onSelectStudent(student)}
                              >
                                {selectedStudent?._id === student._id ? 'Selected' : 'Select'}
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="text-center text-muted py-3">
                            Search for a student record to link.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h3 className="h6">Match preview</h3>
                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="border rounded p-3 h-100">
                      <div className="small text-muted mb-2">Submitted info</div>
                      <div><strong>Name:</strong> {submission.fullName || answers.fullName || '—'}</div>
                      <div><strong>Student No:</strong> {submission.submittedStudentNo || answers.studentNo || '—'}</div>
                      <div><strong>Program:</strong> {answers.program || '—'}</div>
                      <div><strong>Year Level:</strong> {answers.yearLevel || '—'}</div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="border rounded p-3 h-100">
                      <div className="small text-muted mb-2">Official student record</div>
                      {selectedStudent ? (
                        <>
                          <div><strong>Name:</strong> {selectedStudent.studentName}</div>
                          <div><strong>Student No:</strong> {selectedStudent.studentNo}</div>
                          <div><strong>Program:</strong> {selectedStudent.programCode || selectedStudent.programName || '—'}</div>
                          <div><strong>Curriculum Year:</strong> {selectedStudent.curriculumYear || '—'}</div>
                        </>
                      ) : (
                        <div className="text-muted">No student selected.</div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose}>
                Close
              </button>
              <button className="btn btn-outline-danger" onClick={onReject} disabled={acting}>
                Reject
              </button>
              <button className="btn btn-primary" onClick={onApprove} disabled={acting || !selectedStudent}>
                {acting ? 'Saving...' : 'Confirm Link'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

export default function LinkAccountsPage() {
  const [submissions, setSubmissions] = useState([]);
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [toast, setToast] = useState('');

  const [reviewing, setReviewing] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [acting, setActing] = useState(false);

  const loadSubmissions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listVerificationSubmissions({ status, search });
      setSubmissions(data);
    } catch (error) {
      setFeedback({
        type: 'danger',
        text: getErrorMessage(error, 'Failed to load verification submissions.'),
      });
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  }

  async function openReview(id) {
    try {
      setFeedback({ type: '', text: '' });
      const data = await getVerificationSubmission(id);
      setReviewing(data);
      setStudentSearch(data.submittedStudentNo || data.answers?.studentNo || '');
      setStudentResults([]);
      setSelectedStudent(null);
    } catch (error) {
      setFeedback({
        type: 'danger',
        text: getErrorMessage(error, 'Failed to load verification submission.'),
      });
    }
  }

  async function handleStudentSearch() {
    if (!studentSearch.trim()) return;

    try {
      setSearchingStudents(true);
      const data = await searchStudents(studentSearch.trim());
      setStudentResults(data || []);
    } catch (error) {
      setFeedback({
        type: 'danger',
        text: getErrorMessage(error, 'Failed to search student records.'),
      });
    } finally {
      setSearchingStudents(false);
    }
  }

  async function handleApprove() {
    if (!reviewing || !selectedStudent) return;

    const approved = window.confirm(
      `Link this mobile account to ${selectedStudent.studentNo} - ${selectedStudent.studentName}?`
    );

    if (!approved) return;

    try {
      setActing(true);
      await approveVerificationSubmission(reviewing.id || reviewing._id, {
        studentId: selectedStudent._id,
      });
      setReviewing(null);
      await loadSubmissions();
      showToast('Account linked successfully.');
    } catch (error) {
      setFeedback({
        type: 'danger',
        text: getErrorMessage(error, 'Failed to link account.'),
      });
    } finally {
      setActing(false);
    }
  }

  async function handleReject() {
    if (!reviewing) return;

    const reason = window.prompt('Reason for rejection?');
    if (!reason?.trim()) return;

    try {
      setActing(true);
      await rejectVerificationSubmission(reviewing.id || reviewing._id, reason.trim());
      setReviewing(null);
      await loadSubmissions();
      showToast('Verification request rejected.');
    } catch (error) {
      setFeedback({
        type: 'danger',
        text: getErrorMessage(error, 'Failed to reject request.'),
      });
    } finally {
      setActing(false);
    }
  }

  const countLabel = useMemo(() => `${submissions.length} request(s)`, [submissions.length]);

  return (
    <div className="d-flex flex-column gap-4">
      {toast ? (
        <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 2000 }}>
          <div className="alert alert-success shadow-sm mb-0">{toast}</div>
        </div>
      ) : null}

      {feedback.text ? <div className={`alert alert-${feedback.type}`}>{feedback.text}</div> : null}

      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="row g-3 align-items-end mb-3">
            <div className="col-md-5">
              <label className="form-label">Search</label>
              <input
                className="form-control"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, email, or student number"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Status</label>
              <select className="form-select" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="col-md-4 d-flex gap-2">
              <button className="btn btn-primary" onClick={loadSubmissions} disabled={loading}>
                {loading ? 'Loading...' : 'Apply'}
              </button>
              <button className="btn btn-outline-secondary" onClick={() => setSearch('')}>
                Clear
              </button>
            </div>
          </div>

          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="h5 mb-0">Verification Requests</h2>
            <span className="text-muted small">{countLabel}</span>
          </div>

          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>Submitted Name</th>
                  <th>Email</th>
                  <th>Submitted Student No</th>
                  <th>Status</th>
                  <th>Date Submitted</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {submissions.length ? (
                  submissions.map((item) => (
                    <tr key={item.id || item._id}>
                      <td>{item.fullName || '—'}</td>
                      <td>{item.email || '—'}</td>
                      <td>{item.submittedStudentNo || '—'}</td>
                      <td>
                        <span className="badge text-bg-secondary text-uppercase">{item.status}</span>
                      </td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>
                        <button className="btn btn-outline-primary btn-sm" onClick={() => openReview(item.id || item._id)}>
                          Review
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center text-muted py-4">
                      No verification requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ReviewModal
        submission={reviewing}
        selectedStudent={selectedStudent}
        studentResults={studentResults}
        studentSearch={studentSearch}
        searching={searchingStudents}
        acting={acting}
        onClose={() => setReviewing(null)}
        onSearchChange={setStudentSearch}
        onSearch={handleStudentSearch}
        onSelectStudent={setSelectedStudent}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
}
