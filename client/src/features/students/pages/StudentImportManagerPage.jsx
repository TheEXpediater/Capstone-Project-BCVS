import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  bulkImportStudentGrades,
  bulkImportStudents,
  getStudentGrades,
  getStudentProfile,
  listStudents,
} from '../studentsAPI';
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
function DataPreview({ rows }) {
  const previewRows = rows.slice(0, 5);
  const columns = Object.keys(previewRows[0] || {});

  if (!rows.length) {
    return <div className="alert alert-light border mb-0">No preview available yet.</div>;
  }

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

function StudentProfileModal({ student, onClose, onOpenGrades }) {
  if (!student) return null;

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 className="h5 mb-1">Student Profile</h2>
                <p className="text-muted mb-0 small">{student.studentNo}</p>
              </div>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>

            <div className="modal-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="small text-muted">Student No</div>
                  <div className="fw-semibold">{student.studentNo || '—'}</div>
                </div>
                <div className="col-md-6">
                  <div className="small text-muted">Student Name</div>
                  <div className="fw-semibold">{student.studentName || '—'}</div>
                </div>

                <div className="col-md-4">
                  <div className="small text-muted">Program Code</div>
                  <div className="fw-semibold">{student.programCode || '—'}</div>
                </div>
                <div className="col-md-4">
                  <div className="small text-muted">Program Name</div>
                  <div className="fw-semibold">{student.programName || student.degreeTitle || '—'}</div>
                </div>
                <div className="col-md-4">
                  <div className="small text-muted">Graduated</div>
                  <div className="fw-semibold">{student.graduated ? 'Yes' : 'No'}</div>
                </div>

                <div className="col-md-4">
                  <div className="small text-muted">Major</div>
                  <div className="fw-semibold">{student.major || '—'}</div>
                </div>
                <div className="col-md-4">
                  <div className="small text-muted">Gender</div>
                  <div className="fw-semibold">{student.gender || '—'}</div>
                </div>
                <div className="col-md-4">
                  <div className="small text-muted">Extension Name</div>
                  <div className="fw-semibold">{student.extensionName || '—'}</div>
                </div>

                <div className="col-md-6">
                  <div className="small text-muted">Date Admission</div>
                  <div className="fw-semibold">{formatDate(student.dateAdmission)}</div>
                </div>
                <div className="col-md-6">
                  <div className="small text-muted">Date Graduation</div>
                  <div className="fw-semibold">
                    {formatDate(student.dateGraduation || student.dateGraduated)}
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="small text-muted">Place of Birth</div>
                  <div className="fw-semibold">{student.placeBirth || '—'}</div>
                </div>
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
                  <div className="fw-semibold">{student.permanentAddress || '—'}</div>
                </div>

                <div className="col-12">
                  <div className="small text-muted">Residential Address</div>
                  <div className="fw-semibold">{student.residentialAddress || '—'}</div>
                </div>

                <div className="col-md-6">
                  <div className="small text-muted">Entrance Credentials</div>
                  <div className="fw-semibold">{student.entranceCredentials || '—'}</div>
                </div>
                <div className="col-md-6">
                  <div className="small text-muted">High School</div>
                  <div className="fw-semibold">{student.highSchool || '—'}</div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => onOpenGrades(student._id)}
              >
                Show Grades
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="modal-backdrop show" onClick={onClose} />
    </>
  );
}

