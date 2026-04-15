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

function normalizeKey(key) {
  return cleanString(key).replace(/\s+/g, '').toLowerCase();
}

function normalizeProgramCode(value) {
  const code = cleanString(value).toUpperCase();

  const aliases = {
    BTLED: 'BTLE',
  };

  return aliases[code] || code;
}

function normalizeDegreeTitle(value) {
  const title = cleanString(value);
  const upper = title.toUpperCase();

  const aliases = {
    'BACHELOR OF TECHNICAL AND LIVELIHOOD EDUCATION':
      'Bachelor of Technology and Livelihood Education',
    'BACHELOR OF TECHNOLOGY AND LIVELIHOOD EDUCATION':
      'Bachelor of Technology and Livelihood Education',
  };

  return aliases[upper] || title;
}

function normalizeStudentNo(value) {
  return cleanString(value).replace(/\s+/g, '');
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
  return Object.values(row || {}).some((value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    return true;
  });
}

function normalizeRows(rows) {
  return (rows || [])
    .filter(isMeaningfulRow)
    .map(normalizeRow)
    .filter(isMeaningfulRow);
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

function escapeRegex(value) {
  return cleanString(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseCurriculumYearValue(value) {
  const raw = cleanString(value);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : -1;
}

function compareCurriculumFreshness(a, b) {
  const yearDiff =
    parseCurriculumYearValue(b?.curriculumYear) -
    parseCurriculumYearValue(a?.curriculumYear);

  if (yearDiff !== 0) return yearDiff;

  const updatedA = new Date(a?.updatedAt || 0).getTime();
  const updatedB = new Date(b?.updatedAt || 0).getTime();
  return updatedB - updatedA;
}

function buildCurriculumCatalog(curricula) {
  const sorted = [...curricula].sort(compareCurriculumFreshness);

  const exactByProgramYear = new Map();
  const latestByProgram = new Map();

  for (const item of sorted) {
    const program = normalizeProgramCode(item.program);
    const year = cleanString(item.curriculumYear);

    if (program && year) {
      const key = `${program}::${year}`;
      if (!exactByProgramYear.has(key)) {
        exactByProgramYear.set(key, item);
      }
    }

    if (program && !latestByProgram.has(program)) {
      latestByProgram.set(program, item);
    }
  }

  return {
    sorted,
    exactByProgramYear,
    latestByProgram,
  };
}

function resolveCurriculumFromRow(row, catalog) {
  const programCode = normalizeProgramCode(
    row?.programcode ||
      row?.program ||
      row?.curriculumcode
  );

  const curriculumYear = cleanString(row?.curriculumyear);

  const degreeTitle = normalizeDegreeTitle(
    row?.degreetitle || row?.programname
  );

  if (programCode && curriculumYear) {
    const exact = catalog.exactByProgramYear.get(`${programCode}::${curriculumYear}`);
    if (exact) {
      return {
        curriculum: exact,
        matchedBy: 'program + curriculumYear',
      };
    }
  }

  if (programCode) {
    const latest = catalog.latestByProgram.get(programCode);
    if (latest) {
      return {
        curriculum: latest,
        matchedBy: 'program',
      };
    }
  }

  if (!programCode && degreeTitle === 'Bachelor of Technology and Livelihood Education') {
    const btle = catalog.latestByProgram.get('BTLE');
    if (btle) {
      return {
        curriculum: btle,
        matchedBy: 'degreeTitle alias -> BTLE',
      };
    }
  }

  if (degreeTitle) {
    const exactName = new RegExp(`^${escapeRegex(degreeTitle)}$`, 'i');
    const exact = catalog.sorted.find((item) => exactName.test(item.programName || ''));
    if (exact) {
      return {
        curriculum: exact,
        matchedBy: 'programName exact',
      };
    }

    const looseName = new RegExp(escapeRegex(degreeTitle), 'i');
    const partial = catalog.sorted.find((item) => looseName.test(item.programName || ''));
    if (partial) {
      return {
        curriculum: partial,
        matchedBy: 'programName partial',
      };
    }
  }

  return {
    curriculum: null,
    matchedBy: '',
  };
}

function flattenSubjects(curriculum) {
  const rows = [];

  for (const [yearLevel, semesterMap] of Object.entries(curriculum?.structure || {})) {
    for (const [semester, subjects] of Object.entries(semesterMap || {})) {
      for (const subject of subjects || []) {
        const subjectCode = cleanString(subject?.code);
        if (!subjectCode) continue;

        rows.push({
          yearLevel,
          semester,
          subjectCode,
          subjectTitle: cleanString(subject?.title),
          units: Number(subject?.units || 0),
        });
      }
    }
  }

  return rows;
}

function getRandomGrade() {
  const grades = [1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0];
  const value = grades[Math.floor(Math.random() * grades.length)];
  return value.toFixed(2);
}

function buildRemark(finalGrade) {
  const grade = Number(finalGrade);
  if (!Number.isFinite(grade)) return '';
  return grade <= 3.0 ? 'PASSED' : 'FAILED';
}

async function main() {
  const defaultInput = path.resolve(__dirname, 'input', 'students_for_grade_template.xlsx');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const defaultOutput = path.resolve(__dirname, 'output', `grade_import_template_${timestamp}.xlsx`);

  const inputPath = path.resolve(getArg('--input', defaultInput));
  const outputPath = path.resolve(getArg('--output', defaultOutput));

  const mode = cleanString(getArg('--mode', 'random')).toLowerCase();
  const randomizeGrades = mode === 'random';

  const fileBuffer = await fs.readFile(inputPath);
  const workbookInput = XLSX.read(fileBuffer, {
    type: 'buffer',
    cellDates: true,
  });

  const firstSheetName = workbookInput.SheetNames[0];

  if (!firstSheetName) {
    throw new Error('Input workbook has no sheets.');
  }

  const firstSheet = workbookInput.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json(firstSheet, {
    defval: '',
    raw: false,
  });

  const rows = normalizeRows(rawRows);

  if (!rows.length) {
    throw new Error('Input workbook has no usable rows.');
  }

  await connectDatabases();

  const Curriculum = getCurriculumModel();
  const curricula = await Curriculum.find({}).lean();

  if (!curricula.length) {
    throw new Error('No curricula found. Create/import curricula first.');
  }

  const catalog = buildCurriculumCatalog(curricula);
  const gradeImportRows = [];
  const unmatchedRows = [];
  const summaryRows = [];

  for (const row of rows) {
    const studentNo = normalizeStudentNo(row?.studentno || row?.studentnumber);
    const studentName = buildStudentName(row);
    const inputProgram = normalizeProgramCode(row?.programcode || row?.program);
    const inputCurriculumYear = cleanString(row?.curriculumyear);
    const degreeTitle = normalizeDegreeTitle(row?.degreetitle || row?.programname);
    const schoolYear = cleanString(row?.schoolyear);
    const termName = cleanString(row?.termname);

    if (!studentNo) {
      unmatchedRows.push({
        StudentNo: '',
        StudentName: studentName,
        ProgramCode: inputProgram,
        CurriculumYear: inputCurriculumYear,
        DegreeTitle: degreeTitle,
        Reason: 'Missing StudentNo',
      });
      continue;
    }

    const { curriculum, matchedBy } = resolveCurriculumFromRow(row, catalog);

    if (!curriculum) {
      unmatchedRows.push({
        StudentNo: studentNo,
        StudentName: studentName,
        ProgramCode: inputProgram,
        CurriculumYear: inputCurriculumYear,
        DegreeTitle: degreeTitle,
        Reason: 'No matching curriculum found',
      });
      continue;
    }

    const subjects = flattenSubjects(curriculum);

    if (!subjects.length) {
      unmatchedRows.push({
        StudentNo: studentNo,
        StudentName: studentName,
        ProgramCode: curriculum.program,
        CurriculumYear: curriculum.curriculumYear,
        DegreeTitle: curriculum.programName,
        Reason: 'Matched curriculum has no subjects',
      });
      continue;
    }

    for (const subject of subjects) {
      const finalGrade = randomizeGrades ? getRandomGrade() : '';
      const remarks = finalGrade ? buildRemark(finalGrade) : '';

      gradeImportRows.push({
        StudentNo: studentNo,
        StudentName: studentName,
        ProgramCode: curriculum.program,
        ProgramName: curriculum.programName || '',
        CurriculumYear: curriculum.curriculumYear || '',
        YearLevel: subject.yearLevel,
        Semester: subject.semester,
        SubjectCode: subject.subjectCode,
        SubjectTitle: subject.subjectTitle,
        Units: subject.units,
        FinalGrade: finalGrade,
        Remarks: remarks,
        SchoolYear: schoolYear || '2025-2026',
        TermName: termName || subject.semester,
      });
    }

    summaryRows.push({
      StudentNo: studentNo,
      StudentName: studentName,
      ProgramCode: curriculum.program,
      CurriculumYear: curriculum.curriculumYear || '',
      MatchedBy: matchedBy,
      SubjectRowsGenerated: subjects.length,
    });
  }

  const workbookOutput = XLSX.utils.book_new();

  const gradeSheet =
    gradeImportRows.length > 0
      ? XLSX.utils.json_to_sheet(gradeImportRows)
      : XLSX.utils.json_to_sheet([
          {
            StudentNo: '',
            StudentName: '',
            ProgramCode: '',
            ProgramName: '',
            CurriculumYear: '',
            YearLevel: '',
            Semester: '',
            SubjectCode: '',
            SubjectTitle: '',
            Units: '',
            FinalGrade: '',
            Remarks: '',
            SchoolYear: '',
            TermName: '',
          },
        ]);

  const unmatchedSheet =
    unmatchedRows.length > 0
      ? XLSX.utils.json_to_sheet(unmatchedRows)
      : XLSX.utils.json_to_sheet([{ Message: 'All rows matched successfully.' }]);

  const summarySheet =
    summaryRows.length > 0
      ? XLSX.utils.json_to_sheet(summaryRows)
      : XLSX.utils.json_to_sheet([{ Message: 'No summary rows generated.' }]);

  XLSX.utils.book_append_sheet(workbookOutput, gradeSheet, 'grade_import');
  XLSX.utils.book_append_sheet(workbookOutput, unmatchedSheet, 'unmatched_students');
  XLSX.utils.book_append_sheet(workbookOutput, summarySheet, 'summary');

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  XLSX.writeFile(workbookOutput, outputPath);

  console.log('Grade import template generated successfully.');
  console.log(`Input: ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Students processed: ${rows.length}`);
  console.log(`Grade rows generated: ${gradeImportRows.length}`);
  console.log(`Unmatched rows: ${unmatchedRows.length}`);
  console.log(`Mode: ${randomizeGrades ? 'random' : 'blank'}`);
}

main()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });