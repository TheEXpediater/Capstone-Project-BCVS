import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

import { connectDatabases } from '../../config/db.js';
import { getCurriculumModel } from '../../modules/curriculum/model.js';
import { getStudentModel } from '../../modules/students/model.js';

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
  const code = cleanString(value).toUpperCase();

  const aliases = {
    BTLED: 'BTLE',
  };

  return aliases[code] || code;
}

function flattenSubjects(curriculum) {
  const subjects = [];

  for (const [yearLevel, semesterMap] of Object.entries(curriculum?.structure || {})) {
    for (const [semester, subjectList] of Object.entries(semesterMap || {})) {
      for (const subject of subjectList || []) {
        const subjectCode = cleanString(subject?.code).toUpperCase();
        if (!subjectCode) continue;

        subjects.push({
          yearLevel,
          semester,
          subjectCode,
          subjectTitle: cleanString(subject?.title),
          units: Number(subject?.units || 0),
        });
      }
    }
  }

  return subjects;
}

function getRandomGrade() {
  const grades = [1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0];
  return grades[Math.floor(Math.random() * grades.length)].toFixed(2);
}

function getRemarks(finalGrade) {
  const grade = Number(finalGrade);
  return grade <= 3.0 ? 'PASSED' : 'FAILED';
}

async function findStudentsForCurriculum(Student, curriculum, limit) {
  const programCode = normalizeProgramCode(curriculum.program);
  const curriculumYear = cleanString(curriculum.curriculumYear);

  return Student.find({
    $or: [
      { curriculumId: curriculum._id },
      { programCode, curriculumYear },
      { programCode },
    ],
  })
    .sort({ studentNo: 1 })
    .limit(limit)
    .lean();
}

async function main() {
  const limit = Number(getArg('--limit', '10'));
  const schoolYear = cleanString(getArg('--schoolYear', '2025-2026'));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  const outputDir = path.resolve(__dirname, 'output');
  const xlsxOutput = path.join(outputDir, `test_grade_import_${timestamp}.xlsx`);
  const csvOutput = path.join(outputDir, `test_grade_import_${timestamp}.csv`);

  await connectDatabases();

  const Curriculum = getCurriculumModel();
  const Student = getStudentModel();

  const curricula = await Curriculum.find({})
    .sort({ program: 1, curriculumYear: 1 })
    .lean();

  if (!curricula.length) {
    throw new Error('No curricula found in database.');
  }

  const gradeRows = [];
  const summaryRows = [];
  const issueRows = [];

  for (const curriculum of curricula) {
    const subjects = flattenSubjects(curriculum);

    if (!subjects.length) {
      issueRows.push({
        ProgramCode: curriculum.program,
        CurriculumYear: curriculum.curriculumYear,
        Reason: 'Curriculum has no subjects.',
      });
      continue;
    }

    const students = await findStudentsForCurriculum(Student, curriculum, limit);

    if (!students.length) {
      issueRows.push({
        ProgramCode: curriculum.program,
        CurriculumYear: curriculum.curriculumYear,
        Reason: 'No students found for this curriculum.',
      });
      continue;
    }

    for (const student of students) {
      for (const subject of subjects) {
        const finalGrade = getRandomGrade();

        gradeRows.push({
          StudentNo: student.studentNo,
          StudentName: student.studentName,
          ProgramCode: curriculum.program,
          ProgramName: curriculum.programName || student.programName || '',
          CurriculumYear: curriculum.curriculumYear || student.curriculumYear || '',
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

    summaryRows.push({
      ProgramCode: curriculum.program,
      ProgramName: curriculum.programName || '',
      CurriculumYear: curriculum.curriculumYear || '',
      StudentsUsed: students.length,
      SubjectsPerStudent: subjects.length,
      GradeRowsGenerated: students.length * subjects.length,
    });
  }

  await fs.mkdir(outputDir, { recursive: true });

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(gradeRows),
    'grade_import'
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(summaryRows),
    'summary'
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      issueRows.length ? issueRows : [{ Message: 'No issues found.' }]
    ),
    'issues'
  );

  XLSX.writeFile(workbook, xlsxOutput);

  const csvSheet = XLSX.utils.json_to_sheet(gradeRows);
  const csvText = XLSX.utils.sheet_to_csv(csvSheet);
  await fs.writeFile(csvOutput, csvText, 'utf8');

  console.log('Grade import files generated.');
  console.log(`XLSX: ${xlsxOutput}`);
  console.log(`CSV: ${csvOutput}`);
  console.log(`Rows: ${gradeRows.length}`);
  console.log(`Curricula checked: ${curricula.length}`);
  console.log(`Issues: ${issueRows.length}`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});