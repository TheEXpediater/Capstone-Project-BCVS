import { Types } from 'mongoose';
import { ApiError } from '../../shared/utils/ApiError.js';
import { getCurriculumModel } from '../curriculum/model.js';
import { getCredentialDraftModel } from '../credentials/model.js';
import { getMerkleAnchorModel } from '../anchors/model.js';
import {
  getVerificationSessionModel,
  getVerificationSubmissionModel,
} from '../verification/model.js';
import { getStudentGradeModel, getStudentModel } from './model.js';

function cleanString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function normalizeKey(key) {
  return cleanString(key).replace(/\s+/g, '').toLowerCase();
}

function normalizeRow(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const normalized = {};

  for (const [key, value] of Object.entries(raw)) {
    normalized[normalizeKey(key)] = value;
  }

  return normalized;
}

function isMeaningfulRow(row) {
  if (!row || typeof row !== 'object') return false;

  return Object.values(row).some((value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    return true;
  });
}

function normalizeImportRows(rows) {
  if (!Array.isArray(rows)) return [];

  return rows
    .filter(isMeaningfulRow)
    .map(normalizeRow)
    .filter(isMeaningfulRow);
}

function normalizeStudentNo(value) {
  return cleanString(value).replace(/\s+/g, '');
}

function normalizeProgramCode(value) {
  return cleanString(value).toUpperCase();
}

