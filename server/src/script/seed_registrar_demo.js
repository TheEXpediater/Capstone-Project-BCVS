import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import { connectDatabases } from '../config/db.js';
import { env } from '../config/env.js';
import { ensureRoles } from '../modules/auth/service.js';
import { getUserModel } from '../modules/auth/user.model.js';
import { getCurriculumModel } from '../modules/curriculum/model.js';
import { getStudentGradeModel, getStudentModel } from '../modules/students/model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SEED_SOURCE = 'registrar-demo-seed';

const WEB_USERS = [
  ['mis.dev', 'MIS Developer', 'mis@bcvs.local', 'developer'],
  ['registrar.head', 'Registrar Head', 'registrar@bcvs.local', 'super_admin'],
  ['staff.admin', 'Staff Admin', 'admin@bcvs.local', 'admin'],
  ['cashier.user', 'Cashier User', 'cashier@bcvs.local', 'cashier'],
];

const PROGRAM_NAMES = {
  DVM: 'Doctor of Veterinary Medicine',
  BSIT: 'Bachelor of Science in Information Technology',
  BSABE: 'Bachelor of Science in Agricultural and Biosystems Engineering',
  BSCE: 'Bachelor of Science in Civil Engineering',
  BSCPE: 'Bachelor of Science in Computer Engineering',
  BSED: 'Bachelor of Secondary Education',
  BSGE: 'Bachelor of Science in Geodetic Engineering',
  BTLED: 'Bachelor of Technology and Livelihood Education',
};

const FIRST_NAMES = [
  'Maria Angelica',
  'John Mark',
  'Kristine Joy',
  'Joshua',
  'Nicole',
  'Miguel Angelo',
  'Rica Mae',
  'Rafael',
  'Jessa',
  'Carlo',
  'Alyssa',
  'Paolo',
  'Mariel',
  'Francis',
  'Kathleen',
  'Daniel',
];

const MIDDLE_NAMES = [
  'Santos',
  'Reyes',
  'Cruz',
  'Garcia',
  'Mendoza',
  'Flores',
  'Bautista',
  'Pineda',
];

const LAST_NAMES = [
  'Dela Cruz',
  'Garcia',
  'Mendoza',
  'Reyes',
  'Santos',
  'Cruz',
  'Torres',
  'Flores',
  'Gonzales',
  'Bautista',
  'Aquino',
  'Castro',
  'Pineda',
  'David',
  'Ocampo',
  'Rivera',
];

const PASSING_GRADES = ['1.00', '1.25', '1.50', '1.75', '2.00', '2.25', '2.50', '2.75', '3.00'];

function getArg(flag, fallback = '') {
  const exactIndex = process.argv.findIndex((item) => item === flag);
  if (exactIndex !== -1) return process.argv[exactIndex + 1] || fallback;

  const prefix = `${flag}=`;
  const item = process.argv.find((value) => value.startsWith(prefix));
  return item ? item.slice(prefix.length) : fallback;
}

function cleanString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim().replace(/\s+/g, ' ');
}