function StudentGradesModal({ data, onClose }) {
  if (!data) return null;

  const student = data.student;
  const grades = data.grades || [];

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
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
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
                      {grades.map((grade) => (
                        <tr key={grade._id}>
                          <td>{grade.yearLevel || '—'}</td>
                          <td>{grade.semester || '—'}</td>
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

export default function StudentImportManagerPage() {
  const [activeTab, setActiveTab] = useState('students');

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [feedback, setFeedback] = useState({
    type: '',
    text: '',
    issues: [],
  });

  const [studentImportFileName, setStudentImportFileName] = useState('');
  const [studentImportRows, setStudentImportRows] = useState([]);
  const [studentImportSheetName, setStudentImportSheetName] = useState('');
  const [importingStudents, setImportingStudents] = useState(false);

  const [gradeImportFileName, setGradeImportFileName] = useState('');
  const [gradeImportRows, setGradeImportRows] = useState([]);
  const [gradeImportSheetName, setGradeImportSheetName] = useState('');
  const [importingGrades, setImportingGrades] = useState(false);

  const [profileLoading, setProfileLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [gradesLoadingId, setGradesLoadingId] = useState('');
  const [selectedGradesData, setSelectedGradesData] = useState(null);

  async function loadStudents(showBusy = false) {
    try {
      if (showBusy) setRefreshing(true);
      else setLoading(true);

      const data = await listStudents();
      setStudents(data || []);
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error.response?.data?.message ||
          error.message ||
          'Failed to load students.',
        issues: [],
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadStudents(false);
  }, []);

  const studentImportColumns = useMemo(() => {
    return Object.keys(studentImportRows[0] || {});
  }, [studentImportRows]);

  const gradeImportColumns = useMemo(() => {
    return Object.keys(gradeImportRows[0] || {});
  }, [gradeImportRows]);

  async function handleStudentFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await readSpreadsheet(file);
      setStudentImportFileName(file.name);
      setStudentImportSheetName(parsed.sheetName);
      setStudentImportRows(parsed.rows);
      setFeedback({
        type: 'success',
        text: `Loaded ${parsed.rows.length} student row(s) from ${file.name}.`,
        issues: [],
      });
    } catch (error) {
      setFeedback({
        type: 'danger',
        text: error.message || 'Failed to read student import file.',
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
      setGradeImportFileName(file.name);
      setGradeImportSheetName(parsed.sheetName);
      setGradeImportRows(parsed.rows);
      setFeedback({
        type: 'success',
        text: `Loaded ${parsed.rows.length} grade row(s) from ${file.name}.`,
        issues: [],
      });
    } catch (error) {
      setFeedback({
        type: 'danger',
        text: error.message || 'Failed to read grade import file.',
        issues: [],
      });
    } finally {
      event.target.value = '';
    }
  }

  async function handleImportStudents() {
    if (!studentImportRows.length) {
      setFeedback({
        type: 'danger',
        text: 'Choose a student spreadsheet first.',
        issues: [],
      });
      return;
    }

    try {
      setImportingStudents(true);
      const result = await bulkImportStudents(studentImportRows);

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
        text:
          error.response?.data?.message ||
          error.message ||
          'Failed to import student data.',
        issues: [],
      });
    } finally {
      setImportingStudents(false);
    }
  }

  async function handleImportGrades() {
    if (!gradeImportRows.length) {
      setFeedback({
        type: 'danger',
        text: 'Choose a grades spreadsheet first.',
        issues: [],
      });
      return;
    }

    try {
      setImportingGrades(true);
      const result = await bulkImportStudentGrades(gradeImportRows);

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
        text:
          error.response?.data?.message ||
          error.message ||
          'Failed to import grades.',
        issues: [],
      });
    } finally {
      setImportingGrades(false);
    }
  }

  async function handleOpenProfile(studentId) {
    try {
      setProfileLoading(true);
      const data = await getStudentProfile(studentId);
      setSelectedStudent(data);
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error.response?.data?.message ||
          error.message ||
          'Failed to load student profile.',
        issues: [],
      });
    } finally {
      setProfileLoading(false);
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
        text:
          error.response?.data?.message ||
          error.message ||
          'Failed to load student grades.',
        issues: [],
      });
    } finally {
      setGradesLoadingId('');
    }
  }

  function renderTabs() {
    const tabs = [
      { key: 'students', label: 'Students' },
      { key: 'importStudents', label: 'Import Student Data' },
      { key: 'importGrades', label: 'Import Grades' },
    ];

    return (
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
    );
  }

  return (
    <>
      <div className="d-flex flex-column gap-4">
        <div>
          <h1 className="h3 mb-1">Student Records</h1>
          <p className="text-muted mb-0">
            Clean import workflow first for student data, then grades, ready for later TOR / VC generation.
          </p>
        </div>

        {renderTabs()}

        {feedback.text ? (
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
        ) : null}

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
                  disabled={refreshing}
                >
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              {loading ? (
                <div className="text-muted">Loading students...</div>
              ) : students.length === 0 ? (
                <div className="alert alert-light border mb-0">
                  No student records yet.
                </div>
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
                            <span className={`badge ${student.graduated ? 'text-bg-success' : 'text-bg-secondary'}`}>
                              {student.graduated ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td>
                            <div className="d-flex flex-wrap gap-2">
                              <button
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => handleOpenProfile(student._id)}
                                disabled={profileLoading}
                              >
                                Profile
                              </button>
                              <button
                                className="btn btn-outline-secondary btn-sm"
                                onClick={() => handleOpenGrades(student._id)}
                                disabled={gradesLoadingId === student._id}
                              >
                                {gradesLoadingId === student._id ? 'Loading...' : 'Grades'}
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
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4 d-flex flex-column gap-4">
              <div>
                <h2 className="h5 mb-1">Import Student Data</h2>
                <p className="text-muted mb-0">
                  Upload student records first. Your sample file columns already match this flow.
                </p>
              </div>

              <div className="border rounded-3 p-3 bg-light">
                <label className="form-label fw-semibold">Select Excel / CSV file</label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="form-control"
                  onChange={handleStudentFileChange}
                />

                <div className="small text-muted mt-2">
                  Recognized student columns include:
                  {' '}
                  <strong>
                    StudentNo, StudentName, ExtensionName, Gender, PermAddress,
                    ResAddress, EntranceCredentials, HighSchool, DegreeTitle, Major,
                    DateAdmission, PlaceBirth, DateGraduated, DateGraduation
                  </strong>
                </div>

                <div className="small text-muted mt-2">
                  Best practice: add <strong>ProgramCode</strong> and optional
                  <strong> CurriculumYear</strong> in future imports so the curriculum
                  link becomes exact, not only name-matched.
                </div>
              </div>

              {studentImportFileName ? (
                <div className="border rounded-3 p-3">
                  <div className="fw-semibold">{studentImportFileName}</div>
                  <div className="small text-muted">
                    Sheet: {studentImportSheetName || '—'} | Rows: {studentImportRows.length}
                  </div>
                  <div className="small text-muted mt-2">
                    Columns: {studentImportColumns.join(', ') || '—'}
                  </div>
                </div>
              ) : null}

              <div className="d-flex justify-content-end">
                <button
                  className="btn btn-primary"
                  onClick={handleImportStudents}
                  disabled={importingStudents || !studentImportRows.length}
                >
                  {importingStudents ? 'Importing...' : 'Import Student Data'}
                </button>
              </div>

              <DataPreview rows={studentImportRows} />
            </div>
          </div>
        ) : null}

        {activeTab === 'importGrades' ? (
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4 d-flex flex-column gap-4">
              <div>
                <h2 className="h5 mb-1">Import Grades</h2>
                <p className="text-muted mb-0">
                  Grades can only be imported after the student already exists.
                </p>
              </div>

              <div className="alert alert-warning mb-0">
                Grade import will skip any row where the student does not exist yet or the
                student has no linked curriculum.
              </div>

              <div className="border rounded-3 p-3 bg-light">
                <label className="form-label fw-semibold">Select Excel / CSV file</label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="form-control"
                  onChange={handleGradeFileChange}
                />

                <div className="small text-muted mt-2">
                  Recognized grade columns include:
                  {' '}
                  <strong>
                    StudentNo or StudentNumber, SubjectCode or Code, SubjectTitle or Title,
                    Units, FinalGrade or Grade, Remarks, YearLevel or Year,
                    Semester or Sem, SchoolYear, TermName
                  </strong>
                </div>
              </div>

              {gradeImportFileName ? (
                <div className="border rounded-3 p-3">
                  <div className="fw-semibold">{gradeImportFileName}</div>
                  <div className="small text-muted">
                    Sheet: {gradeImportSheetName || '—'} | Rows: {gradeImportRows.length}
                  </div>
                  <div className="small text-muted mt-2">
                    Columns: {gradeImportColumns.join(', ') || '—'}
                  </div>
                </div>
              ) : null}

              <div className="d-flex justify-content-end">
                <button
                  className="btn btn-primary"
                  onClick={handleImportGrades}
                  disabled={importingGrades || !gradeImportRows.length}
                >
                  {importingGrades ? 'Importing...' : 'Import Grades'}
                </button>
              </div>

              <DataPreview rows={gradeImportRows} />
            </div>
          </div>
        ) : null}
      </div>

      <StudentProfileModal
        student={selectedStudent}
        onClose={() => setSelectedStudent(null)}
        onOpenGrades={handleOpenGrades}
      />

      <StudentGradesModal
        data={selectedGradesData}
        onClose={() => setSelectedGradesData(null)}
      />
    </>
  );
}