import { ApiError } from '../../shared/utils/ApiError.js';
import { getEmailOtpDeliveryConfig } from '../settings/setting.service.js';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'BCVS <onboarding@resend.dev>';

function cleanString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function otpSubject(purpose) {
  return purpose === 'password_reset' ? 'Your BCVS password reset code' : 'Your BCVS verification code';
}

function otpHtml(code, purpose) {
  const label = purpose === 'password_reset' ? 'password reset' : 'email verification';
  return [
    '<div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5">',
    `<p>Your BCVS ${label} code is:</p>`,
    `<p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>`,
    '<p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>',
    '</div>',
  ].join('');
}

export async function sendOtpEmail({ to, code, purpose = 'registration' } = {}) {
  const email = cleanString(to).toLowerCase();
  const otp = cleanString(code);

  if (!email) throw new ApiError(400, 'Email is required');
  if (!otp) throw new ApiError(400, 'OTP code is required');

  const config = await getEmailOtpDeliveryConfig();
  if (!config.enabled) {
    return { disabled: true };
  }

  if (!config.configured || !config.apiKey) {
    throw new ApiError(409, 'Email OTP is enabled but the email provider is not configured by MIS.');
  }

  if (config.provider !== 'resend') {
    throw new ApiError(409, 'The configured email provider is not supported.');
  }

  const response = await fetch(RESEND_EMAILS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: DEFAULT_FROM,
      to: [email],
      subject: otpSubject(purpose),
      html: otpHtml(otp, purpose),
    }),
  });

  if (!response.ok) {
    throw new ApiError(502, 'Email provider failed to send the OTP code.');
  }

  return { sent: true };
}
