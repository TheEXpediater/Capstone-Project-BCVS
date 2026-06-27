import mongoose from 'mongoose';
import { connectDatabases } from '../../config/db.js';
import { getCurriculumModel } from '../../modules/curriculum/model.js';
import { getStudentGradeModel, getStudentModel } from '../../modules/students/model.js';

function getArg(flag, fallback = '') {
  const index = process.argv.findIndex((item) => item === flag);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function cleanString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
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

function normalizeProgramCode(value) {
  return cleanString(value).toUpperCase().replace(/\s+/g, '');
}

function normalizeSubjectCode(value) {
  return cleanString(value).toUpperCase();
}

function escapeRegex(value) {
  return cleanString(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildGradeCompletionKey({ yearLevel, semester, subjectCode }) {
  return [
    cleanString(yearLevel).toLowerCase(),
    cleanString(semester).toLowerCase(),
    normalizeSubjectCode(subjectCode),
  ].join('::');
}

function compareSubjects(a, b) {
  return (
    String(a.yearLevel || '').localeCompare(String(b.yearLevel || '')) ||
    String(a.semester || '').localeCompare(String(b.semester || '')) ||
    String(a.subjectCode || '').localeCompare(String(b.subjectCode || ''))
  );
}

function flattenSubjects(curriculum) {
  const subjects = [];
  const structure = curriculum?.structure || {};

  const pushSubject = (yearLevel, semester, subject) => {
    const subjectCode = normalizeSubjectCode(subject?.code || subject?.subjectCode);
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

const LAST_NAMES = [
  'Santos',
  'Reyes',
  'Cruz',
  'Dela Cruz',
  'Garcia',
  'Mendoza',
  'Ramos',
  'Torres',
  'Flores',
  'Gonzales',
  'Bautista',
  'Aquino',
  'Castro',
  'Pineda',
  'Manaloto',
  'Lacson',
  'Henson',
  'David',
  'Macapagal',
  'Mallari',
  'Ocampo',
  'Pangilinan',
  'De Leon',
  'Santiago',
  'Tolentino',
  'Mercado',
  'Navarro',
  'Salvador',
  'Valdez',
  'Rivera',
];

const MALE_FIRST_NAMES = [
  'Juan Miguel',
  'Jose Gabriel',
  'John Mark',
  'Angelo',
  'Joshua',
  'Christian',
  'Jomari',
  'Mark Anthony',
  'Rafael',
  'Paolo',
  'Jerome',
  'Carlo',
  'Francis',
  'Kyle Adrian',
  'Arvin',
  'Jayson',
  'Miguel Angelo',
  'Ronald',
  'Vincent',
  'Daniel',
];

const FEMALE_FIRST_NAMES = [
  'Maria Angelica',
  'Mary Grace',
  'Kristine Joy',
  'Jasmine',
  'Princess Mae',
  'Angela',
  'Nicole',
  'Rica Mae',
  'Jessa',
  'Alyssa',
  'Mariel',
  'Kathleen',
  'Dianne',
  'Rochelle',
  'Catherine',
  'Mikaela',
  'Patricia Mae',
  'Joanna Marie',
  'Clarisse',
  'Andrea',
];

const MIDDLE_NAMES = [
  'Santos',
  'Reyes',
  'Cruz',
  'Garcia',
  'Mendoza',
  'Flores',
  'Gonzales',
  'Bautista',
  'Pineda',
  'David',
  'Ocampo',
  'Pangilinan',
  'Torres',
  'Castro',
];

const EXTENSION_NAMES = ['', '', '', '', '', '', '', 'Jr.', 'III'];

const PAMPANGA_PLACES = [
  { barangay: 'Dolores', city: 'City of San Fernando', province: 'Pampanga' },
  { barangay: 'San Agustin', city: 'City of San Fernando', province: 'Pampanga' },
  { barangay: 'Sindalan', city: 'City of San Fernando', province: 'Pampanga' },
  { barangay: 'Pampang', city: 'Angeles City', province: 'Pampanga' },
  { barangay: 'Cutcut', city: 'Angeles City', province: 'Pampanga' },
  { barangay: 'Lourdes Sur East', city: 'Angeles City', province: 'Pampanga' },
  { barangay: 'Dau', city: 'Mabalacat City', province: 'Pampanga' },
  { barangay: 'Mabiga', city: 'Mabalacat City', province: 'Pampanga' },
  { barangay: 'San Nicolas', city: 'Mexico', province: 'Pampanga' },
  { barangay: 'San Jose Matulid', city: 'Mexico', province: 'Pampanga' },
  { barangay: 'San Miguel', city: 'Guagua', province: 'Pampanga' },
  { barangay: 'Betis', city: 'Guagua', province: 'Pampanga' },
  { barangay: 'Santa Cruz', city: 'Lubao', province: 'Pampanga' },
  { barangay: 'San Roque Arbol', city: 'Lubao', province: 'Pampanga' },
  { barangay: 'Poblacion', city: 'Porac', province: 'Pampanga' },
  { barangay: 'San Isidro', city: 'Bacolor', province: 'Pampanga' },
  { barangay: 'San Vicente', city: 'Apalit', province: 'Pampanga' },
  { barangay: 'San Juan', city: 'Macabebe', province: 'Pampanga' },
  { barangay: 'Caduang Tete', city: 'Macabebe', province: 'Pampanga' },
  { barangay: 'San Pedro', city: 'Magalang', province: 'Pampanga' },
];

const HIGH_SCHOOLS = [
  { name: 'Pampanga High School', address: 'High School Blvd., Lourdes, City of San Fernando, Pampanga' },
  { name: 'Angeles City National High School', address: 'Purok 3, Pampang, Angeles City, Pampanga' },
  { name: 'Angeles City National Trade School', address: 'Fil-Am Friendship Hi-Way, Cutcut, Angeles City, Pampanga' },
  { name: 'Angeles City Science High School', address: 'Dona Aurora St., Lourdes Sur East, Angeles City, Pampanga' },
  { name: 'Bonifacio V. Romero High School', address: 'EPZA, Pulung Cacutud, Angeles City, Pampanga' },
  { name: 'Mexico National High School', address: 'Mexico, Pampanga' },
  { name: 'Betis National High School', address: 'Betis, Guagua, Pampanga' },
  { name: 'Basa Air Base National High School', address: 'Floridablanca, Pampanga' },
  { name: 'Becuran National High School', address: 'Santa Rita, Pampanga' },
  { name: 'Caduang Tete High School', address: 'Caduang Tete, Macabebe, Pampanga' },
  { name: 'Camba National High School', address: 'Arayat, Pampanga' },
  { name: 'Cansinala National High School', address: 'Apalit, Pampanga' },
  { name: 'Natividad National High School', address: 'Guagua, Pampanga' },
  { name: 'Don Jesus Gonzales High School', address: 'Mexico, Pampanga' },
  { name: 'Pasig National High School', address: 'Candaba, Pampanga' },
];

const PASSING_GRADES = ['1.00', '1.25', '1.50', '1.75', '2.00', '2.25', '2.50', '2.75', '3.00'];

function pick(list, index, offset = 0) {
  return list[(index + offset) % list.length];
}

function buildStudentNo({ prefix, graduationYear, curriculum, index }) {
  const programCode = normalizeProgramCode(curriculum?.program) || 'PROGRAM';
  const curriculumYear = cleanString(curriculum?.curriculumYear) || '0000';
  const serial = String(index).padStart(4, '0');
  return `${prefix}-${graduationYear}-${programCode}-${curriculumYear}-${serial}`;
}

function buildStudentPerson(index) {
  const gender = index % 2 === 0 ? 'Female' : 'Male';
  const firstName = gender === 'Female'
    ? pick(FEMALE_FIRST_NAMES, index)
    : pick(MALE_FIRST_NAMES, index);
  const middleName = pick(MIDDLE_NAMES, index, 5);
  const lastName = pick(LAST_NAMES, index, 11);
  const extensionName = pick(EXTENSION_NAMES, index, 3);
  const extensionPart = extensionName ? ` ${extensionName}` : '';

  return {
    gender,
    firstName,
    middleName,
    lastName,
    extensionName,
    studentName: `${lastName}, ${firstName} ${middleName}${extensionPart}`,
  };
}

function buildAddress(index) {
  const place = pick(PAMPANGA_PLACES, index, 7);
  const houseNo = 100 + ((index * 17) % 899);
  const streetNo = 1 + (index % 12);
  return `${houseNo} ${streetNo}th Street, Barangay ${place.barangay}, ${place.city}, ${place.province}`;
}

function buildResidentialAddress(index, permanentAddress) {
  if (index % 4 !== 0) return permanentAddress;
  const place = pick(PAMPANGA_PLACES, index, 12);
  return `Zone ${1 + (index % 6)}, Barangay ${place.barangay}, ${place.city}, ${place.province}`;
}

function buildPlaceOfBirth(index) {
  const place = pick(PAMPANGA_PLACES, index, 2);
  return `${place.city}, ${place.province}`;
}

function buildHighSchool(index) {
  return pick(HIGH_SCHOOLS, index, 4);
}

function buildEntranceCredential(index) {
  return index % 2 === 0 ? 'SF10' : 'Form 138';
}

function buildAdmissionDate(admissionYear, index) {
  const month = 7 + (index % 2);
  const day = 1 + (index % 20);
  return makeDate(`${admissionYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
}

function shouldForceFailure(index, failEvery) {
  return failEvery > 0 && index % failEvery === 0;
}

function buildGrade(index, subjectIndex, failThisStudent, subjectCount) {
  if (failThisStudent && subjectIndex === subjectCount - 1) {
    return {
      finalGrade: '5.00',
      remarks: 'FAILED',
    };
  }

  return {
    finalGrade: pick(PASSING_GRADES, index + subjectIndex),
    remarks: 'PASSED',
  };
}

async function resetSeededData({ Student, StudentGrade, prefix }) {
  const regex = new RegExp(`^${escapeRegex(prefix)}-`);
  const seededStudents = await Student.find({ studentNo: regex }, { _id: 1 }).lean();
  const seededStudentIds = seededStudents.map((student) => student._id);

  if (seededStudentIds.length) {
    await StudentGrade.deleteMany({ student: { $in: seededStudentIds } });
  }

  const deletedStudents = await Student.deleteMany({ studentNo: regex });

  return {
    deletedStudents: deletedStudents.deletedCount || 0,
    deletedGradesForStudents: seededStudentIds.length,
  };
}

async function seedOneStudent({
  Student,
  StudentGrade,
  curriculum,
  subjects,
  index,
  options,
}) {
  const studentNo = buildStudentNo({
    prefix: options.prefix,
    graduationYear: options.graduationYear,
    curriculum,
    index,
  });

  const person = buildStudentPerson(index);
  const permanentAddress = buildAddress(index);
  const residentialAddress = buildResidentialAddress(index, permanentAddress);
  const highSchool = buildHighSchool(index);
  const failThisStudent = shouldForceFailure(index, options.failEvery);

  const gradePlans = subjects.map((subject, subjectIndex) => {
    const grade = buildGrade(index, subjectIndex, failThisStudent, subjects.length);
    return {
      ...subject,
      ...grade,
      schoolYear: options.schoolYear,
      termName: subject.semester,
    };
  });

  const requiredSubjectKeys = new Set(subjects.map(buildGradeCompletionKey));
  const passedSubjectKeys = new Set(
    gradePlans
      .filter((grade) => grade.remarks === 'PASSED')
      .map(buildGradeCompletionKey)
  );

  const graduated = requiredSubjectKeys.size > 0 &&
    [...requiredSubjectKeys].every((key) => passedSubjectKeys.has(key));

  const student = await Student.findOneAndUpdate(
    { studentNo },
    {
      $set: {
        studentNo,
        studentName: person.studentName,
        extensionName: person.extensionName,
        gender: person.gender,
        permanentAddress,
        residentialAddress,
        entranceCredentials: buildEntranceCredential(index),
        highSchool: highSchool.name,
        degreeTitle: cleanString(curriculum?.programName),
        major: '',
        dateAdmission: buildAdmissionDate(options.admissionYear, index),
        placeBirth: buildPlaceOfBirth(index),
        dateGraduated: graduated ? options.dateGraduated : null,
        dateGraduation: graduated ? options.dateGraduation : null,
        graduated,
        programCode: normalizeProgramCode(curriculum?.program),
        programName: cleanString(curriculum?.programName),
        curriculumId: curriculum._id,
        curriculumYear: cleanString(curriculum?.curriculumYear),
        importedBy: null,
        updatedBy: null,
      },
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

  await StudentGrade.deleteMany({
    student: student._id,
    curriculumId: curriculum._id,
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
              importedBy: null,
              updatedBy: null,
            },
            $setOnInsert: {
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      }))
    );
  }

  return {
    studentNo,
    graduated,
    gradeRows: gradePlans.length,
  };
}

async function main() {
  const limit = parsePositiveInteger(getArg('--limit', '100'), 100);
  const curriculumYearFilter = cleanString(getArg('--curriculumYear', ''));
  const prefix = cleanString(getArg('--prefix', 'REGTEST')).toUpperCase();
  const schoolYear = cleanString(getArg('--schoolYear', '2025-2026'));
  const graduationYear = cleanString(getArg('--graduationYear', '2026'));
  const admissionYear = parsePositiveInteger(getArg('--admissionYear', String(Number(graduationYear) - 4)), 2022);
  const failEvery = parseNonNegativeInteger(getArg('--failEvery', '0'), 0);
  const reset = toBooleanArg(getArg('--reset', 'false'), false);

  const dateGraduated = makeDate(getArg('--dateGraduated', `${graduationYear}-06-30`));
  const dateGraduation = makeDate(getArg('--dateGraduation', `${graduationYear}-06-15`));

  if (!dateGraduated || !dateGraduation) {
    throw new Error('Invalid dateGraduated or dateGraduation argument. Use YYYY-MM-DD.');
  }

  await connectDatabases();

  const Curriculum = getCurriculumModel();
  const Student = getStudentModel();
  const StudentGrade = getStudentGradeModel();

  if (reset) {
    const resetSummary = await resetSeededData({ Student, StudentGrade, prefix });
    console.log('Reset complete:', resetSummary);
  }

  const curriculumQuery = curriculumYearFilter
    ? { curriculumYear: curriculumYearFilter }
    : {};

  const curricula = await Curriculum.find(curriculumQuery)
    .sort({ program: 1, curriculumYear: 1 })
    .lean();

  if (!curricula.length) {
    throw new Error(
      curriculumYearFilter
        ? `No curricula found for curriculumYear ${curriculumYearFilter}.`
        : 'No curricula found. Create/import curricula first.'
    );
  }

  let studentsSeeded = 0;
  let gradeRowsSeeded = 0;
  let graduatedYes = 0;
  let graduatedNo = 0;
  const issues = [];

  for (const curriculum of curricula) {
    const programCode = normalizeProgramCode(curriculum?.program);
    const curriculumYear = cleanString(curriculum?.curriculumYear);
    const subjects = flattenSubjects(curriculum);

    if (!programCode || !curriculumYear) {
      issues.push({
        programCode,
        curriculumYear,
        reason: 'Missing program code or curriculum year.',
      });
      continue;
    }

    if (!subjects.length) {
      issues.push({
        programCode,
        curriculumYear,
        reason: 'Curriculum has no subjects. Students were not seeded for this curriculum.',
      });
      continue;
    }

    for (let index = 1; index <= limit; index += 1) {
      const result = await seedOneStudent({
        Student,
        StudentGrade,
        curriculum,
        subjects,
        index,
        options: {
          prefix,
          schoolYear,
          graduationYear,
          admissionYear,
          dateGraduated,
          dateGraduation,
          failEvery,
        },
      });

      studentsSeeded += 1;
      gradeRowsSeeded += result.gradeRows;
      if (result.graduated) graduatedYes += 1;
      else graduatedNo += 1;
    }

    console.log(
      `Seeded ${limit} students for ${programCode} ${curriculumYear} with ${subjects.length} subjects each.`
    );
  }

  console.log('Student seeding completed.');
  console.log(`Curricula checked: ${curricula.length}`);
  console.log(`Students seeded: ${studentsSeeded}`);
  console.log(`Grade rows seeded: ${gradeRowsSeeded}`);
  console.log(`Graduated Yes: ${graduatedYes}`);
  console.log(`Graduated No: ${graduatedNo}`);
  console.log(`Issues: ${issues.length}`);

  if (issues.length) {
    console.table(issues);
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all(
      mongoose.connections.map((connection) => connection.close().catch(() => null))
    );
  });
