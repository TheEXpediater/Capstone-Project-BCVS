import { useEffect, useMemo, useState } from 'react';
import {
  FaChevronLeft,
  FaChevronRight,
  FaCog,
  FaEdit,
  FaFileSignature,
  FaFilter,
  FaIdCard,
  FaListAlt,
  FaPlus,
  FaSearch,
  FaTrash,
  FaUpload,
} from 'react-icons/fa';
import * as XLSX from 'xlsx';
import FloatingActionMenu from '../../../components/FloatingActionMenu';
import { hasValidStoredAuth } from '../../auth/authStorage';
import {
  bulkImportStudentGrades,
  bulkImportStudents,
  createStudentProfile,
  deleteStudentProfile,
  getStudentGrades,
  getStudentProfile,
  listStudents,
  updateStudentProfile,
} from '../studentsAPI';
import { listCurricula } from '../../curriculum/curriculumAPI';
import { createCredentialDraftFromStudent } from '../../credentials/credentialsAPI';

const PAGE_SIZE = 10;

const EMPTY_STUDENT_FORM = {
  studentNo: '',
  studentName: '',
  extensionName: '',
  gender: '',
  curriculumId: '',
  programCode: '',
  programName: '',
  curriculumYear: '',
  degreeTitle: '',
  major: '',
  dateAdmission: '',
  dateGraduated: '',
  dateGraduation: '',
  placeBirth: '',
  permanentAddress: '',
  residentialAddress: '',
  entranceCredentials: 'SF10 / Form 138',
  highSchool: '',
};

const EMPTY_FILTERS = {
  studentName: '',
  programCode: '',
  curriculumYear: '',
  graduationYear: '',
  graduated: '',
};

const EMPTY_IMPORT_STATE = {
  fileName: '',
  sheetName: '',
  rows: [],
  loading: false,
};

const EMPTY_PAGINATION = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  totalPages: 1,
  hasPrevPage: false,
  hasNextPage: false,
};

function formatDate(value) {
  if (!value) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleDateString();
}

function formatYear(value) {
  if (!value) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';

  return String(parsed.getFullYear());
}

