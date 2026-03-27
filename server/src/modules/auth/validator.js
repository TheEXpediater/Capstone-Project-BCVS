import Joi from "joi";

const email = Joi.string().trim().lowercase().email().max(254).required();
const password = Joi.string().min(8).max(128).required();
const optionalString = Joi.string().trim().max(255).allow("", null);

export const bootstrapSuperAdminSchema = Joi.object({
  username: Joi.string().trim().min(2).max(100).required(),
  fullName: Joi.string().trim().min(2).max(200).required(),
  email,
  password,
});

export const createWebUserSchema = Joi.object({
  username: Joi.string().trim().min(2).max(100).required(),
  fullName: Joi.string().trim().min(2).max(200).required(),
  email,
  password,
  role: Joi.string()
    .valid("admin", "super_admin", "developer", "cashier")
    .required(),
  contactNo: optionalString.optional(),
  address: optionalString.optional(),
  profilePicture: Joi.string().trim().uri().optional().allow("", null),
});

export const webLoginSchema = Joi.object({
  email,
  password,
});

export const mobileRegisterSchema = Joi.object({
  username: Joi.string().trim().min(2).max(100).required(),
  fullName: Joi.string().trim().min(2).max(200).optional().allow("", null),
  email,
  password,
  studentId: Joi.string().trim().max(100).optional().allow("", null),
});

export const mobileLoginSchema = Joi.object({
  email,
  password,
});