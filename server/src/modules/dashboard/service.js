import { getUserModel } from '../auth/user.model.js';
import { getCredentialDraftModel } from '../credentials/model.js';
import { getNotificationModel } from '../notifications/model.js';
import { getStudentModel } from '../students/model.js';
import { getVerificationSubmissionModel } from '../verification/model.js';

const LATEST_LIMIT = 5;

const CREDENTIAL_ACTIVITY_TYPES = [
  'credential_requested',
  'credential_ready',
  'credential_shared',
  'payment_received',
  'credential_claimed',
  'credential_anchored',
  'anchor_scheduled',
];

function getRoleMode(actor) {
  if (actor?.role === 'cashier') return 'cashier';
  if (['super_admin', 'developer'].includes(actor?.role)) return 'full';
  return 'registrar';
}

function unpaidPaymentFilter() {
  return {
    $or: [
      { paymentStatus: 'unpaid' },
      { paymentStatus: '' },
      { paymentStatus: null },
      { paymentStatus: { $exists: false } },
    ],
  };
}

function serializePaymentQueueRow(row) {
  return {
    id: String(row._id),
    paymentCode: row.paymentCode || '',
    studentNo: row.studentNo || '',
    studentName: row.studentName || '',
    credentialType: row.credentialType || 'student_record',
    paymentStatus: row.paymentStatus || 'unpaid',
    receiptNo: row.receiptNo || '',
    amount: row.amount || 0,
    createdAt: row.createdAt,
    paidAt: row.paidAt || null,
  };
}

function serializeActivity(row) {
  return {
    id: String(row._id),
    type: row.type,
    title: row.title,
    body: row.body || '',
    data: row.data || {},
    createdAt: row.createdAt,
  };
}

function serializeVerification(row) {
  return {
    id: String(row._id),
    fullName: row.fullName || '',
    email: row.email || '',
    submittedStudentNo: row.submittedStudentNo || '',
    status: row.status || '',
    createdAt: row.createdAt,
  };
}

export async function getDashboardSummary(actor) {
  const User = getUserModel();
  const Student = getStudentModel();
  const CredentialDraft = getCredentialDraftModel();
  const VerificationSubmission = getVerificationSubmissionModel();
  const Notification = getNotificationModel();

  const roleMode = getRoleMode(actor);
  const unpaidFilter = unpaidPaymentFilter();

  const [
    totalStudents,
    totalMobileUsers,
    verifiedMobileUsers,
    pendingVerificationRequests,
    totalCredentialDrafts,
    unpaidCredentialRequests,
    paidCredentialRequests,
    signedCredentials,
    claimReadyCredentials,
    claimedCredentials,
    anchorQueueCount,
    recentCredentialActivity,
    recentVerificationSubmissions,
    paymentQueue,
  ] = await Promise.all([
    Student.countDocuments({}),
    User.countDocuments({ kind: 'mobile' }),
    User.countDocuments({
      kind: 'mobile',
      $or: [{ verified: 'verified' }, { verified: 'true' }, { verified: true }],
    }),
    VerificationSubmission.countDocuments({ status: 'pending' }),
    CredentialDraft.countDocuments({}),
    CredentialDraft.countDocuments(unpaidFilter),
    CredentialDraft.countDocuments({ paymentStatus: 'paid' }),
    CredentialDraft.countDocuments({ status: 'signed' }),
    CredentialDraft.countDocuments({ status: 'claim_ready' }),
    CredentialDraft.countDocuments({ status: 'claimed' }),
    CredentialDraft.countDocuments({ status: 'queued_for_anchor' }),
    Notification.find({ type: { $in: CREDENTIAL_ACTIVITY_TYPES } })
      .sort({ createdAt: -1 })
      .limit(LATEST_LIMIT)
      .lean(),
    VerificationSubmission.find({})
      .sort({ createdAt: -1 })
      .limit(LATEST_LIMIT)
      .lean(),
    CredentialDraft.find(unpaidFilter)
      .sort({ createdAt: -1 })
      .limit(LATEST_LIMIT)
      .lean(),
  ]);

  const metrics = {
    totalStudents,
    totalMobileUsers,
    verifiedMobileUsers,
    pendingVerificationRequests,
    totalCredentialDrafts,
    unpaidCredentialRequests,
    paidCredentialRequests,
    signedCredentials,
    claimReadyCredentials,
    claimedCredentials,
    anchorQueueCount,
    paymentQueueCount: unpaidCredentialRequests,
  };

  return {
    roleMode,
    generatedAt: new Date().toISOString(),
    latestLimit: LATEST_LIMIT,
    metrics,
    paymentQueue: ['cashier', 'full'].includes(roleMode)
      ? paymentQueue.map(serializePaymentQueueRow)
      : [],
    recentCredentialActivity: roleMode === 'cashier'
      ? []
      : recentCredentialActivity.map(serializeActivity),
    recentVerificationSubmissions: roleMode === 'cashier'
      ? []
      : recentVerificationSubmissions.map(serializeVerification),
  };
}
