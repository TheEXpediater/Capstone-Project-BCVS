import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { closeDatabases, connectDatabases } from '../server/src/config/db.js';
import { ensureRoles } from '../server/src/modules/auth/service.js';
import { getUserModel } from '../server/src/modules/auth/user.model.js';
import { getCurriculumModel } from '../server/src/modules/curriculum/model.js';
import { getStudentModel } from '../server/src/modules/students/model.js';
import {
  ensureSystemConfiguration,
  seedCurricula,
  seedStudentsAndGrades,
  seedWebUsers,
} from '../server/src/script/configure_system.js';
import {
  DEFAULT_ADMISSION_YEAR,
  DEFAULT_GRADUATION_YEAR,
  DEFAULT_SCHOOL_YEAR,
  resolveSeedLifecycle,
} from '../server/src/script/seed/lifecycle.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function enabled(value, fallback = true) {
  if (value === undefined || value === null) return fallback;
  return Boolean(value);
}

async function loadSystemConfig() {
  const configPath = path.join(rootDir, 'system.json');
  const raw = await fs.readFile(configPath, 'utf8');
  return JSON.parse(raw);
}

function logOk(message) {
  console.log(`[✓] ${message}`);
}

function logWarn(message) {
  console.log(`[!] ${message}`);
}

function logDetail(message) {
  console.log(`    ${message}`);
}

async function setupSystem() {
  const config = await loadSystemConfig();
  const seedConfig = config.seed || {};
  const setupConfig = config.setup || {};
  const seedDatabase = enabled(setupConfig.seed_database);
  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD || 'ChangeMe123!';
  const curriculumYear = String(seedConfig.curriculumYear || DEFAULT_ADMISSION_YEAR);
  const lifecycle = resolveSeedLifecycle({
    curriculumYear,
    admissionYear: seedConfig.admissionYear || DEFAULT_ADMISSION_YEAR,
    graduationYear: seedConfig.graduationYear || DEFAULT_GRADUATION_YEAR,
    schoolYear: seedConfig.schoolYear || DEFAULT_SCHOOL_YEAR,
  });

  await connectDatabases();
  logOk('Database connected');

  await ensureRoles();
  await ensureSystemConfiguration();

  let curricula = [];

  if (enabled(setupConfig.check_accounts)) {
    const User = getUserModel();
    const accountCount = await User.countDocuments({ kind: 'web' });

    if (accountCount > 0) {
      logOk('Accounts detected');
      logDetail('Seeder skipped');
    } else if (!seedDatabase) {
      logWarn('Accounts missing');
      logDetail('Seeder disabled');
    } else {
      logWarn('Accounts missing');
      logDetail('Running account seeder');
      await seedWebUsers(defaultPassword);
    }
  }

  if (enabled(setupConfig.check_curriculum)) {
    const Curriculum = getCurriculumModel();
    const curriculumCount = await Curriculum.countDocuments();

    if (curriculumCount > 0) {
      logOk('Curriculum detected');
      logDetail('Seeder skipped');
      curricula = await Curriculum.find().sort({ program: 1, curriculumYear: 1 });
    } else if (!seedDatabase) {
      logWarn('Curriculum missing');
      logDetail('Seeder disabled');
    } else {
      logWarn('Curriculum missing');
      logDetail('Running curriculum seeder');
      const inputDir = path.resolve(seedConfig.inputDir || path.join(rootDir, 'server', 'src', 'script', 'curricula', 'input'));
      const result = await seedCurricula(inputDir, curriculumYear);
      curricula = result.curricula;
    }
  }

  if (enabled(setupConfig.check_students)) {
    const Student = getStudentModel();
    const studentCount = await Student.countDocuments();

    if (studentCount > 0) {
      logOk('Students detected');
      logDetail('Seeder skipped');
    } else if (!seedDatabase) {
      logWarn('Students missing');
      logDetail('Seeder disabled');
    } else {
      if (!curricula.length) {
        const Curriculum = getCurriculumModel();
        curricula = await Curriculum.find().sort({ program: 1, curriculumYear: 1 });
      }

      if (!curricula.length) {
        throw new Error('Cannot seed students because no curriculum records exist.');
      }

      logWarn('Students missing');
      logDetail('Running student seeder');
      await seedStudentsAndGrades(curricula, {
        curriculumYear,
        studentsPerProgram: Number(seedConfig.studentsPerProgram || 100),
        schoolYear: lifecycle.schoolYear,
        defaultPassword,
        reset: false,
        force: false,
        createMobileUsers: Boolean(seedConfig.createMobileUsers),
        failEvery: Number(seedConfig.failEvery || 0),
        dateAdmission: new Date(lifecycle.dateAdmission),
        dateGraduated: new Date(lifecycle.dateGraduated),
        dateGraduation: new Date(lifecycle.dateGraduation),
      });
    }
  }

  logOk('System ready');
}

setupSystem()
  .catch((error) => {
    console.error(`[x] ${error.message || error}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabases();
  });