function toDateOrNull(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toNumber(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toPositiveInt(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 1) return fallback;
  return Math.floor(number);
}

function normalizeGraduatedFilter(value) {
  const normalized = cleanString(value).toLowerCase();

  if (['yes', 'y', 'true', '1', 'graduated'].includes(normalized)) {
    return true;
  }

  if (['no', 'n', 'false', '0', 'not_graduated', 'not graduated'].includes(normalized)) {
    return false;
  }

  return null;
}

function escapeRegex(value) {
  return cleanString(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readField(source, keys, fallback = '') {
  for (const key of keys) {
    if (source?.[key] !== undefined) return source[key];
  }

  return fallback;
}

function buildStudentName(row) {
  const direct = cleanString(row?.studentname) || cleanString(row?.fullname);

  if (direct) return direct;

  const lastName = cleanString(row?.lastname);
  const firstName = cleanString(row?.firstname);
  const middleName = cleanString(row?.middlename);

  return [lastName, firstName, middleName].filter(Boolean).join(', ');
}

async function resolveCurriculum(row) {
  const Curriculum = getCurriculumModel();

  const explicitCurriculumId = cleanString(
    row?.curriculumId || row?.curriculumid || row?._curriculumId
  );

  if (explicitCurriculumId) {
    if (!Types.ObjectId.isValid(explicitCurriculumId)) {
      return null;
    }

    const byId = await Curriculum.findById(explicitCurriculumId).lean();
    if (byId) return byId;
  }

  const explicitProgramCode = normalizeProgramCode(
    row?.programCode ||
      row?.programcode ||
      row?.program ||
      row?.curriculumcode
  );

  const explicitCurriculumYear = cleanString(
    row?.curriculumYear || row?.curriculumyear
  );

  const degreeTitle = cleanString(
    row?.degreeTitle || row?.degreetitle || row?.programName || row?.programname
  );

  if (explicitProgramCode && explicitCurriculumYear) {
    const exact = await Curriculum.findOne({
      program: explicitProgramCode,
      curriculumYear: explicitCurriculumYear,
    }).lean();

    if (exact) return exact;
  }

  if (explicitProgramCode) {
    const byProgram = await Curriculum.findOne({
      program: explicitProgramCode,
    })
      .sort({ curriculumYear: -1, updatedAt: -1 })
      .lean();

    if (byProgram) return byProgram;
  }

  if (degreeTitle) {
    const exactName = new RegExp(`^${escapeRegex(degreeTitle)}$`, 'i');
    const byName = await Curriculum.findOne({
      programName: exactName,
    })
      .sort({ curriculumYear: -1, updatedAt: -1 })
      .lean();

    if (byName) return byName;

    const looseName = new RegExp(escapeRegex(degreeTitle), 'i');
    const partial = await Curriculum.findOne({
      programName: looseName,
    })
      .sort({ curriculumYear: -1, updatedAt: -1 })
      .lean();

    if (partial) return partial;
  }

  return null;
}

async function resolveExactCurriculumForImport(row) {
  const Curriculum = getCurriculumModel();

  const programCode = normalizeProgramCode(
    row?.programcode || row?.program || row?.curriculumcode
  );
  const curriculumYear = cleanString(row?.curriculumyear);

  if (!programCode || !curriculumYear) {
    return null;
  }

  return Curriculum.findOne({
    program: programCode,
    curriculumYear,
  }).lean();
}

function buildStudentFilter(options = {}) {
  const clauses = [];
  const search = cleanString(options.search || options.query || '');

  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    clauses.push({
      $or: [
        { studentNo: regex },
        { studentName: regex },
        { programCode: regex },
        { programName: regex },
        { curriculumYear: regex },
      ],
    });
  }

  const name = cleanString(options.studentName || options.name || '');
  if (name) {
    clauses.push({ studentName: new RegExp(escapeRegex(name), 'i') });
  }

  const programCode = normalizeProgramCode(options.programCode || options.program || '');
  if (programCode) {
    clauses.push({ programCode });
  }

  const curriculumYear = cleanString(options.curriculumYear || '');
  if (curriculumYear) {
    clauses.push({ curriculumYear });
  }

  const graduationYear = cleanString(
    options.graduationYear || options.yearGraduated || options.yeargraduated || ''
  );
  if (/^\d{4}$/.test(graduationYear)) {
    const start = new Date(`${graduationYear}-01-01T00:00:00.000Z`);
    const end = new Date(`${Number(graduationYear) + 1}-01-01T00:00:00.000Z`);
    clauses.push({
      $or: [
        { dateGraduated: { $gte: start, $lt: end } },
        { dateGraduation: { $gte: start, $lt: end } },
      ],
    });
  }

  const graduated = normalizeGraduatedFilter(options.graduated || '');
  if (graduated !== null) {
    clauses.push({ graduated });
  }

  if (!clauses.length) return {};
  return { $and: clauses };
}

function mapStudentListRow(row) {
  return {
    _id: row._id,
    studentNo: row.studentNo,
    studentName: row.studentName,
    program:
      row.programCode ||
      row.programName ||
      row.degreeTitle ||
      row.major ||
      '—',
    graduated: Boolean(row.graduated),
    programCode: row.programCode || '',
    programName: row.programName || '',
    curriculumYear: row.curriculumYear || '',
    curriculumId:
      row.curriculumId && typeof row.curriculumId === 'object'
        ? row.curriculumId._id
        : row.curriculumId || null,
    dateGraduated: row.dateGraduated,
    dateGraduation: row.dateGraduation,
    studentStatus: row.studentStatus || (row.graduated ? 'graduated' : 'enrolled'),
    academicStatus: row.academicStatus || (row.graduated ? 'completed' : 'in_progress'),
    updatedAt: row.updatedAt,
  };
}

function mapStudentDetailRow(row) {
  return {
    _id: row._id,
    studentNo: row.studentNo,
    studentName: row.studentName,
    extensionName: row.extensionName,
    gender: row.gender,
    permanentAddress: row.permanentAddress,
    residentialAddress: row.residentialAddress,
    entranceCredentials: row.entranceCredentials,
    highSchool: row.highSchool,
    degreeTitle: row.degreeTitle,
    major: row.major,
    dateAdmission: row.dateAdmission,
    placeBirth: row.placeBirth,
    dateGraduated: row.dateGraduated,
    dateGraduation: row.dateGraduation,
    graduated: Boolean(row.graduated),
    studentStatus: row.studentStatus || (row.graduated ? 'graduated' : 'enrolled'),
    academicStatus: row.academicStatus || (row.graduated ? 'completed' : 'in_progress'),
    programCode: row.programCode,
    programName: row.programName,
    curriculumYear: row.curriculumYear,
    curriculum: row.curriculumId
      ? {
          _id: row.curriculumId._id,
          program: row.curriculumId.program,
          programName: row.curriculumId.programName,
          curriculumYear: row.curriculumId.curriculumYear,
        }
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapGradeRow(row) {
  return {
    _id: row._id,
    studentNo: row.studentNo,
    yearLevel: row.yearLevel,
    semester: row.semester,
    subjectCode: row.subjectCode,
    subjectTitle: row.subjectTitle,
    units: row.units,
    finalGrade: row.finalGrade,
    remarks: row.remarks,
    schoolYear: row.schoolYear,
    termName: row.termName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function sortGrades(a, b) {
  return (
    String(a.yearLevel || '').localeCompare(String(b.yearLevel || '')) ||
    String(a.semester || '').localeCompare(String(b.semester || '')) ||
    String(a.subjectCode || '').localeCompare(String(b.subjectCode || ''))
  );
}

function normalizeSubjectCode(value) {
  return cleanString(value).toUpperCase();
}

function buildGradeCompletionKey({ yearLevel, semester, subjectCode }) {
  return [
    cleanString(yearLevel).toLowerCase(),
    cleanString(semester).toLowerCase(),
    normalizeSubjectCode(subjectCode),
  ].join('::');
}

function flattenCurriculumSubjects(curriculum) {
  const subjects = [];
  const structure = curriculum?.structure || {};

  const pushSubject = (yearLevel, semester, subject) => {
    const subjectCode = normalizeSubjectCode(subject?.code || subject?.subjectCode);
    if (!subjectCode) return;

    subjects.push({
      yearLevel: cleanString(yearLevel || subject?.yearLevel),
      semester: cleanString(semester || subject?.semester),
      subjectCode,
    });
  };

  if (Array.isArray(structure)) {
    for (const subject of structure) {
      pushSubject(subject?.yearLevel, subject?.semester, subject);
    }
    return subjects;
  }

  for (const [yearLevel, semesterValue] of Object.entries(structure)) {
    if (Array.isArray(semesterValue)) {
      for (const subject of semesterValue) {
        pushSubject(yearLevel, subject?.semester, subject);
      }
      continue;
    }

    for (const [semester, subjectList] of Object.entries(semesterValue || {})) {
      const list = Array.isArray(subjectList)
        ? subjectList
        : Array.isArray(subjectList?.subjects)
          ? subjectList.subjects
          : Array.isArray(subjectList?.items)
            ? subjectList.items
            : [];

      for (const subject of list) {
        pushSubject(yearLevel, semester, subject);
      }
    }
  }

  return subjects;
}

function isPassingRemark(remarks, finalGrade) {
  const normalizedRemark = cleanString(remarks).toUpperCase().replace(/[\s_-]+/g, ' ');

  if (['PASSED', 'PASS', 'P'].includes(normalizedRemark)) {
    return true;
  }

  if (
    [
      'FAILED',
      'FAIL',
      'F',
      'INC',
      'INCOMPLETE',
      'DRP',
      'DROPPED',
      'NO GRADE',
      'NG',
    ].includes(normalizedRemark)
  ) {
    return false;
  }

  const numericGrade = Number(cleanString(finalGrade).replace(/,/g, '.'));
  return Number.isFinite(numericGrade) && numericGrade > 0 && numericGrade <= 3;
}

async function computeStudentGraduationStatus(student, { StudentGrade, Curriculum }) {
  if (!student?.curriculumId) {
    return false;
  }

  const curriculum = await Curriculum.findById(student.curriculumId).lean();
  const requiredSubjects = flattenCurriculumSubjects(curriculum);

  if (!requiredSubjects.length) {
    return false;
  }

  const grades = await StudentGrade.find({
    student: student._id,
    curriculumId: student.curriculumId,
  }).lean();

  const gradeByCompletionKey = new Map();

  for (const grade of grades) {
    gradeByCompletionKey.set(
      buildGradeCompletionKey({
        yearLevel: grade.yearLevel,
        semester: grade.semester,
        subjectCode: grade.subjectCode,
      }),
      grade
    );
  }

  return requiredSubjects.every((subject) => {
    const grade = gradeByCompletionKey.get(buildGradeCompletionKey(subject));
    return Boolean(grade) && isPassingRemark(grade.remarks, grade.finalGrade);
  });
}

export async function syncGraduationStatusForStudents(studentIds = []) {
  const Student = getStudentModel();
  const StudentGrade = getStudentGradeModel();
  const Curriculum = getCurriculumModel();

  const uniqueIds = [...new Set(studentIds.map((id) => cleanString(id)).filter(Boolean))]
    .filter((id) => Types.ObjectId.isValid(id));

  if (!uniqueIds.length) {
    return {
      checked: 0,
      updated: 0,
      graduated: 0,
      notGraduated: 0,
    };
  }

  const students = await Student.find({ _id: { $in: uniqueIds } }).lean();
  let updated = 0;
  let graduated = 0;
  let notGraduated = 0;

  for (const student of students) {
    const nextGraduated = await computeStudentGraduationStatus(student, {
      StudentGrade,
      Curriculum,
    });

    if (nextGraduated) graduated += 1;
    else notGraduated += 1;

    const nextStudentStatus = nextGraduated ? 'graduated' : 'enrolled';
    const nextAcademicStatus = nextGraduated ? 'completed' : 'incomplete';

    if (
      Boolean(student.graduated) !== nextGraduated ||
      student.studentStatus !== nextStudentStatus ||
      student.academicStatus !== nextAcademicStatus
    ) {
      await Student.updateOne(
        { _id: student._id },
        {
          $set: {
            graduated: nextGraduated,
            studentStatus: nextStudentStatus,
            academicStatus: nextAcademicStatus,
          },
        }
      );
      updated += 1;
    }
  }

  return {
    checked: students.length,
    updated,
    graduated,
    notGraduated,
  };
}

export async function listStudents(options = {}) {
  const Student = getStudentModel();

  const page = toPositiveInt(options.page, 1);
  const limit = Math.min(toPositiveInt(options.limit, 10), 100);
  const skip = (page - 1) * limit;
  const filter = buildStudentFilter(options);

  const projection = {
    studentNo: 1,
    studentName: 1,
    programCode: 1,
    programName: 1,
    degreeTitle: 1,
    major: 1,
    graduated: 1,
    curriculumId: 1,
    curriculumYear: 1,
    dateGraduated: 1,
    dateGraduation: 1,
    studentStatus: 1,
    academicStatus: 1,
    updatedAt: 1,
  };

  const [total, rows] = await Promise.all([
    Student.countDocuments(filter),
    Student.find(filter, projection)
      .sort({ studentNo: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const totalPages = Math.max(Math.ceil(total / limit), 1);

  return {
    rows: rows.map(mapStudentListRow),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
    },
  };
}

export async function searchStudents(query = '') {
  const Student = getStudentModel();
  const search = cleanString(query);

  if (!search) {
    return [];
  }

  const regex = new RegExp(escapeRegex(search), 'i');
  const rows = await Student.find(
    {
      $or: [
        { studentNo: regex },
        { studentName: regex },
        { programCode: regex },
      ],
    },
    {
      studentNo: 1,
      studentName: 1,
      programCode: 1,
      programName: 1,
      curriculumYear: 1,
      curriculumId: 1,
    }
  )
    .sort({ studentNo: 1 })
    .limit(20)
    .lean();

  return rows.map((row) => ({
    _id: row._id,
    studentNo: row.studentNo,
    studentName: row.studentName,
    programCode: row.programCode || '',
    programName: row.programName || '',
    curriculumYear: row.curriculumYear || '',
    curriculumId: row.curriculumId || null,
  }));
}

export async function getStudentById(id) {
  const Student = getStudentModel();
  const Curriculum = getCurriculumModel();

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid student id.');
  }

  const row = await Student.findById(id)
    .populate({
      path: 'curriculumId',
      model: Curriculum,
      select: 'program programName curriculumYear',
    })
    .lean();

  if (!row) {
    throw new ApiError(404, 'Student not found.');
  }

  return mapStudentDetailRow(row);
}

export async function getStudentGrades(id) {
  const Student = getStudentModel();
  const StudentGrade = getStudentGradeModel();
  const Curriculum = getCurriculumModel();

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid student id.');
  }

  const student = await Student.findById(id)
    .populate({
      path: 'curriculumId',
      model: Curriculum,
      select: 'program programName curriculumYear',
    })
    .lean();

  if (!student) {
    throw new ApiError(404, 'Student not found.');
  }

  const grades = await StudentGrade.find({ student: student._id })
    .sort({ yearLevel: 1, semester: 1, subjectCode: 1 })
    .lean();

  return {
    student: mapStudentDetailRow(student),
    grades: grades.map(mapGradeRow).sort(sortGrades),
  };
}

export async function createStudent(payload = {}, actor) {
  const Student = getStudentModel();

  const studentNo = normalizeStudentNo(
    payload.studentNo || payload.studentno || payload.studentNumber || payload.studentnumber
  );
  const studentName = cleanString(payload.studentName || payload.studentname || payload.fullName || payload.fullname);

  if (!studentNo) {
    throw new ApiError(400, 'Student number is required.');
  }

  if (!studentName) {
    throw new ApiError(400, 'Student name is required.');
  }

  const existing = await Student.findOne({ studentNo }).lean();
  if (existing) {
    throw new ApiError(409, 'A student with this student number already exists.');
  }

  const curriculum = await resolveCurriculum(payload);
  if (!curriculum) {
    throw new ApiError(400, 'Select a valid curriculum/program before saving the student.');
  }

  const created = await Student.create({
    studentNo,
    studentName,
    extensionName: cleanString(payload.extensionName || payload.extensionname),
    gender: cleanString(payload.gender),
    permanentAddress: cleanString(payload.permanentAddress || payload.permAddress || payload.permanentaddress),
    residentialAddress: cleanString(payload.residentialAddress || payload.resAddress || payload.residentialaddress),
    entranceCredentials: cleanString(payload.entranceCredentials || payload.entrancecredentials),
    highSchool: cleanString(payload.highSchool || payload.highschool),
    degreeTitle: cleanString(payload.degreeTitle || payload.degreetitle || curriculum.programName || ''),
    major: cleanString(payload.major),
    dateAdmission: toDateOrNull(payload.dateAdmission || payload.dateadmission),
    placeBirth: cleanString(payload.placeBirth || payload.placebirth),
    dateGraduated: toDateOrNull(payload.dateGraduated || payload.dategraduated),
    dateGraduation: toDateOrNull(payload.dateGraduation || payload.dategraduation),
    graduated: false,
    studentStatus: 'enrolled',
    academicStatus: 'in_progress',
    programCode: curriculum.program,
    programName: cleanString(payload.programName || payload.programname || curriculum.programName || ''),
    curriculumId: curriculum._id,
    curriculumYear: curriculum.curriculumYear || '',
    importedBy: actor?._id || null,
    updatedBy: actor?._id || null,
  });

  return getStudentById(created._id);
}

export async function importStudents(rows, actor) {
  const Student = getStudentModel();
  const importRows = normalizeImportRows(rows);

  if (importRows.length === 0) {
    throw new ApiError(
      400,
      'Import rows are required. The file may be blank or the headers were not parsed correctly.'
    );
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let withoutCurriculum = 0;

  const issues = [];
  const touchedStudentIds = new Set();

  for (const raw of importRows) {
    const studentNo = normalizeStudentNo(
      raw?.studentno || raw?.studentnumber
    );

    const studentName = buildStudentName(raw);

    if (!studentNo) {
      skipped += 1;
      issues.push({
        studentNo: '',
        reason: 'Missing StudentNo.',
      });
      continue;
    }

    if (!studentName) {
      skipped += 1;
      issues.push({
        studentNo,
        reason: 'Missing StudentName.',
      });
      continue;
    }

    const curriculum = await resolveExactCurriculumForImport(raw);

    if (!curriculum) {
      skipped += 1;
      withoutCurriculum += 1;
      issues.push({
        studentNo,
        reason: 'Curriculum not found for ProgramCode + CurriculumYear.',
      });
      continue;
    }

    const dateGraduated = toDateOrNull(raw?.dategraduated);
    const dateGraduation = toDateOrNull(raw?.dategraduation);

    const payload = {
      studentNo,
      studentName,
      extensionName: cleanString(raw?.extensionname),
      gender: cleanString(raw?.gender),
      permanentAddress: cleanString(raw?.permaddress || raw?.permanentaddress),
      residentialAddress: cleanString(raw?.resaddress || raw?.residentialaddress),
      entranceCredentials: cleanString(raw?.entrancecredentials),
      highSchool: cleanString(raw?.highschool),
      degreeTitle: cleanString(raw?.degreetitle || curriculum?.programName || ''),
      major: cleanString(raw?.major),
      dateAdmission: toDateOrNull(raw?.dateadmission),
      placeBirth: cleanString(raw?.placebirth),
      dateGraduated,
      dateGraduation,
      graduated: false,
      studentStatus: dateGraduated || dateGraduation ? 'graduated' : 'enrolled',
      academicStatus: dateGraduated || dateGraduation ? 'completed' : 'in_progress',
      programCode: curriculum?.program || normalizeProgramCode(raw?.programcode || raw?.program || ''),
      programName: cleanString(
        raw?.programname ||
          raw?.degreetitle ||
          curriculum?.programName ||
          ''
      ),
      curriculumId: curriculum._id,
      curriculumYear: curriculum?.curriculumYear || '',
      importedBy: actor?._id || null,
      updatedBy: actor?._id || null,
    };

    const existing = await Student.findOne({ studentNo }).lean();

    const saved = await Student.findOneAndUpdate(
      { studentNo },
      {
        $set: payload,
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    ).lean();

    touchedStudentIds.add(String(saved._id));

    if (existing) updated += 1;
    else inserted += 1;
  }

  const graduationSummary = await syncGraduationStatusForStudents([
    ...touchedStudentIds,
  ]);

  return {
    summary: {
      total: importRows.length,
      inserted,
      updated,
      skipped,
      withoutCurriculum,
      graduationChecked: graduationSummary.checked,
      graduationUpdated: graduationSummary.updated,
      graduatedYes: graduationSummary.graduated,
      graduatedNo: graduationSummary.notGraduated,
    },
    issues: issues.slice(0, 30),
  };
}

export async function importStudentGrades(rows, actor) {
  const Student = getStudentModel();
  const StudentGrade = getStudentGradeModel();
  const importRows = normalizeImportRows(rows);

  if (importRows.length === 0) {
    throw new ApiError(
      400,
      'Import rows are required. The file may be blank or the headers were not parsed correctly.'
    );
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  const issues = [];
  const touchedStudentIds = new Set();

  for (const raw of importRows) {
    const studentNo = normalizeStudentNo(
      raw?.studentno || raw?.studentnumber
    );

    const subjectCode = normalizeProgramCode(
      raw?.subjectcode || raw?.code
    );

    const yearLevel = cleanString(raw?.yearlevel || raw?.year);
    const semester = cleanString(raw?.semester || raw?.sem);

    if (!studentNo) {
      skipped += 1;
      issues.push({ studentNo: '', reason: 'Missing StudentNo.' });
      continue;
    }

    if (!subjectCode) {
      skipped += 1;
      issues.push({ studentNo, reason: 'Missing SubjectCode.' });
      continue;
    }

    if (!yearLevel || !semester) {
      skipped += 1;
      issues.push({
        studentNo,
        reason: 'Missing YearLevel or Semester.',
      });
      continue;
    }

    const student = await Student.findOne({ studentNo }).lean();

    if (!student) {
      skipped += 1;
      issues.push({
        studentNo,
        reason: 'StudentNo not found.',
      });
      continue;
    }

    if (!student.curriculumId) {
      skipped += 1;
      issues.push({
        studentNo,
        reason: 'Student has no linked curriculum.',
      });
      continue;
    }

    touchedStudentIds.add(String(student._id));

    const filter = {
      student: student._id,
      curriculumId: student.curriculumId,
      yearLevel,
      semester,
      subjectCode,
    };

    const payload = {
      student: student._id,
      curriculumId: student.curriculumId,
      studentNo,
      yearLevel,
      semester,
      subjectCode,
      subjectTitle: cleanString(
        raw?.subjecttitle || raw?.title
      ),
      units: toNumber(raw?.units, 0),
      finalGrade: cleanString(
        raw?.finalgrade || raw?.grade
      ),
      remarks: cleanString(raw?.remarks),
      schoolYear: cleanString(raw?.schoolyear),
      termName: cleanString(raw?.termname),
      importedBy: actor?._id || null,
      updatedBy: actor?._id || null,
    };

    const existing = await StudentGrade.findOne(filter).lean();

    await StudentGrade.findOneAndUpdate(
      filter,
      {
        $set: payload,
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    if (existing) updated += 1;
    else inserted += 1;
  }

  const graduationSummary = await syncGraduationStatusForStudents([
    ...touchedStudentIds,
  ]);

  return {
    summary: {
      total: importRows.length,
      inserted,
      updated,
      skipped,
      graduationChecked: graduationSummary.checked,
      graduationUpdated: graduationSummary.updated,
      graduatedYes: graduationSummary.graduated,
      graduatedNo: graduationSummary.notGraduated,
    },
    issues: issues.slice(0, 30),
  };
}

export async function updateStudentById(id, payload, actor) {
  const Student = getStudentModel();
  const Curriculum = getCurriculumModel();

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid student id.');
  }

  const existing = await Student.findById(id).lean();

  if (!existing) {
    throw new ApiError(404, 'Student not found.');
  }

  const next = {
    studentName:
      payload.studentName !== undefined
        ? cleanString(payload.studentName)
        : existing.studentName,

    extensionName:
      payload.extensionName !== undefined
        ? cleanString(payload.extensionName)
        : existing.extensionName,

    gender:
      payload.gender !== undefined
        ? cleanString(payload.gender)
        : existing.gender,

    permanentAddress:
      payload.permanentAddress !== undefined
        ? cleanString(payload.permanentAddress)
        : existing.permanentAddress,

    residentialAddress:
      payload.residentialAddress !== undefined
        ? cleanString(payload.residentialAddress)
        : existing.residentialAddress,

    entranceCredentials:
      payload.entranceCredentials !== undefined
        ? cleanString(payload.entranceCredentials)
        : existing.entranceCredentials,

    highSchool:
      payload.highSchool !== undefined
        ? cleanString(payload.highSchool)
        : existing.highSchool,

    degreeTitle:
      payload.degreeTitle !== undefined
        ? cleanString(payload.degreeTitle)
        : existing.degreeTitle,

    major:
      payload.major !== undefined
        ? cleanString(payload.major)
        : existing.major,

    dateAdmission:
      payload.dateAdmission !== undefined
        ? toDateOrNull(payload.dateAdmission)
        : existing.dateAdmission,

    placeBirth:
      payload.placeBirth !== undefined
        ? cleanString(payload.placeBirth)
        : existing.placeBirth,

    dateGraduated:
      payload.dateGraduated !== undefined
        ? toDateOrNull(payload.dateGraduated)
        : existing.dateGraduated,

    dateGraduation:
      payload.dateGraduation !== undefined
        ? toDateOrNull(payload.dateGraduation)
        : existing.dateGraduation,

    graduated: Boolean(existing.graduated),

    programCode:
      payload.programCode !== undefined
        ? normalizeProgramCode(payload.programCode)
        : existing.programCode,

    programName:
      payload.programName !== undefined
        ? cleanString(payload.programName)
        : existing.programName,

    curriculumYear:
      payload.curriculumYear !== undefined
        ? cleanString(payload.curriculumYear)
        : existing.curriculumYear,
  };

  if (!next.studentName) {
    throw new ApiError(400, 'Student name is required.');
  }

  const curriculumFieldsTouched =
    payload.curriculumId !== undefined ||
    payload.programCode !== undefined ||
    payload.programName !== undefined ||
    payload.degreeTitle !== undefined ||
    payload.curriculumYear !== undefined;

  let nextCurriculumId = existing.curriculumId || null;
  let nextCurriculumYear = next.curriculumYear || '';

  if (curriculumFieldsTouched) {
    const matchedCurriculum = await resolveCurriculum({
      curriculumId: payload.curriculumId,
      programcode: next.programCode,
      program: next.programCode,
      curriculumyear: next.curriculumYear,
      degreetitle: next.degreeTitle,
      programname: next.programName,
    });

    if (payload.curriculumId && !matchedCurriculum) {
      throw new ApiError(400, 'Selected curriculum was not found.');
    }

    nextCurriculumId = matchedCurriculum?._id || null;
    nextCurriculumYear = matchedCurriculum?.curriculumYear || next.curriculumYear || '';

    if (matchedCurriculum?.program) {
      next.programCode = matchedCurriculum.program;
    }

    if (matchedCurriculum?.programName) {
      next.programName = matchedCurriculum.programName;
      if (!next.degreeTitle) {
        next.degreeTitle = matchedCurriculum.programName;
      }
    }
  }

  const updated = await Student.findByIdAndUpdate(
    id,
    {
      $set: {
        studentName: next.studentName,
        extensionName: next.extensionName,
        gender: next.gender,
        permanentAddress: next.permanentAddress,
        residentialAddress: next.residentialAddress,
        entranceCredentials: next.entranceCredentials,
        highSchool: next.highSchool,
        degreeTitle: next.degreeTitle,
        major: next.major,
        dateAdmission: next.dateAdmission,
        placeBirth: next.placeBirth,
        dateGraduated: next.dateGraduated,
        dateGraduation: next.dateGraduation,
        graduated: next.graduated,
        programCode: next.programCode,
        programName: next.programName,
        curriculumYear: nextCurriculumYear,
        curriculumId: nextCurriculumId,
        updatedBy: actor?._id || null,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  )
    .populate({
      path: 'curriculumId',
      model: Curriculum,
      select: 'program programName curriculumYear',
    })
    .lean();

  await syncGraduationStatusForStudents([updated._id]);
  return getStudentById(updated._id);
}

async function cleanupStudentDependents(students = []) {
  const StudentGrade = getStudentGradeModel();
  const CredentialDraft = getCredentialDraftModel();
  const MerkleAnchor = getMerkleAnchorModel();
  const VerificationSession = getVerificationSessionModel();
  const VerificationSubmission = getVerificationSubmissionModel();

  const studentObjectIds = students.map((student) => student._id);
  const studentIdStrings = studentObjectIds.map((studentId) => studentId.toString());
  const studentNos = students.map((student) => cleanString(student.studentNo)).filter(Boolean);

  const credentialDrafts = await CredentialDraft.find(
    {
      $or: [
        { student: { $in: studentObjectIds } },
        { studentNo: { $in: studentNos } },
      ],
    },
    { _id: 1 }
  ).lean();
  const credentialIds = credentialDrafts.map((draft) => draft._id);
  const credentialIdStrings = credentialIds.map((credentialId) => credentialId.toString());

  let anchorsUpdated = 0;
  let deletedEmptyAnchors = 0;
  if (credentialIds.length) {
    const byObjectId = await MerkleAnchor.updateMany(
      { 'credentials.credential': { $in: credentialIds } },
      { $pull: { credentials: { credential: { $in: credentialIds } } } }
    );
    const byCredentialId = await MerkleAnchor.updateMany(
      { 'credentials.credentialId': { $in: credentialIdStrings } },
      { $pull: { credentials: { credentialId: { $in: credentialIdStrings } } } }
    );
    anchorsUpdated = (byObjectId.modifiedCount || 0) + (byCredentialId.modifiedCount || 0);
    const emptyAnchorResult = await MerkleAnchor.deleteMany({ credentials: { $size: 0 } });
    deletedEmptyAnchors = emptyAnchorResult.deletedCount || 0;
  }

  const [
    credentialResult,
    verificationSessionResult,
    verificationSubmissionResult,
    gradeResult,
  ] = await Promise.all([
    credentialIds.length
      ? CredentialDraft.deleteMany({ _id: { $in: credentialIds } })
      : Promise.resolve({ deletedCount: 0 }),
    VerificationSession.deleteMany({
      $or: [
        { studentNo: { $in: studentNos } },
        { credentialId: { $in: credentialIdStrings } },
      ],
    }),
    VerificationSubmission.deleteMany({
      $or: [
        { linkedStudentId: { $in: studentObjectIds } },
        { linkedStudentNo: { $in: studentNos } },
        { submittedStudentNo: { $in: studentNos } },
      ],
    }),
    StudentGrade.deleteMany({
      $or: [
        { student: { $in: studentObjectIds } },
        { studentNo: { $in: studentNos } },
      ],
    }),
  ]);

  return {
    deletedCredentials: credentialResult.deletedCount || 0,
    anchorsUpdated,
    deletedEmptyAnchors,
    deletedVerificationSessions: verificationSessionResult.deletedCount || 0,
    deletedVerificationSubmissions: verificationSubmissionResult.deletedCount || 0,
    deletedGrades: gradeResult.deletedCount || 0,
  };
}

export async function deleteStudentById(id) {
  const Student = getStudentModel();

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid student id.');
  }

  const student = await Student.findById(id).lean();

  if (!student) {
    throw new ApiError(404, 'Student not found.');
  }

  try {
    const cleanup = await cleanupStudentDependents([student]);
    const studentResult = await Student.deleteOne({ _id: student._id });

    return {
      _id: student._id,
      studentNo: student.studentNo,
      studentName: student.studentName,
      deletedCount: studentResult.deletedCount || 0,
      ...cleanup,
    };
  } catch (error) {
    throw new ApiError(500, error?.message || 'Student deletion failed.');
  }
}

export async function bulkDeleteStudents(ids = [], actor) {
  const Student = getStudentModel();

  const normalizedIds = Array.isArray(ids) ? ids.filter(Boolean) : [];
  if (normalizedIds.length === 0) {
    throw new ApiError(400, 'At least one student id is required.');
  }

  const validIds = normalizedIds.filter((id) => Types.ObjectId.isValid(id));
  if (validIds.length !== normalizedIds.length) {
    throw new ApiError(400, 'One or more student ids are invalid.');
  }

  const students = await Student.find({ _id: { $in: validIds } }).lean();
  if (students.length !== validIds.length) {
    throw new ApiError(404, 'One or more student records were not found.');
  }

  try {
    const cleanup = await cleanupStudentDependents(students);
    const studentResult = await Student.deleteMany({ _id: { $in: validIds } });

    return {
      deletedCount: studentResult.deletedCount || 0,
      ...cleanup,
      actor: actor?._id || null,
    };
  } catch (error) {
    throw new ApiError(500, error?.message || 'Bulk student deletion failed.');
  }
}
