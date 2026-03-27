import mongoose from 'mongoose';
import { getIdentityConnection } from '../../config/db.js';

const userSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ['web', 'mobile'],
      required: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    fullName: {
      type: String,
      default: '',
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    contactNo: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', ''],
      default: '',
    },
    age: {
      type: Number,
      min: 0,
      max: 150,
      default: null,
    },
    profilePicture: {
      type: String,
      default: '',
    },
    studentId: {
      type: String,
      default: '',
      index: true,
    },
    verified: {
      type: String,
      enum: ['unverified', 'verified', 'rejected'],
      default: 'unverified',
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
    collection: 'users',
  }
);

export function getUserModel() {
  const connection = getIdentityConnection();
  return connection.models.User || connection.model('User', userSchema);
}
