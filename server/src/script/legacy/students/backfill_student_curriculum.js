import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDatabases } from '../../config/db.js';
import { getStudentModel } from '../../modules/students/model.js';
import { getCurriculumModel } from '../../modules/curriculum/model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function escapeRegex(value) {
  return cleanString(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function resolveCurriculum(student, Curriculum) {
  const explicitProgramCode = normalizeProgramCode(
    student.programCode || student.program || student.curriculumCode
  );

  const explicitCurriculumYear = cleanString(student.curriculumYear);
  const degreeTitle = cleanString(student.degreeTitle || student.programName);

  if (explicitProgramCode && explicitCurriculumYear) {
    const exact = await Curriculum.findOne({
      program: explicitProgramCode,
      curriculumYear: explicitCurriculumYear,
    }).lean();

    if (exact) {
      return { curriculum: exact, matchedBy: 'program + curriculumYear' };
    }
  }

  if (explicitProgramCode) {
    const byProgram = await Curriculum.findOne({
      program: explicitProgramCode,
    })
      .sort({ curriculumYear: -1, updatedAt: -1 })
      .lean();

    if (byProgram) {
      return { curriculum: byProgram, matchedBy: 'program' };
    }
  }

  if (degreeTitle) {
    const exactName = new RegExp(`^${escapeRegex(degreeTitle)}$`, 'i');
    const byName = await Curriculum.findOne({
      programName: exactName,
    })
      .sort({ curriculumYear: -1, updatedAt: -1 })
      .lean();

    if (byName) {
      return { curriculum: byName, matchedBy: 'programName exact' };
    }

    const looseName = new RegExp(escapeRegex(degreeTitle), 'i');
    const partial = await Curriculum.findOne({
      programName: looseName,
    })
      .sort({ curriculumYear: -1, updatedAt: -1 })
      .lean();

    if (partial) {
      return { curriculum: partial, matchedBy: 'programName partial' };
    }
  }

  return { curriculum: null, matchedBy: '' };
}

async function main() {
  await connectDatabases();

  const Student = getStudentModel();
  const Curriculum = getCurriculumModel();

  const students = await Student.find({
    $or: [
      { curriculumId: null },
      { curriculumId: { $exists: false } },
    ],
  }).lean();

  console.log(`Found ${students.length} students without curriculum.`);

  let matched = 0;
  let unmatched = 0;

  for (const student of students) {
    const { curriculum, matchedBy } = await resolveCurriculum(student, Curriculum);

    if (!curriculum) {
      unmatched += 1;
      console.log(
        `UNMATCHED | ${student.studentNo} | ${student.studentName} | ${student.programCode || student.degreeTitle || 'NO PROGRAM'}`
      );
      continue;
    }

    await Student.updateOne(
      { _id: student._id },
      {
        $set: {
          curriculumId: curriculum._id,
          curriculumYear: curriculum.curriculumYear || '',
          programCode: curriculum.program || student.programCode || '',
          programName: curriculum.programName || student.programName || '',
        },
      }
    );

    matched += 1;
    console.log(
      `MATCHED   | ${student.studentNo} | ${student.studentName} | ${curriculum.program} ${curriculum.curriculumYear} | ${matchedBy}`
    );
  }

  console.log('');
  console.log(`Matched: ${matched}`);
  console.log(`Unmatched: ${unmatched}`);
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