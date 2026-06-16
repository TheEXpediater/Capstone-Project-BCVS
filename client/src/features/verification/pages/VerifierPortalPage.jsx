import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  buildDownloadUrl,
  cancelPublicVerificationSession,
  createPublicVerificationSession,
  getPublicVerificationResult,
  requestHolderConsent,
} from '../publicVerificationAPI';

const ACTIVE_SESSION_KEY = 'bcvs.publicVerification.activeSession.v1';
const TERMINAL_STATUSES = new Set(['presented', 'denied', 'cancelled', 'expired', 'failed']);
const WAITING_STATUSES = new Set(['pending', 'pending_consent']);

function clean(value) {
  return String(value || '').trim();
}

function titleCase(value) {
  return clean(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function readStoredSession() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ACTIVE_SESSION_KEY) || 'null');
    if (!parsed?.sessionId || !parsed?.nonce) return null;
    if (TERMINAL_STATUSES.has(parsed.status)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredSession(session, nonce, form = {}) {
  if (!session?.sessionId || !nonce || TERMINAL_STATUSES.has(session.status)) {
    return;
  }

  window.localStorage.setItem(
    ACTIVE_SESSION_KEY,
    JSON.stringify({
      sessionId: session.sessionId,
      nonce,
      credentialId: clean(session.credentialId || form.credentialId),
      credentialType: clean(session.credentialType || form.credentialType),
      status: session.status,
      createdAt: session.createdAt || form.createdAt || new Date().toISOString(),
      form,
      savedAt: new Date().toISOString(),
    })
  );
}

function clearStoredSession() {
  window.localStorage.removeItem(ACTIVE_SESSION_KEY);
}

function statusBadge(status) {
  if (status === 'presented') return 'badge bg-success';
  if (status === 'denied' || status === 'failed') return 'badge bg-danger';
  if (status === 'cancelled' || status === 'expired') return 'badge bg-secondary';
  return 'badge bg-info text-dark';
}

function proofStatus(valid) {
  return valid ? 'badge bg-success' : 'badge bg-warning text-dark';
}

function getErrorMessage(error, fallback = 'Request failed') {
  return error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback;
}

function deriveFormFromSession(session, currentForm) {
  const request = session?.request || {};
  return {
    ...currentForm,
    credentialId: clean(session?.credentialId || currentForm.credentialId),
    credentialType: clean(session?.credentialType || request.credentialType || currentForm.credentialType || 'tor'),
    organization: clean(request.organization || request.orgName || currentForm.organization),
    contact: clean(request.contact || currentForm.contact),
    purpose: clean(request.purpose || currentForm.purpose || 'Credential verification'),
    requestedPdf: Boolean(session?.requestedPdf || request.requestedPdf || currentForm.requestedPdf),
  };
}

function ProofRow({ label, valid, detail }) {
  return (
    <div className="d-flex flex-wrap justify-content-between gap-2 border-bottom py-2">
      <div className="fw-semibold">{label}</div>
      <div className="text-end">
        <span className={proofStatus(valid)}>{valid ? 'Passed' : 'Attention'}</span>
        {detail ? <div className="small text-muted mt-1">{detail}</div> : null}
      </div>
    </div>
  );
}

function ResultPanel({ session, nonce }) {
  const result = session?.verificationResult;
  const checks = result?.checks || {};
  const downloads = session?.downloads || {};

  if (session?.status === 'denied') {
    return <div className="alert alert-danger mb-0">The holder denied this verification request.</div>;
  }

  if (session?.status === 'cancelled') {
    return <div className="alert alert-secondary mb-0">This verification request was cancelled.</div>;
  }

  if (session?.status === 'expired') {
    return <div className="alert alert-secondary mb-0">This verification session expired before the holder responded.</div>;
  }

  if (session?.status === 'failed') {
    return <div className="alert alert-danger mb-0">This verification request could not be completed.</div>;
  }

  if (!result) {
    return (
      <div className="alert alert-light border mb-0">
        Waiting for the holder to approve or deny this request.
      </div>
    );
  }

  return (
    <div className="d-flex flex-column gap-3">
      <div className={`alert mb-0 ${result.verified ? 'alert-success' : result.status === 'failed' ? 'alert-danger' : 'alert-warning'}`}>
        <div className="fw-bold">Verification status: {titleCase(result.status)}</div>
        <div className="small mt-1">{result.note || 'All available proof checks were evaluated.'}</div>
      </div>

      <div className="border rounded-2 p-3 text-start">
        <ProofRow
          label="Credential type"
          valid={checks.credentialType?.valid}
          detail={`${titleCase(checks.credentialType?.actual)} requested as ${titleCase(checks.credentialType?.expected || checks.credentialType?.actual)}`}
        />
        <ProofRow
          label="Holder subject"
          valid={checks.subject?.valid}
          detail={checks.subject?.studentNo || ''}
        />
        <ProofRow
          label="Deterministic VC hash"
          valid={checks.hash?.valid}
          detail={result.vcHash}
        />
        <ProofRow
          label="Issuer signature"
          valid={checks.signature?.valid}
          detail={checks.signature?.verificationMethod || checks.signature?.reason}
        />
        <ProofRow
          label="Merkle proof/root"
          valid={checks.merkle?.valid}
          detail={checks.merkle?.root || checks.merkle?.reason}
        />
        <ProofRow
          label="Blockchain anchor"
          valid={checks.blockchain?.verified}
          detail={checks.blockchain?.txHash || checks.blockchain?.reason}
        />
      </div>

      <div className="d-flex flex-wrap gap-2">
        {downloads.vc ? (
          <a className="btn btn-outline-primary" href={buildDownloadUrl(session.sessionId, nonce, 'vc')}>
            Download VC JSON
          </a>
        ) : null}
        {downloads.report ? (
          <a className="btn btn-outline-secondary" href={buildDownloadUrl(session.sessionId, nonce, 'report')}>
            Download Report
          </a>
        ) : null}
        {downloads.pdf ? (
          <a className="btn btn-primary" href={buildDownloadUrl(session.sessionId, nonce, 'pdf')}>
            Download PDF
          </a>
        ) : null}
      </div>
    </div>
  );
}


function DraftCredentialPanel({ session, form }) {
  const credentialId = clean(session?.credentialId || form?.credentialId);
  const credentialType = clean(session?.credentialType || form?.credentialType);

  if (!credentialId && !credentialType) return null;

  return (
    <div className="alert alert-light border mb-3">
      <div className="fw-semibold mb-2">Credential selected from QR</div>
      <div className="row g-2 small">
        <div className="col-md-8">
          <div className="text-muted">Credential ID</div>
          <div className="fw-semibold text-break">{credentialId || 'Not available'}</div>
        </div>
        <div className="col-md-4">
          <div className="text-muted">Document</div>
          <div className="fw-semibold">{titleCase(credentialType || 'tor')}</div>
        </div>
      </div>
    </div>
  );
}

export default function VerifierPortalPage() {
  const { sessionId: routeSessionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const routeNonce = searchParams.get('nonce') || '';
  const credentialId = searchParams.get('credentialId') || '';
  const credentialTypeHint = searchParams.get('credentialType') || 'tor';
  const [form, setForm] = useState({
    credentialId,
    credentialType: credentialTypeHint || 'tor',
    organization: '',
    contact: '',
    purpose: 'Credential verification',
    requestedPdf: false,
  });
  const [session, setSession] = useState(null);
  const [nonce, setNonce] = useState(routeNonce);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const sessionId = session?.sessionId || routeSessionId || '';
  const isDraftSession = Boolean(sessionId && session?.status === 'draft');
  const canRequestConsent = !sessionId || isDraftSession;
  const canCancel = Boolean(sessionId && nonce && WAITING_STATUSES.has(session?.status));

  useEffect(() => {
    if (routeSessionId || routeNonce) return;
    const stored = readStoredSession();
    if (!stored) return;

    setForm((state) => ({
      ...state,
      ...(stored.form || {}),
      credentialId: stored.form?.credentialId || stored.credentialId || state.credentialId,
      credentialType: stored.form?.credentialType || stored.credentialType || state.credentialType,
    }));
    setNonce(stored.nonce);
    navigate(`/verify/${stored.sessionId}?nonce=${encodeURIComponent(stored.nonce)}`, { replace: true });
  }, [navigate, routeNonce, routeSessionId]);

  useEffect(() => {
    if (!routeSessionId || !routeNonce) return undefined;

    let cancelled = false;
    async function load() {
      try {
        const data = await getPublicVerificationResult(routeSessionId, routeNonce);
        if (cancelled) return;

        setSession(data);
        setNonce(routeNonce);
        setForm((state) => {
          const nextForm = deriveFormFromSession(data, state);
          writeStoredSession(data, routeNonce, nextForm);
          return nextForm;
        });
        if (TERMINAL_STATUSES.has(data?.status)) {
          clearStoredSession();
        }
        setError('');
      } catch (loadError) {
        if (cancelled) return;

        const status = loadError?.response?.status;
        if (status === 410) {
          setSession((state) => ({ ...(state || {}), sessionId: routeSessionId, status: 'expired' }));
          clearStoredSession();
        }
        setError(getErrorMessage(loadError, 'Unable to load verification session.'));
      }
    }

    load();
    const timer = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [routeNonce, routeSessionId]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      let nextNonce = nonce;
      let nextSessionId = sessionId;

      if (!nextSessionId) {
        const created = await createPublicVerificationSession({
          ...form,
          verifyBaseUrl: `${window.location.origin}/verify`,
        });
        nextNonce = created.nonce;
        nextSessionId = created.sessionId;
      }

      const requested = await requestHolderConsent(nextSessionId, {
        ...form,
        nonce: nextNonce,
      });
      const nextForm = deriveFormFromSession(requested, form);
      setSession(requested);
      setNonce(nextNonce);
      setForm(nextForm);
      writeStoredSession(requested, nextNonce, nextForm);
      navigate(`/verify/${nextSessionId}?nonce=${encodeURIComponent(nextNonce)}`, { replace: true });
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to request holder consent.'));
    } finally {
      setBusy(false);
    }
  }

  async function cancelRequest() {
    if (!sessionId || !nonce) return;

    setBusy(true);
    setError('');
    try {
      const cancelled = await cancelPublicVerificationSession(sessionId, nonce);
      setSession(cancelled);
      clearStoredSession();
    } catch (cancelError) {
      setError(getErrorMessage(cancelError, 'Unable to cancel this request.'));
    } finally {
      setBusy(false);
    }
  }

  function startNew() {
    clearStoredSession();
    setSession(null);
    setNonce('');
    setError('');
    setForm({
      credentialId: '',
      credentialType: 'tor',
      organization: '',
      contact: '',
      purpose: 'Credential verification',
      requestedPdf: false,
    });
    navigate('/verify', { replace: true });
  }

  const statusText = useMemo(() => {
    if (!sessionId) return 'Verifier request';
    if (!session) return 'Loading session';
    if (session.status === 'draft') return 'Ready to request holder consent';
    if (session.status === 'presented') return 'Holder approved';
    if (session.status === 'denied') return 'Holder denied';
    if (session.status === 'cancelled') return 'Request cancelled';
    if (session.status === 'expired') return 'Session expired';
    if (session.status === 'failed') return 'Verification failed';
    return 'Waiting for holder consent';
  }, [session, sessionId]);

  return (
    <main className="min-vh-100 bg-light text-start">
      <div className="container py-4 py-lg-5">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
          <div>
            <p className="text-uppercase small fw-bold text-primary mb-1">BCVS public verifier</p>
            <h1 className="h3 mb-1">Verify Credential</h1>
            <p className="text-muted mb-0">{statusText}</p>
          </div>
          <Link className="btn btn-outline-secondary" to="/login">Admin Login</Link>
        </div>

        {error ? <div className="alert alert-danger">{error}</div> : null}

        {canRequestConsent ? (
          <form className="bg-white border rounded-2 p-4 shadow-sm mb-4" onSubmit={submit}>
            {isDraftSession ? (
              <>
                <div className="alert alert-info border mb-3">
                  <div className="fw-semibold">Credential session ready</div>
                  <div className="small">
                    A holder shared this credential. Enter verifier details to request consent from the mobile app.
                  </div>
                </div>
                <DraftCredentialPanel session={session} form={form} />
              </>
            ) : null}

            <div className="row g-3">
              {!isDraftSession ? (
                <>
                  <div className="col-md-8">
                    <label className="form-label fw-semibold">Credential ID</label>
                    <input
                      className="form-control"
                      value={form.credentialId}
                      onChange={(event) => setForm((state) => ({ ...state, credentialId: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Document</label>
                    <select
                      className="form-select"
                      value={form.credentialType}
                      onChange={(event) => setForm((state) => ({ ...state, credentialType: event.target.value }))}
                    >
                      <option value="tor">Transcript of Records</option>
                      <option value="diploma">Diploma</option>
                    </select>
                  </div>
                </>
              ) : null}
              <div className="col-md-6">
                <label className="form-label fw-semibold">Organization</label>
                <input
                  className="form-control"
                  value={form.organization}
                  onChange={(event) => setForm((state) => ({ ...state, organization: event.target.value }))}
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold">Contact</label>
                <input
                  className="form-control"
                  value={form.contact}
                  onChange={(event) => setForm((state) => ({ ...state, contact: event.target.value }))}
                />
              </div>
              <div className="col-12">
                <label className="form-label fw-semibold">Purpose</label>
                <input
                  className="form-control"
                  value={form.purpose}
                  onChange={(event) => setForm((state) => ({ ...state, purpose: event.target.value }))}
                  required
                />
              </div>
              <div className="col-12">
                <label className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={form.requestedPdf}
                    onChange={(event) => setForm((state) => ({ ...state, requestedPdf: event.target.checked }))}
                  />
                  <span className="form-check-label">Request PDF download permission</span>
                </label>
              </div>
            </div>

            <div className="d-flex flex-wrap gap-2 mt-4">
              <button className="btn btn-primary" disabled={busy}>
                {busy ? 'Sending...' : 'Request Holder Consent'}
              </button>
              {sessionId ? (
                <button className="btn btn-outline-secondary" type="button" onClick={startNew} disabled={busy}>
                  Start New Verification
                </button>
              ) : null}
            </div>
          </form>
        ) : null}

        {sessionId && !canRequestConsent ? (
          <div className="bg-white border rounded-2 p-4 shadow-sm">
            <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
              <div>
                <div className="small text-muted">Session</div>
                <div className="fw-semibold text-break">{sessionId}</div>
              </div>
              <div className="text-end">
                <span className={statusBadge(session?.status || 'loading')}>
                  {titleCase(session?.status || 'loading')}
                </span>
              </div>
            </div>

            <DraftCredentialPanel session={session} form={form} />

            <ResultPanel session={session} nonce={nonce} />

            <div className="d-flex flex-wrap gap-2 mt-4">
              {canCancel ? (
                <button className="btn btn-outline-danger" type="button" onClick={cancelRequest} disabled={busy}>
                  {busy ? 'Cancelling...' : 'Cancel Request'}
                </button>
              ) : null}
              <button className="btn btn-outline-secondary" type="button" onClick={startNew} disabled={busy}>
                Start New Verification
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}