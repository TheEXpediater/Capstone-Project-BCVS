import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { hasValidStoredAuth } from '../../auth/authStorage';
import {
  createCredentialClaimOverrideToken,
  createCredentialClaimToken,
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
} from '../credentialsAPI';

const CLAIMABLE_STATUSES = new Set(['signed', 'claim_ready', 'queued_for_anchor', 'anchored']);
const PAYMENT_TAB_ROLES = new Set(['cashier', 'admin', 'super_admin', 'developer']);
const MANAGE_CREDENTIAL_ROLES = new Set(['admin', 'super_admin', 'developer']);
const OVERRIDE_QR_ROLES = new Set(['admin', 'super_admin', 'developer']);

function formatDate(value) {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleString();
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 'Not set';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'PHP',
  }).format(amount);
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
  return Boolean(draft?.signedCredential) || isCredentialClaimableStatus(draft);
}

function canShowClaimQr(draft) {
  return (
    isCredentialPaid(draft) &&
    hasSignedCredential(draft) &&
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
  if (!MANAGE_CREDENTIAL_ROLES.has(currentUser?.role)) return false;
  if (!isCredentialPaid(draft) || !hasSignedCredential(draft)) return false;
  if (isCredentialRejectedOrRevoked(draft)) return false;
  if (draft?.anchorStatus === 'queued' || draft?.anchorStatus === 'anchored') return false;
  return ['signed', 'claim_ready', 'queued_for_anchor', 'anchored', 'claimed'].includes(
    String(draft?.status || '')
  );
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

function matchesStudentName(draft, search) {
  const query = cleanText(search).toLowerCase();
  if (!query) return true;
  return cleanText(draft?.studentName).toLowerCase().includes(query);
}

function matchesPaymentStatus(draft, status) {
  const selected = cleanText(status).toLowerCase();
  if (!selected) return true;
  return cleanText(draft?.paymentStatus).toLowerCase() === selected;
}

function anchorScheduleLabel(draft) {
  const mode = cleanText(draft?.anchorMode).toLowerCase();
  const preference = cleanText(draft?.anchorPreference).toLowerCase();

  if (mode === 'same_day' || preference === 'request') return 'Today';
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
  return 'Queued';
}

function anchorStatusBadge(draft) {
  const label = anchorStatusLabel(draft);
  if (label === 'Anchored') return 'text-bg-success';
  if (label === 'Failed') return 'text-bg-danger';
  if (label === 'Processing') return 'text-bg-info';
  return 'text-bg-warning';
}

function anchorStatusFilterValue(draft) {
  const label = anchorStatusLabel(draft);
  if (label === 'Anchored') return 'anchored';
  if (label === 'Failed') return 'failed';
  if (label === 'Processing') return 'processing';
  return 'queued';
}

function matchesAnchorStatus(draft, status) {
  const selected = cleanText(status).toLowerCase();
  const value = anchorStatusFilterValue(draft);
  if (selected === 'queued') return value === 'queued' || value === 'processing';
  return value === selected;
}

function isAnchored(draft) {
  return cleanText(draft?.anchorStatus).toLowerCase() === 'anchored';
}

function ModalShell({ title, subtitle, children, footer, onClose, size = '' }) {
  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className={`modal-dialog modal-dialog-centered ${size}`}>
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

function QueueResultModal({ result, onClose }) {
  if (!result) return null;

  return (
    <ModalShell
      title="Anchor queue result"
      subtitle="Production summary for today's queue run."
      onClose={onClose}
      size="modal-lg"
      footer={
        <button className="btn btn-primary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <div className="border rounded-3 p-3">
            <div className="small text-muted">Processed</div>
            <div className="h4 mb-0">{result.processedCount || 0}</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="border rounded-3 p-3">
            <div className="small text-muted">Failed</div>
            <div className="h4 mb-0">{result.failedCount || 0}</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="border rounded-3 p-3">
            <div className="small text-muted">Skipped</div>
            <div className="h4 mb-0">{result.skippedCount || 0}</div>
          </div>
        </div>
      </div>

      {result.failed?.length ? (
        <div className="mb-3">
          <h3 className="h6">Failed items</h3>
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
          <h3 className="h6">Skipped items</h3>
          <ul className="list-group">
            {result.skipped.map((item) => (
              <li className="list-group-item small" key={item.id}>
                <strong>{item.id}</strong>: {item.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </ModalShell>
  );
}

function DraftDetailsModal({ draft, actions, onClose }) {
  if (!draft) return null;

  const profile = draft.profileSnapshot || {};
  const grades = draft.gradesSnapshot || [];
  const signedProof = draft.signedCredential?.proof || null;
  const lastVerification = draft.lastVerificationResult || null;

  return (
    <ModalShell
      title="Credential Details"
      subtitle={`${draft.studentNo || 'Student'} - ${draft.studentName || 'Not available'}`}
      onClose={onClose}
      size="modal-xl"
      footer={
        <>
          {actions}
          <button className="btn btn-outline-secondary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <div className="d-flex flex-column gap-4">
        <div className="row g-3">
          <div className="col-md-3">
            <div className="small text-muted">Status</div>
            <span className={`badge ${getStatusBadge(draft.status)}`}>{titleCase(draft.status)}</span>
          </div>
          <div className="col-md-3">
            <div className="small text-muted">Payment</div>
            <span className={`badge ${getPaymentBadge(draft)}`}>
              {isCredentialPaid(draft) ? 'Paid' : 'Unpaid'}
            </span>
          </div>
          <div className="col-md-3">
            <div className="small text-muted">Created</div>
            <div className="fw-semibold">{formatDate(draft.createdAt)}</div>
          </div>
          <div className="col-md-3">
            <div className="small text-muted">Updated</div>
            <div className="fw-semibold">{formatDate(draft.updatedAt)}</div>
          </div>
        </div>

        <div className="border rounded-3 p-3 bg-light">
          <h3 className="h6 mb-3">Payment</h3>
          <div className="row g-3">
            <div className="col-md-3">
              <div className="small text-muted">Payment Code</div>
              <div className="fw-semibold text-break">{draft.paymentCode || 'Not generated'}</div>
            </div>
            <div className="col-md-3">
              <div className="small text-muted">Receipt No</div>
              <div className="fw-semibold">{draft.receiptNo || 'Not paid yet'}</div>
            </div>
            <div className="col-md-3">
              <div className="small text-muted">Amount</div>
              <div className="fw-semibold">{formatCurrency(draft.amount)}</div>
            </div>
            <div className="col-md-3">
              <div className="small text-muted">Paid At</div>
              <div className="fw-semibold">{formatDate(draft.paidAt)}</div>
            </div>
          </div>
        </div>

        <div className="border rounded-3 p-3 bg-light">
          <h3 className="h6 mb-3">Claim and Anchor</h3>
          <div className="row g-3">
            <div className="col-md-3">
              <div className="small text-muted">Claimed At</div>
              <div className="fw-semibold">{formatDate(draft.claimedAt)}</div>
            </div>
            <div className="col-md-3">
              <div className="small text-muted">Claim Token Expires</div>
              <div className="fw-semibold">{formatDate(draft.claimTokenExpiresAt)}</div>
            </div>
            <div className="col-md-3">
              <div className="small text-muted">Anchor Status</div>
              <div className="fw-semibold">{titleCase(draft.anchorStatus || 'not_requested')}</div>
            </div>
            <div className="col-md-3">
              <div className="small text-muted">Anchored At</div>
              <div className="fw-semibold">{formatDate(draft.anchoredAt)}</div>
            </div>
            <div className="col-md-6">
              <div className="small text-muted">Contract</div>
              <div className="fw-semibold text-break">{draft.contractAddress || 'Not available'}</div>
            </div>
            <div className="col-md-6">
              <div className="small text-muted">Anchor Hash</div>
              <div className="fw-semibold text-break">{draft.anchorTxHash || 'Not available'}</div>
            </div>
          </div>
        </div>

        <div className="border rounded-3 p-3 bg-light">
          <h3 className="h6 mb-3">Student Snapshot</h3>
          <div className="row g-3">
            <div className="col-md-4">
              <div className="small text-muted">Student No</div>
              <div className="fw-semibold">{profile.studentNo || draft.studentNo || 'Not available'}</div>
            </div>
            <div className="col-md-4">
              <div className="small text-muted">Student Name</div>
              <div className="fw-semibold">{profile.studentName || draft.studentName || 'Not available'}</div>
            </div>
            <div className="col-md-4">
              <div className="small text-muted">Program</div>
              <div className="fw-semibold">
                {profile.programCode || 'Not available'} {profile.programName || ''}
              </div>
            </div>
          </div>
        </div>

        {grades.length ? (
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
        ) : null}

        {signedProof ? (
          <div className="border rounded-3 p-3 bg-light">
            <h3 className="h6 mb-3">Proof Metadata</h3>
            <div className="row g-3">
              <div className="col-md-4">
                <div className="small text-muted">Proof Type</div>
                <div className="fw-semibold">{signedProof.type || 'Not available'}</div>
              </div>
              <div className="col-md-4">
                <div className="small text-muted">Signature Algorithm</div>
                <div className="fw-semibold">{draft.signatureAlgorithm || signedProof.signatureAlgorithm || 'Not available'}</div>
              </div>
              <div className="col-md-4">
                <div className="small text-muted">Canonicalization</div>
                <div className="fw-semibold">{draft.canonicalizationAlgorithm || signedProof.canonicalizationAlgorithm || 'Not available'}</div>
              </div>
              <div className="col-md-6">
                <div className="small text-muted">Verification Method</div>
                <div className="fw-semibold text-break">{draft.verificationMethod || signedProof.verificationMethod || 'Not available'}</div>
              </div>
              <div className="col-md-6">
                <div className="small text-muted">Issuer Key ID</div>
                <div className="fw-semibold text-break">{draft.issuerKeyId || signedProof.issuerKeyId || 'Not available'}</div>
              </div>
              <div className="col-12">
                <div className="small text-muted">VC Hash</div>
                <div className="fw-semibold text-break">{draft.vcHash || signedProof.vcHash || draft.credentialHash || 'Not available'}</div>
              </div>
              <div className="col-md-6">
                <div className="small text-muted">Merkle Leaf</div>
                <div className="fw-semibold text-break">{draft.merkleLeaf || 'Not available'}</div>
              </div>
              <div className="col-md-6">
                <div className="small text-muted">Merkle Root</div>
                <div className="fw-semibold text-break">{draft.merkleRoot || 'Not available'}</div>
              </div>
              <div className="col-md-4">
                <div className="small text-muted">Merkle Index</div>
                <div className="fw-semibold">{draft.merkleLeafIndex ?? 'Not available'}</div>
              </div>
              <div className="col-md-4">
                <div className="small text-muted">Tree Size</div>
                <div className="fw-semibold">{draft.merkleTreeSize || 0}</div>
              </div>
              <div className="col-md-4">
                <div className="small text-muted">Merkle Algorithm</div>
                <div className="fw-semibold">{draft.merkleAlgorithm || 'Not available'}</div>
              </div>
              <div className="col-12">
                <div className="small text-muted">Merkle Proof</div>
                <div className="fw-semibold text-break">
                  {draft.merkleProof?.length ? draft.merkleProof.join(' | ') : 'Not available'}
                </div>
              </div>
              <div className="col-md-4">
                <div className="small text-muted">Anchor Chain</div>
                <div className="fw-semibold">{draft.anchorChainId || 'Not available'}</div>
              </div>
              <div className="col-md-4">
                <div className="small text-muted">Anchor Block</div>
                <div className="fw-semibold">{draft.anchorBlockNumber || 'Not available'}</div>
              </div>
              <div className="col-md-4">
                <div className="small text-muted">Anchor Event</div>
                <div className="fw-semibold">{draft.anchorEventName || 'Not available'}</div>
              </div>
              <div className="col-12">
                <div className="small text-muted">Anchor Availability</div>
                <div className="fw-semibold text-break">{draft.anchoringUnavailableReason || 'Not available'}</div>
              </div>
            </div>
          </div>
        ) : null}

        {lastVerification ? (
          <div className="border rounded-3 p-3 bg-light">
            <h3 className="h6 mb-3">Last Verification Result</h3>
            <div className="row g-3">
              <div className="col-md-3">
                <div className="small text-muted">Status</div>
                <span className={`badge ${lastVerification.verified ? 'bg-success' : 'bg-warning text-dark'}`}>
                  {titleCase(lastVerification.status || 'unknown')}
                </span>
              </div>
              <div className="col-md-3">
                <div className="small text-muted">Payload Verified</div>
                <div className="fw-semibold">{lastVerification.payloadVerified ? 'Yes' : 'No'}</div>
              </div>
              <div className="col-md-6">
                <div className="small text-muted">Blockchain</div>
                <div className="fw-semibold text-break">
                  {lastVerification.checks?.blockchain?.verified
                    ? 'Verified'
                    : lastVerification.checks?.blockchain?.reason || 'Unavailable'}
                </div>
              </div>
            </div>
          </div>
        ) : null}
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
                      <span className={`badge ${getPaymentBadge(item)}`}>
                        {isCredentialPaid(item) ? 'Paid' : 'Unpaid'}
                      </span>
                      <div className="small text-muted text-truncate" style={{ maxWidth: 160 }}>
                        {item.paymentCode || 'Not generated'}
                      </div>
                    </td>
                    <td>{item.receiptNo || 'Not paid yet'}</td>
                    <td>{formatCurrency(item.amount)}</td>
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

function VcProcessingTable({
  rows,
  loading,
  paymentStatus,
  search,
  onPaymentStatus,
  onSearch,
  onRefresh,
  onDetails,
}) {
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
              Student Name
            </label>
            <input
              id="vc-student-search"
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
            <th>Anchor Schedule</th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item._id}>
              <td className="fw-semibold">{item.studentName || 'Not available'}</td>
              <td>{credentialLabel(item.credentialType)}</td>
              <td>{anchorScheduleLabel(item)}</td>
              <td className="text-end">
                <button
                  className="btn btn-outline-primary btn-sm text-nowrap"
                  onClick={() => onDetails(item._id)}
                >
                  More Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </CredentialTableShell>
  );
}

function SigningTable({
  rows,
  loading,
  busyId,
  search,
  canManage,
  onSearch,
  onRefresh,
  onSign,
  onDetails,
}) {
  return (
    <CredentialTableShell
      title="Signing"
      loading={loading}
      hasRows={rows.length > 0}
      emptyText="No paid credentials are ready for signing."
      onRefresh={onRefresh}
      filters={
        <div className="row g-2 align-items-end mb-3">
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
                <span className={`badge ${signatureStatusBadge(item)}`}>
                  {signatureStatusLabel(item)}
                </span>
              </td>
              <td className="text-end">
                <div className="d-inline-flex flex-wrap justify-content-end gap-2">
                  <button
                    className="btn btn-success btn-sm text-nowrap"
                    onClick={() => onSign(item)}
                    disabled={!canManage || busyId === item._id || hasSignedCredential(item)}
                  >
                    Sign
                  </button>
                  <button
                    className="btn btn-outline-primary btn-sm text-nowrap"
                    onClick={() => onDetails(item._id)}
                    disabled={busyId === item._id}
                  >
                    More Details
                  </button>
                </div>
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
  schedule,
  status,
  onSchedule,
  onStatus,
  onRefresh,
  onDetails,
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
              <option value="queued">Queued</option>
              <option value="anchored">Anchored</option>
              <option value="failed">Failed</option>
            </select>
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
                <button
                  className="btn btn-outline-primary btn-sm text-nowrap"
                  onClick={() => onDetails(item._id)}
                >
                  View Details
                </button>
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
  currentUser,
  onAnchorStatus,
  onSearch,
  onRefresh,
  onDetails,
  onRegenerateQr,
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
          {rows.map((item) => {
            const canRegenerate = canShowClaimOverrideQr(item, currentUser);
            return (
              <tr key={item._id}>
                <td className="fw-semibold">{item.studentName || 'Not available'}</td>
                <td>{credentialLabel(item.credentialType)}</td>
                <td>{formatDate(item.claimedAt)}</td>
                <td className="text-end">
                  <div className="d-inline-flex flex-wrap justify-content-end gap-2">
                    <button
                      className="btn btn-outline-primary btn-sm text-nowrap"
                      onClick={() => onDetails(item._id)}
                      disabled={busyId === item._id}
                    >
                      View Details
                    </button>
                    <button
                      className="btn btn-warning btn-sm text-nowrap"
                      onClick={() => onRegenerateQr(item)}
                      disabled={!canRegenerate || busyId === item._id}
                    >
                      Regenerate QR
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </CredentialTableShell>
  );
}

export default function CredentialDraftsPage() {
  const auth = useMemo(() => hasValidStoredAuth(), []);
  const currentUser = auth?.user || {};
  const currentRole = currentUser?.role || '';
  const canSeePaymentsTab = PAYMENT_TAB_ROLES.has(currentRole);
  const canManageCredentials = MANAGE_CREDENTIAL_ROLES.has(currentRole);
  const cashierOnly = currentRole === 'cashier';

  const [rows, setRows] = useState([]);
  const [paymentRows, setPaymentRows] = useState([]);
  const [activeTab, setActiveTab] = useState(cashierOnly ? 'payments' : 'drafts');
  const [vcPaymentFilter, setVcPaymentFilter] = useState('');
  const [vcSearch, setVcSearch] = useState('');
  const [signingSearch, setSigningSearch] = useState('');
  const [anchorScheduleFilter, setAnchorScheduleFilter] = useState('today');
  const [anchorStatusFilter, setAnchorStatusFilter] = useState('queued');
  const [claimedAnchorFilter, setClaimedAnchorFilter] = useState('anchored');
  const [claimedSearch, setClaimedSearch] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('unpaid');
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [modalBusy, setModalBusy] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [claimQr, setClaimQr] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [reasonAction, setReasonAction] = useState(null);
  const [queueResult, setQueueResult] = useState(null);
  const [queueSummary, setQueueSummary] = useState(null);

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
    if (!canManageCredentials) return;
    try {
      const data = await getTodaysAnchorQueueSummary();
      setQueueSummary(data);
    } catch {
      setQueueSummary(null);
    }
  }, [canManageCredentials]);

  useEffect(() => {
    if (activeTab === 'payments') {
      loadPayments();
      return;
    }

    loadDrafts();
    loadAnchorSummary();
  }, [activeTab, loadDrafts, loadPayments, loadAnchorSummary]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (activeTab === 'payments') {
        loadPayments().catch(() => {});
      } else {
        loadDrafts().catch(() => {});
        loadAnchorSummary().catch(() => {});
      }
    }, 15000);

    return () => window.clearInterval(timer);
  }, [activeTab, loadDrafts, loadPayments, loadAnchorSummary]);

  function closeActionModals() {
    setConfirmAction(null);
    setReasonAction(null);
  }

  function actionError(error, fallback) {
    return error?.response?.data?.message || error?.message || fallback;
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
    await Promise.all([
      loadDrafts(),
      canSeePaymentsTab ? loadPayments() : Promise.resolve(),
      loadAnchorSummary(),
    ]);
  }

  async function openDraft(id) {
    try {
      setBusyId(id);
      const data = await getCredentialDraftById(id);
      setSelectedDraft(data);
    } catch (error) {
      setFeedback({ type: 'danger', text: actionError(error, 'Failed to load details.') });
    } finally {
      setBusyId('');
    }
  }

  function confirmSubmit(item) {
    setConfirmAction({
      title: 'Submit for signing?',
      subtitle: 'This sends the paid draft to the registrar signing queue.',
      details: `${item.studentName} (${item.studentNo}) - ${titleCase(item.credentialType)}`,
      confirmLabel: 'Submit',
      run: async () => {
        setBusyId(item._id);
        await submitCredentialDraft(item._id);
        setBusyId('');
        await refreshAfterAction('Draft submitted for signing.');
      },
    });
  }

  function confirmSign(item) {
    if (!isCredentialPaid(item)) {
      setFeedback({ type: 'warning', text: 'Payment is required before signing.' });
      return;
    }

    setConfirmAction({
      title: 'Sign credential?',
      subtitle: 'This signs the VC with the active issuer key. Private key material stays on the server.',
      details: `${item.studentName} (${item.studentNo}) - ${titleCase(item.credentialType)}`,
      confirmLabel: 'Sign',
      variant: 'success',
      run: async () => {
        setBusyId(item._id);
        await signCredentialDraft(item._id);
        setBusyId('');
        await refreshAfterAction('Credential signed successfully.');
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
    setConfirmAction({
      title: 'Mark payment as paid?',
      subtitle: 'This records payment, generates a receipt number, and notifies the student.',
      details: `${item.paymentCode || item._id} - ${item.studentName} (${item.studentNo})`,
      confirmLabel: 'Mark Paid',
      variant: 'success',
      run: async () => {
        setBusyId(item._id);
        await markCredentialPaymentPaid(item._id);
        setBusyId('');
        await refreshAfterAction('Payment marked as paid.');
      },
    });
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
    setConfirmAction({
      title: "Process today's anchor queue?",
      subtitle: 'This will anchor all eligible credentials scheduled for today or earlier.',
      details: `${queueSummary?.pendingCount || 0} eligible item(s) are currently due.`,
      confirmLabel: 'Process Queue',
      variant: 'warning',
      run: async () => {
        const result = await processTodaysAnchorQueue();
        setQueueResult(result);
        await refreshAfterAction("Today's anchor queue processed.");
      },
    });
  }

  function detailsAction(run) {
    setSelectedDraft(null);
    run();
  }

  function renderDetailsActions(draft) {
    if (!draft) return null;

    return (
      <div className="me-auto d-flex flex-wrap gap-2">
        {draft.status === 'draft' && canManageCredentials ? (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => detailsAction(() => confirmSubmit(draft))}
            disabled={busyId === draft._id}
          >
            Submit
          </button>
        ) : null}

        {draft.status === 'for_signature' && canManageCredentials ? (
          <>
            <button
              className="btn btn-success btn-sm"
              onClick={() => detailsAction(() => confirmSign(draft))}
              disabled={busyId === draft._id || !isCredentialPaid(draft)}
            >
              Sign
            </button>
            <button
              className="btn btn-outline-danger btn-sm"
              onClick={() => detailsAction(() => confirmReject(draft))}
              disabled={busyId === draft._id}
            >
              Reject
            </button>
          </>
        ) : null}

        {canShowClaimQr(draft) && canManageCredentials && hasActiveClaimToken(draft) ? (
          <button
            className="btn btn-info btn-sm"
            onClick={() => detailsAction(() => viewExistingClaimQr(draft))}
            disabled={busyId === draft._id}
          >
            View QR
          </button>
        ) : null}

        {canShowClaimQr(draft) && canManageCredentials && !hasActiveClaimToken(draft) && canGenerateFreshClaimQr(draft) ? (
          <button
            className="btn btn-info btn-sm"
            onClick={() => detailsAction(() => confirmClaimQr(draft, hasExpiredClaimToken(draft)))}
            disabled={busyId === draft._id}
          >
            {hasExpiredClaimToken(draft) ? 'Fresh QR' : 'Claim QR'}
          </button>
        ) : null}

        {canShowClaimQr(draft) && canManageCredentials && !hasActiveClaimToken(draft) && !canGenerateFreshClaimQr(draft) ? (
          <button className="btn btn-outline-info btn-sm" disabled>
            QR Active
          </button>
        ) : null}

        {canShowClaimOverrideQr(draft, currentUser) ? (
          <>
            {hasActiveClaimToken(draft) ? (
              <button
                className="btn btn-warning btn-sm"
                onClick={() => detailsAction(() => viewExistingClaimQr(draft, true))}
                disabled={busyId === draft._id}
              >
                View QR
              </button>
            ) : null}
            <button
              className="btn btn-outline-warning btn-sm"
              onClick={() => detailsAction(() => confirmOverrideQr(draft))}
              disabled={busyId === draft._id}
            >
              Regenerate QR
            </button>
          </>
        ) : null}

        {canQueueAnchor(draft, currentUser) ? (
          <>
            <button
              className="btn btn-warning btn-sm"
              onClick={() => detailsAction(() => confirmQueueAnchor(draft, 'same_day'))}
              disabled={busyId === draft._id}
            >
              Anchor Today
            </button>
            <button
              className="btn btn-outline-warning btn-sm"
              onClick={() => detailsAction(() => confirmQueueAnchor(draft, 'scheduled'))}
              disabled={busyId === draft._id}
            >
              Schedule 7 Days
            </button>
          </>
        ) : null}
      </div>
    );
  }

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
        const isIntakeStatus = ['draft', 'signed', 'claim_ready'].includes(status);
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

  const signingRows = useMemo(
    () =>
      rows.filter((item) => {
        const status = cleanText(item.status).toLowerCase();
        return (
          isCredentialPaid(item) &&
          ['for_signature', 'signed'].includes(status) &&
          matchesStudentName(item, signingSearch)
        );
      }),
    [rows, signingSearch]
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
          matchesAnchorSchedule(item, anchorScheduleFilter) &&
          matchesAnchorStatus(item, anchorStatusFilter)
        );
      }),
    [rows, anchorScheduleFilter, anchorStatusFilter]
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
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div>
            <h1 className="h3 mb-0">VC</h1>
          </div>

          {canManageCredentials ? (
            <button
              className="btn btn-warning"
              onClick={confirmProcessQueue}
              disabled={modalBusy}
            >
              Process Today's Anchor Queue
              {queueSummary?.pendingCount ? ` (${queueSummary.pendingCount})` : ''}
            </button>
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
            rows={vcRows}
            loading={loading}
            paymentStatus={vcPaymentFilter}
            search={vcSearch}
            onPaymentStatus={setVcPaymentFilter}
            onSearch={setVcSearch}
            onRefresh={loadDrafts}
            onDetails={openDraft}
          />
        ) : null}

        {activeTab === 'signing' ? (
          <SigningTable
            rows={signingRows}
            loading={loading}
            busyId={busyId}
            search={signingSearch}
            canManage={canManageCredentials}
            onSearch={setSigningSearch}
            onRefresh={loadDrafts}
            onSign={confirmSign}
            onDetails={openDraft}
          />
        ) : null}

        {activeTab === 'anchor' ? (
          <AnchorProgressTable
            rows={anchorRows}
            loading={loading}
            schedule={anchorScheduleFilter}
            status={anchorStatusFilter}
            onSchedule={setAnchorScheduleFilter}
            onStatus={setAnchorStatusFilter}
            onRefresh={loadDrafts}
            onDetails={openDraft}
          />
        ) : null}

        {activeTab === 'claimed' ? (
          <ClaimedCredentialsTable
            rows={claimedRows}
            loading={loading}
            busyId={busyId}
            anchorStatus={claimedAnchorFilter}
            search={claimedSearch}
            currentUser={currentUser}
            onAnchorStatus={setClaimedAnchorFilter}
            onSearch={setClaimedSearch}
            onRefresh={loadDrafts}
            onDetails={openDraft}
            onRegenerateQr={confirmOverrideQr}
          />
        ) : null}
      </div>

      <DraftDetailsModal
        draft={selectedDraft}
        actions={renderDetailsActions(selectedDraft)}
        onClose={() => setSelectedDraft(null)}
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
      <QueueResultModal
        result={queueResult}
        onClose={() => setQueueResult(null)}
      />
    </>
  );
}
