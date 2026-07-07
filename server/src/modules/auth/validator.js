import Joi from 'joi';

const email = Joi.string()
  .trim()
  .lowercase()
  .email({ tlds: { allow: false } })
  .max(254)
  .required();

const password = Joi.string().min(8).max(128).required();
const optionalString = Joi.string().trim().max(255).allow('', null);
const strongPassword = Joi.string()
  .min(8)
  .max(128)
  .pattern(/[a-z]/, 'lowercase letter')
  .pattern(/[A-Z]/, 'uppercase letter')
  .pattern(/[0-9]/, 'number')
  .required();

export const bootstrapSuperAdminSchema = Joi.object({
  username: Joi.string().trim().min(2).max(100).required(),
  fullName: Joi.string().trim().min(2).max(200).required(),
  email,
  password,
});

export const createWebUserSchema = Joi.object({
  username: Joi.string().trim().min(2).max(100).optional().allow('', null),
  fullName: Joi.string().trim().min(2).max(200).required(),
  email,
  password,
  role: Joi.string()
    .valid('admin', 'super_admin', 'developer', 'cashier')
    .required(),
  isActive: Joi.boolean().optional(),
  contactNo: optionalString.optional(),
  address: optionalString.optional(),
  profilePicture: Joi.string().trim().uri().optional().allow('', null),
});

export const webLoginSchema = Joi.object({
  email,
  password,
});

export const mobileRegisterSchema = Joi.object({
  username: Joi.string().trim().min(2).max(100).required(),
  fullName: Joi.string().trim().min(2).max(200).optional().allow('', null),
  email,
  password,
  studentId: Joi.string().trim().max(100).optional().allow('', null),
  contactNo: optionalString.optional(),
  address: optionalString.optional(),
  addressLine: optionalString.optional(),
  cityMunicipality: optionalString.optional(),
  province: optionalString.optional(),
  program: optionalString.optional(),
  yearGraduated: Joi.string().trim().max(20).optional().allow('', null),
  graduationStatus: Joi.string()
    .trim()
    .valid('graduated', 'not_graduated_yet', 'pending', '')
    .optional()
    .allow('', null),
});

export const createMobileUserSchema = Joi.object({
  username: Joi.string().trim().min(2).max(100).optional().allow('', null),
  fullName: Joi.string().trim().min(2).max(200).required(),
  email,
  password,
  studentId: Joi.string().trim().max(100).optional().allow('', null),
  isActive: Joi.boolean().optional(),
});

export const mobileLoginSchema = Joi.object({
  email,
  password,
});

export const updateWebProfileSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(200).required(),
  email: email.optional(),
  contactNo: optionalString.optional(),
  address: optionalString.optional(),
  role: Joi.string()
    .valid('admin', 'super_admin', 'developer', 'cashier')
    .optional(),
});

export const updateWebPasswordSchema = Joi.object({
  oldPassword: password,
  newPassword: strongPassword.invalid(Joi.ref('oldPassword')).messages({
    'any.invalid': 'New password must be different from the old password.',
  }),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
    'any.only': 'Confirm password must match the new password.',
  }),
});
