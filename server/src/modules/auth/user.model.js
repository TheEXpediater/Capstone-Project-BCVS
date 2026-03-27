// server/src/modules/auth/user.model.js
import mongoose from 'mongoose';
import { getIdentityConnection } from '../../config/db.js';

const userSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ['web', 'mobile'],
      required: true,
    },
    role: {
      type: String,
      enum: ['admin', 'super_admin', 'developer', 'cashier', 'student'],
      required: true,
    },
    username: {
      type: String,
      trim: true,
      minlength: 2,
      maxlength: 100,
      required: true,
    },
    fullName: {
      type: String,
      trim: true,
      minlength: 2,
      maxlength: 200,
      required: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      unique: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    contactNo: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    profilePicture: {
      type: String,
      trim: true,
      default: '',
    },
    studentId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    verified: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre('validate', function () {
  if (this.kind === 'web') {
    if (!['admin', 'super_admin', 'developer', 'cashier'].includes(this.role)) {
      throw new Error('Invalid web role');
    }

    this.studentId = null;
    this.verified = null;
  }

  if (this.kind === 'mobile') {
    if (this.role !== 'student') {
      throw new Error('Mobile users must have student role');
    }

    if (!this.studentId) {
      throw new Error('studentId is required for mobile users');
    }

    if (this.verified === null || this.verified === undefined) {
      this.verified = 'unverified';
    }
  }
});

export function getUserModel() {
  const connection = getIdentityConnection();
  return connection.models.User || connection.model('User', userSchema);
}