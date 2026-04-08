import { Types } from 'mongoose';
import { ApiError } from '../../shared/utils/ApiError.js';
import { getCurriculumModel } from './model.js';

function cleanString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim().replace(/\s+/g, ' ');
}

function normalizeProgram(value) {
  return cleanString(value).toUpperCase();
}

function normalizeUnits(value) {
  if (value === '' || value === null || value === undefined) return 0;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

function normalizeSubject(subject, yearLabel, semesterLabel) {
  const code = cleanString(subject?.code);
  const title = cleanString(subject?.title);
  const prerequisite = cleanString(subject?.prerequisite);

  const isCompletelyEmpty =
    !code &&
    !title &&
    (subject?.units === '' || subject?.units === null || subject?.units === undefined) &&
    !prerequisite;

  if (isCompletelyEmpty) {
    return null;
  }

  if (!code) {
    throw new ApiError(
      400,
      `Subject code is required in ${yearLabel} / ${semesterLabel}`
    );
  }

  return {
    code,
    title,
    units: normalizeUnits(subject?.units),
    ...(prerequisite ? { prerequisite } : {}),
  };
}

function normalizeStructure(structure) {
  if (!structure || typeof structure !== 'object' || Array.isArray(structure)) {
    throw new ApiError(400, 'Curriculum structure must be an object.');
  }

  const normalized = {};
  let subjectCount = 0;
  let totalUnits = 0;

  for (const [rawYearLabel, rawSemesters] of Object.entries(structure)) {
    const yearLabel = cleanString(rawYearLabel);
    if (!yearLabel) continue;

    if (!rawSemesters || typeof rawSemesters !== 'object' || Array.isArray(rawSemesters)) {
      throw new ApiError(400, `Year "${yearLabel}" must contain semester objects.`);
    }

    normalized[yearLabel] = {};

    for (const [rawSemesterLabel, rawSubjects] of Object.entries(rawSemesters)) {
      const semesterLabel = cleanString(rawSemesterLabel);
      if (!semesterLabel) continue;

      if (!Array.isArray(rawSubjects)) {
        throw new ApiError(
          400,
          `Semester "${semesterLabel}" in "${yearLabel}" must contain an array of subjects.`
        );
      }

      const cleanedSubjects = rawSubjects
        .map((subject) => normalizeSubject(subject, yearLabel, semesterLabel))
        .filter(Boolean);

      normalized[yearLabel][semesterLabel] = cleanedSubjects;

      for (const item of cleanedSubjects) {
        subjectCount += 1;
        totalUnits += Number(item.units || 0);
      }
    }
  }

  return {
    normalized,
    subjectCount,
    totalUnits,
  };
}

function serializeCurriculum(doc) {
  return {
    _id: doc._id,
    program: doc.program,
    programName: doc.programName || '',
    curriculumYear: doc.curriculumYear,
    structure: doc.structure || {},
    subjectCount: doc.subjectCount || 0,
    totalUnits: doc.totalUnits || 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function listCurricula() {
  const Curriculum = getCurriculumModel();

  const rows = await Curriculum.find(
    {},
    '_id program programName curriculumYear subjectCount totalUnits createdAt updatedAt'
  )
    .sort({ updatedAt: -1, program: 1 })
    .lean();

  return rows;
}

export async function getCurriculumById(id) {
  const Curriculum = getCurriculumModel();

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid curriculum id.');
  }

  const row = await Curriculum.findById(id).lean();

  if (!row) {
    throw new ApiError(404, 'Curriculum not found.');
  }

  return row;
}

export async function saveCurriculum(payload, actor) {
  const Curriculum = getCurriculumModel();

  const program = normalizeProgram(payload?.program);
  const programName = cleanString(payload?.programName);
  const curriculumYear = cleanString(payload?.curriculumYear || '2024');

  if (!program) {
    throw new ApiError(400, 'Program is required.');
  }

  if (!curriculumYear) {
    throw new ApiError(400, 'Curriculum year is required.');
  }

  const { normalized, subjectCount, totalUnits } = normalizeStructure(payload?.structure || {});

  if (subjectCount === 0) {
    throw new ApiError(400, 'Curriculum must contain at least one subject.');
  }

  const updated = await Curriculum.findOneAndUpdate(
    { program, curriculumYear },
    {
      $set: {
        program,
        programName,
        curriculumYear,
        structure: normalized,
        subjectCount,
        totalUnits,
        updatedBy: actor?._id || null,
      },
      $setOnInsert: {
        createdBy: actor?._id || null,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
    }
  );

  return serializeCurriculum(updated);
}

export async function deleteCurriculum(id) {
  const Curriculum = getCurriculumModel();

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid curriculum id.');
  }

  const deleted = await Curriculum.findByIdAndDelete(id);

  if (!deleted) {
    throw new ApiError(404, 'Curriculum not found.');
  }

  return {
    success: true,
    _id: deleted._id,
  };
}
