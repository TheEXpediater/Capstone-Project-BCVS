import { useEffect, useMemo, useState } from 'react';
import {
  FaChevronLeft,
  FaChevronRight,
  FaCog,
  FaDownload,
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
import BulkActionsMenu from '../../../components/BulkActionsMenu';
import CreateVcDraftModal from '../../../components/CreateVcDraftModal';
import DataTable from '../../../components/DataTable';
import FloatingActionMenu from '../../../components/FloatingActionMenu';
import { hasValidStoredAuth } from '../../auth/authStorage';
import {
  bulkDeleteStudents,
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
const BASE_CREDENTIAL_AMOUNT = 150;
const DEFAULT_ANCHOR_NOW_FEE = 20;

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
  if (!value) return 'â€”';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleDateString();
}

function formatYear(value) {
  if (!value) return 'â€”';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'â€”';

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
  importTab,
  setImportTab,
  activeTab,
  setActiveTab,
  form,
  setForm,
  curricula,
  creating,
  studentImport,
  gradeImport,
  onClose,
  onCreate,
  onFileChange,
  onImport,
  onGradeFileChange,
  onImportGrades,
}) {
  if (!open) return null;

  const busy = creating || studentImport.loading || gradeImport.loading;

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 className="h5 mb-1">Import</h2>
                <p className="text-muted mb-0 small">
                  Upload student data or grades without changing the existing import flow.
                </p>
              </div>
              <button type="button" className="btn-close" onClick={onClose} disabled={busy} aria-label="Close" />
            </div>

            <div className="modal-body">
              <ul className="nav nav-tabs mb-3">
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link ${importTab === 'studentData' ? 'active' : ''}`}
                    onClick={() => setImportTab('studentData')}
                    disabled={busy}
                  >
                    Student Data
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link ${importTab === 'grades' ? 'active' : ''}`}
                    onClick={() => setImportTab('grades')}
                    disabled={busy}
                  >
                    Grades
                  </button>
                </li>
              </ul>

              {importTab === 'studentData' ? (
                <>
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
                </>
              ) : null}

              {importTab === 'grades' ? (
                <div className="d-flex flex-column gap-3">
                  <div className="alert alert-warning mb-0">
                    Grade import will skip any row where the student does not exist yet or the student has no linked curriculum.
                  </div>
                  <div>
                    <label className="form-label fw-semibold">Grade CSV / Excel file</label>
                    <input
                      type="file"
                      className="form-control"
                      accept=".csv,.xlsx,.xls"
                      onChange={onGradeFileChange}
                    />
                    <div className="form-text">
                      Recognized grade columns include <strong>StudentNo, YearLevel, Semester, SubjectCode, SubjectTitle, Units, FinalGrade, Remarks, SchoolYear, TermName</strong>.
                    </div>
                  </div>

                  {gradeImport.fileName ? (
                    <div className="alert alert-light border mb-0">
                      <div><strong>File:</strong> {gradeImport.fileName}</div>
                      <div><strong>Sheet:</strong> {gradeImport.sheetName || 'First sheet'}</div>
                      <div><strong>Rows:</strong> {gradeImport.rows.length}</div>
                    </div>
                  ) : null}

                  <DataPreview rows={gradeImport.rows} />
                </div>
              ) : null}
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              {importTab === 'grades' ? (
                <button className="btn btn-primary" onClick={onImportGrades} disabled={gradeImport.loading || !gradeImport.rows.length}>
                  {gradeImport.loading ? 'Importing...' : 'Import Grades'}
                </button>
              ) : activeTab === 'manual' ? (
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

function DetailItem({ label, value }) {
  return (
    <div className="col-md-6">
      <div className="small text-muted">{label}</div>
      <div className="fw-semibold">{value || 'â€”'}</div>
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
    yearLevel: grade.yearLevel || 'â€”',
    semester: grade.semester || 'â€”',
    subjectCode: grade.subjectCode || 'â€”',
    subjectTitle: grade.subjectTitle || 'â€”',
    units: grade.units ?? 'â€”',
    finalGrade: grade.finalGrade || 'â€”',
    remarks: grade.remarks || 'â€”',
    schoolYear: grade.schoolYear || 'â€”',
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
                  {student.studentNo} Â· {student.studentName}
                </p>
              </div>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>
            <div className="modal-body">
              <div className="alert alert-light border d-flex flex-wrap gap-3 align-items-center">
                <span><strong>Program:</strong> {student.programCode || 'â€”'}</span>
                <span><strong>Curriculum:</strong> {student.curriculum?.curriculumYear || student.curriculumYear || 'â€”'}</span>
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
            onOpenProfile(student._id, 'view');
          }}
          disabled={profileLoading}
        >
          <FaIdCard className="me-2" />
          View Profile
        </button>
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
  const [importTab, setImportTab] = useState('studentData');
  const [studentDataTab, setStudentDataTab] = useState('manual');
  const [studentForm, setStudentForm] = useState(createStudentForm());
  const [creatingStudent, setCreatingStudent] = useState(false);

  const [studentImport, setStudentImport] = useState(EMPTY_IMPORT_STATE);
  const [gradeImport, setGradeImport] = useState(EMPTY_IMPORT_STATE);

  const [profileLoading, setProfileLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState(() => new Set());
  const [profileMode, setProfileMode] = useState('view');
  const [gradesLoadingId, setGradesLoadingId] = useState('');
  const [selectedGradesData, setSelectedGradesData] = useState(null);
  const [actionMenuOpenId, setActionMenuOpenId] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [busyAction, setBusyAction] = useState(false);
  const [creatingVcDraftId, setCreatingVcDraftId] = useState('');
  const [createVcModalOpen, setCreateVcModalOpen] = useState(false);
  const [createVcStudent, setCreateVcStudent] = useState(null);
  const [createVcSubmitting, setCreateVcSubmitting] = useState(false);
  const [bulkActionMenuOpen, setBulkActionMenuOpen] = useState(false);
  const [bulkCreateVcModalOpen, setBulkCreateVcModalOpen] = useState(false);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkCreateVcDraft, setBulkCreateVcDraft] = useState({
    credentialType: '',
    anchorNow: false,
    anchorCost: DEFAULT_ANCHOR_NOW_FEE,
  });
  const [bulkCreateVcStep, setBulkCreateVcStep] = useState('configure');
  const [bulkCreateVcResults, setBulkCreateVcResults] = useState([]);
  const [bulkCreateVcSubmitting, setBulkCreateVcSubmitting] = useState(false);
  const [bulkDeleteSubmitting, setBulkDeleteSubmitting] = useState(false);

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

  const selectedStudents = useMemo(
    () => students.filter((student) => selectedStudentIds.has(student._id)),
    [students, selectedStudentIds]
  );
  const selectedStudentCount = selectedStudentIds.size;
  const bulkCreateVcSummary = useMemo(() => {
    const successful = bulkCreateVcResults.filter((item) => item.status === 'success');
    const failed = bulkCreateVcResults.filter((item) => item.status === 'failed');
    return {
      successful,
      failed,
      successCount: successful.length,
      failedCount: failed.length,
    };
  }, [bulkCreateVcResults]);

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
        setSelectedStudentIds(new Set());
        setPagination({
          ...EMPTY_PAGINATION,
          page,
          total: data.length,
          totalPages: 1,
        });
        return;
      }

      setStudents(data?.rows || []);
      setSelectedStudentIds(new Set());
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
    setGradeImport(EMPTY_IMPORT_STATE);
    setImportTab('studentData');
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

      setStudentDataModalOpen(false);
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

    setCreateVcStudent(student || null);
    setCreateVcModalOpen(true);
  }

  async function submitCreateVcDraft(payload) {
    if (!createVcStudent?._id) {
      setFeedback({ type: 'warning', text: 'Choose a student before creating a VC draft.', issues: [] });
      return;
    }

    try {
      setCreateVcSubmitting(true);
      await createCredentialDraftFromStudent(createVcStudent._id, payload);
      setCreateVcModalOpen(false);
      setCreateVcStudent(null);
      setFeedback({ type: 'success', text: 'VC draft created successfully.', issues: [] });
      await loadStudents({ page: pagination.page, showBusy: true });
    } catch (error) {
      setFeedback({
        type: 'danger',
        text: getErrorMessage(error, 'Failed to create VC draft.'),
        issues: [],
      });
    } finally {
      setCreateVcSubmitting(false);
    }
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

  function toggleStudentSelection(studentId, checked) {
    setSelectedStudentIds((current) => {
      const next = new Set(current);
      if (checked) next.add(studentId);
      else next.delete(studentId);
      return next;
    });
  }

  function toggleAllStudents(idsOrChecked, checkedValue) {
    const checked = Array.isArray(idsOrChecked) ? checkedValue : idsOrChecked;
    const ids = Array.isArray(idsOrChecked) ? idsOrChecked : students.map((student) => student._id);
    setSelectedStudentIds(checked ? new Set(ids) : new Set());
  }

  function openBulkCreateVcModal() {
    if (!selectedStudentCount) {
      setFeedback({
        type: 'warning',
        text: 'Select at least one student before creating VC drafts.',
        issues: [],
      });
      return;
    }

    setBulkCreateVcDraft({
      credentialType: '',
      anchorNow: false,
      anchorCost: DEFAULT_ANCHOR_NOW_FEE,
    });
    setBulkCreateVcStep('configure');
    setBulkCreateVcResults([]);
    setBulkCreateVcModalOpen(true);
  }

  function closeBulkCreateVcModal() {
    if (bulkCreateVcSubmitting) return;
    setBulkCreateVcModalOpen(false);
    setBulkCreateVcStep('configure');
  }

  function downloadBulkCreateReport() {
    const header = ['Student No', 'Student Name', 'Credential Type', 'Status', 'Message'];
    const rows = bulkCreateVcResults.map((item) => [
      item.studentNo,
      item.studentName,
      bulkCreateVcDraft.credentialType === 'diploma' ? 'Diploma' : 'Transcript of Records',
      item.status,
      item.message || item.error || '',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bcvs-bulk-vc-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function openBulkDeleteModal() {
    if (!selectedStudentCount) {
      setFeedback({
        type: 'warning',
        text: 'Select at least one student before deleting records.',
        issues: [],
      });
      return;
    }

    setBulkDeleteModalOpen(true);
  }

  async function confirmBulkCreateVcDrafts() {
    if (!selectedStudentCount) {
      setFeedback({
        type: 'warning',
        text: 'Select at least one student before creating VC drafts.',
        issues: [],
      });
      return;
    }

    if (!bulkCreateVcDraft.credentialType) {
      setFeedback({
        type: 'warning',
        text: 'Choose Diploma or TOR before creating VC drafts.',
        issues: [],
      });
      return;
    }

    try {
      setBulkCreateVcSubmitting(true);
      setBulkCreateVcStep('processing');
      const targets = selectedStudents.map((student) => ({
        studentId: student._id,
        studentNo: student.studentNo || '',
        studentName: student.studentName || '',
        program: student.programCode || student.programName || '',
        status: 'pending',
        progress: 0,
        message: 'Pending',
      }));
      setBulkCreateVcResults(targets);
      let resultRows = targets;
      const applyResult = (studentId, patch) => {
        resultRows = resultRows.map((item) => (item.studentId === studentId ? { ...item, ...patch } : item));
        setBulkCreateVcResults(resultRows);
      };

      for (const target of targets) {
        applyResult(target.studentId, {
          status: 'processing',
          progress: 35,
          message: 'Generating VC...',
        });

        try {
          const anchorNow = Boolean(bulkCreateVcDraft.anchorNow);
          await createCredentialDraftFromStudent(target.studentId, {
            credentialType: bulkCreateVcDraft.credentialType,
            notes: '',
            anchorMode: anchorNow ? 'same_day' : 'scheduled',
            anchorNow,
            anchorNowFee: anchorNow ? Number(bulkCreateVcDraft.anchorCost || DEFAULT_ANCHOR_NOW_FEE) : 0,
          });
          applyResult(target.studentId, {
            status: 'success',
            progress: 100,
            message: `${bulkCreateVcDraft.credentialType === 'diploma' ? 'Diploma' : 'Transcript of Records'} VC created`,
          });
        } catch (error) {
          applyResult(target.studentId, {
            status: 'failed',
            progress: 100,
            message: getErrorMessage(error, 'Unable to create VC draft.'),
          });
        }
      }

      setBulkCreateVcStep('results');
      setSelectedStudentIds(new Set());
      await loadStudents({ page: pagination.page, showBusy: true });
    } catch (error) {
      setFeedback({
        type: 'danger',
        text: getErrorMessage(error, 'Failed to create VC drafts.'),
        issues: [],
      });
      setBulkCreateVcStep('configure');
    } finally {
      setBulkCreateVcSubmitting(false);
    }
  }

  async function confirmBulkDeleteStudents() {
    if (!selectedStudentCount) {
      setFeedback({
        type: 'warning',
        text: 'Select at least one student before deleting records.',
        issues: [],
      });
      return;
    }

    try {
      setBulkDeleteSubmitting(true);
      const deleted = await bulkDeleteStudents(Array.from(selectedStudentIds));

      setBulkDeleteModalOpen(false);
      setSelectedStudentIds(new Set());
      await loadStudents({ page: pagination.page, showBusy: true });
      setFeedback({
        type: 'success',
        text: `Deleted ${deleted?.deletedCount || selectedStudentCount} student record${selectedStudentCount === 1 ? '' : 's'}.`,
        issues: [],
      });
    } catch (error) {
      setFeedback({
        type: 'danger',
        text: getErrorMessage(error, 'Failed to delete selected students.'),
        issues: [],
      });
    } finally {
      setBulkDeleteSubmitting(false);
    }
  }

  return (
    <>
      <div className="d-flex flex-column gap-4">
        <div className="d-flex flex-wrap justify-content-end align-items-center gap-2">
          <button className="btn btn-primary" onClick={openStudentDataModal} disabled={loadingCurricula}>
            <FaUpload className="me-2" />
            Import
          </button>
          {canCreateVcDraft ? (
            <button className="btn btn-outline-primary" onClick={() => { setCreateVcStudent(null); setCreateVcModalOpen(true); }} disabled={loadingStudents || refreshingStudents}>
              <FaFileSignature className="me-2" />
              Create VC
            </button>
          ) : null}
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
                <BulkActionsMenu
                  actions={[
                    ...(canCreateVcDraft
                      ? [
                          {
                            key: 'create-vc',
                            label: 'Create VC',
                            icon: <FaFileSignature />, 
                            onClick: openBulkCreateVcModal,
                          },
                        ]
                      : []),
                    {
                      key: 'delete-selected',
                      label: 'Delete Selected Students',
                      icon: <FaTrash />, 
                      variant: 'danger',
                      onClick: openBulkDeleteModal,
                    },
                  ]}
                  selectedCount={selectedStudentCount}
                  label="Actions"
                  isOpen={bulkActionMenuOpen}
                  onToggle={() => setBulkActionMenuOpen((value) => !value)}
                  onClose={() => setBulkActionMenuOpen(false)}
                  loading={loadingStudents || refreshingStudents}
                />
              </div>
            </form>

            {loadingStudents ? (
              <div className="text-muted">Loading students...</div>
            ) : students.length === 0 ? (
              <div className="mis-empty-state">No student records found.</div>
            ) : (
              <>
                <DataTable
                  rows={students}
                  columns={[
                    {
                      key: 'studentNo',
                      header: 'Student No.',
                      className: 'fw-semibold',
                    },
                    {
                      key: 'studentName',
                      header: 'Name',
                    },
                    {
                      key: 'programCode',
                      header: 'Program Code',
                      className: 'fw-semibold',
                      render: (student) => student.programCode || student.program || '-',
                    },
                    {
                      key: 'yearGraduated',
                      header: 'Year Graduated',
                      render: (student) => formatYear(student.dateGraduated || student.dateGraduation),
                    },
                    {
                      key: 'graduated',
                      header: 'Graduated',
                      render: (student) => (
                        <span className={`badge ${student.graduated ? 'text-bg-success' : 'text-bg-secondary'}`}>
                          {student.graduated ? 'Yes' : 'No'}
                        </span>
                      ),
                    },
                  ]}
                  selectedRows={selectedStudentIds}
                  activeRecord={selectedStudent}
                  onToggleRow={toggleStudentSelection}
                  onToggleAll={toggleAllStudents}
                  onViewDetails={(student) => handleOpenProfile(student._id)}
                  renderActions={(student) => (
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
                  )}
                />

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
        importTab={importTab}
        setImportTab={setImportTab}
        activeTab={studentDataTab}
        setActiveTab={setStudentDataTab}
        form={studentForm}
        setForm={setStudentForm}
        curricula={curricula}
        creating={creatingStudent}
        studentImport={studentImport}
        gradeImport={gradeImport}
        onClose={() => setStudentDataModalOpen(false)}
        onCreate={handleCreateStudent}
        onFileChange={handleStudentFileChange}
        onImport={handleImportStudents}
        onGradeFileChange={handleGradeFileChange}
        onImportGrades={handleImportGrades}
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

      <CreateVcDraftModal
        open={createVcModalOpen}
        title="Create VC Draft"
        subtitle="Create a VC draft for one student from the registrar workspace."
        student={createVcStudent}
        students={students}
        loading={loadingStudents || refreshingStudents}
        submitting={createVcSubmitting}
        onClose={() => {
          setCreateVcModalOpen(false);
          setCreateVcStudent(null);
        }}
        onConfirm={submitCreateVcDraft}
      />

      <ConfirmActionModal
        action={confirmAction}
        busy={busyAction}
        onCancel={() => setConfirmAction(null)}
        onConfirm={runConfirmedAction}
        onCredentialTypeChange={(credentialType) =>
          setConfirmAction((prev) => (prev ? { ...prev, credentialType } : prev))
        }
      />

      {bulkCreateVcModalOpen ? (
        <>
          <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content border-0 shadow">
                <div className="modal-header">
                  <div>
                    <h2 className="h5 mb-1">Create VC Drafts</h2>
                    <p className="text-muted mb-0 small">Create credential drafts for the selected students.</p>
                  </div>
                  <button type="button" className="btn-close" onClick={closeBulkCreateVcModal} disabled={bulkCreateVcSubmitting} aria-label="Close" />
                </div>
                <div className="modal-body">
                  {bulkCreateVcStep === 'configure' ? (
                    <>
                      <div className="alert alert-info border mb-3">
                        This will create VC drafts for {selectedStudentCount} selected student{selectedStudentCount === 1 ? '' : 's'}.
                      </div>
                      <div className="table-responsive mb-3">
                        <table className="table table-sm align-middle mb-0">
                          <thead>
                            <tr>
                              <th>Student No.</th>
                              <th>Student Name</th>
                              <th>Program</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedStudents.map((student) => (
                              <tr key={student._id}>
                                <td>{student.studentNo || '-'}</td>
                                <td>{student.studentName || '-'}</td>
                                <td>{student.programCode || student.programName || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <div className="fw-semibold mb-2">Credential Type</div>
                          <label className="form-check">
                            <input
                              className="form-check-input"
                              type="radio"
                              name="bulkCredentialType"
                              value="diploma"
                              checked={bulkCreateVcDraft.credentialType === 'diploma'}
                              onChange={(event) => setBulkCreateVcDraft((prev) => ({ ...prev, credentialType: event.target.value }))}
                            />
                            <span className="form-check-label">Diploma</span>
                          </label>
                          <label className="form-check">
                            <input
                              className="form-check-input"
                              type="radio"
                              name="bulkCredentialType"
                              value="tor"
                              checked={bulkCreateVcDraft.credentialType === 'tor'}
                              onChange={(event) => setBulkCreateVcDraft((prev) => ({ ...prev, credentialType: event.target.value }))}
                            />
                            <span className="form-check-label">Transcript of Records</span>
                          </label>
                        </div>
                        <div className="col-md-6">
                          <div className="fw-semibold mb-2">Blockchain Anchor</div>
                          <div className="btn-group mb-3" role="group" aria-label="Anchor now">
                            <button
                              type="button"
                              className={`btn btn-sm ${bulkCreateVcDraft.anchorNow ? 'btn-primary' : 'btn-outline-primary'}`}
                              onClick={() => setBulkCreateVcDraft((prev) => ({ ...prev, anchorNow: true }))}
                            >
                              YES
                            </button>
                            <button
                              type="button"
                              className={`btn btn-sm ${!bulkCreateVcDraft.anchorNow ? 'btn-primary' : 'btn-outline-primary'}`}
                              onClick={() => setBulkCreateVcDraft((prev) => ({ ...prev, anchorNow: false }))}
                            >
                              NO
                            </button>
                          </div>
                          {bulkCreateVcDraft.anchorNow ? (
                            <div>
                              <label className="form-label fw-semibold">Anchor Cost</label>
                              <div className="input-group">
                                <span className="input-group-text">PHP</span>
                                <input
                                  type="number"
                                  min="0"
                                  className="form-control"
                                  value={bulkCreateVcDraft.anchorCost}
                                  onChange={(event) => setBulkCreateVcDraft((prev) => ({ ...prev, anchorCost: event.target.value }))}
                                />
                              </div>
                              <div className="form-text">
                                Total per credential: PHP {BASE_CREDENTIAL_AMOUNT + Number(bulkCreateVcDraft.anchorCost || 0)}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </>
                  ) : null}

                  {bulkCreateVcStep === 'processing' ? (
                    <div className="d-flex flex-column gap-3">
                      <h3 className="h6 mb-0">Creating Credentials</h3>
                      {bulkCreateVcResults.map((item) => (
                        <div className="border rounded-3 p-3" key={item.studentId}>
                          <div className="d-flex justify-content-between gap-3">
                            <div>
                              <div className="fw-semibold">{item.studentName}</div>
                              <div className="small text-muted">{item.message}</div>
                            </div>
                            <span className={`badge ${item.status === 'success' ? 'text-bg-success' : item.status === 'failed' ? 'text-bg-danger' : item.status === 'processing' ? 'text-bg-primary' : 'text-bg-secondary'}`}>
                              {item.status}
                            </span>
                          </div>
                          <div className="progress mt-2" style={{ height: 8 }}>
                            <div
                              className={`progress-bar ${item.status === 'failed' ? 'bg-danger' : item.status === 'success' ? 'bg-success' : ''}`}
                              style={{ width: `${item.progress || 0}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {bulkCreateVcStep === 'results' ? (
                    <div className="d-flex flex-column gap-3">
                      <div className={`alert ${bulkCreateVcSummary.failedCount ? 'alert-warning' : 'alert-success'} mb-0`}>
                        <div className="fw-semibold">Bulk Creation Completed</div>
                        <div>Successful: {bulkCreateVcSummary.successCount}</div>
                        <div>Failed: {bulkCreateVcSummary.failedCount}</div>
                      </div>
                      <div className="table-responsive">
                        <table className="table table-sm align-middle mb-0">
                          <tbody>
                            {bulkCreateVcResults.map((item) => (
                              <tr key={item.studentId}>
                                <td style={{ width: 36 }}>
                                  {item.status === 'success' ? '✓' : '✗'}
                                </td>
                                <td>
                                  <div className="fw-semibold">{item.studentName}</div>
                                  <div className="small text-muted">{item.message}</div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="modal-footer">
                  {bulkCreateVcStep === 'results' ? (
                    <button className="btn btn-outline-primary me-auto" onClick={downloadBulkCreateReport}>
                      <FaDownload className="me-2" />
                      Download report
                    </button>
                  ) : null}
                  <button className="btn btn-outline-secondary" onClick={closeBulkCreateVcModal} disabled={bulkCreateVcSubmitting}>
                    {bulkCreateVcStep === 'results' ? 'Close' : 'Cancel'}
                  </button>
                  {bulkCreateVcStep === 'configure' ? (
                    <button className="btn btn-primary" onClick={confirmBulkCreateVcDrafts} disabled={bulkCreateVcSubmitting || !bulkCreateVcDraft.credentialType}>
                      Confirm
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" />
        </>
      ) : null}

      {bulkDeleteModalOpen ? (
        <>
          <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow">
                <div className="modal-header">
                  <div>
                    <h2 className="h5 mb-1">Delete Selected Students</h2>
                    <p className="text-muted mb-0 small">This action cannot be undone.</p>
                  </div>
                  <button type="button" className="btn-close" onClick={() => setBulkDeleteModalOpen(false)} disabled={bulkDeleteSubmitting} aria-label="Close" />
                </div>
                <div className="modal-body">
                  <p className="mb-3">Deleting these student records will also remove:</p>
                  <ul className="mb-3">
                    <li>Student Profile</li>
                    <li>Grade Records</li>
                    <li>Credential Drafts and VC Records</li>
                    <li>Blockchain Anchor References</li>
                    <li>Verification Records</li>
                  </ul>
                  <div className="alert alert-light border small mb-0">
                    {selectedStudentCount} selected student{selectedStudentCount === 1 ? '' : 's'} will be removed from the system.
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setBulkDeleteModalOpen(false)} disabled={bulkDeleteSubmitting}>Cancel</button>
                  <button className="btn btn-danger" onClick={confirmBulkDeleteStudents} disabled={bulkDeleteSubmitting}>
                    {bulkDeleteSubmitting ? 'Deleting...' : 'Delete Selected Students'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" />
        </>
      ) : null}
    </>
  );
}
