import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  bulkImportStudentGrades,
  bulkImportStudents,
  getStudentGrades,
  getStudentProfile,
  listStudents,
  updateStudentProfile,
} from '../studentsAPI';
import { createCredentialDraftFromStudent } from '../../credentials/credentialsAPI';

function formatDate(value) {
  if (!value) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleDateString();
}

function buildSummaryText(label, summary) {
  if (!summary) return `${label} finished.`;

  const parts = [
    `total: ${summary.total ?? 0}`,
    `inserted: ${summary.inserted ?? 0}`,
    `updated: ${summary.updated ?? 0}`,
    `skipped: ${summary.skipped ?? 0}`,
  ];

  if (typeof summary.withoutCurriculum === 'number') {
    parts.push(`without curriculum: ${summary.withoutCurriculum}`);
  }

  return `${label} finished (${parts.join(', ')}).`;
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function normalizeHeaderKey(key) {
  return String(key || '').trim().replace(/\s+/g, '');
}

function normalizeCellValue(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return value;
}

function isMeaningfulRow(row) {
  return Object.values(row || {}).some((value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    return true;
  });
}

async function readSpreadsheet(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
  });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: false,
  });

  const rows = rawRows
    .map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          normalizeHeaderKey(key),
          normalizeCellValue(value),
        ])
      )
    )
    .filter(isMeaningfulRow);

  return {
    sheetName,
    rows,
  };
}

