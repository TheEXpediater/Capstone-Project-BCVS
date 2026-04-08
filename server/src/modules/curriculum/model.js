import mongoose from 'mongoose';
import { getPlatformConnection } from '../../config/db.js';

const curriculumSchema = new mongoose.Schema(
  {
    program: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    programName: {
      type: String,
      default: '',
      trim: true,
    },
    curriculumYear: {
      type: String,
      required: true,
      trim: true,
      default: '2024',
      index: true,
    },
    structure: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
    subjectCount: {
      type: Number,
      default: 0,
    },
    totalUnits: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'curricula',
  }
);

curriculumSchema.index({ program: 1, curriculumYear: 1 }, { unique: true });

export function getCurriculumModel() {
  const connection = getPlatformConnection();
  return connection.models.Curriculum || connection.model('Curriculum', curriculumSchema);
}
