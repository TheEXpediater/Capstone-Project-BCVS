import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  buildDownloadUrl,
  createPublicVerificationSession,
  getPublicVerificationResult,
  requestHolderConsent,
} from '../publicVerificationAPI';

function clean(value) {
  return String(value || '').trim();
}

function titleCase(value) {
  return clean(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function statusBadge(valid) {
  return valid ? 'badge bg-success' : 'badge bg-warning text-dark';
}

function ProofRow({ label, valid, detail }) {
  return (
    <div className="d-flex flex-wrap justify-content-between gap-2 border-bottom py-2">
      <div className="fw-semibold">{label}</div>
      <div className="text-end">
        <span className={statusBadge(valid)}>{valid ? 'Passed' : 'Attention'}</span>
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

  if (session?.status === 'expired') {
    return <div className="alert alert-secondary mb-0">This verification session expired before the holder responded.</div>;
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

export default function VerifierPortalPage() {
  const { sessionId: routeSessionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const credentialId = searchParams.get('credentialId') || '';
  const credentialTypeHint = searchParams.get('credentialType') || 'tor';
  const routeNonce = searchParams.get('nonce') || '';
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
  const waiting = ['draft', 'pending', 'pending_consent'].includes(session?.status);

  useEffect(() => {
    if (!routeSessionId || !routeNonce) return undefined;

    let cancelled = false;
    async function load() {
      try {
        const data = await getPublicVerificationResult(routeSessionId, routeNonce);
        if (!cancelled) {
          setSession(data);
          setNonce(routeNonce);
          setError('');
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.response?.data?.message || loadError.message);
      }
    }

    load();
    const timer = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [routeSessionId, routeNonce]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const created = await createPublicVerificationSession({
        ...form,
        verifyBaseUrl: `${window.location.origin}/verify`,
      });
      const nextNonce = created.nonce;
      const nextSessionId = created.sessionId;
      const requested = await requestHolderConsent(nextSessionId, {
        ...form,
        nonce: nextNonce,
      });
      setSession(requested);
      setNonce(nextNonce);
      navigate(`/verify/${nextSessionId}?nonce=${encodeURIComponent(nextNonce)}`, {
        replace: true,
      });
    } catch (submitError) {
      setError(submitError.response?.data?.message || submitError.message);
    } finally {
      setBusy(false);
    }
  }

  const statusText = useMemo(() => {
    if (!session) return 'Verifier request';
    if (session.status === 'presented') return 'Holder approved';
    if (session.status === 'denied') return 'Holder denied';
    if (session.status === 'expired') return 'Session expired';
    return 'Waiting for holder consent';
  }, [session]);

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

        {!sessionId ? (
          <form className="bg-white border rounded-2 p-4 shadow-sm" onSubmit={submit}>
            <div className="row g-3">
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
            </div>
          </form>
        ) : (
          <div className="bg-white border rounded-2 p-4 shadow-sm">
            <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
              <div>
                <div className="small text-muted">Session</div>
                <div className="fw-semibold">{sessionId}</div>
              </div>
              <div className="text-end">
                <span className={`badge ${waiting ? 'bg-info text-dark' : session?.status === 'presented' ? 'bg-success' : 'bg-secondary'}`}>
                  {titleCase(session?.status || 'loading')}
                </span>
              </div>
            </div>

            <ResultPanel session={session} nonce={nonce} />
          </div>
        )}
      </div>
    </main>
  );
}