function buildSummaryText(label, summary) {
  if (!summary) return `${label} finished.`;

  const parts = [
    `total: ${summary.total ?? 0}`,
    `inserted: ${summary.inserted ?? 0}`,
    `updated: ${summary.updated ?? 0}`,
    `skipped: ${summary.skipped ?? 0}`,
  ];

  if (typeof summary.withoutCurriculum === 'number' && summary.withoutCurriculum > 0) {
    parts.push(`without curriculum: ${summary.withoutCurriculum}`);
  }

  if (typeof summary.graduationChecked === 'number') {
    parts.push(`graduation checked: ${summary.graduationChecked}`);
  }

  if (typeof summary.graduationUpdated === 'number') {
    parts.push(`graduation updated: ${summary.graduationUpdated}`);
  }

  if (typeof summary.graduatedYes === 'number') {
    parts.push(`graduated yes: ${summary.graduatedYes}`);
  }

  if (typeof summary.graduatedNo === 'number') {
    parts.push(`graduated no: ${summary.graduatedNo}`);
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

function createStudentForm(student = null) {
  if (!student) return { ...EMPTY_STUDENT_FORM };

  return {
    studentNo: student.studentNo || '',
    studentName: student.studentName || '',
    extensionName: student.extensionName || '',
    gender: student.gender || '',
    curriculumId: student.curriculum?._id || student.curriculumId || '',
    programCode: student.programCode || student.curriculum?.program || '',
    programName: student.programName || student.curriculum?.programName || '',
    curriculumYear: student.curriculumYear || student.curriculum?.curriculumYear || '',
    degreeTitle: student.degreeTitle || student.programName || student.curriculum?.programName || '',
    major: student.major || '',
    dateAdmission: formatDateInput(student.dateAdmission),
    dateGraduated: formatDateInput(student.dateGraduated),
    dateGraduation: formatDateInput(student.dateGraduation),
    placeBirth: student.placeBirth || '',
    permanentAddress: student.permanentAddress || '',
    residentialAddress: student.residentialAddress || '',
    entranceCredentials: student.entranceCredentials || '',
    highSchool: student.highSchool || '',
  };
}

function curriculumLabel(curriculum) {
  const program = curriculum?.program || 'Program';
  const name = curriculum?.programName || 'Unnamed curriculum';
  const year = curriculum?.curriculumYear || 'No year';
  return `${program} - ${name} (${year})`;
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
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
                  <td key={`${index}-${column}`}>{String(row[column] ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StudentFormFields({
  form,
  onChange,
  curricula,
  includeStudentNo = false,
  readOnlyStudentNo = false,
}) {
  function updateField(field, value) {
    onChange({
      ...form,
      [field]: value,
    });
  }

  function handleCurriculumChange(curriculumId) {
    const selected = curricula.find((item) => String(item._id) === String(curriculumId));

    onChange({
      ...form,
      curriculumId,
      programCode: selected?.program || '',
      programName: selected?.programName || '',
      curriculumYear: selected?.curriculumYear || '',
      degreeTitle: selected?.programName || form.degreeTitle || '',
    });
  }

  return (
    <div className="row g-3">
      {includeStudentNo ? (
        <div className="col-md-4">
          <label className="form-label fw-semibold">Student No.</label>
          <input
            className="form-control"
            value={form.studentNo}
            onChange={(event) => updateField('studentNo', event.target.value)}
            disabled={readOnlyStudentNo}
            required
          />
        </div>
      ) : null}

      <div className={includeStudentNo ? 'col-md-8' : 'col-md-6'}>
        <label className="form-label fw-semibold">Student Name</label>
        <input
          className="form-control"
          value={form.studentName}
          onChange={(event) => updateField('studentName', event.target.value)}
          placeholder="Last Name, First Name Middle Name"
          required
        />
      </div>

      <div className="col-md-6">
        <label className="form-label fw-semibold">Program / Curriculum</label>
        <select
          className="form-select"
          value={form.curriculumId}
          onChange={(event) => handleCurriculumChange(event.target.value)}
          required
        >
          <option value="">Select existing curriculum</option>
          {curricula.map((curriculum) => (
            <option key={curriculum._id} value={curriculum._id}>
              {curriculumLabel(curriculum)}
            </option>
          ))}
        </select>
      </div>

      <div className="col-md-3">
        <label className="form-label fw-semibold">Major</label>
        <input
          className="form-control"
          value={form.major}
          onChange={(event) => updateField('major', event.target.value)}
          placeholder="Optional"
        />
      </div>

      <div className="col-md-3">
        <label className="form-label fw-semibold">Extension Name</label>
        <input
          className="form-control"
          value={form.extensionName}
          onChange={(event) => updateField('extensionName', event.target.value)}
          placeholder="Jr., Sr., III"
        />
      </div>

      <div className="col-md-3">
        <label className="form-label fw-semibold">Gender</label>
        <select
          className="form-select"
          value={form.gender}
          onChange={(event) => updateField('gender', event.target.value)}
        >
          <option value="">Select</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
      </div>

      <div className="col-md-3">
        <label className="form-label fw-semibold">Date Admission</label>
        <input
          type="date"
          className="form-control"
          value={form.dateAdmission}
          onChange={(event) => updateField('dateAdmission', event.target.value)}
        />
      </div>

      <div className="col-md-3">
        <label className="form-label fw-semibold">Date Graduated</label>
        <input
          type="date"
          className="form-control"
          value={form.dateGraduated}
          onChange={(event) => updateField('dateGraduated', event.target.value)}
        />
      </div>

      <div className="col-md-3">
        <label className="form-label fw-semibold">Date Graduation</label>
        <input
          type="date"
          className="form-control"
          value={form.dateGraduation}
          onChange={(event) => updateField('dateGraduation', event.target.value)}
        />
      </div>

      <div className="col-md-6">
        <label className="form-label fw-semibold">Place of Birth</label>
        <input
          className="form-control"
          value={form.placeBirth}
          onChange={(event) => updateField('placeBirth', event.target.value)}
          placeholder="City/Municipality, Province"
        />
      </div>

      <div className="col-md-6">
        <label className="form-label fw-semibold">High School</label>
        <input
          className="form-control"
          value={form.highSchool}
          onChange={(event) => updateField('highSchool', event.target.value)}
        />
      </div>

      <div className="col-md-6">
        <label className="form-label fw-semibold">Entrance Credentials</label>
        <input
          className="form-control"
          value={form.entranceCredentials}
          onChange={(event) => updateField('entranceCredentials', event.target.value)}
          placeholder="SF10 / Form 138"
        />
      </div>

      <div className="col-md-6">
        <label className="form-label fw-semibold">Permanent Address</label>
        <textarea
          className="form-control"
          rows="2"
          value={form.permanentAddress}
          onChange={(event) => updateField('permanentAddress', event.target.value)}
        />
      </div>

      <div className="col-md-6">
        <label className="form-label fw-semibold">Residential Address</label>
        <textarea
          className="form-control"
          rows="2"
          value={form.residentialAddress}
          onChange={(event) => updateField('residentialAddress', event.target.value)}
        />
      </div>
    </div>
  );
}

function StudentDataModal({
  open,
  activeTab,
  setActiveTab,
  form,
  setForm,
  curricula,
  creating,
  studentImport,
  onClose,
  onCreate,
  onFileChange,
  onImport,
}) {
  if (!open) return null;

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 className="h5 mb-1">Student Data</h2>
                <p className="text-muted mb-0 small">
                  Create one student by default, or upload a CSV or Excel file when doing bulk entry.
                </p>
              </div>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>

            <div className="modal-body">
              <div className="d-flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  className={`btn ${activeTab === 'manual' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setActiveTab('manual')}
                >
                  <FaPlus className="me-2" />
                  Manual Entry
                </button>
                <button
                  type="button"
                  className={`btn ${activeTab === 'csv' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setActiveTab('csv')}
                >
                  <FaUpload className="me-2" />
                  Upload CSV / Excel
                </button>
              </div>

              {activeTab === 'manual' ? (
                <>
                  <div className="alert alert-light border small">
                    Program is selected from the existing curriculum list. The Graduated value is not manually edited here because it is computed from grade remarks.
                  </div>
                  <StudentFormFields
                    form={form}
                    onChange={setForm}
                    curricula={curricula}
                    includeStudentNo
                  />
                </>
              ) : null}

              {activeTab === 'csv' ? (
                <div className="d-flex flex-column gap-3">
                  <div>
                    <label className="form-label fw-semibold">Student CSV / Excel file</label>
                    <input
                      type="file"
                      className="form-control"
                      accept=".csv,.xlsx,.xls"
                      onChange={onFileChange}
                    />
                    <div className="form-text">
                      Required columns: StudentNo, StudentName, ProgramCode, and CurriculumYear. The ProgramCode + CurriculumYear pair must already exist in Curriculum Manager.
                    </div>
                  </div>

                  {studentImport.fileName ? (
                    <div className="alert alert-light border mb-0">
                      <div><strong>File:</strong> {studentImport.fileName}</div>
                      <div><strong>Sheet:</strong> {studentImport.sheetName || 'First sheet'}</div>
                      <div><strong>Rows:</strong> {studentImport.rows.length}</div>
                    </div>
                  ) : null}

                  <DataPreview rows={studentImport.rows} />
                </div>
              ) : null}
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={creating || studentImport.loading}>
                Cancel
              </button>
              {activeTab === 'manual' ? (
                <button className="btn btn-primary" onClick={onCreate} disabled={creating}>
                  {creating ? 'Saving...' : 'Save Student Record'}
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={onImport}
                  disabled={studentImport.loading || !studentImport.rows.length}
                >
                  {studentImport.loading ? 'Importing...' : 'Import Student Data'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

function ImportModal({
  open,
  title,
  description,
  warning,
  fileName,
  sheetName,
  rows,
  loading,
  buttonText,
  helperText,
  onClose,
  onFileChange,
  onImport,
}) {
  if (!open) return null;

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 className="h5 mb-1">{title}</h2>
                <p className="text-muted mb-0 small">{description}</p>
              </div>
              <button type="button" className="btn-close" onClick={onClose} disabled={loading} aria-label="Close" />
            </div>

            <div className="modal-body">
              <div className="d-flex flex-column gap-3">
                {warning ? <div className="alert alert-warning mb-0">{warning}</div> : null}

                <div>
                  <label className="form-label fw-semibold">CSV / Excel file</label>
                  <input
                    type="file"
                    className="form-control"
                    accept=".csv,.xlsx,.xls"
                    onChange={onFileChange}
                  />
                  {helperText ? <div className="form-text">{helperText}</div> : null}
                </div>

                {fileName ? (
                  <div className="alert alert-light border mb-0">
                    <div><strong>File:</strong> {fileName}</div>
                    <div><strong>Sheet:</strong> {sheetName || 'First sheet'}</div>
                    <div><strong>Rows:</strong> {rows.length}</div>
                  </div>
                ) : null}

                <DataPreview rows={rows} />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={onImport} disabled={loading || !rows.length}>
                {loading ? 'Importing...' : buttonText}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="col-md-6">
      <div className="small text-muted">{label}</div>
      <div className="fw-semibold">{value || '—'}</div>
    </div>
  );
}

function StudentProfileModal({
  student,
  initialEditing = false,
  curricula,
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

  function handleRequestClose() {
    if (isEditing && hasChanges) {
      const approved = window.confirm('Discard unsaved changes?');
      if (!approved) return;
    }
    onClose();
  }

  async function handleSave() {
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
      const approved = window.confirm('You have unsaved changes. Open grades without saving?');
      if (!approved) return;
    }
    onOpenGrades(student._id);
  }

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 className="h5 mb-1">{isEditing ? 'Edit Student Profile' : 'Student Profile'}</h2>
                <p className="text-muted mb-0 small">{student.studentNo}</p>
              </div>
              <button type="button" className="btn-close" onClick={handleRequestClose} aria-label="Close" />
            </div>

            <div className="modal-body">
              {isEditing ? (
                <StudentFormFields
                  form={form}
                  onChange={setForm}
                  curricula={curricula}
                  includeStudentNo
                  readOnlyStudentNo
                />
              ) : (
                <div className="row g-3">
                  <DetailItem label="Student No." value={student.studentNo} />
                  <DetailItem label="Student Name" value={student.studentName} />
                  <DetailItem label="Program Code" value={student.programCode || student.curriculum?.program} />
                  <DetailItem label="Program Name" value={student.programName || student.curriculum?.programName} />
                  <DetailItem label="Curriculum Year" value={student.curriculumYear || student.curriculum?.curriculumYear} />
                  <DetailItem label="Major" value={student.major} />
                  <DetailItem label="Gender" value={student.gender} />
                  <DetailItem label="Extension Name" value={student.extensionName} />
                  <DetailItem label="Date Admission" value={formatDate(student.dateAdmission)} />
                  <DetailItem label="Date Graduated" value={formatDate(student.dateGraduated)} />
                  <DetailItem label="Date Graduation" value={formatDate(student.dateGraduation)} />
                  <DetailItem label="Graduated" value={student.graduated ? 'Yes' : 'No'} />
                  <DetailItem label="Place of Birth" value={student.placeBirth} />
                  <DetailItem label="Entrance Credentials" value={student.entranceCredentials} />
                  <DetailItem label="High School" value={student.highSchool} />
                  <DetailItem label="Permanent Address" value={student.permanentAddress} />
                  <DetailItem label="Residential Address" value={student.residentialAddress} />
                </div>
              )}
            </div>

            <div className="modal-footer">
              {isEditing ? (
                <>
                  <button className="btn btn-outline-secondary" onClick={() => setIsEditing(false)} disabled={saving}>
                    Cancel Edit
                  </button>
                  <button className="btn btn-primary" onClick={handleSave} disabled={saving || !hasChanges}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-outline-secondary" onClick={handleRequestClose}>Close</button>
                  <button className="btn btn-outline-primary" onClick={handleOpenGradesFromModal}>
                    <FaListAlt className="me-2" />
                    View Grades
                  </button>
                  <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
                    <FaEdit className="me-2" />
                    Edit Profile
                  </button>
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

function buildGradeDisplayRows(grades) {
  if (!grades?.length) {
    return [];
  }

  return (grades || []).map((grade) => ({
    ...grade,
    yearLevel: grade.yearLevel || '—',
    semester: grade.semester || '—',
    subjectCode: grade.subjectCode || '—',
    subjectTitle: grade.subjectTitle || '—',
    units: grade.units ?? '—',
    finalGrade: grade.finalGrade || '—',
    remarks: grade.remarks || '—',
    schoolYear: grade.schoolYear || '—',
  }));
}

function StudentGradesModal({ data, onClose }) {
  if (!data) return null;

  const rows = buildGradeDisplayRows(data.grades);
  const student = data.student || {};

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 className="h5 mb-1">Student Grades</h2>
                <p className="text-muted mb-0 small">
                  {student.studentNo} · {student.studentName}
                </p>
              </div>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>
            <div className="modal-body">
              <div className="alert alert-light border d-flex flex-wrap gap-3 align-items-center">
                <span><strong>Program:</strong> {student.programCode || '—'}</span>
                <span><strong>Curriculum:</strong> {student.curriculum?.curriculumYear || student.curriculumYear || '—'}</span>
                <span><strong>Graduated:</strong> {student.graduated ? 'Yes' : 'No'}</span>
              </div>

              {rows.length ? (
                <div className="table-responsive">
                  <table className="table table-sm align-middle">
                    <thead>
                      <tr>
                        <th>Year</th>
                        <th>Semester</th>
                        <th>Code</th>
                        <th>Subject</th>
                        <th>Units</th>
                        <th>Grade</th>
                        <th>Remarks</th>
                        <th>School Year</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((grade) => (
                        <tr key={grade._id || `${grade.yearLevel}-${grade.semester}-${grade.subjectCode}`}>
                          <td>{grade.yearLevel}</td>
                          <td>{grade.semester}</td>
                          <td className="fw-semibold">{grade.subjectCode}</td>
                          <td>{grade.subjectTitle}</td>
                          <td>{grade.units}</td>
                          <td>{grade.finalGrade}</td>
                          <td>{grade.remarks}</td>
                          <td>{grade.schoolYear}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="alert alert-light border mb-0">No grades imported for this student yet.</div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

function StudentActionMenu({
  student,
  isOpen,
  onToggle,
  onClose,
  onOpenProfile,
  onOpenGrades,
  onConfirmVcDraft,
  onDeleteStudent,
  profileLoading,
  gradesLoadingId,
  creatingVcDraftId,
  canCreateVcDraft,
}) {
  return (
    <div className="d-inline-flex align-items-center gap-2">
      <button
        type="button"
        className="btn btn-outline-primary btn-sm"
        onClick={() => onOpenProfile(student._id, 'view')}
        disabled={profileLoading}
      >
        <FaIdCard className="me-1" />
        Profile
      </button>

      <FloatingActionMenu
        isOpen={isOpen}
        onToggle={onToggle}
        onClose={onClose}
        buttonContent={<FaCog />}
        ariaLabel="Student actions"
        menuWidth={220}
      >
        <div className="list-group list-group-flush">
          <button
            type="button"
            className="list-group-item list-group-item-action"
            onClick={() => {
              onClose();
              onOpenProfile(student._id, 'edit');
            }}
          >
            <FaEdit className="me-2" />
            Edit Profile
          </button>
          <button
            type="button"
            className="list-group-item list-group-item-action"
            onClick={() => {
              onClose();
              onOpenGrades(student._id);
            }}
            disabled={gradesLoadingId === student._id}
          >
            <FaListAlt className="me-2" />
            {gradesLoadingId === student._id ? 'Loading Grades...' : 'View Grades'}
          </button>
          {canCreateVcDraft ? (
            <button
              type="button"
              className="list-group-item list-group-item-action"
              onClick={() => {
                onClose();
                onConfirmVcDraft(student);
              }}
              disabled={creatingVcDraftId === student._id}
            >
              <FaFileSignature className="me-2" />
              {creatingVcDraftId === student._id ? 'Creating VC...' : 'Create VC Draft'}
            </button>
          ) : null}
          <button
            type="button"
            className="list-group-item list-group-item-action text-danger"
            onClick={() => {
              onClose();
              onDeleteStudent(student);
            }}
          >
            <FaTrash className="me-2" />
            Delete Student
          </button>
        </div>
      </FloatingActionMenu>
    </div>
  );
}

function ConfirmActionModal({ action, busy, onCancel, onConfirm, onCredentialTypeChange }) {
  if (!action) return null;

  const isDelete = action.type === 'deleteStudent';
  const isCreateVcDraft = action.type === 'createVcDraft';
  const title = isDelete ? 'Delete student record?' : 'Create VC draft?';
  const message = isDelete
    ? `This will delete ${action.student?.studentName || 'this student'} and all imported grade rows linked to this student. This cannot be undone.`
    : `Create a verifiable credential draft for ${action.student?.studentName || 'this student'}?`;
  const confirmText = isDelete ? 'Delete Student' : 'Create VC Draft';
  const buttonClass = isDelete ? 'btn-danger' : 'btn-primary';

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <h2 className="h5 mb-0">{title}</h2>
              <button type="button" className="btn-close" onClick={onCancel} disabled={busy} aria-label="Close" />
            </div>
            <div className="modal-body">
              <p className="mb-2">{message}</p>
              {action.student?.studentNo ? (
                <div className="alert alert-light border mb-3 small">
                  Student No: <strong>{action.student.studentNo}</strong>
                </div>
              ) : null}
              {isCreateVcDraft ? (
                <div>
                  <label className="form-label fw-semibold">Credential Type</label>
                  <select
                    className="form-select"
                    value={action.credentialType || ''}
                    onChange={(event) => onCredentialTypeChange(event.target.value)}
                    disabled={busy}
                  >
                    <option value="">Choose credential type</option>
                    <option value="diploma">Diploma</option>
                    <option value="tor">TOR</option>
                  </select>
                  <div className="form-text">New VC drafts require an explicit type.</div>
                </div>
              ) : null}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
              <button
                className={`btn ${buttonClass}`}
                onClick={onConfirm}
                disabled={busy || (isCreateVcDraft && !action.credentialType)}
              >
                {busy ? 'Processing...' : confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

function FilterModal({
  open,
  draft,
  setDraft,
  curricula,
  onCancel,
  onApply,
  onClear,
}) {
  const programCodes = uniqueValues(curricula.map((item) => item.program));
  const curriculumYears = uniqueValues(curricula.map((item) => item.curriculumYear));

  if (!open) return null;

  function updateField(field, value) {
    setDraft({
      ...draft,
      [field]: value,
    });
  }

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 className="h5 mb-1">Filter Students</h2>
                <p className="text-muted mb-0 small">Apply simple registrar filters without cluttering the main table.</p>
              </div>
              <button type="button" className="btn-close" onClick={onCancel} aria-label="Close" />
            </div>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label fw-semibold">Name contains</label>
                  <input
                    className="form-control"
                    value={draft.studentName}
                    onChange={(event) => updateField('studentName', event.target.value)}
                    placeholder="Student name"
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold">Program Code</label>
                  <select
                    className="form-select"
                    value={draft.programCode}
                    onChange={(event) => updateField('programCode', event.target.value)}
                  >
                    <option value="">All programs</option>
                    {programCodes.map((program) => (
                      <option key={program} value={program}>{program}</option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold">Curriculum Year</label>
                  <select
                    className="form-select"
                    value={draft.curriculumYear}
                    onChange={(event) => updateField('curriculumYear', event.target.value)}
                  >
                    <option value="">All curriculum years</option>
                    {curriculumYears.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold">Year Graduated</label>
                  <input
                    type="number"
                    className="form-control"
                    value={draft.graduationYear}
                    onChange={(event) => updateField('graduationYear', event.target.value)}
                    placeholder="2026"
                    min="1900"
                    max="2100"
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold">Graduated</label>
                  <select
                    className="form-select"
                    value={draft.graduated}
                    onChange={(event) => updateField('graduated', event.target.value)}
                  >
                    <option value="">All</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-danger me-auto" onClick={onClear}>Clear Filters</button>
              <button className="btn btn-outline-secondary" onClick={onCancel}>Cancel</button>
              <button className="btn btn-primary" onClick={onApply}>Apply Filters</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

function PaginationControls({ pagination, onPageChange, disabled }) {
  const page = pagination.page || 1;
  const totalPages = pagination.totalPages || 1;

  if (totalPages <= 1) return null;

  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);

  for (let number = start; number <= end; number += 1) {
    pages.push(number);
  }

  return (
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
      <div className="small text-muted">
        Page {page} of {totalPages}
      </div>
      <div className="btn-group">
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={disabled || page <= 1}
        >
          <FaChevronLeft className="me-1" />
          Previous
        </button>
        {pages.map((number) => (
          <button
            type="button"
            key={number}
            className={`btn btn-sm ${number === page ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => onPageChange(number)}
            disabled={disabled || number === page}
          >
            {number}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={disabled || page >= totalPages}
        >
          Next
          <FaChevronRight className="ms-1" />
        </button>
      </div>
    </div>
  );
}

export default function StudentImportManagerPage() {
  const auth = useMemo(() => hasValidStoredAuth(), []);
  const currentRole = auth?.user?.role || '';
  const canCreateVcDraft = currentRole === 'admin';

  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [refreshingStudents, setRefreshingStudents] = useState(false);
  const [curricula, setCurricula] = useState([]);
  const [loadingCurricula, setLoadingCurricula] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filterDraft, setFilterDraft] = useState(EMPTY_FILTERS);
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  const [feedback, setFeedback] = useState({
    type: '',
    text: '',
    issues: [],
  });

  const [studentDataModalOpen, setStudentDataModalOpen] = useState(false);
  const [studentDataTab, setStudentDataTab] = useState('manual');
  const [studentForm, setStudentForm] = useState(createStudentForm());
  const [creatingStudent, setCreatingStudent] = useState(false);

  const [studentImport, setStudentImport] = useState(EMPTY_IMPORT_STATE);
  const [gradeImport, setGradeImport] = useState(EMPTY_IMPORT_STATE);
  const [gradeImportModalOpen, setGradeImportModalOpen] = useState(false);

  const [profileLoading, setProfileLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [profileMode, setProfileMode] = useState('view');
  const [gradesLoadingId, setGradesLoadingId] = useState('');
  const [selectedGradesData, setSelectedGradesData] = useState(null);
  const [actionMenuOpenId, setActionMenuOpenId] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [busyAction, setBusyAction] = useState(false);
  const [creatingVcDraftId, setCreatingVcDraftId] = useState('');

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((value) => String(value || '').trim() !== '').length,
    [filters]
  );

  const countLabel = useMemo(() => {
    const total = pagination.total || 0;
    if (total === 0) return '0 students';

    const start = (pagination.page - 1) * pagination.limit + 1;
    const end = Math.min(total, pagination.page * pagination.limit);
    return `Showing ${start}-${end} of ${total} students`;
  }, [pagination]);

  async function loadCurricula() {
    try {
      setLoadingCurricula(true);
      const data = await listCurricula();
      setCurricula(Array.isArray(data) ? data : data?.rows || []);
    } catch (error) {
      setFeedback({
        type: 'danger',
        text: getErrorMessage(error, 'Failed to load curricula.'),
        issues: [],
      });
    } finally {
      setLoadingCurricula(false);
    }
  }

  async function loadStudents({ page = pagination.page, showBusy = false, search = searchText, filterValues = filters } = {}) {
    try {
      if (showBusy) setRefreshingStudents(true);
      else setLoadingStudents(true);

      const params = {
        page,
        limit: PAGE_SIZE,
      };

      if (search.trim()) params.search = search.trim();

      for (const [key, value] of Object.entries(filterValues)) {
        if (String(value || '').trim()) {
          params[key] = String(value).trim();
        }
      }

      const data = await listStudents(params);

      if (Array.isArray(data)) {
        setStudents(data);
        setPagination({
          ...EMPTY_PAGINATION,
          page,
          total: data.length,
          totalPages: 1,
        });
        return;
      }

      setStudents(data?.rows || []);
      setPagination(data?.pagination || EMPTY_PAGINATION);
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
    loadCurricula();
    loadStudents({ page: 1 });
  }, []);

  function openStudentDataModal() {
    setStudentForm(createStudentForm());
    setStudentImport(EMPTY_IMPORT_STATE);
    setStudentDataTab('manual');
    setStudentDataModalOpen(true);
  }

  async function handleStudentFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      setStudentImport(EMPTY_IMPORT_STATE);
      return;
    }

    try {
      setStudentImport((prev) => ({
        ...prev,
        fileName: file.name,
        loading: true,
      }));

      const parsed = await readSpreadsheet(file);
      setStudentImport({
        fileName: file.name,
        sheetName: parsed.sheetName,
        rows: parsed.rows,
        loading: false,
      });
    } catch (error) {
      setStudentImport(EMPTY_IMPORT_STATE);
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

    if (!file) {
      setGradeImport(EMPTY_IMPORT_STATE);
      return;
    }

    try {
      setGradeImport((prev) => ({
        ...prev,
        fileName: file.name,
        loading: true,
      }));

      const parsed = await readSpreadsheet(file);
      setGradeImport({
        fileName: file.name,
        sheetName: parsed.sheetName,
        rows: parsed.rows,
        loading: false,
      });
    } catch (error) {
      setGradeImport(EMPTY_IMPORT_STATE);
      setFeedback({
        type: 'danger',
        text: getErrorMessage(error, 'Failed to read grade import file.'),
        issues: [],
      });
    } finally {
      event.target.value = '';
    }
  }

  async function handleCreateStudent() {
    if (!studentForm.studentNo.trim()) {
      setFeedback({ type: 'warning', text: 'Student number is required.', issues: [] });
      return;
    }

    if (!studentForm.studentName.trim()) {
      setFeedback({ type: 'warning', text: 'Student name is required.', issues: [] });
      return;
    }

    if (!studentForm.curriculumId) {
      setFeedback({ type: 'warning', text: 'Select a program/curriculum before saving.', issues: [] });
      return;
    }

    try {
      setCreatingStudent(true);
      const created = await createStudentProfile(studentForm);
      setStudentDataModalOpen(false);
      setStudentForm(createStudentForm());
      await loadStudents({ page: 1, showBusy: true });
      setFeedback({
        type: 'success',
        text: `Student record created for ${created.studentName}.`,
        issues: [],
      });
    } catch (error) {
      setFeedback({
        type: 'danger',
        text: getErrorMessage(error, 'Failed to create student record.'),
        issues: [],
      });
    } finally {
      setCreatingStudent(false);
    }
  }

  async function handleImportStudents() {
    if (!studentImport.rows.length) {
      setFeedback({
        type: 'warning',
        text: 'Choose a student data file before importing.',
        issues: [],
      });
      return;
    }

    try {
      setStudentImport((prev) => ({ ...prev, loading: true }));
      const result = await bulkImportStudents(studentImport.rows);

      setStudentDataModalOpen(false);
      setStudentImport(EMPTY_IMPORT_STATE);
      await loadStudents({ page: 1, showBusy: true });

      setFeedback({
        type: 'success',
        text: buildSummaryText('Student import', result.summary),
        issues: result.issues || [],
      });
    } catch (error) {
      setFeedback({
        type: 'danger',
        text: getErrorMessage(error, 'Failed to import students.'),
        issues: [],
      });
    } finally {
      setStudentImport((prev) => ({ ...prev, loading: false }));
    }
  }

  async function handleImportGrades() {
    if (!gradeImport.rows.length) {
      setFeedback({
        type: 'warning',
        text: 'Choose a grade file before importing.',
        issues: [],
      });
      return;
    }

    try {
      setGradeImport((prev) => ({ ...prev, loading: true }));
      const result = await bulkImportStudentGrades(gradeImport.rows);

      setGradeImportModalOpen(false);
      setGradeImport(EMPTY_IMPORT_STATE);
      await loadStudents({ page: pagination.page, showBusy: true });

      setFeedback({
        type: 'success',
        text: buildSummaryText('Grade import', result.summary),
        issues: result.issues || [],
      });
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
      await loadStudents({ page: pagination.page, showBusy: true });
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

  function requestCreateVcDraft(student) {
    if (!canCreateVcDraft) {
      setFeedback({
        type: 'warning',
        text: 'This role is not allowed to create VC drafts.',
        issues: [],
      });
      return;
    }

    setConfirmAction({ type: 'createVcDraft', student, credentialType: '' });
  }

  function requestDeleteStudent(student) {
    setConfirmAction({ type: 'deleteStudent', student });
  }

  async function runConfirmedAction() {
    if (!confirmAction?.student?._id) return;

    try {
      setBusyAction(true);

      if (confirmAction.type === 'deleteStudent') {
        const deleted = await deleteStudentProfile(confirmAction.student._id);
        setConfirmAction(null);

        const nextPage = students.length === 1 && pagination.page > 1
          ? pagination.page - 1
          : pagination.page;

        await loadStudents({ page: nextPage, showBusy: true });
        setFeedback({
          type: 'success',
          text: `Deleted ${deleted.studentName}. ${deleted.deletedGrades || 0} grade row(s) were also removed.`,
          issues: [],
        });
        return;
      }

      if (confirmAction.type === 'createVcDraft' && !confirmAction.credentialType) {
        setFeedback({
          type: 'warning',
          text: 'Choose Diploma or TOR before creating a VC draft.',
          issues: [],
        });
        return;
      }

      setCreatingVcDraftId(confirmAction.student._id);
      const data = await createCredentialDraftFromStudent(confirmAction.student._id, {
        credentialType: confirmAction.credentialType,
        notes: '',
      });

      setConfirmAction(null);
      setFeedback({
        type: 'success',
        text: `VC draft created for ${data.studentName}.`,
        issues: [],
      });
    } catch (error) {
      setFeedback({
        type: 'danger',
        text: getErrorMessage(error, 'Action failed.'),
        issues: [],
      });
    } finally {
      setBusyAction(false);
      setCreatingVcDraftId('');
    }
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    loadStudents({ page: 1, search: searchText, filterValues: filters });
  }

  function handleClearSearch() {
    setSearchText('');
    loadStudents({ page: 1, search: '', filterValues: filters });
  }

  function openFilterModal() {
    setFilterDraft(filters);
    setFilterModalOpen(true);
  }

  function applyFilters() {
    setFilters(filterDraft);
    setFilterModalOpen(false);
    loadStudents({ page: 1, search: searchText, filterValues: filterDraft });
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setFilterDraft(EMPTY_FILTERS);
    setFilterModalOpen(false);
    loadStudents({ page: 1, search: searchText, filterValues: EMPTY_FILTERS });
  }

  function changePage(page) {
    if (page < 1 || page > pagination.totalPages || page === pagination.page) return;
    loadStudents({ page, showBusy: true });
  }

  return (
    <>
      <div className="d-flex flex-column gap-4">
        <div className="d-flex flex-wrap justify-content-end align-items-center gap-2">
          <button className="btn btn-primary" onClick={openStudentDataModal} disabled={loadingCurricula}>
            <FaPlus className="me-2" />
            Import Student Data
          </button>
          <button className="btn btn-outline-primary" onClick={() => setGradeImportModalOpen(true)}>
            <FaUpload className="me-2" />
            Import Grades
          </button>
          <button className="btn btn-outline-secondary" onClick={() => loadStudents({ page: pagination.page, showBusy: true })} disabled={refreshingStudents}>
            {refreshingStudents ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <FeedbackAlert feedback={feedback} />

        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
              <div>
                <h2 className="h5 mb-1">Saved Students</h2>
                <p className="text-muted mb-0">
                  The table is limited to 10 records per page for cleaner registrar use.
                </p>
              </div>
              <div className="text-muted small">{countLabel}</div>
            </div>

            <form className="row g-2 align-items-end mb-3" onSubmit={handleSearchSubmit}>
              <div className="col-lg-6">
                <label className="form-label fw-semibold">Search student</label>
                <div className="input-group">
                  <span className="input-group-text"><FaSearch /></span>
                  <input
                    className="form-control"
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Student number, name, or program"
                  />
                </div>
              </div>
              <div className="col-lg-6 d-flex flex-wrap gap-2">
                <button className="btn btn-primary" type="submit" disabled={loadingStudents || refreshingStudents}>
                  Search
                </button>
                <button className="btn btn-outline-secondary" type="button" onClick={handleClearSearch}>
                  Clear Search
                </button>
                <button className="btn btn-outline-primary" type="button" onClick={openFilterModal}>
                  <FaFilter className="me-2" />
                  Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
                </button>
              </div>
            </form>

            {loadingStudents ? (
              <div className="text-muted">Loading students...</div>
            ) : students.length === 0 ? (
              <div className="alert alert-light border mb-0">No student records found.</div>
            ) : (
              <>
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Student No.</th>
                        <th>Name</th>
                        <th>Program</th>
                        <th>Year Graduated</th>
                        <th>Graduated</th>
                        <th className="text-end" style={{ minWidth: 170 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student._id}>
                          <td className="fw-semibold">{student.studentNo}</td>
                          <td>{student.studentName}</td>
                          <td>
                            <div className="fw-semibold">{student.programCode || student.program || '—'}</div>
                            <div className="small text-muted">
                              {student.programName || '—'}
                              {student.curriculumYear ? ` · Curriculum ${student.curriculumYear}` : ''}
                            </div>
                          </td>
                          <td>{formatYear(student.dateGraduated || student.dateGraduation)}</td>
                          <td>
                            <span className={`badge ${student.graduated ? 'text-bg-success' : 'text-bg-secondary'}`}>
                              {student.graduated ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="text-end">
                            <StudentActionMenu
                              student={student}
                              isOpen={actionMenuOpenId === student._id}
                              onToggle={() =>
                                setActionMenuOpenId((prev) =>
                                  prev === student._id ? '' : student._id
                                )
                              }
                              onClose={() => setActionMenuOpenId('')}
                              onOpenProfile={handleOpenProfile}
                              onOpenGrades={handleOpenGrades}
                              onConfirmVcDraft={requestCreateVcDraft}
                              onDeleteStudent={requestDeleteStudent}
                              profileLoading={profileLoading}
                              gradesLoadingId={gradesLoadingId}
                              creatingVcDraftId={creatingVcDraftId}
                              canCreateVcDraft={canCreateVcDraft}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <PaginationControls
                  pagination={pagination}
                  onPageChange={changePage}
                  disabled={loadingStudents || refreshingStudents}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <StudentDataModal
        open={studentDataModalOpen}
        activeTab={studentDataTab}
        setActiveTab={setStudentDataTab}
        form={studentForm}
        setForm={setStudentForm}
        curricula={curricula}
        creating={creatingStudent}
        studentImport={studentImport}
        onClose={() => setStudentDataModalOpen(false)}
        onCreate={handleCreateStudent}
        onFileChange={handleStudentFileChange}
        onImport={handleImportStudents}
      />

      <ImportModal
        open={gradeImportModalOpen}
        title="Import Grades"
        description="Grades can only be imported after the student already exists."
        warning="Grade import will skip any row where the student does not exist yet or the student has no linked curriculum."
        fileName={gradeImport.fileName}
        sheetName={gradeImport.sheetName}
        rows={gradeImport.rows}
        loading={gradeImport.loading}
        buttonText="Import Grades"
        onClose={() => setGradeImportModalOpen(false)}
        onFileChange={handleGradeFileChange}
        onImport={handleImportGrades}
        helperText={
          <>
            Recognized grade columns include <strong>StudentNo, YearLevel, Semester, SubjectCode, SubjectTitle, Units, FinalGrade, Remarks, SchoolYear, TermName</strong>.
          </>
        }
      />

      <FilterModal
        open={filterModalOpen}
        draft={filterDraft}
        setDraft={setFilterDraft}
        curricula={curricula}
        onCancel={() => setFilterModalOpen(false)}
        onApply={applyFilters}
        onClear={clearFilters}
      />

      <StudentProfileModal
        student={selectedStudent}
        initialEditing={profileMode === 'edit'}
        curricula={curricula}
        onClose={() => {
          setSelectedStudent(null);
          setProfileMode('view');
        }}
        onOpenGrades={handleOpenGrades}
        onSave={handleSaveStudentProfile}
      />

      <StudentGradesModal data={selectedGradesData} onClose={() => setSelectedGradesData(null)} />

      <ConfirmActionModal
        action={confirmAction}
        busy={busyAction}
        onCancel={() => setConfirmAction(null)}
        onConfirm={runConfirmedAction}
        onCredentialTypeChange={(credentialType) =>
          setConfirmAction((prev) => (prev ? { ...prev, credentialType } : prev))
        }
      />
    </>
  );
}
