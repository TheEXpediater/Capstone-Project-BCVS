import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { useSearchParams } from 'react-router-dom';
import {
  FaBan,
  FaCalendarAlt,
  FaCalendarDay,
  FaCog,
  FaEdit,
  FaEye,
  FaPaperPlane,
  FaPlus,
  FaQrcode,
  FaSignature,
  FaTrash,
} from 'react-icons/fa';
import FloatingActionMenu from '../../../components/FloatingActionMenu';
import CreateVcDraftModal from '../../../components/CreateVcDraftModal';
import { hasValidStoredAuth } from '../../auth/authStorage';
import { listStudents } from '../../students/studentsAPI';
import {
  bulkCreateCredentialClaimTokens,
  bulkDeleteCredentialDrafts,
  bulkScheduleCredentialAnchors,
  bulkSignCredentialDrafts,
  bulkSubmitCredentialDrafts,
  createCredentialClaimOverrideToken,
  createCredentialClaimToken,
  createCredentialDraftFromStudent,
  deleteCredentialDraft,
  getCredentialDraftById,
  getTodaysAnchorQueueSummary,
  listCredentialDrafts,
  listCredentialPayments,
  markCredentialPaymentPaid,
  processTodaysAnchorQueue,
  rejectCredentialDraft,
  scheduleCredentialAnchor,
  signCredentialDraft,
  submitCredentialDraft,
  updateCredentialDraft,
} from '../credentialsAPI';

const CLAIMABLE_STATUSES = new Set(['signed', 'claim_ready', 'queued_for_anchor', 'anchored']);
const PAYMENT_TAB_ROLES = new Set(['cashier']);
const DRAFT_ADMIN_ROLES = new Set(['admin']);
const REGISTRAR_ACTION_ROLES = new Set(['super_admin']);
const OVERRIDE_QR_ROLES = new Set(['super_admin']);
const BASE_CREDENTIAL_AMOUNT = 150;
const ANCHOR_NOW_FEE = 20;
const VC_PAGE_SIZE = 10;
const MAX_BULK_SELECTION = 10;

function formatDate(value) {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleString();
}

function formatDateInput(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 'Not set';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'PHP',
  }).format(amount);
}

function normalizeAnchorMode(value, anchorNow = false) {
  const mode = cleanText(value).toLowerCase();
  if (anchorNow || ['anchor_now', 'anchor-now', 'same_day', 'today', 'priority'].includes(mode)) {
    return 'anchor_now';
  }
  return 'default';
}

function priceForAnchorMode(mode) {
  return mode === 'anchor_now' ? BASE_CREDENTIAL_AMOUNT + ANCHOR_NOW_FEE : BASE_CREDENTIAL_AMOUNT;
}

function anchorModeLabel(mode) {
  return normalizeAnchorMode(mode) === 'anchor_now' ? 'Anchor Now' : 'Default';
}

function anchorNowText(mode) {
  return normalizeAnchorMode(mode) === 'anchor_now'
    ? 'Anchor Now adds PHP 20 and places the request in the priority anchoring queue.'
    : 'Default uses the regular scheduled anchoring queue.';
}

function defaultAnchorDueDate() {
  const due = new Date();
  due.setDate(due.getDate() + 7);
  return due;
}

function generateReceiptNo() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function titleCase(value) {
  const text = String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text ? text.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not available';
}

function cleanText(value) {
  return String(value || '').trim();
}

function isCredentialPaid(draft) {
  return String(draft?.paymentStatus || 'unpaid').toLowerCase() === 'paid';
}

function isCredentialClaimed(draft) {
  return draft?.status === 'claimed' || Boolean(draft?.claimedAt);
}

function isCredentialRejectedOrRevoked(draft) {
  return ['rejected', 'revoked'].includes(String(draft?.status || '').toLowerCase());
}

function isCredentialClaimableStatus(draft) {
  return CLAIMABLE_STATUSES.has(String(draft?.status || '').toLowerCase());
}

function hasSignedCredential(draft) {
  return Boolean(draft?.signedCredential);
}

function canShowClaimQr(draft) {
  return (
    isCredentialPaid(draft) &&
    Boolean(draft?.signedCredential) &&
    isCredentialClaimableStatus(draft) &&
    !isCredentialClaimed(draft) &&
    !isCredentialRejectedOrRevoked(draft)
  );
}

function canGenerateFreshClaimQr(draft) {
  if (!canShowClaimQr(draft)) return false;
  if (!draft?.claimTokenHash || !draft?.claimTokenExpiresAt) return true;
  return new Date(draft.claimTokenExpiresAt).getTime() <= Date.now();
}

function hasExpiredClaimToken(draft) {
  return Boolean(
    draft?.claimTokenHash &&
      draft?.claimTokenExpiresAt &&
      new Date(draft.claimTokenExpiresAt).getTime() <= Date.now()
  );
}

function hasActiveClaimToken(draft) {
  return Boolean(
    draft?.claimToken &&
      draft?.claimTokenExpiresAt &&
      new Date(draft.claimTokenExpiresAt).getTime() > Date.now()
  );
}

function canShowClaimOverrideQr(draft, currentUser) {
  return (
    OVERRIDE_QR_ROLES.has(currentUser?.role) &&
    isCredentialPaid(draft) &&
    Boolean(draft?.signedCredential) &&
    isCredentialClaimed(draft) &&
    !isCredentialRejectedOrRevoked(draft)
  );
}

function canQueueAnchor(draft, currentUser) {
  if (!REGISTRAR_ACTION_ROLES.has(currentUser?.role)) return false;
  if (!isCredentialPaid(draft) || !draft?.signedCredential) return false;
  if (isCredentialRejectedOrRevoked(draft)) return false;
  if (draft?.anchorStatus === 'queued' || draft?.anchorStatus === 'anchored') return false;
  return ['signed', 'claim_ready', 'queued_for_anchor', 'anchored'].includes(
    String(draft?.status || '')
  );
}

function hasIssuedCredentialArtifacts(draft) {
  return Boolean(
    draft?.signedCredential ||
      draft?.vcPayload ||
      cleanText(draft?.credentialHash) ||
      cleanText(draft?.vcHash) ||
      draft?.signedAt ||
      ['signed', 'claim_ready', 'claimed', 'shared', 'queued_for_anchor', 'anchored', 'revoked'].includes(
        cleanText(draft?.status).toLowerCase()
      )
  );
}

function canEditCredentialDraft(draft) {
  if (!draft || hasIssuedCredentialArtifacts(draft)) return false;
  return cleanText(draft.status).toLowerCase() === 'draft';
}

function canDeleteCredentialDraft(draft) {
  if (!draft || hasIssuedCredentialArtifacts(draft)) return false;
  return cleanText(draft.status).toLowerCase() === 'draft';
}

function getStatusBadge(status) {
  const map = {
    draft: 'text-bg-secondary',
    for_signature: 'text-bg-warning',
    signed: 'text-bg-primary',
    claim_ready: 'text-bg-info',
    claimed: 'text-bg-success',
    shared: 'text-bg-success',
    revoked: 'text-bg-dark',
    rejected: 'text-bg-danger',
    queued_for_anchor: 'text-bg-info',
    anchored: 'text-bg-success',
  };

  return map[status] || 'text-bg-secondary';
}

function getPaymentBadge(draft) {
  return isCredentialPaid(draft) ? 'text-bg-success' : 'text-bg-warning';
}

function credentialLabel(value) {
  const type = cleanText(value).toLowerCase();
  if (type === 'tor') return 'TOR';
  if (type === 'diploma') return 'Diploma';
  return titleCase(value || 'credential');
}

function matchesCredentialSearch(draft, search) {
  const query = cleanText(search).toLowerCase();
  if (!query) return true;
  return [
    draft?.studentName,
    draft?.studentNo,
    draft?.credentialType,
    draft?.status,
    draft?.paymentStatus,
    draft?.anchorStatus,
  ].some((value) => cleanText(value).toLowerCase().includes(query));
}

const matchesStudentName = matchesCredentialSearch;

function matchesPaymentStatus(draft, status) {
  const selected = cleanText(status).toLowerCase();
  if (!selected) return true;
  return cleanText(draft?.paymentStatus).toLowerCase() === selected;
}

function anchorScheduleLabel(draft) {
  const mode = cleanText(draft?.anchorScheduleMode || draft?.anchorMode).toLowerCase();
  const preference = cleanText(draft?.anchorPreference).toLowerCase();

  if (mode === 'same_day' || preference === 'request') return 'Today';
  if (draft?.anchorNow || cleanText(draft?.anchorMode).toLowerCase() === 'anchor_now') return 'Priority';
  return '7 Days';
}

function matchesAnchorSchedule(draft, schedule) {
  const selected = cleanText(schedule).toLowerCase();
  if (!selected) return true;
  return selected === 'today'
    ? anchorScheduleLabel(draft) === 'Today'
    : anchorScheduleLabel(draft) === '7 Days';
}

function signatureStatusLabel(draft) {
  return hasSignedCredential(draft) ? 'Signed' : 'Pending';
}

function signatureStatusBadge(draft) {
  return hasSignedCredential(draft) ? 'text-bg-success' : 'text-bg-warning';
}

function anchorStatusLabel(draft) {
  const status = cleanText(draft?.anchorStatus).toLowerCase();

  if (status === 'anchored') return 'Anchored';
  if (status === 'anchor_failed') return 'Failed';
  if (['merkle_ready', 'contract_missing', 'contract_unsupported'].includes(status)) {
    return 'Processing';
  }
  if (status === 'queued') return isDueForAnchorQueue(draft) ? 'Ready' : 'Scheduled';
  return 'Queued';
}

function anchorStatusBadge(draft) {
  const label = anchorStatusLabel(draft);
  if (label === 'Anchored') return 'text-bg-success';
  if (label === 'Failed') return 'text-bg-danger';
  if (label === 'Processing') return 'text-bg-info';
  if (label === 'Ready') return 'text-bg-warning';
  if (label === 'Scheduled') return 'text-bg-secondary';
  return 'text-bg-warning';
}

function anchorStatusFilterValue(draft) {
  const label = anchorStatusLabel(draft);
  if (label === 'Anchored') return 'anchored';
  if (label === 'Failed') return 'failed';
  if (label === 'Processing') return 'processing';
  if (label === 'Scheduled') return 'scheduled';
  return 'queued';
}

function matchesAnchorStatus(draft, status) {
  const selected = cleanText(status).toLowerCase();
  const value = anchorStatusFilterValue(draft);
  if (selected === 'queued') return ['queued', 'scheduled', 'processing'].includes(value);
  return value === selected;
}

function matchesAnchorSearch(draft, search) {
  const query = cleanText(search).toLowerCase();
  if (!query) return true;
  return [
    draft?.studentName,
    draft?.studentNo,
    draft?.credentialType,
    draft?.anchorStatus,
    draft?.paymentCode,
    draft?.receiptNo,
    draft?.credentialHash,
    draft?.vcHash,
    draft?.anchorTxHash,
    draft?.anchorBatchId,
    draft?.contractAddress,
    draft?.anchorContractAddress,
  ]
    .map((value) => cleanText(value).toLowerCase())
    .some((value) => value.includes(query));
}

function isAnchored(draft) {
  return cleanText(draft?.anchorStatus).toLowerCase() === 'anchored';
}

function getDraftId(item) {
  return item?._id || item?.id || item?.credentialId || item?.draftId || '';
}

function isMeaningful(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value === null || value === undefined) return false;
  return String(value).trim() !== '';
}

function hasAnyValue(...values) {
  return values.some(isMeaningful);
}

function extractQueueRows(summary) {
  const candidates = [
    summary?.rows,
    summary?.items,
    summary?.credentials,
    summary?.pending,
    summary?.pendingRows,
  ];
  const rows = candidates.find(Array.isArray);
  return rows || [];
}

function isDueForAnchorQueue(item, dueAtValue) {
  const anchorStatus = cleanText(item?.anchorStatus).toLowerCase();
  if (anchorStatus !== 'queued') return false;
  if (!isCredentialPaid(item) || !hasSignedCredential(item) || isCredentialRejectedOrRevoked(item)) {
    return false;
  }

  let dueAt = dueAtValue ? new Date(dueAtValue) : new Date();
  const hasInvalidDueAt = Number.isNaN(dueAt.getTime());
  if (hasInvalidDueAt) dueAt = new Date();
  if (hasInvalidDueAt || !dueAtValue) {
    dueAt.setHours(23, 59, 59, 999);
  }
  const scheduledAt = item?.scheduledAnchorAt || item?.anchorScheduledAt || item?.anchorDueAt;

  if (!scheduledAt) return anchorScheduleLabel(item) === 'Today';

  const scheduledDate = new Date(scheduledAt);
  if (Number.isNaN(scheduledDate.getTime())) return anchorScheduleLabel(item) === 'Today';

  return scheduledDate.getTime() <= dueAt.getTime();
}

function getAnchorQueueRows(summary, rows) {
  const apiRows = extractQueueRows(summary);
  if (apiRows.length) return apiRows;

  return (rows || []).filter((item) => isDueForAnchorQueue(item, summary?.dueAt));
}

