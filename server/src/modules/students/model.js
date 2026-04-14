import mongoose from 'mongoose';
import { getPlatformConnection } from '../../config/db.js';

const studentSchema = new mongoose.Schema(
  {
    studentNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
    },
    extensionName: {
      type: String,
      default: '',
      trim: true,
    },
    gender: {
      type: String,
      default: '',
      trim: true,
    },
    permanentAddress: {
      type: String,
      default: '',
      trim: true,
    },
    residentialAddress: {
      type: String,
      default: '',
      trim: true,
    },
    entranceCredentials: {
      type: String,
      default: '',
      trim: true,
    },
    highSchool: {
      type: String,
      default: '',
      trim: true,
    },
    degreeTitle: {
      type: String,
      default: '',
      trim: true,
    },
    major: {
      type: String,
      default: '',
      trim: true,
    },
    dateAdmission: {
      type: Date,
      default: null,
    },
    placeBirth: {
      type: String,
      default: '',
      trim: true,
    },
    dateGraduated: {
      type: Date,
      default: null,
    },
    dateGraduation: {
      type: Date,
      default: null,
    },
    graduated: {
      type: Boolean,
      default: false,
      index: true,
    },

    // denormalized program fields for quick table display
    programCode: {
      type: String,
      default: '',
      trim: true,
      uppercase: true,
    },
    programName: {
      type: String,
      default: '',
      trim: true,
    },

    // link to curriculum for TOR / VC use later
    curriculumId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Curriculum',
      default: null,
      index: true,
    },
    curriculumYear: {
      type: String,
      default: '',
      trim: true,
    },

    importedBy: {
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
    collection: 'students',
  }
);

studentSchema.index({ programCode: 1, graduated: 1 });

const studentGradeSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    curriculumId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Curriculum',
      required: true,
      index: true,
    },
    studentNo: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    yearLevel: {
      type: String,
      required: true,
      trim: true,
    },
    semester: {
      type: String,
      required: true,
      trim: true,
    },
    subjectCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    subjectTitle: {
      type: String,
      default: '',
      trim: true,
    },
    units: {
      type: Number,
      default: 0,
      min: 0,
    },
    finalGrade: {
      type: String,
      default: '',
      trim: true,
    },
    remarks: {
      type: String,
      default: '',
      trim: true,
    },
    schoolYear: {
      type: String,
      default: '',
      trim: true,
    },
    termName: {
      type: String,
      default: '',
      trim: true,
    },
    importedBy: {
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
    collection: 'student_grades',
  }
);

studentGradeSchema.index(
  {
    student: 1,
    curriculumId: 1,
    yearLevel: 1,
    semester: 1,
    subjectCode: 1,
  },
  {
    unique: true,
  }
);

export function getStudentModel() {
  const connection = getPlatformConnection();
  return connection.models.Student || connection.model('Student', studentSchema);
}

export function getStudentGradeModel() {
  const connection = getPlatformConnection();
  return (
    connection.models.StudentGrade ||
    connection.model('StudentGrade', studentGradeSchema)
  );
}