function formatDateInput(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function createStudentForm(student) {
  return {
    studentName: student?.studentName || '',
    extensionName: student?.extensionName || '',
    gender: student?.gender || '',
    permanentAddress: student?.permanentAddress || '',
    residentialAddress: student?.residentialAddress || '',
    entranceCredentials: student?.entranceCredentials || '',
    highSchool: student?.highSchool || '',
    degreeTitle: student?.degreeTitle || '',
    major: student?.major || '',
    dateAdmission: formatDateInput(student?.dateAdmission),
    placeBirth: student?.placeBirth || '',
    dateGraduated: formatDateInput(student?.dateGraduated),
    dateGraduation: formatDateInput(student?.dateGraduation),
    graduated: Boolean(student?.graduated),
    programCode: student?.programCode || '',
    programName: student?.programName || '',
    curriculumYear: student?.curriculum?.curriculumYear || '',
  };
}

function FeedbackAlert({ feedback }) {
  if (!feedback?.text) return null;

  return (
    <div className={`alert alert-${feedback.type} mb-0`}>
      <div>{feedback.text}</div>

      {feedback.issues?.length ? (
        <div className="mt-2">
          <div className="fw-semibold small mb-1">Sample issues</div>
          <ul className="small mb-0">
            {feedback.issues.slice(0, 10).map((issue, index) => (
              <li key={index}>
                {issue.studentNo ? `${issue.studentNo}: ` : ''}
                {issue.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function DataPreview({ rows }) {
  if (!rows.length) {
    return <div className="alert alert-light border mb-0">No preview available yet.</div>;
  }

  const previewRows = rows.slice(0, 5);
  const columns = Object.keys(previewRows[0] || {});

  return (
    <div className="border rounded-3 p-3 bg-light">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="fw-semibold">Preview</div>
        <div className="small text-muted">
          Showing {previewRows.length} of {rows.length} row(s)
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-sm align-middle mb-0">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={`${index}-${column}`}>
                    {String(row[column] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StudentProfileModal({
  student,
  initialEditing = false,
  onClose,
  onOpenGrades,
  onSave,
}) {
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(createStudentForm(student));

  useEffect(() => {
    setIsEditing(initialEditing);
    setForm(createStudentForm(student));
  }, [student, initialEditing]);

  if (!student) return null;

  const original = createStudentForm(student);
  const hasChanges = JSON.stringify(form) !== JSON.stringify(original);

  function updateField(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleRequestClose() {
    if (isEditing && hasChanges) {
      const approved = window.confirm('Discard unsaved changes?');
      if (!approved) return;
    }
    onClose();
  }

  function handleStartEdit() {
    const approved = window.confirm('Turn this profile into edit mode?');
    if (!approved) return;
    setIsEditing(true);
  }

  function handleCancelEdit() {
    if (hasChanges) {
      const approved = window.confirm('Discard unsaved changes?');
      if (!approved) return;
    }
    setForm(original);
    setIsEditing(false);
  }

  async function handleSave() {
    const approved = window.confirm('Save changes to this student profile?');
    if (!approved) return;

    try {
      setSaving(true);
      const updated = await onSave(student._id, form);
      setForm(createStudentForm(updated));
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleOpenGradesFromModal() {
    if (isEditing && hasChanges) {
      const approved = window.confirm(
        'You have unsaved changes. Open grades without saving?'
      );
      if (!approved) return;
    }
    onOpenGrades(student._id);
  }

  function renderValue(label, value, input) {
    return (
      <div className="col-md-6">
        <div className="small text-muted">{label}</div>
        {isEditing ? input : <div className="fw-semibold">{value || '—'}</div>}
      </div>
    );
  }

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 className="h5 mb-1">
                  {isEditing ? 'Edit Student Profile' : 'Student Profile'}
                </h2>
                <p className="text-muted mb-0 small">{student.studentNo}</p>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={handleRequestClose}
                aria-label="Close"
              />
            </div>

            <div className="modal-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="small text-muted">Student No</div>
                  <div className="fw-semibold">{student.studentNo || '—'}</div>
                </div>

                {renderValue(
                  'Student Name',
                  form.studentName,
                  <input
                    className="form-control"
                    value={form.studentName}
                    onChange={(e) => updateField('studentName', e.target.value)}
                  />
                )}

                {renderValue(
                  'Program Code',
                  form.programCode,
                  <input
                    className="form-control"
                    value={form.programCode}
                    onChange={(e) => updateField('programCode', e.target.value.toUpperCase())}
                  />
                )}

                {renderValue(
                  'Program Name',
                  form.programName || form.degreeTitle,
                  <input
                    className="form-control"
                    value={form.programName}
                    onChange={(e) => updateField('programName', e.target.value)}
                  />
                )}

                <div className="col-md-4">
                  <div className="small text-muted">Graduated</div>
                  {isEditing ? (
                    <select
                      className="form-select"
                      value={form.graduated ? 'yes' : 'no'}
                      onChange={(e) => updateField('graduated', e.target.value === 'yes')}
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  ) : (
                    <div className="fw-semibold">{form.graduated ? 'Yes' : 'No'}</div>
                  )}
                </div>

                {renderValue(
                  'Curriculum Year',
                  form.curriculumYear || student?.curriculum?.curriculumYear,
                  <input
                    className="form-control"
                    value={form.curriculumYear}
                    onChange={(e) => updateField('curriculumYear', e.target.value)}
                  />
                )}

                {renderValue(
                  'Major',
                  form.major,
                  <input
                    className="form-control"
                    value={form.major}
                    onChange={(e) => updateField('major', e.target.value)}
                  />
                )}

                {renderValue(
                  'Gender',
                  form.gender,
                  <input
                    className="form-control"
                    value={form.gender}
                    onChange={(e) => updateField('gender', e.target.value)}
                  />
                )}

                {renderValue(
                  'Extension Name',
                  form.extensionName,
                  <input
                    className="form-control"
                    value={form.extensionName}
                    onChange={(e) => updateField('extensionName', e.target.value)}
                  />
                )}

                {renderValue(
                  'Date Admission',
                  formatDate(form.dateAdmission),
                  <input
                    type="date"
                    className="form-control"
                    value={form.dateAdmission}
                    onChange={(e) => updateField('dateAdmission', e.target.value)}
                  />
                )}

                {renderValue(
                  'Date Graduated',
                  formatDate(form.dateGraduated),
                  <input
                    type="date"
                    className="form-control"
                    value={form.dateGraduated}
                    onChange={(e) => updateField('dateGraduated', e.target.value)}
                  />
                )}

                {renderValue(
                  'Date Graduation',
                  formatDate(form.dateGraduation),
                  <input
                    type="date"
                    className="form-control"
                    value={form.dateGraduation}
                    onChange={(e) => updateField('dateGraduation', e.target.value)}
                  />
                )}

                {renderValue(
                  'Place of Birth',
                  form.placeBirth,
                  <input
                    className="form-control"
                    value={form.placeBirth}
                    onChange={(e) => updateField('placeBirth', e.target.value)}
                  />
                )}

                <div className="col-md-6">
                  <div className="small text-muted">Curriculum</div>
                  <div className="fw-semibold">
                    {student.curriculum
                      ? `${student.curriculum.program} ${student.curriculum.curriculumYear}`
                      : 'Not linked yet'}
                  </div>
                </div>

                <div className="col-12">
                  <div className="small text-muted">Permanent Address</div>
                  {isEditing ? (
                    <textarea
                      className="form-control"
                      rows="2"
                      value={form.permanentAddress}
                      onChange={(e) => updateField('permanentAddress', e.target.value)}
                    />
                  ) : (
                    <div className="fw-semibold">{form.permanentAddress || '—'}</div>
                  )}
                </div>

                <div className="col-12">
                  <div className="small text-muted">Residential Address</div>
                  {isEditing ? (
                    <textarea
                      className="form-control"
                      rows="2"
                      value={form.residentialAddress}
                      onChange={(e) => updateField('residentialAddress', e.target.value)}
                    />
                  ) : (
                    <div className="fw-semibold">{form.residentialAddress || '—'}</div>
                  )}
                </div>

                {renderValue(
                  'Entrance Credentials',
                  form.entranceCredentials,
                  <input
                    className="form-control"
                    value={form.entranceCredentials}
                    onChange={(e) => updateField('entranceCredentials', e.target.value)}
                  />
                )}

                {renderValue(
                  'High School',
                  form.highSchool,
                  <input
                    className="form-control"
                    value={form.highSchool}
                    onChange={(e) => updateField('highSchool', e.target.value)}
                  />
                )}

                {renderValue(
                  'Degree Title',
                  form.degreeTitle,
                  <input
                    className="form-control"
                    value={form.degreeTitle}
                    onChange={(e) => updateField('degreeTitle', e.target.value)}
                  />
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={handleRequestClose}>
                Close
              </button>

              {!isEditing ? (
                <>
                  <button className="btn btn-outline-primary" onClick={handleStartEdit}>
                    Edit
                  </button>
                  <button className="btn btn-primary" onClick={handleOpenGradesFromModal}>
                    Show Grades
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-outline-secondary" onClick={handleCancelEdit}>
                    Cancel Edit
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="modal-backdrop show" onClick={handleRequestClose} />
    </>
  );
}

function buildGradeDisplayRows(grades) {
  const yearCounts = new Map();
  const semesterCounts = new Map();

  for (const grade of grades || []) {
    const yearKey = grade.yearLevel || '—';
    const semesterKey = `${yearKey}__${grade.semester || '—'}`;

    yearCounts.set(yearKey, (yearCounts.get(yearKey) || 0) + 1);
    semesterCounts.set(semesterKey, (semesterCounts.get(semesterKey) || 0) + 1);
  }

  let lastYearKey = null;
  let lastSemesterKey = null;

  return (grades || []).map((grade) => {
    const yearKey = grade.yearLevel || '—';
    const semesterKey = `${yearKey}__${grade.semester || '—'}`;

    const showYear = yearKey !== lastYearKey;
    const showSemester = semesterKey !== lastSemesterKey;

    lastYearKey = yearKey;
    lastSemesterKey = semesterKey;

    return {
      ...grade,
      showYear,
      showSemester,
      yearRowSpan: showYear ? yearCounts.get(yearKey) || 1 : 0,
      semesterRowSpan: showSemester ? semesterCounts.get(semesterKey) || 1 : 0,
    };
  });
}

function StudentGradesModal({ data, onClose }) {
  if (!data) return null;

  const grades = data.grades || [];
  const student = data.student;
  const displayRows = buildGradeDisplayRows(grades);

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-xl modal-dialog-centered">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 className="h5 mb-1">Student Grades</h2>
                <p className="text-muted mb-0 small">
                  {student?.studentNo} — {student?.studentName}
                </p>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
                aria-label="Close"
              />
            </div>

            <div className="modal-body">
              {grades.length === 0 ? (
                <div className="alert alert-light border mb-0">
                  No grades imported for this student yet.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle">
                    <thead>
                      <tr>
                        <th>Year</th>
                        <th>Semester</th>
                        <th>Subject Code</th>
                        <th>Subject Title</th>
                        <th>Units</th>
                        <th>Grade</th>
                        <th>Remarks</th>
                        <th>School Year</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows.map((grade) => (
                        <tr key={grade._id}>
                          {grade.showYear ? (
                            <td rowSpan={grade.yearRowSpan} className="align-top fw-semibold">
                              {grade.yearLevel || '—'}
                            </td>
                          ) : null}

                          {grade.showSemester ? (
                            <td rowSpan={grade.semesterRowSpan} className="align-top">
                              {grade.semester || '—'}
                            </td>
                          ) : null}

                          <td className="fw-semibold">{grade.subjectCode || '—'}</td>
                          <td>{grade.subjectTitle || '—'}</td>
                          <td>{grade.units ?? 0}</td>
                          <td>{grade.finalGrade || '—'}</td>
                          <td>{grade.remarks || '—'}</td>
                          <td>{grade.schoolYear || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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

function ImportPanel({
  title,
  description,
  warning,
  fileName,
  sheetName,
  rows,
  loading,
  buttonText,
  onFileChange,
  onImport,
  helperText,
}) {
  const columns = Object.keys(rows[0] || {});

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body p-4 d-flex flex-column gap-4">
        <div>
          <h2 className="h5 mb-1">{title}</h2>
          <p className="text-muted mb-0">{description}</p>
        </div>

        {warning ? <div className="alert alert-warning mb-0">{warning}</div> : null}

        <div className="border rounded-3 p-3 bg-light">
          <label className="form-label fw-semibold">Select Excel / CSV file</label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="form-control"
            onChange={onFileChange}
          />

          {helperText ? (
            <div className="small text-muted mt-2">{helperText}</div>
          ) : null}
        </div>

        {fileName ? (
          <div className="border rounded-3 p-3">
            <div className="fw-semibold">{fileName}</div>
            <div className="small text-muted">
              Sheet: {sheetName || '—'} | Rows: {rows.length}
            </div>
            <div className="small text-muted mt-2">
              Columns: {columns.join(', ') || '—'}
            </div>
          </div>
        ) : null}

        <div className="d-flex justify-content-end">
          <button
            className="btn btn-primary"
            onClick={onImport}
            disabled={loading || !rows.length}
          >
            {loading ? 'Importing...' : buttonText}
          </button>
        </div>

        <DataPreview rows={rows} />
      </div>
    </div>
  );
}

export default function StudentImportManagerPage() {
  const [activeTab, setActiveTab] = useState('students');
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [refreshingStudents, setRefreshingStudents] = useState(false);

  const [feedback, setFeedback] = useState({
    type: '',
    text: '',
    issues: [],
  });

  const [studentImport, setStudentImport] = useState({
    fileName: '',
    sheetName: '',
    rows: [],
    loading: false,
  });

  const [gradeImport, setGradeImport] = useState({
    fileName: '',
    sheetName: '',
    rows: [],
    loading: false,
  });

  const [profileLoading, setProfileLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [profileMode, setProfileMode] = useState('view');
  const [gradesLoadingId, setGradesLoadingId] = useState('');
  const [selectedGradesData, setSelectedGradesData] = useState(null);

  async function loadStudents(showBusy = false) {
    try {
      if (showBusy) {
        setRefreshingStudents(true);
      } else {
        setLoadingStudents(true);
      }

      const data = await listStudents();
      setStudents(data || []);
    } catch (error) {
      setFeedback({
        type: 'danger',
        text: getErrorMessage(error, 'Failed to load students.'),
        issues: [],
      });
    } finally {
      setLoadingStudents(false);
      setRefreshingStudents(false);
    }
  }

  useEffect(() => {
    loadStudents(false);
  }, []);

  async function handleStudentFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await readSpreadsheet(file);

      setStudentImport({
        fileName: file.name,
        sheetName: parsed.sheetName,
        rows: parsed.rows,
        loading: false,
      });

      setFeedback({
        type: 'success',
        text: `Loaded ${parsed.rows.length} student row(s) from ${file.name}.`,
        issues: [],
      });
    } catch (error) {
      setFeedback({
        type: 'danger',
        text: getErrorMessage(error, 'Failed to read student import file.'),
        issues: [],
      });
    } finally {
      event.target.value = '';
    }
  }

  async function handleGradeFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await readSpreadsheet(file);

      setGradeImport({
        fileName: file.name,
        sheetName: parsed.sheetName,
        rows: parsed.rows,
        loading: false,
      });

      setFeedback({
        type: 'success',
        text: `Loaded ${parsed.rows.length} grade row(s) from ${file.name}.`,
        issues: [],
      });
    } catch (error) {
      setFeedback({
        type: 'danger',
        text: getErrorMessage(error, 'Failed to read grade import file.'),
        issues: [],
      });
    } finally {
      event.target.value = '';
    }
  }

  async function handleImportStudents() {
    if (!studentImport.rows.length) {
      setFeedback({
        type: 'danger',
        text: 'Choose a student spreadsheet first.',
        issues: [],
      });
      return;
    }

    try {
      setStudentImport((prev) => ({ ...prev, loading: true }));

      const result = await bulkImportStudents(studentImport.rows);

      setFeedback({
        type: 'success',
        text: buildSummaryText('Student import', result.summary),
        issues: result.issues || [],
      });

      await loadStudents(true);
      setActiveTab('students');
    } catch (error) {
      setFeedback({
        type: 'danger',
        text: getErrorMessage(error, 'Failed to import student data.'),
        issues: [],
      });
    } finally {
      setStudentImport((prev) => ({ ...prev, loading: false }));
    }
  }

  async function handleImportGrades() {
    if (!gradeImport.rows.length) {
      setFeedback({
        type: 'danger',
        text: 'Choose a grades spreadsheet first.',
        issues: [],
      });
      return;
    }

    try {
      setGradeImport((prev) => ({ ...prev, loading: true }));

      const result = await bulkImportStudentGrades(gradeImport.rows);

      setFeedback({
        type: 'success',
        text: buildSummaryText('Grade import', result.summary),
        issues: result.issues || [],
      });

      await loadStudents(true);
      setActiveTab('students');
    } catch (error) {
      setFeedback({
        type: 'danger',
        text: getErrorMessage(error, 'Failed to import grades.'),
        issues: [],
      });
    } finally {
      setGradeImport((prev) => ({ ...prev, loading: false }));
    }
  }

  async function handleOpenProfile(studentId, mode = 'view') {
    try {
      setProfileLoading(true);
      const data = await getStudentProfile(studentId);
      setSelectedStudent(data);
      setProfileMode(mode);
    } catch (error) {
      setFeedback({
        type: 'danger',
        text: getErrorMessage(error, 'Failed to load student profile.'),
        issues: [],
      });
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleSaveStudentProfile(studentId, payload) {
    try {
      const updated = await updateStudentProfile(studentId, payload);

      setSelectedStudent(updated);
      await loadStudents(true);

      setFeedback({
        type: 'success',
        text: 'Student profile updated successfully.',
        issues: [],
      });

      return updated;
    } catch (error) {
      setFeedback({
        type: 'danger',
        text: getErrorMessage(error, 'Failed to update student profile.'),
        issues: [],
      });
      throw error;
    }
  }

  async function handleOpenGrades(studentId) {
    try {
      setGradesLoadingId(studentId);
      const data = await getStudentGrades(studentId);
      setSelectedGradesData(data);
      setSelectedStudent(null);
    } catch (error) {
      setFeedback({
        type: 'danger',
        text: getErrorMessage(error, 'Failed to load student grades.'),
        issues: [],
      });
    } finally {
      setGradesLoadingId('');
    }
  }

  async function handleCreateVcDraft(studentId) {
    const approved = window.confirm(
      'Create a VC draft from this student profile and current grades?'
    );

    if (!approved) return;

    try {
      const data = await createCredentialDraftFromStudent(studentId, {
        credentialType: 'student_record',
        notes: '',
      });

      setFeedback({
        type: 'success',
        text: `VC draft created for ${data.studentName}.`,
        issues: [],
      });
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to create VC draft.',
        issues: [],
      });
    }
  }

  return (
    <>
      <div className="d-flex flex-column gap-4">
        <div>
          <h1 className="h3 mb-1">Student Records</h1>
          <p className="text-muted mb-0">
            Clean student import first, then grade import, with profile and grade viewing in one page.
          </p>
        </div>

        <div className="d-flex flex-wrap gap-2">
          <button
            className={`btn ${activeTab === 'students' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setActiveTab('students')}
          >
            Students
          </button>
          <button
            className={`btn ${activeTab === 'importStudents' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setActiveTab('importStudents')}
          >
            Import Student Data
          </button>
          <button
            className={`btn ${activeTab === 'importGrades' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setActiveTab('importGrades')}
          >
            Import Grades
          </button>
        </div>

        <FeedbackAlert feedback={feedback} />

        {activeTab === 'students' ? (
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h2 className="h5 mb-1">Saved Students</h2>
                  <p className="text-muted mb-0">
                    Table stays minimal: student no, name, program, graduated.
                  </p>
                </div>

                <button
                  className="btn btn-outline-secondary"
                  onClick={() => loadStudents(true)}
                  disabled={refreshingStudents}
                >
                  {refreshingStudents ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              {loadingStudents ? (
                <div className="text-muted">Loading students...</div>
              ) : students.length === 0 ? (
                <div className="alert alert-light border mb-0">No student records yet.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Student No.</th>
                        <th>Name</th>
                        <th>Program</th>
                        <th>Graduated</th>
                        <th style={{ minWidth: 180 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student._id}>
                          <td className="fw-semibold">{student.studentNo}</td>
                          <td>{student.studentName}</td>
                          <td>{student.program || '—'}</td>
                          <td>
                            <span
                              className={`badge ${
                                student.graduated ? 'text-bg-success' : 'text-bg-secondary'
                              }`}
                            >
                              {student.graduated ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td>
                            <div className="d-flex flex-wrap gap-2">
                              <button
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => handleOpenProfile(student._id, 'view')}
                                disabled={profileLoading}
                              >
                                Profile
                              </button>

                              <button
                                className="btn btn-outline-warning btn-sm"
                                onClick={() => handleOpenProfile(student._id, 'edit')}
                                disabled={profileLoading}
                              >
                                Edit
                              </button>

                              <button
                                className="btn btn-outline-secondary btn-sm"
                                onClick={() => handleOpenGrades(student._id)}
                                disabled={gradesLoadingId === student._id}
                              >
                                {gradesLoadingId === student._id ? 'Loading...' : 'Grades'}
                              </button>

                              <button
                                className="btn btn-outline-success btn-sm"
                                onClick={() => handleCreateVcDraft(student._id)}
                              >
                                Create VC Draft
                              </button>
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

        {activeTab === 'importStudents' ? (
          <ImportPanel
            title="Import Student Data"
            description="Upload student records first."
            fileName={studentImport.fileName}
            sheetName={studentImport.sheetName}
            rows={studentImport.rows}
            loading={studentImport.loading}
            buttonText="Import Student Data"
            onFileChange={handleStudentFileChange}
            onImport={handleImportStudents}
            helperText={
              <>
                Recognized student columns include <strong>StudentNo, StudentName, ExtensionName, Gender, PermAddress, ResAddress, EntranceCredentials, HighSchool, DegreeTitle, Major, DateAdmission, PlaceBirth, DateGraduated, DateGraduation</strong>. Add <strong>ProgramCode</strong> and optional <strong>CurriculumYear</strong> when available for better curriculum matching.
              </>
            }
          />
        ) : null}

        {activeTab === 'importGrades' ? (
          <ImportPanel
            title="Import Grades"
            description="Grades can only be imported after the student already exists."
            warning="Grade import will skip any row where the student does not exist yet or the student has no linked curriculum."
            fileName={gradeImport.fileName}
            sheetName={gradeImport.sheetName}
            rows={gradeImport.rows}
            loading={gradeImport.loading}
            buttonText="Import Grades"
            onFileChange={handleGradeFileChange}
            onImport={handleImportGrades}
            helperText={
              <>
                Recognized grade columns include <strong>StudentNo or StudentNumber, SubjectCode or Code, SubjectTitle or Title, Units, FinalGrade or Grade, Remarks, YearLevel or Year, Semester or Sem, SchoolYear, TermName</strong>.
              </>
            }
          />
        ) : null}
      </div>

      <StudentProfileModal
        student={selectedStudent}
        initialEditing={profileMode === 'edit'}
        onClose={() => {
          setSelectedStudent(null);
          setProfileMode('view');
        }}
        onOpenGrades={handleOpenGrades}
        onSave={handleSaveStudentProfile}
      />

      <StudentGradesModal
        data={selectedGradesData}
        onClose={() => setSelectedGradesData(null)}
      />
    </>
  );
}