function FieldValue({ label, children, className = '' }) {
  return (
    <div className={className}>
      <div className="small text-muted">{label}</div>
      <div className="fw-semibold text-break">{children || 'Not available'}</div>
    </div>
  );
}

function SummaryTile({ label, children }) {
  return (
    <div className="col-md-3">
      <div className="border rounded-3 bg-light p-3 h-100">
        <div className="small text-muted mb-1">{label}</div>
        <div className="fw-semibold">{children}</div>
      </div>
    </div>
  );
}

function EmptyState({ children }) {
  return <div className="alert alert-light border mb-0">{children}</div>;
}

function GradesTable({ grades }) {
  if (!grades?.length) {
    return <EmptyState>No grades are attached to this draft yet.</EmptyState>;
  }

  return (
    <div className="table-responsive border rounded-3">
      <table className="table table-sm align-middle mb-0">
        <thead>
          <tr>
            <th>Year</th>
            <th>Semester</th>
            <th>Subject Code</th>
            <th>Subject Title</th>
            <th>Units</th>
            <th>Grade</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {grades.map((grade, index) => (
            <tr key={grade._id || `${grade.subjectCode}-${index}`}>
              <td>{grade.yearLevel || 'Not available'}</td>
              <td>{grade.semester || 'Not available'}</td>
              <td className="fw-semibold">{grade.subjectCode || 'Not available'}</td>
              <td>{grade.subjectTitle || 'Not available'}</td>
              <td>{grade.units ?? 0}</td>
              <td>{grade.finalGrade || 'Not available'}</td>
              <td>{grade.remarks || 'Not available'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function createDraftEditForm(draft) {
  const profile = draft?.profileSnapshot || {};

  return {
    credentialType: draft?.credentialType || 'tor',
    notes: draft?.notes || '',
    profile: {
      studentNo: profile.studentNo || draft?.studentNo || '',
      studentName: profile.studentName || draft?.studentName || '',
      programCode: profile.programCode || '',
      programName: profile.programName || '',
      curriculumYear: profile.curriculumYear || '',
      major: profile.major || '',
      gender: profile.gender || '',
      dateAdmission: formatDateInput(profile.dateAdmission),
      dateGraduated: formatDateInput(profile.dateGraduated || profile.dateGraduation),
      placeBirth: profile.placeBirth || '',
      permanentAddress: profile.permanentAddress || '',
      residentialAddress: profile.residentialAddress || '',
      entranceCredentials: profile.entranceCredentials || '',
      highSchool: profile.highSchool || '',
    },
    grades: (draft?.gradesSnapshot || []).map((grade) => ({
      yearLevel: grade.yearLevel || '',
      semester: grade.semester || '',
      subjectCode: grade.subjectCode || '',
      subjectTitle: grade.subjectTitle || '',
      units: grade.units ?? '',
      finalGrade: grade.finalGrade || '',
      remarks: grade.remarks || '',
      schoolYear: grade.schoolYear || '',
    })),
  };
}

function DraftEditField({ label, value, onChange, type = 'text', disabled, className = 'col-md-4', required = false }) {
  return (
    <div className={className}>
      <label className="form-label small fw-semibold">{label}</label>
      <input
        type={type}
        className="form-control form-control-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required={required}
      />
    </div>
  );
}

function DraftActionMenu({ actions, isOpen, onToggle, onClose }) {
  if (!actions?.length) {
    return (
      <span className="d-inline-block" title="No available actions">
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled
          aria-label="No available actions"
        >
          <FaCog />
        </button>
      </span>
    );
  }

  return (
    <FloatingActionMenu
      isOpen={isOpen}
      onToggle={onToggle}
      onClose={onClose}
      buttonContent={<FaCog />}
      ariaLabel="Credential actions"
      menuWidth={230}
    >
      <div className="list-group list-group-flush">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            className={`list-group-item list-group-item-action ${
              action.variant === 'danger' ? 'text-danger' : ''
            }`}
            onClick={() => {
              onClose();
              action.onClick();
            }}
            disabled={action.disabled}
            title={action.title || ''}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </FloatingActionMenu>
  );
}

function BulkActionMenu({ actions, selectedCount, loading, isOpen, onToggle, onClose }) {
  if (!actions?.length || selectedCount === 0) {
    return (
      <button type="button" className="btn btn-success btn-sm flex-fill" disabled>
        Bulk Actions ({selectedCount})
      </button>
    );
  }

  return (
    <FloatingActionMenu
      isOpen={isOpen}
      onToggle={onToggle}
      onClose={onClose}
      buttonClassName="btn btn-success btn-sm flex-fill"
      buttonContent={
        <span className="d-inline-flex align-items-center gap-2">
          <FaCog />
          <span>Bulk Actions ({selectedCount})</span>
        </span>
      }
      ariaLabel="Bulk credential actions"
      menuWidth={260}
    >
      <div className="list-group list-group-flush">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            className={`list-group-item list-group-item-action ${
              action.variant === 'danger' ? 'text-danger' : ''
            }`}
            onClick={() => {
              onClose();
              action.onClick();
            }}
            disabled={loading || action.disabled}
            title={action.title || ''}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </FloatingActionMenu>
  );
}

function ModalShell({ title, subtitle, children, footer, onClose, size = '', scrollable = false }) {
  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className={`modal-dialog modal-dialog-centered ${scrollable ? 'modal-dialog-scrollable' : ''} ${size}`}>
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 className="h5 mb-1">{title}</h2>
                {subtitle ? <p className="text-muted mb-0 small">{subtitle}</p> : null}
              </div>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>
            <div className="modal-body">{children}</div>
            {footer ? <div className="modal-footer">{footer}</div> : null}
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" onClick={onClose} />
    </>
  );
}

function ConfirmModal({ action, busy, onCancel, onConfirm }) {
  if (!action) return null;

  return (
    <ModalShell
      title={action.title}
      subtitle={action.subtitle}
      onClose={busy ? () => {} : onCancel}
      footer={
        <>
          <button className="btn btn-outline-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className={`btn btn-${action.variant || 'primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working...' : action.confirmLabel || 'Confirm'}
          </button>
        </>
      }
    >
      {action.details ? <div className="alert alert-light border mb-0">{action.details}</div> : null}
    </ModalShell>
  );
}

function ReasonModal({ action, busy, onCancel, onConfirm }) {
  const [reason, setReason] = useState(action?.initialReason || '');

  if (!action) return null;

  const meaningful = reason.trim().length >= 8;

  return (
    <ModalShell
      title={action.title}
      subtitle={action.subtitle}
      onClose={busy ? () => {} : onCancel}
      footer={
        <>
          <button className="btn btn-outline-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className={`btn btn-${action.variant || 'primary'}`}
            onClick={() => onConfirm(reason.trim())}
            disabled={busy || !meaningful}
          >
            {busy ? 'Working...' : action.confirmLabel || 'Confirm'}
          </button>
        </>
      }
    >
      <label className="form-label fw-semibold">Reason</label>
      <textarea
        className="form-control"
        rows="4"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder={action.placeholder || 'Enter a clear reason'}
        disabled={busy}
      />
      <div className="form-text">A short audit reason is required.</div>
    </ModalShell>
  );
}

function QueueProcessModal({
  open,
  summary,
  rows,
  result,
  error,
  busy,
  onClose,
  onProcess,
  onView,
}) {
  if (!open) return null;

  const queueRows = getAnchorQueueRows(summary, rows);
  const pendingCount = summary?.pendingCount ?? queueRows.length;

  return (
    <ModalShell
      title="Process Today's Anchor Queue"
      subtitle="Review credentials scheduled for anchoring today or earlier."
      onClose={busy ? () => {} : onClose}
      size="modal-xl"
      scrollable
      footer={
        <>
          <button className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>
            Close
          </button>
          <button
            className="btn btn-warning"
            onClick={onProcess}
            disabled={busy || pendingCount <= 0}
          >
            {busy ? 'Processing...' : 'Process Queue'}
          </button>
        </>
      }
    >
      <div className="d-flex flex-column gap-3">
        {error ? <div className="alert alert-danger mb-0">{error}</div> : null}

        <div className="alert alert-light border mb-0">
          <strong>{pendingCount || 0}</strong> credential(s) are currently due for anchoring.
          {summary?.dueAt ? (
            <span className="text-muted"> Queue cutoff: {formatDate(summary.dueAt)}.</span>
          ) : null}
        </div>

        {queueRows.length ? (
          <div className="table-responsive border rounded-3">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Credential</th>
                  <th>Scheduled</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queueRows.map((item) => {
                  const id = getDraftId(item);
                  return (
                    <tr key={id || `${item.studentNo}-${item.scheduledAnchorAt}`}>
                      <td>
                        <div className="fw-semibold">{item.studentName || 'Not available'}</div>
                        <div className="small text-muted">{item.studentNo || 'No student number'}</div>
                      </td>
                      <td>{credentialLabel(item.credentialType || 'student_record')}</td>
                      <td>{formatDate(item.scheduledAnchorAt || item.anchorScheduledAt || item.anchorDueAt)}</td>
                      <td>
                        <span className={`badge ${anchorStatusBadge(item)}`}>
                          {anchorStatusLabel(item)}
                        </span>
                      </td>
                      <td className="text-end">
                        <button
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => id && onView(id)}
                          disabled={!id || busy}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>
            The API returned a summary count only. The queue can still be processed from here, and
            row details will appear automatically when the API provides them or when matching rows
            are present in the current VC list.
          </EmptyState>
        )}

        {result ? (
          <div className="border rounded-3 p-3">
            <h3 className="h6 mb-3">Processing Result</h3>
            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <div className="border rounded-3 p-3 h-100">
                  <div className="small text-muted">Processed</div>
                  <div className="h4 mb-0">{result.processedCount || 0}</div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="border rounded-3 p-3 h-100">
                  <div className="small text-muted">Failed</div>
                  <div className="h4 mb-0">{result.failedCount || 0}</div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="border rounded-3 p-3 h-100">
                  <div className="small text-muted">Skipped</div>
                  <div className="h4 mb-0">{result.skippedCount || 0}</div>
                </div>
              </div>
            </div>

            {result.failed?.length ? (
              <div className="mb-3">
                <h4 className="h6">Failed items</h4>
                <ul className="list-group">
                  {result.failed.map((item) => (
                    <li className="list-group-item small" key={item.id}>
                      <strong>{item.id}</strong>: {item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.skipped?.length ? (
              <div>
                <h4 className="h6">Skipped items</h4>
                <ul className="list-group">
                  {result.skipped.map((item) => (
                    <li className="list-group-item small" key={item.id}>
                      <strong>{item.id}</strong>: {item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </ModalShell>
  );
}

function DraftDetailsModal({ draft, onClose }) {
  const [activeTab, setActiveTab] = useState('student');

  if (!draft) return null;

  const profile = draft.profileSnapshot || {};
  const grades = draft.gradesSnapshot || [];
  const signedProof = draft.signedCredential?.proof || null;
  const lastVerification = draft.lastVerificationResult || null;
  const hasPaymentData = hasAnyValue(
    draft.paymentCode,
    draft.receiptNo,
    draft.amount,
    draft.paidAt,
    draft.paymentStatus
  );
  const hasClaimAnchorData =
    (hasSignedCredential(draft) || isCredentialClaimed(draft) || isAnchored(draft)) &&
    hasAnyValue(
      draft.claimedAt,
      draft.claimTokenExpiresAt,
      draft.anchorStatus,
      draft.scheduledAnchorAt,
      draft.anchoredAt,
      draft.contractAddress,
      draft.anchorContractAddress,
      draft.anchorTxHash,
      draft.merkleRoot,
      draft.anchorFailureReason,
      draft.anchoringUnavailableReason
    );
  const tabs = [
    { key: 'student', label: 'Student Data & Grades' },
    ...(hasPaymentData ? [{ key: 'payment', label: 'Payment' }] : []),
    ...(hasClaimAnchorData ? [{ key: 'claimAnchor', label: 'Claim & Anchor' }] : []),
    ...(signedProof ? [{ key: 'proof', label: 'Proof' }] : []),
    ...(lastVerification ? [{ key: 'verification', label: 'Verification' }] : []),
  ];
  const visibleTab = tabs.some((tab) => tab.key === activeTab) ? activeTab : 'student';

  return (
    <ModalShell
      title="Credential Details"
      subtitle={`${draft.studentNo || 'Student'} - ${draft.studentName || 'Not available'}`}
      onClose={onClose}
      size="modal-xl"
      scrollable
      footer={
        <button className="btn btn-outline-secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="d-flex flex-column gap-4">
        <div className="row g-3">
          <SummaryTile label="Status">
            <span className={`badge ${getStatusBadge(draft.status)}`}>{titleCase(draft.status)}</span>
          </SummaryTile>
          <SummaryTile label="Payment">
            <span className={`badge ${getPaymentBadge(draft)}`}>
              {isCredentialPaid(draft) ? 'Paid' : 'Unpaid'}
            </span>
          </SummaryTile>
          <SummaryTile label="Created">{formatDate(draft.createdAt)}</SummaryTile>
          <SummaryTile label="Updated">{formatDate(draft.updatedAt)}</SummaryTile>
        </div>

        <div>
          <ul className="nav nav-tabs">
            {tabs.map((tab) => (
              <li className="nav-item" key={tab.key}>
                <button
                  type="button"
                  className={`nav-link ${visibleTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>

          <div className="border border-top-0 rounded-bottom p-3 bg-white">
            {visibleTab === 'student' ? (
              <div className="d-flex flex-column gap-3">
                <div className="row g-3">
                  <FieldValue label="Student No" className="col-md-4">
                    {profile.studentNo || draft.studentNo}
                  </FieldValue>
                  <FieldValue label="Student Name" className="col-md-4">
                    {profile.studentName || draft.studentName}
                  </FieldValue>
                  <FieldValue label="Credential" className="col-md-4">
                    {credentialLabel(draft.credentialType || 'student_record')}
                  </FieldValue>
                  <FieldValue label="Program" className="col-md-4">
                    {[profile.programCode, profile.programName].filter(Boolean).join(' - ')}
                  </FieldValue>
                  <FieldValue label="Curriculum Year" className="col-md-4">
                    {profile.curriculumYear}
                  </FieldValue>
                  <FieldValue label="Major" className="col-md-4">
                    {profile.major}
                  </FieldValue>
                  <FieldValue label="Date Admitted" className="col-md-4">
                    {formatDate(profile.dateAdmission)}
                  </FieldValue>
                  <FieldValue label="Date Graduated" className="col-md-4">
                    {formatDate(profile.dateGraduated || profile.dateGraduation)}
                  </FieldValue>
                  <FieldValue label="Gender" className="col-md-4">
                    {profile.gender}
                  </FieldValue>
                  <FieldValue label="Permanent Address" className="col-md-6">
                    {profile.permanentAddress}
                  </FieldValue>
                  <FieldValue label="Residential Address" className="col-md-6">
                    {profile.residentialAddress}
                  </FieldValue>
                </div>

                <div>
                  <h3 className="h6 mb-2">Grades</h3>
                  <GradesTable grades={grades} />
                </div>
              </div>
            ) : null}

            {visibleTab === 'payment' ? (
              <div className="row g-3">
                <FieldValue label="Payment Code" className="col-md-3">
                  {draft.paymentCode || 'Not generated'}
                </FieldValue>
                <FieldValue label="Receipt No" className="col-md-3">
                  {draft.receiptNo || 'Not paid yet'}
                </FieldValue>
                <FieldValue label="Amount" className="col-md-3">
                  {formatCurrency(draft.amount)}
                </FieldValue>
                <FieldValue label="Paid At" className="col-md-3">
                  {formatDate(draft.paidAt)}
                </FieldValue>
              </div>
            ) : null}

            {visibleTab === 'claimAnchor' ? (
              <div className="row g-3">
                <FieldValue label="Claimed At" className="col-md-3">
                  {formatDate(draft.claimedAt)}
                </FieldValue>
                <FieldValue label="Claim Token Expires" className="col-md-3">
                  {formatDate(draft.claimTokenExpiresAt)}
                </FieldValue>
                <FieldValue label="Anchor Status" className="col-md-3">
                  {titleCase(draft.anchorStatus || 'not_requested')}
                </FieldValue>
                <FieldValue label="Scheduled Anchor" className="col-md-3">
                  {formatDate(draft.scheduledAnchorAt)}
                </FieldValue>
                <FieldValue label="Anchored At" className="col-md-3">
                  {formatDate(draft.anchoredAt)}
                </FieldValue>
                <FieldValue label="Contract" className="col-md-5">
                  {draft.anchorContractAddress || draft.contractAddress}
                </FieldValue>
                <FieldValue label="Anchor Hash" className="col-md-4">
                  {draft.anchorTxHash}
                </FieldValue>
                <FieldValue label="Merkle Root" className="col-md-6">
                  {draft.merkleRoot}
                </FieldValue>
                <FieldValue label="Anchor Availability" className="col-md-6">
                  {draft.anchorFailureReason || draft.anchoringUnavailableReason}
                </FieldValue>
              </div>
            ) : null}

            {visibleTab === 'proof' ? (
              <div className="row g-3">
                <FieldValue label="Proof Type" className="col-md-4">
                  {signedProof?.type}
                </FieldValue>
                <FieldValue label="Signature Algorithm" className="col-md-4">
                  {draft.signatureAlgorithm || signedProof?.signatureAlgorithm}
                </FieldValue>
                <FieldValue label="Canonicalization" className="col-md-4">
                  {draft.canonicalizationAlgorithm || signedProof?.canonicalizationAlgorithm}
                </FieldValue>
                <FieldValue label="Verification Method" className="col-md-6">
                  {draft.verificationMethod || signedProof?.verificationMethod}
                </FieldValue>
                <FieldValue label="Issuer Key ID" className="col-md-6">
                  {draft.issuerKeyId || signedProof?.issuerKeyId}
                </FieldValue>
                <FieldValue label="VC Hash" className="col-12">
                  {draft.vcHash || signedProof?.vcHash || draft.credentialHash}
                </FieldValue>
                <FieldValue label="Merkle Leaf" className="col-md-6">
                  {draft.merkleLeaf}
                </FieldValue>
                <FieldValue label="Merkle Proof" className="col-md-6">
                  {draft.merkleProof?.length ? draft.merkleProof.join(' | ') : ''}
                </FieldValue>
              </div>
            ) : null}

            {visibleTab === 'verification' ? (
              <div className="row g-3">
                <FieldValue label="Status" className="col-md-3">
                  <span className={`badge ${lastVerification?.verified ? 'bg-success' : 'bg-warning text-dark'}`}>
                    {titleCase(lastVerification?.status || 'unknown')}
                  </span>
                </FieldValue>
                <FieldValue label="Payload Verified" className="col-md-3">
                  {lastVerification?.payloadVerified ? 'Yes' : 'No'}
                </FieldValue>
                <FieldValue label="Blockchain" className="col-md-6">
                  {lastVerification?.checks?.blockchain?.verified
                    ? 'Verified'
                    : lastVerification?.checks?.blockchain?.reason || 'Unavailable'}
                </FieldValue>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function DraftEditModal({ draft, onClose, onSave, saving }) {
  const [activeTab, setActiveTab] = useState('student');
  const [form, setForm] = useState(() => createDraftEditForm(draft));
  const [localError, setLocalError] = useState('');

  if (!draft) return null;

  function updateProfile(field, value) {
    setForm((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        [field]: value,
      },
    }));
  }

  function updateGrade(index, field, value) {
    setForm((prev) => ({
      ...prev,
      grades: prev.grades.map((grade, gradeIndex) =>
        gradeIndex === index ? { ...grade, [field]: value } : grade
      ),
    }));
  }

  function addGrade() {
    setForm((prev) => ({
      ...prev,
      grades: [
        ...prev.grades,
        {
          yearLevel: '',
          semester: '',
          subjectCode: '',
          subjectTitle: '',
          units: '',
          finalGrade: '',
          remarks: '',
          schoolYear: '',
        },
      ],
    }));
  }

  function removeGrade(index) {
    setForm((prev) => ({
      ...prev,
      grades: prev.grades.filter((_, gradeIndex) => gradeIndex !== index),
    }));
  }

  function save() {
    const studentNo = cleanText(form.profile.studentNo);
    const studentName = cleanText(form.profile.studentName);

    if (!studentNo || !studentName) {
      setLocalError('Student number and student name are required.');
      return;
    }

    const grades = form.grades.filter((grade) =>
      Object.values(grade).some((value) => cleanText(value))
    );
    const incompleteGrade = grades.find(
      (grade) =>
        !cleanText(grade.subjectCode) ||
        !cleanText(grade.subjectTitle) ||
        !cleanText(grade.finalGrade)
    );

    if (incompleteGrade) {
      setLocalError('Each grade row needs a subject code, subject title, and final grade.');
      setActiveTab('grades');
      return;
    }

    setLocalError('');
    onSave({
      credentialType: form.credentialType,
      notes: form.notes,
      profileSnapshot: {
        ...form.profile,
        studentNo,
        studentName,
      },
      gradesSnapshot: grades,
    });
  }

  return (
    <ModalShell
      title="Edit Credential Draft"
      subtitle={`${draft.studentNo || 'Student'} - ${draft.studentName || 'Not available'}`}
      onClose={onClose}
      size="modal-xl"
      scrollable
      footer={
        <>
          <button className="btn btn-outline-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
        </>
      }
    >
      <div className="d-flex flex-column gap-3">
        {localError ? <div className="alert alert-danger mb-0">{localError}</div> : null}

        <ul className="nav nav-tabs">
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link ${activeTab === 'student' ? 'active' : ''}`}
              onClick={() => setActiveTab('student')}
            >
              Profile
            </button>
          </li>
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link ${activeTab === 'grades' ? 'active' : ''}`}
              onClick={() => setActiveTab('grades')}
            >
              Grades
            </button>
          </li>
        </ul>

        <div className="border border-top-0 rounded-bottom p-3 bg-white">
          {activeTab === 'student' ? (
            <div className="d-flex flex-column gap-3">
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Credential Type</label>
                  <select
                    className="form-select form-select-sm"
                    value={form.credentialType}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, credentialType: event.target.value }))
                    }
                    disabled={saving}
                  >
                    <option value="tor">TOR</option>
                    <option value="diploma">Diploma</option>
                  </select>
                </div>
                <DraftEditField
                  label="Student No"
                  value={form.profile.studentNo}
                  onChange={(value) => updateProfile('studentNo', value)}
                  disabled={saving}
                  required
                />
                <DraftEditField
                  label="Student Name"
                  value={form.profile.studentName}
                  onChange={(value) => updateProfile('studentName', value)}
                  disabled={saving}
                  className="col-md-4"
                  required
                />
                <DraftEditField
                  label="Program Code"
                  value={form.profile.programCode}
                  onChange={(value) => updateProfile('programCode', value)}
                  disabled={saving}
                />
                <DraftEditField
                  label="Program Name"
                  value={form.profile.programName}
                  onChange={(value) => updateProfile('programName', value)}
                  disabled={saving}
                  className="col-md-8"
                />
                <DraftEditField
                  label="Curriculum Year"
                  value={form.profile.curriculumYear}
                  onChange={(value) => updateProfile('curriculumYear', value)}
                  disabled={saving}
                />
                <DraftEditField
                  label="Major"
                  value={form.profile.major}
                  onChange={(value) => updateProfile('major', value)}
                  disabled={saving}
                />
                <DraftEditField
                  label="Gender"
                  value={form.profile.gender}
                  onChange={(value) => updateProfile('gender', value)}
                  disabled={saving}
                />
                <DraftEditField
                  label="Date Admission"
                  value={form.profile.dateAdmission}
                  onChange={(value) => updateProfile('dateAdmission', value)}
                  type="date"
                  disabled={saving}
                />
                <DraftEditField
                  label="Date Graduated"
                  value={form.profile.dateGraduated}
                  onChange={(value) => updateProfile('dateGraduated', value)}
                  type="date"
                  disabled={saving}
                />
                <DraftEditField
                  label="Place of Birth"
                  value={form.profile.placeBirth}
                  onChange={(value) => updateProfile('placeBirth', value)}
                  disabled={saving}
                />
                <DraftEditField
                  label="High School"
                  value={form.profile.highSchool}
                  onChange={(value) => updateProfile('highSchool', value)}
                  disabled={saving}
                />
                <DraftEditField
                  label="Entrance Credentials"
                  value={form.profile.entranceCredentials}
                  onChange={(value) => updateProfile('entranceCredentials', value)}
                  disabled={saving}
                />
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Permanent Address</label>
                  <textarea
                    className="form-control form-control-sm"
                    rows="2"
                    value={form.profile.permanentAddress}
                    onChange={(event) => updateProfile('permanentAddress', event.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Residential Address</label>
                  <textarea
                    className="form-control form-control-sm"
                    rows="2"
                    value={form.profile.residentialAddress}
                    onChange={(event) => updateProfile('residentialAddress', event.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="col-12">
                <label className="form-label small fw-semibold">Notes</label>
                <textarea
                  className="form-control form-control-sm"
                  rows="3"
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  disabled={saving}
                />
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'grades' ? (
            <div className="d-flex flex-column gap-3">
              <div className="d-flex justify-content-end">
                <button className="btn btn-outline-primary btn-sm" type="button" onClick={addGrade} disabled={saving}>
                  Add Grade
                </button>
              </div>

              {!form.grades.length ? (
                <EmptyState>No grades are attached to this draft yet.</EmptyState>
              ) : (
                <div className="table-responsive border rounded-3">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th style={{ minWidth: 110 }}>Year</th>
                        <th style={{ minWidth: 120 }}>Semester</th>
                        <th style={{ minWidth: 130 }}>Code</th>
                        <th style={{ minWidth: 220 }}>Subject Title</th>
                        <th style={{ minWidth: 90 }}>Units</th>
                        <th style={{ minWidth: 100 }}>Grade</th>
                        <th style={{ minWidth: 140 }}>Remarks</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.grades.map((grade, index) => (
                        <tr key={`${grade.subjectCode}-${index}`}>
                          {[
                            ['yearLevel', 'Year'],
                            ['semester', 'Semester'],
                            ['subjectCode', 'Code'],
                            ['subjectTitle', 'Subject Title'],
                            ['units', 'Units'],
                            ['finalGrade', 'Grade'],
                            ['remarks', 'Remarks'],
                          ].map(([field, label]) => (
                            <td key={field}>
                              <input
                                className="form-control form-control-sm"
                                value={grade[field] ?? ''}
                                onChange={(event) => updateGrade(index, field, event.target.value)}
                                placeholder={label}
                                disabled={saving}
                              />
                            </td>
                          ))}
                          <td className="text-end">
                            <button
                              className="btn btn-outline-danger btn-sm"
                              type="button"
                              onClick={() => removeGrade(index)}
                              disabled={saving}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </ModalShell>
  );
}

function ClaimQrModal({ claimQr, onClose, onRefresh }) {
  const [remainingSeconds, setRemainingSeconds] = useState(
    claimQr?.initialRemainingSeconds || 0
  );

  useEffect(() => {
    if (!claimQr) return undefined;

    const timer = window.setInterval(() => {
      setRemainingSeconds(
        Math.max(0, Math.floor(((claimQr.expiresAtMs || 0) - Date.now()) / 1000))
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [claimQr]);

  if (!claimQr) return null;

  const isExpired = remainingSeconds <= 0;
  const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const seconds = String(remainingSeconds % 60).padStart(2, '0');

  return (
    <ModalShell
      title={claimQr.override ? 'Override Claim QR' : 'Claim QR'}
      subtitle={`${claimQr.credential?.studentNo || 'Student'} - scan with the mobile app.`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline-secondary" onClick={onRefresh}>
            Refresh List
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <div className="text-center">
        {claimQr.dataUrl ? (
          <img
            src={claimQr.dataUrl}
            width="260"
            height="260"
            alt="Credential claim QR"
            className="border rounded-3 p-2 bg-white"
          />
        ) : null}

        <div className="mt-3">
          <span className={`badge ${isExpired ? 'text-bg-danger' : 'text-bg-success'}`}>
            {isExpired ? 'Expired' : `Expires in ${minutes}:${seconds}`}
          </span>
        </div>

        <div className="small text-muted mt-3 text-break">{claimQr.claimUri}</div>
        <div className="alert alert-light border mt-3 mb-0 text-start small">
          The QR contains a temporary claim token. The signed VC is delivered only after
          the student signs in and claims it from the backend.
        </div>
      </div>
    </ModalShell>
  );
}

function PaymentConfirmModal({ draft, busy, onClose, onConfirm }) {
  const [anchorMode, setAnchorMode] = useState('default');
  const [amount, setAmount] = useState(draft ? String(priceForAnchorMode('default')) : '');
  const [receiptNo, setReceiptNo] = useState(draft ? generateReceiptNo() : '');
  const [localError, setLocalError] = useState('');

  if (!draft) return null;

  const mode = normalizeAnchorMode(anchorMode);
  const scheduledPreview = defaultAnchorDueDate();

  function changeAnchorMode(value) {
    const nextMode = normalizeAnchorMode(value);
    setAnchorMode(nextMode);
    setAmount(String(priceForAnchorMode(nextMode)));
  }

  function submit() {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setLocalError('Amount must be numeric and greater than 0.');
      return;
    }
    if (!/^\d{6}$/.test(receiptNo)) {
      setLocalError('Receipt number must be 6 digits.');
      return;
    }
    setLocalError('');
    onConfirm({ amount: numericAmount, receiptNo, anchorMode: mode });
  }

  return (
    <ModalShell
      title="Confirm Payment"
      subtitle="Review the payment details before marking this request as paid."
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-success" onClick={submit} disabled={busy}>
            {busy ? 'Saving...' : 'Confirm Payment'}
          </button>
        </>
      }
    >
      <div className="d-flex flex-column gap-3">
        {localError ? <div className="alert alert-danger mb-0">{localError}</div> : null}
        <div className="row g-3">
          <FieldValue label="Student" className="col-md-6">{draft.studentName}</FieldValue>
          <FieldValue label="Student Number" className="col-md-6">{draft.studentNo}</FieldValue>
          <FieldValue label="Credential Type" className="col-md-6">{credentialLabel(draft.credentialType)}</FieldValue>
          <FieldValue label="Anchor Mode" className="col-md-6">{anchorModeLabel(mode)}</FieldValue>
        </div>
        <div>
          <label className="form-label fw-semibold">Anchor Schedule</label>
          <select
            className="form-select"
            value={mode}
            onChange={(event) => changeAnchorMode(event.target.value)}
            disabled={busy}
          >
            <option value="default">Default: Anchor after 7 days</option>
            <option value="anchor_now">Anchor Now: Priority queue</option>
          </select>
        </div>
        <div className="alert alert-light border mb-0">
          {mode === 'anchor_now'
            ? 'Will enter the anchor queue once the VC is signed and paid.'
            : `Scheduled anchor date preview: ${formatDate(scheduledPreview)}.`}{' '}
          {anchorNowText(mode)}
        </div>
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label fw-semibold">Receipt Number</label>
            <input
              className="form-control"
              value={receiptNo}
              onChange={(event) => setReceiptNo(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label fw-semibold">Amount</label>
            <input
              className="form-control"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
            />
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function DraftSubmitModal({ draft, busy, onClose, onConfirm }) {
  const initialMode = normalizeAnchorMode(draft?.anchorMode, draft?.anchorNow);
  const [credentialType, setCredentialType] = useState(draft?.credentialType || 'tor');
  const [anchorMode, setAnchorMode] = useState(initialMode);
  const [amount, setAmount] = useState(
    draft ? String(draft.amount || draft.totalAmount || priceForAnchorMode(initialMode)) : '150'
  );
  const [localError, setLocalError] = useState('');

  if (!draft) return null;

  function changeAnchorMode(nextMode) {
    setAnchorMode(nextMode);
    setAmount(String(priceForAnchorMode(nextMode)));
  }

  function submit() {
    const numericAmount = Number(amount);
    if (!['tor', 'diploma'].includes(credentialType)) {
      setLocalError('Credential type must be Diploma or TOR.');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setLocalError('Price must be numeric and greater than 0.');
      return;
    }
    setLocalError('');
    onConfirm({
      credentialType,
      anchorMode,
      anchorNow: anchorMode === 'anchor_now',
      amount: numericAmount,
      totalAmount: numericAmount,
    });
  }

  return (
    <ModalShell
      title="Submit Credential Draft"
      subtitle="Set pricing and anchor handling before sending the draft to the signing queue."
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Submitting...' : 'Submit Draft'}
          </button>
        </>
      }
    >
      <div className="d-flex flex-column gap-3">
        {localError ? <div className="alert alert-danger mb-0">{localError}</div> : null}
        <div className="row g-3">
          <FieldValue label="Student" className="col-md-6">{draft.studentName}</FieldValue>
          <FieldValue label="Student Number" className="col-md-6">{draft.studentNo}</FieldValue>
          <div className="col-md-6">
            <label className="form-label fw-semibold">Credential Type</label>
            <select className="form-select" value={credentialType} onChange={(event) => setCredentialType(event.target.value)}>
              <option value="diploma">Diploma</option>
              <option value="tor">TOR</option>
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label fw-semibold">Anchor Option</label>
            <select className="form-select" value={anchorMode} onChange={(event) => changeAnchorMode(event.target.value)}>
              <option value="default">Default</option>
              <option value="anchor_now">Anchor Now</option>
            </select>
          </div>
        </div>
        <div className="alert alert-light border mb-0">{anchorNowText(anchorMode)}</div>
        <div>
          <label className="form-label fw-semibold">Price</label>
          <input
            className="form-control"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
          />
          <div className="form-text">Cashier can still edit the amount during payment confirmation.</div>
        </div>
      </div>
    </ModalShell>
  );
}

function PaymentTable({
  rows,
  loading,
  busyId,
  search,
  status,
  onSearch,
  onStatus,
  onApply,
  onMarkPaid,
}) {
  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
          <div>
            <h2 className="h5 mb-1">Payment Requests</h2>
            <p className="text-muted mb-0">Cashier workflow for confirming payments.</p>
          </div>
          <button className="btn btn-outline-secondary" onClick={onApply} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="row g-3 align-items-end mb-3">
          <div className="col-md-6">
            <label className="form-label">Search</label>
            <input
              className="form-control"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Payment code, receipt, student no, or name"
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">Payment Status</label>
            <select
              className="form-select"
              value={status}
              onChange={(event) => onStatus(event.target.value)}
            >
              <option value="">All</option>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div className="col-md-3 d-grid">
            <button className="btn btn-primary" onClick={onApply} disabled={loading}>
              Apply
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-muted">Loading payment requests...</div>
        ) : rows.length === 0 ? (
          <div className="alert alert-light border mb-0">No payment requests found.</div>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Credential</th>
                  <th>Anchor</th>
                  <th>Payment</th>
                  <th>Receipt</th>
                  <th>Amount</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item._id}>
                    <td style={{ maxWidth: 220 }}>
                      <div className="fw-semibold text-truncate">{item.studentName}</div>
                      <div className="small text-muted text-truncate">{item.studentNo}</div>
                    </td>
                    <td>{titleCase(item.credentialType || 'student_record')}</td>
                    <td>
                      <span className="badge text-bg-light border">
                        {anchorModeLabel(item.anchorMode || (item.anchorNow ? 'anchor_now' : 'default'))}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getPaymentBadge(item)}`}>
                        {isCredentialPaid(item) ? 'Paid' : 'Unpaid'}
                      </span>
                      <div className="small text-muted text-truncate" style={{ maxWidth: 160 }}>
                        {item.paymentCode || 'Not generated'}
                      </div>
                    </td>
                    <td>{item.receiptNo || 'Not paid yet'}</td>
                    <td>{formatCurrency(item.amount || item.totalAmount)}</td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => onMarkPaid(item)}
                        disabled={busyId === item._id || isCredentialPaid(item)}
                      >
                        {isCredentialPaid(item) ? 'Paid' : 'Mark Paid'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CredentialTableShell({ title, loading, hasRows, emptyText, filters, onRefresh, children }) {
  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
          <h2 className="h5 mb-0">{title}</h2>
          <button className="btn btn-outline-secondary btn-sm" onClick={onRefresh} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {filters}

        {loading ? (
          <div className="text-muted">Loading credentials...</div>
        ) : !hasRows ? (
          <div className="alert alert-light border mb-0">{emptyText}</div>
        ) : (
          <div className="table-responsive">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

function RowActionCell({
  item,
  busyId,
  detailsLabel = 'More Details',
  onDetails,
  actions,
  detailsInMenu = false,
  isMenuOpen,
  onToggleMenu,
  onCloseMenu,
}) {
  const menuActions = detailsInMenu
    ? [
        {
          key: 'view-details',
          label: 'View Details',
          icon: <FaEye />,
          onClick: () => onDetails(item._id),
          disabled: busyId === item._id,
        },
        ...(actions || []),
      ]
    : actions;

  return (
    <div className="d-inline-flex flex-wrap justify-content-end gap-2">
      {!detailsInMenu ? (
        <button
          className="btn btn-outline-primary btn-sm text-nowrap"
          onClick={() => onDetails(item._id)}
          disabled={busyId === item._id}
        >
          {detailsLabel}
        </button>
      ) : null}
      <DraftActionMenu
        actions={menuActions}
        isOpen={isMenuOpen}
        onToggle={onToggleMenu}
        onClose={onCloseMenu}
      />
    </div>
  );
}

function VcProcessingTable({
  rows,
  loading,
  busyId,
  paymentStatus,
  search,
  selectedIds,
  selectedCount,
  page,
  pageCount,
  onPaymentStatus,
  onSearch,
  onRefresh,
  onDetails,
  onToggleSelected,
  onTogglePage,
  onPage,
  canSelectRow,
  bulkActions,
  bulkMenuOpen,
  onToggleBulkMenu,
  onCloseBulkMenu,
  getActions,
  actionMenuOpenId,
  onToggleActionMenu,
  onCloseActionMenu,
}) {
  const selectableIds = rows
    .filter((item) => canSelectRow(item))
    .map((item) => item._id);
  const allPageSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
  const somePageSelected = selectableIds.some((id) => selectedIds.has(id));

  return (
    <CredentialTableShell
      title="VC"
      loading={loading}
      hasRows={rows.length > 0}
      emptyText="No credentials are waiting for processing."
      onRefresh={onRefresh}
      filters={
        <div className="row g-2 align-items-end mb-3">
          <div className="col-md-3 col-lg-2">
            <label className="form-label small fw-semibold" htmlFor="vc-payment-status">
              Payment Status
            </label>
            <select
              id="vc-payment-status"
              className="form-select form-select-sm"
              value={paymentStatus}
              onChange={(event) => onPaymentStatus(event.target.value)}
            >
              <option value="">All</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>
          <div className="col-md-5 col-lg-4">
            <label className="form-label small fw-semibold" htmlFor="vc-student-search">
              Search
            </label>
            <input
              id="vc-student-search"
              className="form-control form-control-sm"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Name, student number, credential type, or status"
            />
          </div>
          <div className="col-md-4 col-lg-3 d-flex gap-2">
            <button className="btn btn-outline-secondary btn-sm flex-fill" onClick={onRefresh} disabled={loading}>
              Refresh
            </button>
            <BulkActionMenu
              actions={bulkActions}
              selectedCount={selectedCount}
              loading={loading}
              isOpen={bulkMenuOpen}
              onToggle={onToggleBulkMenu}
              onClose={onCloseBulkMenu}
            />
          </div>
        </div>
      }
    >
      <>
        <table className="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={allPageSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = !allPageSelected && somePageSelected;
                  }}
                  onChange={(event) => onTogglePage(selectableIds, event.target.checked)}
                  disabled={selectableIds.length === 0}
                  aria-label="Select visible credentials"
                />
              </th>
              <th>Student</th>
              <th>Credential</th>
              <th>Payment</th>
              <th>Anchor</th>
              <th>Status</th>
              <th className="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const selectable = canSelectRow(item);
              return (
                <tr key={item._id}>
                  <td>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={selectedIds.has(item._id)}
                      onChange={(event) => onToggleSelected(item._id, event.target.checked)}
                      disabled={!selectable}
                      aria-label={`Select ${item.studentName || 'credential draft'}`}
                    />
                  </td>
                  <td>
                    <div className="fw-semibold">{item.studentName || 'Not available'}</div>
                    <div className="small text-muted">{item.studentNo || 'No student number'}</div>
                  </td>
                  <td>{credentialLabel(item.credentialType)}</td>
                  <td>
                    <span className={`badge ${getPaymentBadge(item)}`}>
                      {isCredentialPaid(item) ? 'Paid' : 'Unpaid'}
                    </span>
                    <div className="small text-muted">{formatCurrency(item.amount || item.totalAmount)}</div>
                  </td>
                  <td>
                    <span className="badge text-bg-light border">{anchorModeLabel(item.anchorMode)}</span>
                    <div className="small text-muted">{anchorScheduleLabel(item)}</div>
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadge(item.status)}`}>{titleCase(item.status)}</span>
                  </td>
                  <td className="text-end">
                    <RowActionCell
                      item={item}
                      busyId={busyId}
                      onDetails={onDetails}
                      actions={getActions(item)}
                      isMenuOpen={actionMenuOpenId === item._id}
                      onToggleMenu={() => onToggleActionMenu(item._id)}
                      onCloseMenu={onCloseActionMenu}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 pt-3">
          <div className="small text-muted">
            Select up to {MAX_BULK_SELECTION} credentials for status-appropriate bulk actions.
          </div>
          <div className="btn-group btn-group-sm" role="group" aria-label="VC pagination">
            <button
              className="btn btn-outline-secondary"
              onClick={() => onPage(Math.max(1, page - 1))}
              disabled={page <= 1}
            >
              Previous
            </button>
            <button className="btn btn-outline-secondary" disabled>
              Page {page} of {pageCount}
            </button>
            <button
              className="btn btn-outline-secondary"
              onClick={() => onPage(Math.min(pageCount, page + 1))}
              disabled={page >= pageCount}
            >
              Next
            </button>
          </div>
        </div>
      </>
    </CredentialTableShell>
  );
}

function SigningTable({
  rows,
  loading,
  busyId,
  paymentStatus,
  search,
  onPaymentStatus,
  onSearch,
  onRefresh,
  onDetails,
  getActions,
  actionMenuOpenId,
  onToggleActionMenu,
  onCloseActionMenu,
}) {
  return (
    <CredentialTableShell
      title="Signing"
      loading={loading}
      hasRows={rows.length > 0}
      emptyText="No credentials are ready for signing."
      onRefresh={onRefresh}
      filters={
        <div className="row g-2 align-items-end mb-3">
          <div className="col-md-3 col-lg-2">
            <label className="form-label small fw-semibold" htmlFor="signing-payment-status">
              Payment Status
            </label>
            <select
              id="signing-payment-status"
              className="form-select form-select-sm"
              value={paymentStatus}
              onChange={(event) => onPaymentStatus(event.target.value)}
            >
              <option value="">All</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>
          <div className="col-md-5 col-lg-4">
            <label className="form-label small fw-semibold" htmlFor="signing-student-search">
              Student Name
            </label>
            <input
              id="signing-student-search"
              className="form-control form-control-sm"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search student name"
            />
          </div>
        </div>
      }
    >
      <table className="table table-sm align-middle mb-0">
        <thead>
          <tr>
            <th>Student Name</th>
            <th>Credential</th>
            <th>Payment</th>
            <th>Signature Status</th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item._id}>
              <td className="fw-semibold">{item.studentName || 'Not available'}</td>
              <td>{credentialLabel(item.credentialType)}</td>
              <td>
                <span className={`badge ${getPaymentBadge(item)}`}>
                  {isCredentialPaid(item) ? 'Paid' : 'Unpaid'}
                </span>
              </td>
              <td>
                <span className={`badge ${signatureStatusBadge(item)}`}>
                  {signatureStatusLabel(item)}
                </span>
              </td>
              <td className="text-end">
                <RowActionCell
                  item={item}
                  busyId={busyId}
                  onDetails={onDetails}
                  actions={getActions(item)}
                  isMenuOpen={actionMenuOpenId === item._id}
                  onToggleMenu={() => onToggleActionMenu(item._id)}
                  onCloseMenu={onCloseActionMenu}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </CredentialTableShell>
  );
}

function AnchorProgressTable({
  rows,
  loading,
  busyId,
  schedule,
  status,
  search,
  onSchedule,
  onStatus,
  onSearch,
  onRefresh,
  onDetails,
  getActions,
  actionMenuOpenId,
  onToggleActionMenu,
  onCloseActionMenu,
}) {
  return (
    <CredentialTableShell
      title="Anchor"
      loading={loading}
      hasRows={rows.length > 0}
      emptyText="No credentials match the selected anchor filters."
      onRefresh={onRefresh}
      filters={
        <div className="row g-2 align-items-end mb-3">
          <div className="col-md-3 col-lg-2">
            <label className="form-label small fw-semibold" htmlFor="anchor-schedule">
              Schedule
            </label>
            <select
              id="anchor-schedule"
              className="form-select form-select-sm"
              value={schedule}
              onChange={(event) => onSchedule(event.target.value)}
            >
              <option value="today">Today</option>
              <option value="7days">7 Days</option>
            </select>
          </div>
          <div className="col-md-3 col-lg-2">
            <label className="form-label small fw-semibold" htmlFor="anchor-status">
              Status
            </label>
            <select
              id="anchor-status"
              className="form-select form-select-sm"
              value={status}
              onChange={(event) => onStatus(event.target.value)}
            >
              <option value="queued">Queued / Scheduled</option>
              <option value="scheduled">Scheduled</option>
              <option value="anchored">Anchored</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div className="col-md-5 col-lg-4">
            <label className="form-label small fw-semibold" htmlFor="anchor-search">
              Search
            </label>
            <input
              id="anchor-search"
              className="form-control form-control-sm"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Student, hash, batch, tx, or contract"
            />
          </div>
        </div>
      }
    >
      <table className="table table-sm align-middle mb-0">
        <thead>
          <tr>
            <th>Student Name</th>
            <th>Credential</th>
            <th>Anchor Status</th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item._id}>
              <td className="fw-semibold">{item.studentName || 'Not available'}</td>
              <td>{credentialLabel(item.credentialType)}</td>
              <td>
                <span className={`badge ${anchorStatusBadge(item)}`}>
                  {anchorStatusLabel(item)}
                </span>
              </td>
              <td className="text-end">
                <RowActionCell
                  item={item}
                  busyId={busyId}
                  detailsLabel="More Details"
                  onDetails={onDetails}
                  actions={getActions(item)}
                  detailsInMenu
                  isMenuOpen={actionMenuOpenId === item._id}
                  onToggleMenu={() => onToggleActionMenu(item._id)}
                  onCloseMenu={onCloseActionMenu}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </CredentialTableShell>
  );
}

function ClaimedCredentialsTable({
  rows,
  loading,
  busyId,
  anchorStatus,
  search,
  onAnchorStatus,
  onSearch,
  onRefresh,
  onDetails,
  getActions,
  actionMenuOpenId,
  onToggleActionMenu,
  onCloseActionMenu,
}) {
  return (
    <CredentialTableShell
      title="Claimed"
      loading={loading}
      hasRows={rows.length > 0}
      emptyText="No claimed credentials match the selected filters."
      onRefresh={onRefresh}
      filters={
        <div className="row g-2 align-items-end mb-3">
          <div className="col-md-3 col-lg-2">
            <label className="form-label small fw-semibold" htmlFor="claimed-anchor-status">
              Anchor Status
            </label>
            <select
              id="claimed-anchor-status"
              className="form-select form-select-sm"
              value={anchorStatus}
              onChange={(event) => onAnchorStatus(event.target.value)}
            >
              <option value="anchored">Anchored</option>
              <option value="not_anchored">Not Anchored</option>
            </select>
          </div>
          <div className="col-md-5 col-lg-4">
            <label className="form-label small fw-semibold" htmlFor="claimed-student-search">
              Student Name
            </label>
            <input
              id="claimed-student-search"
              className="form-control form-control-sm"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search student name"
            />
          </div>
        </div>
      }
    >
      <table className="table table-sm align-middle mb-0">
        <thead>
          <tr>
            <th>Student Name</th>
            <th>Credential</th>
            <th>Claimed Date</th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
              <tr key={item._id}>
                <td className="fw-semibold">{item.studentName || 'Not available'}</td>
                <td>{credentialLabel(item.credentialType)}</td>
                <td>{formatDate(item.claimedAt)}</td>
                <td className="text-end">
                  <RowActionCell
                    item={item}
                    busyId={busyId}
                    detailsLabel="More Details"
                    onDetails={onDetails}
                    actions={getActions(item)}
                    detailsInMenu
                    isMenuOpen={actionMenuOpenId === item._id}
                    onToggleMenu={() => onToggleActionMenu(item._id)}
                    onCloseMenu={onCloseActionMenu}
                  />
                </td>
              </tr>
          ))}
        </tbody>
      </table>
    </CredentialTableShell>
  );
}

export default function CredentialDraftsPage() {
  const [searchParams] = useSearchParams();
  const routeDraftId = searchParams.get('draftId') || '';
  const auth = useMemo(() => hasValidStoredAuth(), []);
  const currentUser = useMemo(() => auth?.user || {}, [auth?.user]);
  const currentRole = currentUser?.role || '';
  const canSeePaymentsTab = PAYMENT_TAB_ROLES.has(currentRole);
  const canManageDrafts = DRAFT_ADMIN_ROLES.has(currentRole);
  const canUseRegistrarActions = REGISTRAR_ACTION_ROLES.has(currentRole);
  const canUseBulkActions = canManageDrafts || canUseRegistrarActions;
  const cashierOnly = currentRole === 'cashier';

  const [rows, setRows] = useState([]);
  const [paymentRows, setPaymentRows] = useState([]);
  const [activeTab, setActiveTab] = useState(cashierOnly ? 'payments' : 'drafts');
  const [vcPaymentFilter, setVcPaymentFilter] = useState('');
  const [vcSearch, setVcSearch] = useState('');
  const [signingPaymentFilter, setSigningPaymentFilter] = useState('');
  const [signingSearch, setSigningSearch] = useState('');
  const [anchorScheduleFilter, setAnchorScheduleFilter] = useState('today');
  const [anchorStatusFilter, setAnchorStatusFilter] = useState('queued');
  const [anchorSearch, setAnchorSearch] = useState('');
  const [claimedAnchorFilter, setClaimedAnchorFilter] = useState('anchored');
  const [claimedSearch, setClaimedSearch] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('unpaid');
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [modalBusy, setModalBusy] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [paymentConfirmDraft, setPaymentConfirmDraft] = useState(null);
  const [draftSubmit, setDraftSubmit] = useState(null);
  const [selectedVcIds, setSelectedVcIds] = useState(() => new Set());
  const [vcPage, setVcPage] = useState(1);
  const [rowActionMenuOpenId, setRowActionMenuOpenId] = useState('');
  const [bulkActionMenuOpen, setBulkActionMenuOpen] = useState(false);
  const [claimQr, setClaimQr] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [reasonAction, setReasonAction] = useState(null);
  const [queueSummary, setQueueSummary] = useState(null);
  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [queueProcessing, setQueueProcessing] = useState(false);
  const [queueProcessResult, setQueueProcessResult] = useState(null);
  const [queueError, setQueueError] = useState('');
  const [openedRouteDraftId, setOpenedRouteDraftId] = useState('');
  const [createVcModalOpen, setCreateVcModalOpen] = useState(false);
  const [createVcStudent, setCreateVcStudent] = useState(null);
  const [createVcSubmitting, setCreateVcSubmitting] = useState(false);
  const [createVcStudents, setCreateVcStudents] = useState([]);
  const [createVcStudentsLoading, setCreateVcStudentsLoading] = useState(false);
  const [createVcPickerOpen, setCreateVcPickerOpen] = useState(false);

  const loadDrafts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listCredentialDrafts();
      setRows(data || []);
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to load credential drafts.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPayments = useCallback(async () => {
    try {
      setPaymentLoading(true);
      const data = await listCredentialPayments({
        paymentStatus: paymentStatusFilter,
        search: paymentSearch,
      });
      setPaymentRows(data || []);
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error?.response?.data?.message ||
          error?.message ||
          'Failed to load payment requests.',
      });
    } finally {
      setPaymentLoading(false);
    }
  }, [paymentSearch, paymentStatusFilter]);

  const loadAnchorSummary = useCallback(async () => {
    if (!canUseRegistrarActions) return;
    try {
      const data = await getTodaysAnchorQueueSummary();
      setQueueSummary(data);
    } catch {
      setQueueSummary(null);
    }
  }, [canUseRegistrarActions]);

  useEffect(() => {
    if (activeTab === 'payments') {
      loadPayments();
      return;
    }

    loadDrafts();
    loadAnchorSummary();
  }, [activeTab, loadDrafts, loadPayments, loadAnchorSummary]);

  useEffect(() => {
    if (activeTab !== 'drafts') {
      setSelectedVcIds(new Set());
    }
  }, [activeTab]);

  useEffect(() => {
    setVcPage(1);
  }, [vcPaymentFilter, vcSearch]);

  useEffect(() => {
    if (!routeDraftId || openedRouteDraftId === routeDraftId) return undefined;

    let cancelled = false;

    async function openRouteDraft() {
      try {
        setBusyId(routeDraftId);
        const data = await getCredentialDraftById(routeDraftId);
        if (!cancelled) {
          setActiveTab('drafts');
          setSelectedDraft(data);
          setOpenedRouteDraftId(routeDraftId);
        }
      } catch (error) {
        if (!cancelled) {
          setFeedback({
            type: 'danger',
            text:
              error?.response?.data?.message ||
              error?.message ||
              'Failed to load credential draft.',
          });
          setOpenedRouteDraftId(routeDraftId);
        }
      } finally {
        if (!cancelled) setBusyId('');
      }
    }

    openRouteDraft();

    return () => {
      cancelled = true;
    };
  }, [routeDraftId, openedRouteDraftId]);

  function closeActionModals() {
    setConfirmAction(null);
    setReasonAction(null);
  }

  function actionError(error, fallback) {
    return error?.response?.data?.message || error?.message || fallback;
  }

  function closeRowActionMenu() {
    setRowActionMenuOpenId('');
  }

  function closeBulkActionMenu() {
    setBulkActionMenuOpen(false);
  }

  function toggleRowActionMenu(id) {
    setRowActionMenuOpenId((prev) => (prev === id ? '' : id));
  }

  async function runConfirmedAction() {
    if (!confirmAction?.run) return;

    try {
      setModalBusy(true);
      await confirmAction.run();
      closeActionModals();
    } catch (error) {
      setFeedback({ type: 'danger', text: actionError(error, 'Action failed.') });
    } finally {
      setBusyId('');
      setModalBusy(false);
    }
  }

  async function runReasonAction(reason) {
    if (!reasonAction?.run) return;

    try {
      setModalBusy(true);
      await reasonAction.run(reason);
      closeActionModals();
    } catch (error) {
      setFeedback({ type: 'danger', text: actionError(error, 'Action failed.') });
    } finally {
      setBusyId('');
      setModalBusy(false);
    }
  }

  async function refreshAfterAction(message) {
    setFeedback({ type: 'success', text: message });
    const refreshJobs = [];

    if (!cashierOnly) {
      refreshJobs.push(loadDrafts());
      refreshJobs.push(loadAnchorSummary());
    }

    if (canSeePaymentsTab || activeTab === 'payments') {
      refreshJobs.push(loadPayments());
    }

    await Promise.all(refreshJobs);
  }

  async function openDraft(id) {
    try {
      setBusyId(id);
      closeRowActionMenu();
      const data = await getCredentialDraftById(id);
      setSelectedDraft(data);
    } catch (error) {
      setFeedback({ type: 'danger', text: actionError(error, 'Failed to load details.') });
    } finally {
      setBusyId('');
    }
  }

  async function loadCreateVcStudents() {
    if (createVcStudents.length || createVcStudentsLoading) return;

    try {
      setCreateVcStudentsLoading(true);
      const data = await listStudents({ page: 1, limit: 100 });
      const rows = Array.isArray(data) ? data : data?.rows || [];
      setCreateVcStudents(rows);
    } catch {
      setCreateVcStudents([]);
    } finally {
      setCreateVcStudentsLoading(false);
    }
  }

  function openCreateVcPicker() {
    setCreateVcStudent(null);
    setCreateVcStudents([]);
    setCreateVcPickerOpen(true);
    loadCreateVcStudents();
  }

  function selectCreateVcStudent(student) {
    setCreateVcStudent(student);
    setCreateVcPickerOpen(false);
    setCreateVcModalOpen(true);
  }

  async function submitCreateVcDraft(payload) {
    if (!createVcStudent?._id) {
      setFeedback({ type: 'warning', text: 'Choose a student before creating a VC draft.' });
      return;
    }

    try {
      setCreateVcSubmitting(true);
      await createCredentialDraftFromStudent(createVcStudent._id, payload);
      setCreateVcModalOpen(false);
      setCreateVcStudent(null);
      setCreateVcStudents([]);
      await refreshAfterAction('VC draft created successfully.');
    } catch (error) {
      setFeedback({ type: 'danger', text: actionError(error, 'Failed to create VC draft.') });
    } finally {
      setCreateVcSubmitting(false);
    }
  }

  function confirmSubmit(item) {
    setDraftSubmit(item);
  }

  async function confirmDraftSubmit(payload) {
    if (!draftSubmit?._id) return;

    try {
      setModalBusy(true);
      setBusyId(draftSubmit._id);
      await updateCredentialDraft(draftSubmit._id, payload);
      await submitCredentialDraft(draftSubmit._id);
      setDraftSubmit(null);
      await refreshAfterAction('Draft submitted for signing.');
    } catch (error) {
      setFeedback({ type: 'danger', text: actionError(error, 'Failed to submit draft.') });
    } finally {
      setBusyId('');
      setModalBusy(false);
    }
  }

  function confirmSign(item) {
    const unpaid = !isCredentialPaid(item);

    setConfirmAction({
      title: unpaid ? 'Sign unpaid credential?' : 'Sign credential?',
      subtitle: unpaid
        ? 'Payment is still marked unpaid. Continue only if the registrar intentionally approves signing before cashier confirmation.'
        : 'This signs the VC with the active issuer key. Private key material stays on the server.',
      details: `${item.studentName} (${item.studentNo}) - ${titleCase(item.credentialType)}`,
      confirmLabel: unpaid ? 'Sign Anyway' : 'Sign',
      variant: unpaid ? 'warning' : 'success',
      run: async () => {
        setBusyId(item._id);
        await signCredentialDraft(item._id, unpaid ? { allowUnpaid: true } : {});
        setBusyId('');
        await refreshAfterAction('Credential signed successfully.');
      },
    });
  }

  function confirmDeleteDraft(item) {
    setConfirmAction({
      title: 'Delete draft?',
      subtitle: 'This removes the unsigned credential draft from the registrar queue.',
      details: `${item.studentName} (${item.studentNo}) - ${titleCase(item.credentialType)}`,
      confirmLabel: 'Delete Draft',
      variant: 'danger',
      run: async () => {
        setBusyId(item._id);
        await deleteCredentialDraft(item._id);
        setBusyId('');
        setSelectedDraft(null);
        setEditDraft(null);
        await refreshAfterAction('Credential draft deleted.');
      },
    });
  }

  function confirmReject(item) {
    setReasonAction({
      title: 'Reject credential?',
      subtitle: 'The rejection reason will be saved with the credential draft.',
      placeholder: 'Explain why this credential is being rejected',
      confirmLabel: 'Reject',
      variant: 'danger',
      run: async (reason) => {
        setBusyId(item._id);
        await rejectCredentialDraft(item._id, { rejectionReason: reason });
        setBusyId('');
        await refreshAfterAction('Credential rejected.');
      },
    });
  }

  function confirmMarkPaid(item) {
    setPaymentConfirmDraft(item);
  }

  async function confirmPayment(payload) {
    if (!paymentConfirmDraft?._id) return;

    try {
      setModalBusy(true);
      setBusyId(paymentConfirmDraft._id);
      await markCredentialPaymentPaid(paymentConfirmDraft._id, payload);
      setPaymentConfirmDraft(null);
      await refreshAfterAction('Payment marked as paid.');
    } catch (error) {
      setFeedback({ type: 'danger', text: actionError(error, 'Failed to mark payment as paid.') });
    } finally {
      setBusyId('');
      setModalBusy(false);
    }
  }

  async function generateClaimQr(item, payload = {}) {
    setBusyId(item._id);
    const data = await createCredentialClaimToken(item._id, payload);
    await openClaimQrPayload(data);
    setBusyId('');
    await refreshAfterAction(payload.regenerate ? 'Fresh claim QR generated.' : 'Claim QR generated.');
  }

  async function openClaimQrPayload(data) {
    const dataUrl = await QRCode.toDataURL(data.claimUri, { margin: 2, width: 260 });
    setClaimQr({
      ...data,
      dataUrl,
      expiresAtMs: data.expiresAt ? new Date(data.expiresAt).getTime() : 0,
      initialRemainingSeconds: data.expiresAt
        ? Math.max(0, Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000))
        : 0,
    });
  }

  async function viewExistingClaimQr(item, override = false) {
    try {
      const token = item?.claimToken;
      if (!token) {
        setFeedback({ type: 'warning', text: 'No active claim QR is stored for this credential.' });
        return;
      }

      const claimUri = `bcvs://claim?token=${encodeURIComponent(token)}`;
      await openClaimQrPayload({
        credential: item,
        token,
        claimUri,
        expiresAt: item.claimTokenExpiresAt,
        ttlMinutes: 0,
        override,
      });
    } catch (error) {
      setFeedback({ type: 'danger', text: actionError(error, 'Failed to open claim QR.') });
    }
  }

  function confirmClaimQr(item, regenerate = false) {
    setConfirmAction({
      title: regenerate ? 'Generate fresh claim QR?' : 'Generate claim QR?',
      subtitle: regenerate
        ? 'This invalidates the old token and creates a fresh temporary QR.'
        : 'This creates a temporary QR for the unclaimed credential.',
      details: `${item.studentName} (${item.studentNo}) - ${titleCase(item.status)}`,
      confirmLabel: regenerate ? 'Generate Fresh QR' : 'Generate QR',
      run: async () => generateClaimQr(item, regenerate ? { regenerate: true } : {}),
    });
  }

  function confirmOverrideQr(item) {
    setReasonAction({
      title: 'Generate QR override?',
      subtitle:
        'This credential was already claimed. Continue only if the registrar approved a re-claim.',
      placeholder: 'Student lost access, changed device, or registrar-approved re-claim',
      confirmLabel: 'Generate Override QR',
      variant: 'warning',
      run: async (reason) => {
        setBusyId(item._id);
        const data = await createCredentialClaimOverrideToken(item._id, { reason });
        const dataUrl = await QRCode.toDataURL(data.claimUri, { margin: 2, width: 260 });
        setClaimQr({
          ...data,
          dataUrl,
          expiresAtMs: data.expiresAt ? new Date(data.expiresAt).getTime() : 0,
          initialRemainingSeconds: data.expiresAt
            ? Math.max(0, Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000))
            : 0,
        });
        setBusyId('');
        await refreshAfterAction('Override QR generated and audited.');
      },
    });
  }

  function confirmQueueAnchor(item, mode) {
    const sameDay = mode === 'same_day';
    setConfirmAction({
      title: sameDay ? 'Anchor today?' : 'Schedule anchoring in 7 days?',
      subtitle: sameDay
        ? 'This queues the credential for same-day anchoring.'
        : 'This queues the credential for anchoring seven days from now.',
      details: `${item.studentName} (${item.studentNo}) - ${titleCase(item.status)}`,
      confirmLabel: sameDay ? 'Anchor Today' : 'Schedule 7 Days',
      variant: 'warning',
      run: async () => {
        setBusyId(item._id);
        await scheduleCredentialAnchor(item._id, { anchorMode: mode });
        setBusyId('');
        await refreshAfterAction(sameDay ? 'Credential queued for today.' : 'Credential scheduled for 7 days.');
      },
    });
  }

  function confirmProcessQueue() {
    setQueueError('');
    setQueueProcessResult(null);
    setQueueModalOpen(true);
    loadAnchorSummary().catch(() => {});
  }

  async function processQueueFromModal() {
    try {
      setQueueProcessing(true);
      setQueueError('');
      const result = await processTodaysAnchorQueue();
      setQueueProcessResult(result);
      await refreshAfterAction("Today's anchor queue processed.");
    } catch (error) {
      setQueueError(actionError(error, "Failed to process today's anchor queue."));
    } finally {
      setQueueProcessing(false);
    }
  }

  async function saveEditedDraft(payload) {
    if (!editDraft?._id) return;

    try {
      setEditSaving(true);
      const updated = await updateCredentialDraft(editDraft._id, payload);
      setEditDraft(null);
      if (selectedDraft?._id === updated?._id) {
        setSelectedDraft(updated);
      }
      await refreshAfterAction('Credential draft updated.');
    } catch (error) {
      setFeedback({ type: 'danger', text: actionError(error, 'Failed to update credential draft.') });
    } finally {
      setEditSaving(false);
    }
  }

  function toggleVcSelection(id, checked) {
    setSelectedVcIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        if (!next.has(id) && next.size >= MAX_BULK_SELECTION) {
          setFeedback({
            type: 'warning',
            text: `Select up to ${MAX_BULK_SELECTION} drafts at a time.`,
          });
          return prev;
        }
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function toggleVcPageSelection(ids, checked) {
    setSelectedVcIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        const remaining = Math.max(0, MAX_BULK_SELECTION - next.size);
        const idsToAdd = ids.filter((id) => !next.has(id));
        idsToAdd.slice(0, remaining).forEach((id) => next.add(id));
        if (idsToAdd.length > remaining) {
          setFeedback({
            type: 'warning',
            text: `Only ${MAX_BULK_SELECTION} drafts can be selected at once.`,
          });
        }
      } else {
        ids.forEach((id) => next.delete(id));
      }
      return next;
    });
  }

  function confirmBulkSubmitSelected() {
    const targets = selectedVcRows.filter(
      (item) => cleanText(item.status).toLowerCase() === 'draft'
    );

    if (!canManageDrafts) {
      setFeedback({ type: 'warning', text: 'Only admin users can submit drafts.' });
      return;
    }

    if (targets.length === 0) {
      setFeedback({ type: 'warning', text: 'Select at least one draft credential.' });
      return;
    }

    setConfirmAction({
      title: 'Submit selected drafts?',
      subtitle: 'Each selected draft will be priced, updated, and sent to the signing queue.',
      details: `${targets.length} draft${targets.length === 1 ? '' : 's'} selected.`,
      confirmLabel: 'Submit Selected',
      variant: 'success',
      run: async () => {
        setBusyId('bulk-submit');
        await bulkSubmitCredentialDrafts(targets.map((item) => item._id));
        setBusyId('');
        setSelectedVcIds(new Set());
        await refreshAfterAction(`${targets.length} draft${targets.length === 1 ? '' : 's'} submitted for signing.`);
      },
    });
  }

  function confirmBulkDeleteSelected() {
    const targets = selectedVcRows.filter((item) => canDeleteCredentialDraft(item));

    if (!canManageDrafts) {
      setFeedback({ type: 'warning', text: 'Only admin users can delete drafts.' });
      return;
    }

    if (targets.length === 0) {
      setFeedback({ type: 'warning', text: 'Select at least one unsigned draft.' });
      return;
    }

    setConfirmAction({
      title: 'Delete selected drafts?',
      subtitle: 'Only unsigned draft credentials will be deleted.',
      details: `${targets.length} draft${targets.length === 1 ? '' : 's'} selected.`,
      confirmLabel: 'Delete Selected',
      variant: 'danger',
      run: async () => {
        setBusyId('bulk-delete');
        await bulkDeleteCredentialDrafts(targets.map((item) => item._id));
        setBusyId('');
        setSelectedVcIds(new Set());
        await refreshAfterAction(`${targets.length} draft${targets.length === 1 ? '' : 's'} deleted.`);
      },
    });
  }

  function confirmBulkSignSelected() {
    const targets = selectedVcRows.filter(
      (item) => cleanText(item.status).toLowerCase() === 'for_signature' && !hasSignedCredential(item)
    );

    if (!canUseRegistrarActions) {
      setFeedback({ type: 'warning', text: 'Only registrar users can sign credentials.' });
      return;
    }

    if (targets.length === 0) {
      setFeedback({ type: 'warning', text: 'Select at least one signing-ready credential.' });
      return;
    }

    const unpaidCount = targets.filter((item) => !isCredentialPaid(item)).length;
    setConfirmAction({
      title: unpaidCount ? 'Sign selected unpaid credentials?' : 'Sign selected credentials?',
      subtitle: unpaidCount
        ? `${unpaidCount} selected credential(s) are still unpaid. Continue only if this is intentional.`
        : 'Each selected credential will be signed with the active issuer key.',
      details: `${targets.length} credential${targets.length === 1 ? '' : 's'} selected.`,
      confirmLabel: unpaidCount ? 'Sign Anyway' : 'Sign Selected',
      variant: unpaidCount ? 'warning' : 'success',
      run: async () => {
        setBusyId('bulk-sign');
        await bulkSignCredentialDrafts(targets.map((item) => item._id));
        setBusyId('');
        setSelectedVcIds(new Set());
        await refreshAfterAction(`${targets.length} credential${targets.length === 1 ? '' : 's'} signed.`);
      },
    });
  }

  function confirmBulkQueueAnchorSelected(mode) {
    const targets = selectedVcRows.filter((item) => canQueueAnchor(item, currentUser));
    const sameDay = mode === 'same_day';

    if (!canUseRegistrarActions) {
      setFeedback({ type: 'warning', text: 'Only registrar users can schedule anchoring.' });
      return;
    }

    if (targets.length === 0) {
      setFeedback({ type: 'warning', text: 'Select at least one paid, signed credential.' });
      return;
    }

    setConfirmAction({
      title: sameDay ? 'Anchor selected today?' : 'Schedule selected for 7 days?',
      subtitle: sameDay
        ? 'Each selected credential will be queued for same-day anchoring.'
        : 'Each selected credential will be queued for regular scheduled anchoring.',
      details: `${targets.length} credential${targets.length === 1 ? '' : 's'} selected.`,
      confirmLabel: sameDay ? 'Anchor Today' : 'Schedule 7 Days',
      variant: 'warning',
      run: async () => {
        setBusyId('bulk-anchor');
        await bulkScheduleCredentialAnchors(targets.map((item) => item._id), { anchorMode: mode });
        setBusyId('');
        setSelectedVcIds(new Set());
        await refreshAfterAction(
          sameDay
            ? `${targets.length} credential${targets.length === 1 ? '' : 's'} queued for today.`
            : `${targets.length} credential${targets.length === 1 ? '' : 's'} scheduled for 7 days.`
        );
      },
    });
  }

  function confirmBulkClaimQrSelected() {
    const targets = selectedVcRows.filter((item) => canShowClaimQr(item));

    if (!canUseRegistrarActions) {
      setFeedback({ type: 'warning', text: 'Only registrar users can generate claim QR codes.' });
      return;
    }

    if (targets.length === 0) {
      setFeedback({ type: 'warning', text: 'Select at least one signed and paid credential.' });
      return;
    }

    setConfirmAction({
      title: 'Generate claim QR for selected credentials?',
      subtitle: 'Each selected credential must be signed, paid, and not claimed.',
      details: `${targets.length} credential${targets.length === 1 ? '' : 's'} selected.`,
      confirmLabel: 'Generate QR',
      variant: 'success',
      run: async () => {
        setBusyId('bulk-claim-qr');
        await bulkCreateCredentialClaimTokens(targets.map((item) => item._id));
        setBusyId('');
        setSelectedVcIds(new Set());
        await refreshAfterAction(`${targets.length} claim QR token${targets.length === 1 ? '' : 's'} generated.`);
      },
    });
  }

  function viewQueueCredential(id) {
    setQueueModalOpen(false);
    openDraft(id);
  }

  function runRowAction(run) {
    closeRowActionMenu();
    run();
  }

  function buildDraftActions(draft) {
    if (!draft) return [];

    const actions = [];

    if (canManageDrafts && canEditCredentialDraft(draft)) {
      actions.push({
        key: 'edit',
        label: 'Edit',
        icon: <FaEdit />,
        onClick: () => runRowAction(() => {
          setSelectedDraft(null);
          setEditDraft(draft);
        }),
        disabled: busyId === draft._id,
      });
    }

    if (draft.status === 'draft' && canManageDrafts) {
      actions.push({
        key: 'submit',
        label: 'Submit',
        icon: <FaPaperPlane />,
        onClick: () => runRowAction(() => confirmSubmit(draft)),
        disabled: busyId === draft._id,
      });
    }

    if (canManageDrafts && canDeleteCredentialDraft(draft)) {
      actions.push({
        key: 'delete',
        label: 'Delete',
        icon: <FaTrash />,
        variant: 'danger',
        onClick: () => runRowAction(() => confirmDeleteDraft(draft)),
        disabled: busyId === draft._id,
      });
    }

    if (draft.status === 'for_signature' && canUseRegistrarActions) {
      actions.push({
        key: 'sign',
        label: 'Sign',
        icon: <FaSignature />,
        onClick: () => runRowAction(() => confirmSign(draft)),
        disabled: busyId === draft._id || hasSignedCredential(draft),
      });
      actions.push({
        key: 'reject',
        label: 'Reject',
        icon: <FaBan />,
        variant: 'danger',
        onClick: () => runRowAction(() => confirmReject(draft)),
        disabled: busyId === draft._id,
      });
    }

    if (canShowClaimQr(draft) && canUseRegistrarActions && hasActiveClaimToken(draft)) {
      actions.push({
        key: 'view-qr',
        label: 'View QR Code',
        icon: <FaEye />,
        onClick: () => runRowAction(() => viewExistingClaimQr(draft)),
        disabled: busyId === draft._id,
      });
    }

    if (
      canShowClaimQr(draft) &&
      canUseRegistrarActions &&
      !hasActiveClaimToken(draft) &&
      canGenerateFreshClaimQr(draft)
    ) {
      actions.push({
        key: 'claim-qr',
        label: hasExpiredClaimToken(draft) ? 'Fresh QR' : 'Claim QR',
        icon: <FaQrcode />,
        onClick: () => runRowAction(() => confirmClaimQr(draft, hasExpiredClaimToken(draft))),
        disabled: busyId === draft._id,
      });
    }

    if (
      canShowClaimQr(draft) &&
      canUseRegistrarActions &&
      !hasActiveClaimToken(draft) &&
      !canGenerateFreshClaimQr(draft)
    ) {
      actions.push({
        key: 'qr-active',
        label: 'QR Active',
        icon: <FaQrcode />,
        onClick: () => {},
        disabled: true,
      });
    }

    if (canShowClaimOverrideQr(draft, currentUser)) {
      if (hasActiveClaimToken(draft)) {
        actions.push({
          key: 'view-override-qr',
          label: 'View QR Code',
          icon: <FaEye />,
          onClick: () => runRowAction(() => viewExistingClaimQr(draft, true)),
          disabled: busyId === draft._id,
        });
      }

      actions.push({
        key: 'regenerate-qr',
        label: 'Regenerate QR',
        icon: <FaQrcode />,
        onClick: () => runRowAction(() => confirmOverrideQr(draft)),
        disabled: busyId === draft._id,
      });
    }

    if (canQueueAnchor(draft, currentUser)) {
      actions.push({
        key: 'anchor-today',
        label: 'Anchor Today',
        icon: <FaCalendarDay />,
        onClick: () => runRowAction(() => confirmQueueAnchor(draft, 'same_day')),
        disabled: busyId === draft._id,
      });
      actions.push({
        key: 'schedule-anchor',
        label: 'Schedule 7 Days',
        icon: <FaCalendarAlt />,
        onClick: () => runRowAction(() => confirmQueueAnchor(draft, 'scheduled')),
        disabled: busyId === draft._id,
      });
    }

    return actions;
  }

  const canBulkSelectCredential = useCallback((item) => {
    if (!canUseBulkActions) return false;

    const status = cleanText(item?.status).toLowerCase();
    if (canManageDrafts) {
      return status === 'draft' && (canDeleteCredentialDraft(item) || canEditCredentialDraft(item));
    }

    if (canUseRegistrarActions) {
      return (
        (status === 'for_signature' && !hasSignedCredential(item)) ||
        canQueueAnchor(item, currentUser) ||
        canShowClaimQr(item)
      );
    }

    return false;
  }, [canManageDrafts, canUseBulkActions, canUseRegistrarActions, currentUser]);

  const tabs = cashierOnly
    ? [{ key: 'payments', label: 'Payments' }]
    : [
        { key: 'drafts', label: 'VC' },
        { key: 'signing', label: 'Signing' },
        { key: 'anchor', label: 'Anchor' },
        { key: 'claimed', label: 'Claimed' },
        ...(canSeePaymentsTab ? [{ key: 'payments', label: 'Payments' }] : []),
      ];

  const vcRows = useMemo(
    () =>
      rows.filter((item) => {
        const status = cleanText(item.status).toLowerCase();
        const anchorStatus = cleanText(item.anchorStatus).toLowerCase();
        const isIntakeStatus = ['draft', 'for_signature', 'signed', 'claim_ready'].includes(status);
        const isAlreadyQueued = ['queued', 'anchored'].includes(anchorStatus);

        return (
          isIntakeStatus &&
          !isCredentialClaimed(item) &&
          !isAlreadyQueued &&
          matchesPaymentStatus(item, vcPaymentFilter) &&
          matchesStudentName(item, vcSearch)
        );
      }),
    [rows, vcPaymentFilter, vcSearch]
  );

  const vcPageCount = Math.max(1, Math.ceil(vcRows.length / VC_PAGE_SIZE));
  const vcPageRows = useMemo(() => {
    const safePage = Math.min(Math.max(vcPage, 1), vcPageCount);
    const start = (safePage - 1) * VC_PAGE_SIZE;
    return vcRows.slice(start, start + VC_PAGE_SIZE);
  }, [vcPage, vcPageCount, vcRows]);
  const selectedVcRows = useMemo(
    () => vcRows.filter((item) => selectedVcIds.has(item._id)),
    [selectedVcIds, vcRows]
  );
  const hasSelectedVcRows = selectedVcRows.length > 0;
  const allSelectedDrafts =
    hasSelectedVcRows && selectedVcRows.every((item) => cleanText(item.status).toLowerCase() === 'draft');
  const allSelectedDeletable =
    hasSelectedVcRows && selectedVcRows.every((item) => canDeleteCredentialDraft(item));
  const allSelectedSignable =
    hasSelectedVcRows &&
    selectedVcRows.every(
      (item) => cleanText(item.status).toLowerCase() === 'for_signature' && !hasSignedCredential(item)
    );
  const allSelectedAnchorable =
    hasSelectedVcRows && selectedVcRows.every((item) => canQueueAnchor(item, currentUser));
  const allSelectedClaimQr =
    hasSelectedVcRows && selectedVcRows.every((item) => canShowClaimQr(item));
  const bulkActions = [
    ...(canManageDrafts && allSelectedDrafts
      ? [
          {
            key: 'submit-selected',
            label: `Submit drafts (${selectedVcRows.length})`,
            icon: <FaPaperPlane />,
            onClick: confirmBulkSubmitSelected,
          },
        ]
      : []),
    ...(canManageDrafts && allSelectedDeletable
      ? [
          {
            key: 'delete-selected',
            label: `Delete drafts (${selectedVcRows.length})`,
            icon: <FaTrash />,
            variant: 'danger',
            onClick: confirmBulkDeleteSelected,
          },
        ]
      : []),
    ...(canUseRegistrarActions && allSelectedSignable
      ? [
          {
            key: 'sign-selected',
            label: `Sign ready (${selectedVcRows.length})`,
            icon: <FaSignature />,
            onClick: confirmBulkSignSelected,
          },
        ]
      : []),
    ...(canUseRegistrarActions && allSelectedAnchorable
      ? [
          {
            key: 'anchor-selected-today',
            label: `Anchor today (${selectedVcRows.length})`,
            icon: <FaCalendarDay />,
            onClick: () => confirmBulkQueueAnchorSelected('same_day'),
          },
          {
            key: 'anchor-selected-scheduled',
            label: `Schedule 7 days (${selectedVcRows.length})`,
            icon: <FaCalendarAlt />,
            onClick: () => confirmBulkQueueAnchorSelected('scheduled'),
          },
        ]
      : []),
    ...(canUseRegistrarActions && allSelectedClaimQr
      ? [
          {
            key: 'claim-qr-selected',
            label: `Generate claim QR (${selectedVcRows.length})`,
            icon: <FaQrcode />,
            onClick: confirmBulkClaimQrSelected,
          },
        ]
      : []),
  ];
  const visibleBulkActions =
    hasSelectedVcRows && bulkActions.length === 0
      ? [
          {
            key: 'no-common-action',
            label: 'No available bulk action for the selected rows.',
            icon: <FaBan />,
            disabled: true,
            title: 'Select rows with the same valid lifecycle action.',
          },
        ]
      : bulkActions;

  useEffect(() => {
    setVcPage((current) => Math.min(Math.max(current, 1), vcPageCount));
  }, [vcPageCount]);

  useEffect(() => {
    const visibleIds = new Set(vcRows.filter(canBulkSelectCredential).map((item) => item._id));
    setSelectedVcIds((prev) => {
      const next = new Set([...prev].filter((id) => visibleIds.has(id)));
      if (next.size === prev.size && [...next].every((id) => prev.has(id))) return prev;
      return next;
    });
  }, [canBulkSelectCredential, vcRows]);

  const signingRows = useMemo(
    () =>
      rows.filter((item) => {
        const status = cleanText(item.status).toLowerCase();
        return (
          ['for_signature', 'signed'].includes(status) &&
          matchesPaymentStatus(item, signingPaymentFilter) &&
          matchesStudentName(item, signingSearch)
        );
      }),
    [rows, signingPaymentFilter, signingSearch]
  );

  const anchorRows = useMemo(
    () =>
      rows.filter((item) => {
        const anchorStatus = cleanText(item.anchorStatus).toLowerCase();
        const isAnchorTracked = [
          'queued',
          'merkle_ready',
          'contract_missing',
          'contract_unsupported',
          'anchor_failed',
          'anchored',
        ].includes(anchorStatus);

        return (
          isAnchorTracked &&
          isCredentialPaid(item) &&
          hasSignedCredential(item) &&
          matchesAnchorSchedule(item, anchorScheduleFilter) &&
          matchesAnchorStatus(item, anchorStatusFilter) &&
          matchesAnchorSearch(item, anchorSearch)
        );
      }),
    [rows, anchorScheduleFilter, anchorStatusFilter, anchorSearch]
  );

  const claimedRows = useMemo(
    () =>
      rows.filter((item) => {
        const anchorMatch =
          claimedAnchorFilter === 'anchored' ? isAnchored(item) : !isAnchored(item);

        return (
          isCredentialClaimed(item) &&
          anchorMatch &&
          matchesStudentName(item, claimedSearch)
        );
      }),
    [rows, claimedAnchorFilter, claimedSearch]
  );

  return (
    <>
      <div className="d-flex flex-column gap-4">
        <div className="d-flex flex-wrap justify-content-end align-items-center gap-2">
          {canUseRegistrarActions ? (
            <>
              <button
                className="btn btn-primary"
                onClick={openCreateVcPicker}
                disabled={modalBusy}
              >
                <FaPlus className="me-2" />
                Create VC
              </button>
              <button
                className="btn btn-warning"
                onClick={confirmProcessQueue}
                disabled={modalBusy}
              >
                Process Today's Anchor Queue
                {queueSummary?.pendingCount ? ` (${queueSummary.pendingCount})` : ''}
              </button>
            </>
          ) : null}
        </div>

        {feedback.text ? (
          <div className={`alert alert-${feedback.type} mb-0`}>{feedback.text}</div>
        ) : null}

        <div className="d-flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`btn ${activeTab === tab.key ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'payments' ? (
          <PaymentTable
            rows={paymentRows}
            loading={paymentLoading}
            busyId={busyId}
            search={paymentSearch}
            status={paymentStatusFilter}
            onSearch={setPaymentSearch}
            onStatus={setPaymentStatusFilter}
            onApply={loadPayments}
            onMarkPaid={confirmMarkPaid}
          />
        ) : null}

        {activeTab === 'drafts' ? (
          <VcProcessingTable
            rows={vcPageRows}
            loading={loading}
            busyId={busyId}
            paymentStatus={vcPaymentFilter}
            search={vcSearch}
            selectedIds={selectedVcIds}
            selectedCount={selectedVcIds.size}
            page={vcPage}
            pageCount={vcPageCount}
            onPaymentStatus={setVcPaymentFilter}
            onSearch={setVcSearch}
            onRefresh={loadDrafts}
            onDetails={openDraft}
            onToggleSelected={toggleVcSelection}
            onTogglePage={toggleVcPageSelection}
            onPage={setVcPage}
            canSelectRow={canBulkSelectCredential}
            bulkActions={visibleBulkActions}
            bulkMenuOpen={bulkActionMenuOpen}
            onToggleBulkMenu={() => setBulkActionMenuOpen((value) => !value)}
            onCloseBulkMenu={closeBulkActionMenu}
            getActions={buildDraftActions}
            actionMenuOpenId={rowActionMenuOpenId}
            onToggleActionMenu={toggleRowActionMenu}
            onCloseActionMenu={closeRowActionMenu}
          />
        ) : null}

        {activeTab === 'signing' ? (
          <SigningTable
            rows={signingRows}
            loading={loading}
            busyId={busyId}
            paymentStatus={signingPaymentFilter}
            search={signingSearch}
            onPaymentStatus={setSigningPaymentFilter}
            onSearch={setSigningSearch}
            onRefresh={loadDrafts}
            onDetails={openDraft}
            getActions={buildDraftActions}
            actionMenuOpenId={rowActionMenuOpenId}
            onToggleActionMenu={toggleRowActionMenu}
            onCloseActionMenu={closeRowActionMenu}
          />
        ) : null}

        {activeTab === 'anchor' ? (
          <AnchorProgressTable
            rows={anchorRows}
            loading={loading}
            busyId={busyId}
            schedule={anchorScheduleFilter}
            status={anchorStatusFilter}
            search={anchorSearch}
            onSchedule={setAnchorScheduleFilter}
            onStatus={setAnchorStatusFilter}
            onSearch={setAnchorSearch}
            onRefresh={loadDrafts}
            onDetails={openDraft}
            getActions={buildDraftActions}
            actionMenuOpenId={rowActionMenuOpenId}
            onToggleActionMenu={toggleRowActionMenu}
            onCloseActionMenu={closeRowActionMenu}
          />
        ) : null}

        {activeTab === 'claimed' ? (
          <ClaimedCredentialsTable
            rows={claimedRows}
            loading={loading}
            busyId={busyId}
            anchorStatus={claimedAnchorFilter}
            search={claimedSearch}
            onAnchorStatus={setClaimedAnchorFilter}
            onSearch={setClaimedSearch}
            onRefresh={loadDrafts}
            onDetails={openDraft}
            getActions={buildDraftActions}
            actionMenuOpenId={rowActionMenuOpenId}
            onToggleActionMenu={toggleRowActionMenu}
            onCloseActionMenu={closeRowActionMenu}
          />
        ) : null}
      </div>

      <DraftDetailsModal
        key={selectedDraft?._id || 'credential-details'}
        draft={selectedDraft}
        onClose={() => setSelectedDraft(null)}
      />
      <DraftEditModal
        key={editDraft?._id || 'credential-edit'}
        draft={editDraft}
        onClose={() => setEditDraft(null)}
        onSave={saveEditedDraft}
        saving={editSaving}
      />
      <PaymentConfirmModal
        key={paymentConfirmDraft?._id || 'payment-confirm'}
        draft={paymentConfirmDraft}
        busy={modalBusy}
        onClose={() => setPaymentConfirmDraft(null)}
        onConfirm={confirmPayment}
      />
      <DraftSubmitModal
        key={draftSubmit?._id || 'draft-submit'}
        draft={draftSubmit}
        busy={modalBusy}
        onClose={() => setDraftSubmit(null)}
        onConfirm={confirmDraftSubmit}
      />
      <ClaimQrModal
        key={claimQr?.claimUri || 'claim-qr'}
        claimQr={claimQr}
        onRefresh={() => loadDrafts()}
        onClose={async () => {
          setClaimQr(null);
          await loadDrafts();
        }}
      />
      <ConfirmModal
        action={confirmAction}
        busy={modalBusy}
        onCancel={closeActionModals}
        onConfirm={runConfirmedAction}
      />
      <ReasonModal
        action={reasonAction}
        busy={modalBusy}
        onCancel={closeActionModals}
        onConfirm={runReasonAction}
      />
      <QueueProcessModal
        open={queueModalOpen}
        summary={queueSummary}
        rows={rows}
        result={queueProcessResult}
        error={queueError}
        busy={queueProcessing}
        onClose={() => setQueueModalOpen(false)}
        onProcess={processQueueFromModal}
        onView={viewQueueCredential}
      />
      {createVcPickerOpen ? (
        <>
          <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow">
                <div className="modal-header">
                  <div>
                    <h2 className="h5 mb-1">Select Student</h2>
                    <p className="text-muted mb-0 small">Choose a student before creating a VC draft.</p>
                  </div>
                  <button type="button" className="btn-close" onClick={() => setCreateVcPickerOpen(false)} aria-label="Close" />
                </div>
                <div className="modal-body">
                  {createVcStudentsLoading ? (
                    <div className="text-muted">Loading students...</div>
                  ) : createVcStudents.length ? (
                    <div className="list-group">
                      {createVcStudents.map((student) => (
                        <button
                          key={student._id}
                          type="button"
                          className="list-group-item list-group-item-action"
                          onClick={() => selectCreateVcStudent(student)}
                        >
                          <div className="fw-semibold">{student.studentName || 'Unnamed student'}</div>
                          <div className="small text-muted">
                            {student.studentNo || 'No student number'} · {student.programCode || student.programName || 'No program'}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="alert alert-light border mb-0">No students found.</div>
                  )}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setCreateVcPickerOpen(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" />
        </>
      ) : null}
      <CreateVcDraftModal
        open={createVcModalOpen}
        mode="single"
        student={createVcStudent}
        students={createVcStudent ? [createVcStudent] : []}
        submitting={createVcSubmitting}
        onClose={() => {
          setCreateVcModalOpen(false);
          setCreateVcStudent(null);
          setCreateVcStudents([]);
        }}
        onConfirm={submitCreateVcDraft}
      />
    </>
  );
}
