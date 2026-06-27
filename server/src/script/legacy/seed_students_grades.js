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

const WEB_USERS = [
  {
    username: 'mis.dev',
    fullName: 'MIS Developer',
    email: 'mis@bcvs.local',
    role: 'developer',
  },
  {
    username: 'registrar.head',
    fullName: 'Registrar Head',
    email: 'registrar@bcvs.local',
    role: 'super_admin',
  },
  {
    username: 'staff.admin',
    fullName: 'Staff Admin',
    email: 'admin@bcvs.local',
    role: 'admin',
  },
  {
    username: 'cashier.user',
    fullName: 'Cashier User',
    email: 'cashier@bcvs.local',
    role: 'cashier',
  },
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
  BTLE: 'Bachelor of Technology and Livelihood Education',
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
  const index = process.argv.findIndex((item) => item === flag);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function cleanString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim().replace(/\s+/g, ' ');
}

function normalizeProgramCode(value) {
  return cleanString(value).toUpperCase().replace(/\s+/g, '');
}

function normalizeSubjectCode(value) {
  return cleanString(value).toUpperCase();
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(cleanString(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseNonNegativeInteger(value, fallback) {
  const parsed = Number.parseInt(cleanString(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function toBooleanArg(value, fallback = false) {
  const normalized = cleanString(value).toLowerCase();
  if (!normalized) return fallback;
  return ['true', 'yes', 'y', '1', 'on'].includes(normalized);
}

function escapeRegex(value) {
  return cleanString(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function firstFourDigitYear(value, fallback = '2021') {
  const match = cleanString(value).match(/\d{4}/);
  return match ? match[0] : fallback;
}

function inferProgramFromFile(fileName) {
  return normalizeProgramCode(
    path.basename(fileName, '.json').replace(/_?Curriculum$/i, '')
  );
}

function normalizeUnits(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

      if (!Array.isArray(rawSubjects)) {
        throw new Error(`${sourceName}: ${yearLabel} / ${semesterLabel} must be an array.`);
      }

      structure[yearLabel][semesterLabel] = rawSubjects
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

  if (subjectCount === 0) {
    throw new Error(`${sourceName}: no subjects found.`);
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

function buildStudentNo(curriculumYear, serial) {
  const year = firstFourDigitYear(curriculumYear);
  return `C${year}${String(serial).padStart(5, '0')}`;
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

function makeDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

async function seedWebUsers(defaultPassword) {
  await ensureRoles();

  const User = getUserModel();
  const passwordHash = await bcrypt.hash(defaultPassword, Number(env.bcryptSaltRounds || 10));
  let created = 0;
  let skipped = 0;

  for (const item of WEB_USERS) {
    const email = item.email.toLowerCase();
    const existing = await User.findOne({ email });

    if (existing) {
      skipped += 1;
      continue;
    }

    await User.create({
      kind: 'web',
      role: item.role,
      username: item.username,
      fullName: item.fullName,
      email,
      password: passwordHash,
      isActive: true,
    });

    created += 1;
  }

  return { created, skipped };
}

async function seedCurricula(inputDir, curriculumYear) {
  const Curriculum = getCurriculumModel();
  const entries = (await fs.readdir(inputDir))
    .filter((file) => /_?Curriculum\.json$/i.test(file))
    .sort();

  if (!entries.length) {
    throw new Error(`No *_Curriculum.json files found in ${inputDir}`);
  }

  const rows = [];

  for (const file of entries) {
    const filePath = path.join(inputDir, file);
    const raw = JSON.parse(await fs.readFile(filePath, 'utf8'));
    const program = inferProgramFromFile(file);
    const programName = PROGRAM_NAMES[program] || program;
    const normalized = normalizeCurriculumStructure(raw, file);

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
          createdAt: new Date(),
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    rows.push(curriculum);
    console.log(`curriculum: ${program} ${curriculumYear} | subjects=${normalized.subjectCount} | units=${normalized.totalUnits}`);
  }

  return rows;
}

async function resetSeededStudents(Student, StudentGrade, curriculumYear) {
  const year = firstFourDigitYear(curriculumYear);
  const regex = new RegExp(`^C${escapeRegex(year)}\\d{5}$`);
  const students = await Student.find({ studentNo: regex }, { _id: 1 }).lean();
  const ids = students.map((student) => student._id);

  if (ids.length) {
    await StudentGrade.deleteMany({ student: { $in: ids } });
  }

  const deleted = await Student.deleteMany({ studentNo: regex });

  return {
    deletedStudents: deleted.deletedCount || 0,
    deletedGradesForStudents: ids.length,
  };
}

async function getNextAvailableSerial(Student, curriculumYear, requestedStartSerial) {
  const year = firstFourDigitYear(curriculumYear);
  const regex = new RegExp(`^C${escapeRegex(year)}\\d{5}$`);
  const rows = await Student.find({ studentNo: regex }, { studentNo: 1 }).lean();
  let max = 0;

  for (const row of rows) {
    const match = cleanString(row.studentNo).match(new RegExp(`^C${escapeRegex(year)}(\\d{5})$`));
    if (match) max = Math.max(max, Number.parseInt(match[1], 10));
  }

  return Math.max(requestedStartSerial, max + 1);
}

async function maybeCreateMobileUser(User, student, defaultPasswordHash) {
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
        password: defaultPasswordHash,
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
  const defaultPasswordHash = await bcrypt.hash(options.defaultPassword, Number(env.bcryptSaltRounds || 10));

  if (options.reset) {
    const resetSummary = await resetSeededStudents(Student, StudentGrade, options.curriculumYear);
    console.log('student reset:', resetSummary);
  }

  let serial = await getNextAvailableSerial(Student, options.curriculumYear, options.startSerial);
  let studentsSeeded = 0;
  let gradesSeeded = 0;
  let mobileUsersTouched = 0;

  for (const curriculum of curricula) {
    const subjects = flattenSubjects(curriculum);

    if (!subjects.length) {
      console.warn(`skip students for ${curriculum.program}: no subjects found`);
      continue;
    }

    for (let localIndex = 1; localIndex <= options.studentsPerCurriculum; localIndex += 1) {
      const studentNo = buildStudentNo(options.curriculumYear, serial);
      const globalIndex = serial;
      const failThisStudent = options.failEvery > 0 && globalIndex % options.failEvery === 0;
      const graduated = !failThisStudent;
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
            importedBy: null,
            updatedBy: null,
          },
          $setOnInsert: { createdAt: new Date() },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
        }
      );

      await StudentGrade.deleteMany({ student: student._id, curriculumId: curriculum._id });

      await StudentGrade.bulkWrite(
        subjects.map((subject, subjectIndex) => {
          const grade = getGrade(globalIndex, subjectIndex, failThisStudent, subjects.length);

          return {
            updateOne: {
              filter: {
                student: student._id,
                curriculumId: curriculum._id,
                yearLevel: subject.yearLevel,
                semester: subject.semester,
                subjectCode: subject.subjectCode,
              },
              update: {
                $set: {
                  student: student._id,
                  curriculumId: curriculum._id,
                  studentNo,
                  yearLevel: subject.yearLevel,
                  semester: subject.semester,
                  subjectCode: subject.subjectCode,
                  subjectTitle: subject.subjectTitle,
                  units: subject.units,
                  finalGrade: grade.finalGrade,
                  remarks: grade.remarks,
                  schoolYear: options.schoolYear,
                  termName: subject.semester,
                  importedBy: null,
                  updatedBy: null,
                },
                $setOnInsert: { createdAt: new Date() },
              },
              upsert: true,
            },
          };
        })
      );

      if (options.createMobileUsers) {
        await maybeCreateMobileUser(User, student, defaultPasswordHash);
        mobileUsersTouched += 1;
      }

      studentsSeeded += 1;
      gradesSeeded += subjects.length;
      serial += 1;
    }

    console.log(`students: ${curriculum.program} | count=${options.studentsPerCurriculum} | subjectsEach=${subjects.length}`);
  }

  return { studentsSeeded, gradesSeeded, mobileUsersTouched };
}

async function main() {
  const curriculumYear = cleanString(getArg('--curriculumYear', '2021'));
  const studentsPerCurriculum = parsePositiveInteger(
    getArg('--studentsPerCurriculum', getArg('--limit', '100')),
    100
  );
  const startSerial = parsePositiveInteger(getArg('--startSerial', '1'), 1);
  const schoolYear = cleanString(getArg('--schoolYear', '2025-2026'));
  const graduationYear = firstFourDigitYear(getArg('--graduationYear', String(Number(firstFourDigitYear(curriculumYear)) + 4)));
  const defaultPassword = cleanString(getArg('--password', process.env.SEED_DEFAULT_PASSWORD || 'ChangeMe123!'));
  const inputDir = path.resolve(getArg('--inputDir', path.join(__dirname, 'curricula', 'input')));
  const failEvery = parseNonNegativeInteger(getArg('--failEvery', '0'), 0);
  const reset = toBooleanArg(getArg('--reset', 'false'), false);
  const createMobileUsers = toBooleanArg(getArg('--mobileUsers', 'false'), false);
  const dateGraduated = makeDate(getArg('--dateGraduated', `${graduationYear}-06-30`));
  const dateGraduation = makeDate(getArg('--dateGraduation', `${graduationYear}-06-15`));

  if (!dateGraduated || !dateGraduation) {
    throw new Error('Invalid graduation dates. Use YYYY-MM-DD.');
  }

  await connectDatabases();

  const users = await seedWebUsers(defaultPassword);
  const curricula = await seedCurricula(inputDir, curriculumYear);
  const studentSummary = await seedStudentsAndGrades(curricula, {
    curriculumYear,
    studentsPerCurriculum,
    startSerial,
    schoolYear,
    defaultPassword,
    reset,
    failEvery,
    dateGraduated,
    dateGraduation,
    createMobileUsers,
  });

  console.log('\nSeed completed.');
  console.log(JSON.stringify({ users, curricula: curricula.length, ...studentSummary }, null, 2));
  console.log('\nDefault web login emails:');
  for (const user of WEB_USERS) console.log(`- ${user.email} / ${defaultPassword}`);

  if (createMobileUsers) {
    console.log(`\nMobile student accounts use password: ${defaultPassword}`);
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all(mongoose.connections.map((connection) => connection.close().catch(() => null)));
  });