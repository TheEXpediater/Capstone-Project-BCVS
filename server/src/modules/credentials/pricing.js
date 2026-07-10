import { ApiError } from '../../shared/utils/ApiError.js';

export const BASE_CREDENTIAL_AMOUNT = 150;
export const ANCHOR_NOW_FEE = 20;
export const ANCHOR_MODE_DEFAULT = 'default';
export const ANCHOR_MODE_NOW = 'anchor_now';

function cleanString(value, fallback = '') {
  const cleaned = String(value || '').trim();
  return cleaned || fallback;
}

export function normalizeAnchorMode(value, options = {}) {
  const normalized = cleanString(value).toLowerCase();
  const anchorNow = options.anchorNow === true || options.anchorNow === 'true';

  if (anchorNow || ['anchor_now', 'anchor-now', 'now', 'priority', 'same_day', 'today'].includes(normalized)) {
    return ANCHOR_MODE_NOW;
  }

  return ANCHOR_MODE_DEFAULT;
}

export function normalizePaymentAmount(value, fallback = null) {
  const hasExplicitValue =
    value !== undefined &&
    value !== null &&
    !(typeof value === 'string' && value.trim() === '');
  const raw = hasExplicitValue ? value : fallback;
  const amount = Number(raw);

  if (!Number.isFinite(amount)) {
    throw new ApiError(400, 'Payment amount must be numeric');
  }

  if (amount <= 0) {
    throw new ApiError(400, 'Payment amount must be greater than 0');
  }

  return Math.round(amount * 100) / 100;
}

export function normalizeReceiptNo(value) {
  const receiptNo = cleanString(value);

  if (!/^\d{6}$/.test(receiptNo)) {
    throw new ApiError(400, 'Receipt number must be 6 digits');
  }

  return receiptNo;
}

function hasExplicitValue(value) {
  return (
    value !== undefined &&
    value !== null &&
    !(typeof value === 'string' && value.trim() === '')
  );
}

export function buildCredentialPricing(input = {}, options = {}) {
  const anchorMode = normalizeAnchorMode(input.anchorMode, { anchorNow: input.anchorNow });
  const anchorNow = anchorMode === ANCHOR_MODE_NOW;
  const baseAmount =
    options.trustStoredValues && hasExplicitValue(input.baseAmount)
      ? normalizePaymentAmount(input.baseAmount, BASE_CREDENTIAL_AMOUNT)
      : BASE_CREDENTIAL_AMOUNT;
  const anchorNowFee =
    anchorNow && options.trustStoredValues && hasExplicitValue(input.anchorNowFee)
      ? normalizePaymentAmount(input.anchorNowFee, ANCHOR_NOW_FEE)
      : anchorNow
        ? ANCHOR_NOW_FEE
        : 0;
  const defaultTotal = baseAmount + anchorNowFee;
  const requestedTotal = input.amount ?? input.totalAmount;
  const totalAmount =
    options.trustStoredValues && hasExplicitValue(requestedTotal)
      ? normalizePaymentAmount(requestedTotal, defaultTotal)
      : defaultTotal;

  return {
    baseAmount,
    anchorNowFee,
    amount: totalAmount,
    totalAmount,
    anchorMode,
    anchorNow,
  };
}

export function pricingFromDraft(draft = {}) {
  return buildCredentialPricing({
    baseAmount: draft.baseAmount || BASE_CREDENTIAL_AMOUNT,
    anchorNowFee: draft.anchorNowFee || undefined,
    amount: draft.amount || draft.totalAmount || undefined,
    anchorMode: draft.anchorMode,
    anchorNow: draft.anchorNow,
  }, { trustStoredValues: true });
}
