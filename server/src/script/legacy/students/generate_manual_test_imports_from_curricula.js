import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { connectDatabases } from '../../config/db.js';
import { getCurriculumModel } from '../../modules/curriculum/model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getArg(flag, fallback = '') {
  const index = process.argv.findIndex((item) => item === flag);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function cleanString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function normalizeProgramCode(value) {
  return cleanString(value).toUpperCase();
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(cleanString(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function extractSchoolYearParts(schoolYear) {
  const text = cleanString(schoolYear);
  const match = text.match(/(\d{4})\s*-\s*(\d{4})/);

  if (match) {
    return {
      startYear: match[1],
      endYear: match[2],
    };
  }

  const year = String(new Date().getFullYear());
  return {
    startYear: year,
    endYear: year,
  };
}

function buildAdmissionDate(schoolYear) {
  const { startYear } = extractSchoolYearParts(schoolYear);
  return `${startYear}-08-01`;
}

function buildStudentNo(curriculum, schoolYearSuffix, index, usedStudentNos) {
  const program = normalizeProgramCode(curriculum?.program) || 'UNKNOWN';
  const curriculumYear = cleanString(curriculum?.curriculumYear) || '0000';
  const serial = String(index).padStart(2, '0');

  const base = `TEST-${program}-${schoolYearSuffix}-${serial}`;
  if (!usedStudentNos.has(base)) {
    usedStudentNos.add(base);
    return base;
  }

  const fallback = `TEST-${program}-${curriculumYear}-${schoolYearSuffix}-${serial}`;
  if (!usedStudentNos.has(fallback)) {
    usedStudentNos.add(fallback);
    return fallback;
  }

  let attempt = 2;
  while (true) {
    const candidate = `${fallback}-${attempt}`;
    if (!usedStudentNos.has(candidate)) {
      usedStudentNos.add(candidate);
      return candidate;
    }
    attempt += 1;
  }
}

function buildStudentName(studentIndex, programCode) {
  const serial = String(studentIndex).padStart(2, '0');
  return `Test Student ${serial} ${programCode}`;
}

function getRandomGender(studentIndex) {
  return studentIndex % 2 === 0 ? 'Female' : 'Male';
}

function flattenSubjects(curriculum) {
  const subjects = [];
  const structure = curriculum?.structure || {};

  const pushSubject = (yearLevel, semester, subject) => {
    const subjectCode = cleanString(subject?.code || subject?.subjectCode).toUpperCase();
    if (!subjectCode) return;

    subjects.push({
      yearLevel: cleanString(yearLevel || subject?.yearLevel),
      semester: cleanString(semester || subject?.semester),
      subjectCode,
      subjectTitle: cleanString(subject?.title || subject?.subjectTitle),
      units: Number(subject?.units || 0),
    });
  };

  if (Array.isArray(structure)) {
    for (const subject of structure) {
      pushSubject(subject?.yearLevel, subject?.semester, subject);
    }
    return subjects.sort(compareSubjects);
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

  return subjects.sort(compareSubjects);
}

function compareSubjects(a, b) {
  return (
    String(a.yearLevel || '').localeCompare(String(b.yearLevel || '')) ||
    String(a.semester || '').localeCompare(String(b.semester || '')) ||
    String(a.subjectCode || '').localeCompare(String(b.subjectCode || ''))
  );
}

function getRandomGrade() {
  const grades = [1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0];
  const value = grades[Math.floor(Math.random() * grades.length)];
  return value.toFixed(2);
}

function getRemarks(finalGrade) {
  const grade = Number(finalGrade);
  if (!Number.isFinite(grade)) return '';
  return grade <= 3.0 ? 'PASSED' : 'FAILED';
}

function createWorkbook(rows, sheetName) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  return workbook;
}

async function writeWorkbookAndCsv({ rows, xlsxPath, csvPath, sheetName }) {
  const workbook = createWorkbook(rows, sheetName);
  XLSX.writeFile(workbook, xlsxPath);

  const csvSheet = XLSX.utils.json_to_sheet(rows);
  const csvText = XLSX.utils.sheet_to_csv(csvSheet);
  await fs.writeFile(csvPath, `\ufeff${csvText}`, 'utf8');
}

async function main() {
  const limit = parsePositiveInteger(getArg('--limit', '10'), 10);
  const schoolYear = cleanString(getArg('--schoolYear', '2025-2026'));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.resolve(__dirname, 'output');

  const studentXlsx = path.join(outputDir, `test_students_import_${timestamp}.xlsx`);
  const studentCsv = path.join(outputDir, `test_students_import_${timestamp}.csv`);
  const gradeXlsx = path.join(outputDir, `test_grades_import_${timestamp}.xlsx`);
  const gradeCsv = path.join(outputDir, `test_grades_import_${timestamp}.csv`);

  await connectDatabases();

  const Curriculum = getCurriculumModel();
  const curricula = await Curriculum.find({})
    .sort({ program: 1, curriculumYear: 1 })
    .lean();

  if (!curricula.length) {
    throw new Error('No curricula found in the database.');
  }

  const { endYear } = extractSchoolYearParts(schoolYear);
  const usedStudentNos = new Set();
  const studentRows = [];
  const gradeRows = [];
  const issues = [];
  const studentPlans = [];

  for (const curriculum of curricula) {
    const programCode = normalizeProgramCode(curriculum?.program);
    const programName = cleanString(curriculum?.programName);
    const curriculumYear = cleanString(curriculum?.curriculumYear);

    if (!programCode || !curriculumYear) {
      issues.push({
        programCode: programCode || '',
        curriculumYear: curriculumYear || '',
        reason: 'Missing program code or curriculum year.',
      });
      continue;
    }

    const subjects = flattenSubjects(curriculum);

    const hasSubjects = subjects.length > 0;

    if (!hasSubjects) {
      issues.push({
        programCode,
        curriculumYear,
        reason: 'Curriculum has no subjects.',
      });
    }

    for (let i = 1; i <= limit; i += 1) {
      const studentNo = buildStudentNo(curriculum, endYear, i, usedStudentNos);
      const studentName = buildStudentName(i, programCode);
      const gender = getRandomGender(i);
      const dateAdmission = buildAdmissionDate(schoolYear);

      studentPlans.push({
        studentNo,
        studentName,
        programCode,
        programName,
        curriculumYear,
        gender,
        dateAdmission,
        subjects,
      });

      studentRows.push({
        StudentNo: studentNo,
        StudentName: studentName,
        ProgramCode: programCode,
        ProgramName: programName,
        CurriculumYear: curriculumYear,
        DegreeTitle: programName,
        Gender: gender,
        DateAdmission: dateAdmission,
        Graduated: 'No',
      });
    }
  }

  await fs.mkdir(outputDir, { recursive: true });

  await writeWorkbookAndCsv({
    rows: studentRows,
    xlsxPath: studentXlsx,
    csvPath: studentCsv,
    sheetName: 'students_import',
  });

  for (const plan of studentPlans) {
    for (const subject of plan.subjects) {
      const finalGrade = getRandomGrade();

      gradeRows.push({
        StudentNo: plan.studentNo,
        StudentName: plan.studentName,
        ProgramCode: plan.programCode,
        ProgramName: plan.programName,
        CurriculumYear: plan.curriculumYear,
        YearLevel: subject.yearLevel,
        Semester: subject.semester,
        SubjectCode: subject.subjectCode,
        SubjectTitle: subject.subjectTitle,
        Units: subject.units,
        FinalGrade: finalGrade,
        Remarks: getRemarks(finalGrade),
        SchoolYear: schoolYear,
        TermName: subject.semester,
      });
    }
  }

  await writeWorkbookAndCsv({
    rows: gradeRows,
    xlsxPath: gradeXlsx,
    csvPath: gradeCsv,
    sheetName: 'grades_import',
  });

  console.log('files generated successfully');
  console.log(`student rows count: ${studentRows.length}`);
  console.log(`grade rows count: ${gradeRows.length}`);
  console.log(`curricula checked: ${curricula.length}`);
  console.log(`issues count: ${issues.length}`);
  console.log(`student xlsx: ${studentXlsx}`);
  console.log(`student csv: ${studentCsv}`);
  console.log(`grade xlsx: ${gradeXlsx}`);
  console.log(`grade csv: ${gradeCsv}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
