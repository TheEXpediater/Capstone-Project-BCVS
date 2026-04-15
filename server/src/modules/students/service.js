import { Types } from 'mongoose';
import { ApiError } from '../../shared/utils/ApiError.js';
import { getCurriculumModel } from '../curriculum/model.js';
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

function toBooleanYesNo(value) {
  const normalized = cleanString(value).toLowerCase();
  return ['yes', 'y', 'true', '1'].includes(normalized);
}

function escapeRegex(value) {
  return cleanString(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildStudentName(row) {
  const direct =
    cleanString(row?.studentname) ||
    cleanString(row?.fullname);

  if (direct) return direct;

  const lastName = cleanString(row?.lastname);
  const firstName = cleanString(row?.firstname);
  const middleName = cleanString(row?.middlename);

  return [lastName, firstName, middleName].filter(Boolean).join(', ');
}

async function resolveCurriculum(row) {
  const Curriculum = getCurriculumModel();

  const explicitProgramCode = normalizeProgramCode(
    row?.programcode ||
      row?.program ||
      row?.curriculumcode
  );

  const explicitCurriculumYear = cleanString(row?.curriculumyear);

  const degreeTitle = cleanString(
    row?.degreetitle || row?.programname
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
    curriculumId:
      row.curriculumId && typeof row.curriculumId === 'object'
        ? row.curriculumId._id
        : row.curriculumId || null,
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
    programCode: row.programCode,
    programName: row.programName,
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

export async function listStudents() {
  const Student = getStudentModel();

  const rows = await Student.find(
    {},
    {
      studentNo: 1,
      studentName: 1,
      programCode: 1,
      programName: 1,
      degreeTitle: 1,
      major: 1,
      graduated: 1,
      curriculumId: 1,
      updatedAt: 1,
    }
  )
    .sort({ studentNo: 1 })
    .lean();

  return rows.map(mapStudentListRow);
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
    grades: grades.map(mapGradeRow),
  };
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

    const curriculum = await resolveCurriculum(raw);

    const dateGraduated = toDateOrNull(raw?.dategraduated);
    const dateGraduation = toDateOrNull(raw?.dategraduation);

    const graduated =
      Boolean(dateGraduated || dateGraduation) ||
      toBooleanYesNo(raw?.graduated);

    const payload = {
      studentNo,
      studentName,
      extensionName: cleanString(raw?.extensionname),
      gender: cleanString(raw?.gender),
      permanentAddress: cleanString(raw?.permaddress || raw?.permanentaddress),
      residentialAddress: cleanString(raw?.resaddress || raw?.residentialaddress),
      entranceCredentials: cleanString(raw?.entrancecredentials),
      highSchool: cleanString(raw?.highschool),
      degreeTitle: cleanString(raw?.degreetitle),
      major: cleanString(raw?.major),
      dateAdmission: toDateOrNull(raw?.dateadmission),
      placeBirth: cleanString(raw?.placebirth),
      dateGraduated,
      dateGraduation,
      graduated,
      programCode: normalizeProgramCode(
        raw?.programcode ||
          raw?.program ||
          curriculum?.program ||
          ''
      ),
      programName: cleanString(
        raw?.programname ||
          raw?.degreetitle ||
          curriculum?.programName ||
          ''
      ),
      curriculumId: curriculum?._id || null,
      curriculumYear: curriculum?.curriculumYear || '',
      importedBy: actor?._id || null,
      updatedBy: actor?._id || null,
    };

    if (!payload.curriculumId) {
      withoutCurriculum += 1;
    }

    const existing = await Student.findOne({ studentNo }).lean();

    await Student.findOneAndUpdate(
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
    );

    if (existing) updated += 1;
    else inserted += 1;
  }

  return {
    summary: {
      total: importRows.length,
      inserted,
      updated,
      skipped,
      withoutCurriculum,
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
        reason: 'Student does not exist yet. Import student data first.',
      });
      continue;
    }

    if (!student.curriculumId) {
      skipped += 1;
      issues.push({
        studentNo,
        reason: 'Student has no linked curriculum. Resolve curriculum first.',
      });
      continue;
    }

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

  return {
    summary: {
      total: importRows.length,
      inserted,
      updated,
      skipped,
    },
    issues: issues.slice(0, 30),
  };
}