function toBooleanArg(value, fallback = false) {
  const normalized = cleanString(value).toLowerCase();
  if (!normalized) return fallback;
  return ['true', '1', 'yes', 'y', 'on'].includes(normalized);
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(cleanString(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInteger(value, fallback) {
  const parsed = Number.parseInt(cleanString(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function firstFourDigitYear(value, fallback = '2021') {
  const match = cleanString(value).match(/\d{4}/);
  return match ? match[0] : fallback;
}

function normalizeProgramCode(value) {
  const normalized = cleanString(value).toUpperCase().replace(/\s+/g, '');
  return normalized === 'BSCPE' ? 'BSCPE' : normalized;
}

function inferProgramFromFile(fileName) {
  return normalizeProgramCode(path.basename(fileName, '.json').replace(/_?Curriculum$/i, ''));
}

function normalizeSubjectCode(value) {
  return cleanString(value).toUpperCase();
}

function normalizeUnits(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function makeDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildStudentNo(curriculumYear, serial) {
  return `C${firstFourDigitYear(curriculumYear)}${String(serial).padStart(5, '0')}`;
}

function buildStudentName(index) {
  const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
  const middleName = MIDDLE_NAMES[(index + 3) % MIDDLE_NAMES.length];
  const lastName = LAST_NAMES[(index + 5) % LAST_NAMES.length];
  return `${lastName}, ${firstName} ${middleName}`;
}

function buildAddress(index) {
  const barangays = ['Dolores', 'San Agustin', 'Sindalan', 'Pampang', 'Cutcut', 'Dau', 'San Nicolas', 'San Miguel'];
  const cities = ['City of San Fernando', 'Angeles City', 'Mabalacat City', 'Mexico', 'Guagua'];
  const houseNo = 100 + ((index * 17) % 800);
  return `${houseNo} Sample Street, Barangay ${barangays[index % barangays.length]}, ${cities[index % cities.length]}, Pampanga`;
}

function getGrade(globalIndex, subjectIndex, failThisStudent, subjectCount) {
  if (failThisStudent && subjectIndex === subjectCount - 1) {
    return { finalGrade: '5.00', remarks: 'FAILED' };
  }

  return {
    finalGrade: PASSING_GRADES[(globalIndex + subjectIndex) % PASSING_GRADES.length],
    remarks: 'PASSED',
  };
}

function normalizeCurriculumStructure(rawStructure, sourceName) {
  if (!rawStructure || typeof rawStructure !== 'object' || Array.isArray(rawStructure)) {
    throw new Error(`${sourceName}: curriculum structure must be an object.`);
  }

  const structure = {};
  let subjectCount = 0;
  let totalUnits = 0;

  for (const [rawYearLabel, rawSemesters] of Object.entries(rawStructure)) {
    const yearLabel = cleanString(rawYearLabel);
    if (!yearLabel) continue;

    if (!rawSemesters || typeof rawSemesters !== 'object' || Array.isArray(rawSemesters)) {
      throw new Error(`${sourceName}: year ${yearLabel} must contain semester objects.`);
    }

    structure[yearLabel] = {};

    for (const [rawSemesterLabel, rawSubjects] of Object.entries(rawSemesters)) {
      const semesterLabel = cleanString(rawSemesterLabel);
      if (!semesterLabel) continue;

      const subjectList = Array.isArray(rawSubjects)
        ? rawSubjects
        : Array.isArray(rawSubjects?.subjects)
          ? rawSubjects.subjects
          : [];

      if (!Array.isArray(subjectList)) {
        throw new Error(`${sourceName}: ${yearLabel} / ${semesterLabel} must be an array.`);
      }

      structure[yearLabel][semesterLabel] = subjectList
        .map((subject) => {
          const code = cleanString(subject?.code || subject?.subjectCode);
          const title = cleanString(subject?.title || subject?.subjectTitle);
          const prerequisite = cleanString(subject?.prerequisite);
          const units = normalizeUnits(subject?.units);

          if (!code && !title && units === 0 && !prerequisite) return null;
          if (!code) {
            throw new Error(`${sourceName}: subject code is required in ${yearLabel} / ${semesterLabel}.`);
          }

          subjectCount += 1;
          totalUnits += units;

          return {
            code,
            title,
            units,
            ...(prerequisite ? { prerequisite } : {}),
          };
        })
        .filter(Boolean);
    }
  }

  return { structure, subjectCount, totalUnits };
}

function flattenSubjects(curriculum) {
  const subjects = [];

  for (const [yearLevel, semesters] of Object.entries(curriculum?.structure || {})) {
    for (const [semester, subjectList] of Object.entries(semesters || {})) {
      for (const subject of subjectList || []) {
        const subjectCode = normalizeSubjectCode(subject?.code || subject?.subjectCode);
        if (!subjectCode) continue;

        subjects.push({
          yearLevel,
          semester,
          subjectCode,
          subjectTitle: cleanString(subject?.title || subject?.subjectTitle),
          units: normalizeUnits(subject?.units),
        });
      }
    }
  }

  return subjects.sort((a, b) => (
    String(a.yearLevel).localeCompare(String(b.yearLevel)) ||
    String(a.semester).localeCompare(String(b.semester)) ||
    String(a.subjectCode).localeCompare(String(b.subjectCode))
  ));
}

async function seedWebUsers(defaultPassword) {
  await ensureRoles();

  const User = getUserModel();
  const passwordHash = await bcrypt.hash(defaultPassword, Number(env.bcryptSaltRounds || 10));
  let created = 0;
  let skipped = 0;

  for (const [username, fullName, rawEmail, role] of WEB_USERS) {
    const email = rawEmail.toLowerCase();
    const existing = await User.findOne({ email });

    if (existing) {
      skipped += 1;
      continue;
    }

    await User.create({
      kind: 'web',
      role,
      username,
      fullName,
      email,
      password: passwordHash,
      isActive: true,
    });

    created += 1;
  }

  return { created, skipped, total: WEB_USERS.length };
}

async function seedCurricula(inputDir, curriculumYear) {
  await fs.mkdir(inputDir, { recursive: true });

  const Curriculum = getCurriculumModel();
  const entries = (await fs.readdir(inputDir))
    .filter((file) => /_?Curriculum\.json$/i.test(file))
    .sort();

  if (!entries.length) {
    throw new Error(`No *_Curriculum.json files found in ${inputDir}. Place the default curriculum JSON files there and rerun the seed.`);
  }

  const curricula = [];
  const skipped = [];

  for (const file of entries) {
    const filePath = path.join(inputDir, file);
    const raw = JSON.parse(await fs.readFile(filePath, 'utf8'));
    const program = inferProgramFromFile(file);
    const programName = PROGRAM_NAMES[program] || program;
    const normalized = normalizeCurriculumStructure(raw, file);

    if (normalized.subjectCount === 0) {
      skipped.push({ file, reason: 'No subjects found.' });
      console.warn(`Skipping empty curriculum ${file}: no subjects found.`);
      continue;
    }

    const curriculum = await Curriculum.findOneAndUpdate(
      { program, curriculumYear },
      {
        $set: {
          program,
          programName,
          curriculumYear,
          structure: normalized.structure,
          subjectCount: normalized.subjectCount,
          totalUnits: normalized.totalUnits,
          updatedBy: null,
        },
        $setOnInsert: {
          createdBy: null,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    curricula.push(curriculum);
  }

  return { curricula, skipped };
}

async function resetSeededStudents(Student, StudentGrade, curriculumYear) {
  const filter = {
    'seedMeta.source': SEED_SOURCE,
    'seedMeta.curriculumYear': firstFourDigitYear(curriculumYear),
  };

  const gradeResult = await StudentGrade.deleteMany(filter);
  const studentResult = await Student.deleteMany(filter);

  return {
    deletedStudents: studentResult.deletedCount || 0,
    deletedGradeRows: gradeResult.deletedCount || 0,
  };
}

function isSameSeed(existing, curriculumYear) {
  return (
    existing?.seedMeta?.source === SEED_SOURCE &&
    existing?.seedMeta?.curriculumYear === firstFourDigitYear(curriculumYear)
  );
}

async function findWritableStudentSlot(Student, curriculumYear, startingSerial) {
  let serial = startingSerial;

  while (serial < 100000) {
    const studentNo = buildStudentNo(curriculumYear, serial);
    const existing = await Student.findOne({ studentNo });

    if (!existing || isSameSeed(existing, curriculumYear)) {
      return { studentNo, serial, existing };
    }

    serial += 1;
  }

  throw new Error(`No available C${firstFourDigitYear(curriculumYear)}##### student numbers remain.`);
}

async function maybeCreateMobileUser(User, student, passwordHash) {
  const studentNo = cleanString(student.studentNo);
  const email = `${studentNo.toLowerCase()}@student.bcvs.local`;

  await User.findOneAndUpdate(
    { email },
    {
      $set: {
        kind: 'mobile',
        role: 'student',
        username: studentNo.toLowerCase(),
        fullName: student.studentName,
        email,
        password: passwordHash,
        studentId: studentNo,
        verified: 'verified',
        verifiedAt: new Date(),
        isActive: true,
      },
    },
    {
      upsert: true,
      runValidators: true,
    }
  );
}

async function seedStudentsAndGrades(curricula, options) {
  const Student = getStudentModel();
  const StudentGrade = getStudentGradeModel();
  const User = getUserModel();
  const generatedAt = new Date();
  const seedMeta = {
    source: SEED_SOURCE,
    curriculumYear: firstFourDigitYear(options.curriculumYear),
    generatedAt,
  };

  if (options.reset) {
    const resetSummary = await resetSeededStudents(Student, StudentGrade, options.curriculumYear);
    console.log(`Seed reset deleted ${resetSummary.deletedStudents} seeded students and ${resetSummary.deletedGradeRows} seeded grade rows.`);
  }

  const existingStudentCount = await Student.countDocuments();
  if (existingStudentCount > 0 && !options.force && !options.reset) {
    console.log('Students already exist. Skipping student/grade seed. Use --force true or --reset true to override.');
    return {
      studentsSeeded: 0,
      gradeRowsSeeded: 0,
      mobileUsersTouched: 0,
      firstStudentNo: '',
      lastStudentNo: '',
      skippedBecauseStudentsExist: true,
    };
  }

  const defaultPasswordHash = await bcrypt.hash(options.defaultPassword, Number(env.bcryptSaltRounds || 10));
  let serial = options.startSerial;
  let studentsSeeded = 0;
  let gradeRowsSeeded = 0;
  let mobileUsersTouched = 0;
  let firstStudentNo = '';
  let lastStudentNo = '';

  for (const curriculum of curricula) {
    const subjects = flattenSubjects(curriculum);

    if (!subjects.length) {
      console.warn(`Skipping students for ${curriculum.program}: no subjects found.`);
      continue;
    }

    for (let localIndex = 1; localIndex <= options.studentsPerProgram; localIndex += 1) {
      const slot = await findWritableStudentSlot(Student, options.curriculumYear, serial);
      const globalIndex = slot.serial;
      const studentNo = slot.studentNo;
      const failThisStudent = options.failEvery > 0 && globalIndex % options.failEvery === 0;
      const gradePlans = subjects.map((subject, subjectIndex) => ({
        ...subject,
        ...getGrade(globalIndex, subjectIndex, failThisStudent, subjects.length),
        schoolYear: options.schoolYear,
        termName: subject.semester,
      }));
      const graduated = gradePlans.every((grade) => Number(grade.finalGrade) <= 3);
      const address = buildAddress(globalIndex);

      const student = await Student.findOneAndUpdate(
        { studentNo },
        {
          $set: {
            studentNo,
            studentName: buildStudentName(globalIndex),
            extensionName: '',
            gender: globalIndex % 2 === 0 ? 'Female' : 'Male',
            permanentAddress: address,
            residentialAddress: address,
            entranceCredentials: 'SF10 / Form 138',
            highSchool: 'Sample National High School',
            degreeTitle: curriculum.programName || '',
            major: '',
            dateAdmission: makeDate(`${firstFourDigitYear(options.curriculumYear)}-08-01`),
            placeBirth: 'Pampanga, Philippines',
            dateGraduated: graduated ? options.dateGraduated : null,
            dateGraduation: graduated ? options.dateGraduation : null,
            graduated,
            programCode: curriculum.program,
            programName: curriculum.programName || '',
            curriculumId: curriculum._id,
            curriculumYear: curriculum.curriculumYear,
            seedMeta,
            importedBy: null,
            updatedBy: null,
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
        }
      );

      await StudentGrade.deleteMany({
        student: student._id,
        curriculumId: curriculum._id,
        'seedMeta.source': SEED_SOURCE,
        'seedMeta.curriculumYear': seedMeta.curriculumYear,
      });

      if (gradePlans.length) {
        await StudentGrade.bulkWrite(
          gradePlans.map((grade) => ({
            updateOne: {
              filter: {
                student: student._id,
                curriculumId: curriculum._id,
                yearLevel: grade.yearLevel,
                semester: grade.semester,
                subjectCode: grade.subjectCode,
              },
              update: {
                $set: {
                  student: student._id,
                  curriculumId: curriculum._id,
                  studentNo,
                  yearLevel: grade.yearLevel,
                  semester: grade.semester,
                  subjectCode: grade.subjectCode,
                  subjectTitle: grade.subjectTitle,
                  units: grade.units,
                  finalGrade: grade.finalGrade,
                  remarks: grade.remarks,
                  schoolYear: grade.schoolYear,
                  termName: grade.termName,
                  seedMeta,
                  importedBy: null,
                  updatedBy: null,
                },
              },
              upsert: true,
            },
          }))
        );
      }

      if (options.createMobileUsers) {
        await maybeCreateMobileUser(User, student, defaultPasswordHash);
        mobileUsersTouched += 1;
      }

      studentsSeeded += 1;
      gradeRowsSeeded += gradePlans.length;
      firstStudentNo ||= studentNo;
      lastStudentNo = studentNo;
      serial = slot.serial + 1;
    }
  }

  return {
    studentsSeeded,
    gradeRowsSeeded,
    mobileUsersTouched,
    firstStudentNo,
    lastStudentNo,
    skippedBecauseStudentsExist: false,
  };
}

async function main() {
  const curriculumYear = cleanString(getArg('--curriculumYear', '2021'));
  const studentsPerProgram = parsePositiveInteger(
    getArg('--studentsPerProgram', getArg('--studentsPerCurriculum', '100')),
    100
  );
  const startSerial = parsePositiveInteger(getArg('--startSerial', '1'), 1);
  const schoolYear = cleanString(getArg('--schoolYear', '2025-2026'));
  const defaultPassword = cleanString(getArg('--password', process.env.SEED_DEFAULT_PASSWORD || 'ChangeMe123!'));
  const reset = toBooleanArg(getArg('--reset', 'false'), false);
  const force = toBooleanArg(getArg('--force', 'false'), false);
  const createMobileUsers = toBooleanArg(getArg('--mobileUsers', 'false'), false);
  const failEvery = parseNonNegativeInteger(getArg('--failEvery', '0'), 0);
  const inputDir = path.resolve(getArg('--inputDir', path.join(__dirname, 'curricula', 'input')));
  const graduationYear = String(Number(firstFourDigitYear(curriculumYear)) + 4);
  const dateGraduated = makeDate(getArg('--dateGraduated', `${graduationYear}-06-30`));
  const dateGraduation = makeDate(getArg('--dateGraduation', `${graduationYear}-06-15`));

  if (!dateGraduated || !dateGraduation) {
    throw new Error('Invalid graduation dates. Use YYYY-MM-DD.');
  }

  await connectDatabases();

  const users = await seedWebUsers(defaultPassword);
  const curricula = await seedCurricula(inputDir, curriculumYear);
  const studentSummary = await seedStudentsAndGrades(curricula.curricula, {
    curriculumYear,
    studentsPerProgram,
    startSerial,
    schoolYear,
    defaultPassword,
    reset,
    force,
    createMobileUsers,
    failEvery,
    dateGraduated,
    dateGraduation,
  });

  console.log('\nBCVS registrar seed completed.');
  console.log(`Web users created/skipped: ${users.created}/${users.skipped}`);
  console.log(`Curricula imported/upserted: ${curricula.curricula.length}`);
  if (curricula.skipped.length) {
    console.log(`Curricula skipped: ${curricula.skipped.length}`);
  }
  console.log(`Students seeded: ${studentSummary.studentsSeeded}`);
  console.log(`Grade rows seeded: ${studentSummary.gradeRowsSeeded}`);
  console.log(`First student number: ${studentSummary.firstStudentNo || 'N/A'}`);
  console.log(`Last student number: ${studentSummary.lastStudentNo || 'N/A'}`);
  if (createMobileUsers) {
    console.log(`Mobile users created/updated: ${studentSummary.mobileUsersTouched}`);
  }
  console.log('\nDefault web users:');
  for (const [, , email, role] of WEB_USERS) {
    console.log(`- ${email} / ${defaultPassword} / ${role}`);
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all(mongoose.connections.map((connection) => connection.close().catch(() => null)));
  });
