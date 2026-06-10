import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  checkAnchorReadiness,
  deployContract,
  estimateDeployment,
  getContractsDashboard,
  registerExistingContract,
  selectActiveAnchorContract,
} from '../contractsAPI';

const ANCHOR_CONTRACT_TYPE = 'merkle_anchor';

function contractTypeLabel() {
  return 'Merkle Anchor Contract';
}

function capabilityClass(capabilities) {
  if (capabilities?.canAnchorMerkleRoot && capabilities?.canVerifyMerkleRoot) return 'text-bg-success';
  if (capabilities?.canAnchorMerkleRoot) return 'text-bg-warning';
  return 'text-bg-danger';
}

function capabilityLabel(capabilities) {
  if (capabilities?.canAnchorMerkleRoot && capabilities?.canVerifyMerkleRoot) {
    return 'Merkle Anchoring Supported';
  }
  if (capabilities?.canAnchorMerkleRoot) {
    return 'Legacy Anchoring Supported';
  }
  return 'Merkle Anchoring Not Supported';
}

function explorerBase(url) {
  return String(url || '')
    .replace(/\/tx\/[^/]+$/i, '')
    .replace(/\/address\/[^/]+$/i, '');
}

function addressLink(item) {
  const base = explorerBase(item.explorerUrl);
  return base && item.address ? `${base}/address/${encodeURIComponent(item.address)}` : '';
}

function ExistingContractModal({
  form,
  busy,
  onChange,
  onClose,
  onVerify,
}) {
  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 className="h5 mb-1">Add Existing Contract</h2>
                <p className="text-muted mb-0 small">
                  Verify an already deployed MerkleAnchor contract on the configured network.
                </p>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
                disabled={busy}
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label fw-semibold">Contract Address</label>
                <input
                  className="form-control"
                  value={form.address}
                  onChange={(event) => onChange({ ...form, address: event.target.value })}
                  placeholder="0x..."
                  disabled={busy}
                />
              </div>
              <div>
                <label className="form-label fw-semibold">Contract Type</label>
                <select
                  className="form-select"
                  value={form.contractType}
                  onChange={(event) => onChange({ ...form, contractType: event.target.value })}
                  disabled={busy}
                >
                  <option value="merkle_anchor">Merkle Anchor</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={onVerify} disabled={busy || !form.address.trim()}>
                {busy ? 'Verifying...' : 'Verify Contract'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

function ReadinessModal({ result, onClose }) {
  const checks = [
    ['Contract Exists', Boolean(result?.contractExists)],
    ['Anchor Method Available', Boolean(result?.canAnchor)],
    ['RPC Connected', Boolean(result?.rpcConnected)],
    ['Wallet Loaded', Boolean(result?.walletLoaded)],
    ['Wallet Balance', Boolean(result?.walletBalance)],
    ['Anchor Simulation Passed', Boolean(result?.anchorSimulation)],
  ];

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 className="h5 mb-1">Anchor Readiness Check</h2>
                <p className="text-muted mb-0 small">Read-only health check for the active anchor contract.</p>
              </div>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>
            <div className="modal-body">
              <div className="mb-3 d-flex flex-wrap align-items-center gap-2">
                <span className={`badge ${result?.ready ? 'text-bg-success' : 'text-bg-danger'}`}>
                  {result?.ready ? 'READY FOR ANCHORING' : 'NOT READY'}
                </span>
                <span className="small text-muted">Wallet balance: {result?.walletBalance ?? '0.0'} POL</span>
              </div>
              <ul className="list-group list-group-flush">
                {checks.map(([label, ok]) => (
                  <li key={label} className="list-group-item d-flex justify-content-between align-items-center px-0">
                    <span>{label}</span>
                    <span className={`badge ${ok ? 'text-bg-success' : 'text-bg-danger'}`}>
                      {ok ? '✓' : '✗'}
                    </span>
                  </li>
                ))}
              </ul>
              {Array.isArray(result?.errors) && result.errors.length ? (
                <div className="alert alert-danger mt-3 mb-0">
                  {result.errors.map((item) => <div key={item}>{item}</div>)}
                </div>
              ) : null}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

export default function ContractManagerPage() {
  const reduxUser = useSelector((state) => state.auth?.user);
  const fallbackUser = useMemo(() => {
    try {
      const raw = localStorage.getItem('auth');
      return raw ? JSON.parse(raw)?.user : null;
    } catch {
      return null;
    }
  }, []);
  const currentUser = reduxUser || fallbackUser;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [verifyingExisting, setVerifyingExisting] = useState(false);
  const [checkingReadiness, setCheckingReadiness] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [dashboard, setDashboard] = useState({
    health: null,
    account: null,
    contracts: [],
    activeAnchorContract: null,
    activeAnchorContractId: '',
    activeAnchorContractAddress: '',
  });
  const [estimate, setEstimate] = useState(null);
  const [selectedContractType] = useState(ANCHOR_CONTRACT_TYPE);
  const [existingModalOpen, setExistingModalOpen] = useState(false);
  const [readinessModalOpen, setReadinessModalOpen] = useState(false);
  const [readinessResult, setReadinessResult] = useState(null);
  const [existingForm, setExistingForm] = useState({
    address: '',
    contractType: 'merkle_anchor',
  });

  const canDeploy = currentUser?.role === 'developer';

  async function loadDashboard(showBusy = false) {
    try {
      if (showBusy) setRefreshing(true);
      else setLoading(true);
      const data = await getContractsDashboard();
      setDashboard({
        health: data.health || null,
        account: data.account || null,
        contracts: data.contracts || [],
        activeAnchorContract: data.activeAnchorContract || null,
        activeAnchorContractId: data.activeAnchorContractId || '',
        activeAnchorContractAddress: data.activeAnchorContractAddress || '',
      });
    } catch (error) {
      setFeedback({ type: 'danger', text: error.message || 'Failed to load contract dashboard.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard(false);
  }, []);

  async function handleEstimate() {
    try {
      setEstimating(true);
      const data = await estimateDeployment({ contractType: ANCHOR_CONTRACT_TYPE });
      setEstimate(data);
      setFeedback({ type: 'success', text: 'Deployment estimate loaded.' });
    } catch (error) {
      setFeedback({ type: 'danger', text: error.message || 'Failed to estimate deployment.' });
    } finally {
      setEstimating(false);
    }
  }

  async function handleDeploy() {
    try {
      setDeploying(true);
      const data = await deployContract({ contractType: ANCHOR_CONTRACT_TYPE });
      setFeedback({
        type: 'success',
        text: `Contract deployed${data?.address ? ` at ${data.address}` : ''}.`,
      });
      setEstimate(null);
      await loadDashboard(true);
    } catch (error) {
      setFeedback({ type: 'danger', text: error.message || 'Contract deployment failed.' });
    } finally {
      setDeploying(false);
    }
  }

  async function handleRegisterExisting() {
    try {
      setVerifyingExisting(true);
      const data = await registerExistingContract(existingForm);
      setFeedback({
        type: 'success',
        text: `Contract verified and registered at ${data?.address || existingForm.address}.`,
      });
      setExistingModalOpen(false);
      setExistingForm({ address: '', contractType: 'merkle_anchor' });
      await loadDashboard(true);
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error?.response?.data?.message ||
          error.message ||
          'Failed to verify existing contract.',
      });
    } finally {
      setVerifyingExisting(false);
    }
  }

  async function handleSelectActiveAnchor(item) {
    try {
      setDeploying(true);
      const data = await selectActiveAnchorContract({
        contractId: item._id,
        contractAddress: item.address,
      });
      setFeedback({
        type: 'success',
        text: `Active anchor contract set to ${data?.activeAnchorContractAddress || item.address}.`,
      });
      await loadDashboard(true);
    } catch (error) {
      setFeedback({ type: 'danger', text: error.message || 'Failed to select active anchor contract.' });
    } finally {
      setDeploying(false);
    }
  }

  async function handleCheckReadiness(item = null) {
    try {
      const contractIdOrAddress = item?._id || item?.address || activeAnchorId;
      if (!contractIdOrAddress) {
        setFeedback({ type: 'warning', text: 'Select an active anchor contract before running the readiness check.' });
        return;
      }

      setCheckingReadiness(true);
      const data = await checkAnchorReadiness(contractIdOrAddress);
      setReadinessResult(data);
      setReadinessModalOpen(true);
    } catch (error) {
      setFeedback({
        type: 'danger',
        text: error?.response?.data?.message || error.message || 'Failed to check anchor readiness.',
      });
    } finally {
      setCheckingReadiness(false);
    }
  }

  const activeAnchorAddress =
    dashboard.activeAnchorContractAddress || dashboard.activeAnchorContract?.address || '';
  const activeAnchorId =
    dashboard.activeAnchorContractId || dashboard.activeAnchorContract?._id || activeAnchorAddress;

  const anchorContracts = useMemo(() => {
    const contracts = (dashboard.contracts || []).filter((item) => item.contractType === 'merkle_anchor');

    return contracts.sort((a, b) => {
      const aActive =
        a.isActive ||
        a.active ||
        String(a._id || '') === String(activeAnchorId || '') ||
        a.address === activeAnchorAddress;
      const bActive =
        b.isActive ||
        b.active ||
        String(b._id || '') === String(activeAnchorId || '') ||
        b.address === activeAnchorAddress;

      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return 0;
    });
  }, [dashboard.contracts, activeAnchorAddress, activeAnchorId]);

  const activeContract = anchorContracts.find((item) => {
    return (
      item.isActive ||
      item.active ||
      String(item._id || '') === String(activeAnchorId || '') ||
      item.address === activeAnchorAddress
    );
  });

  const activeContractStatus =
    activeContract?.capabilities?.canAnchorMerkleRoot || activeContract?.capabilities?.canVerifyMerkleRoot
      ? 'Ready'
      : activeContract
        ? 'Not Ready'
        : 'Not selected';

  if (loading) {
    return <div className="card border-0 shadow-sm"><div className="card-body p-4">Loading contract manager...</div></div>;
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-1">Anchor Contracts</h1>
          <p className="text-muted mb-0">Review and manage MerkleAnchor contracts used by VC anchoring and verification.</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          {canDeploy ? (
            <button
              className="btn btn-primary"
              onClick={() => setExistingModalOpen(true)}
              disabled={verifyingExisting}
            >
              Register Existing Anchor Contract
            </button>
          ) : null}
          <button className="btn btn-outline-secondary" onClick={() => loadDashboard(true)} disabled={refreshing}>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {feedback.text ? <div className={`alert alert-${feedback.type}`}>{feedback.text}</div> : null}

      <div className="row g-4 mb-4">
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <h2 className="h5 mb-3">Service Health</h2>
              <div className="mb-2"><span className="text-muted">Status:</span> <strong>{dashboard.health?.ok ? 'Connected' : 'Unavailable'}</strong></div>
              <div className="mb-2"><span className="text-muted">Network:</span> <strong>{dashboard.health?.network || 'Unknown'}</strong></div>
              <div className="mb-0"><span className="text-muted">Chain ID:</span> <strong>{dashboard.health?.chainId ?? '—'}</strong></div>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <h2 className="h5 mb-3">Wallet</h2>
              <div className="mb-2"><span className="text-muted">Address:</span><div className="fw-semibold text-break">{dashboard.account?.address || dashboard.health?.walletAddress || '—'}</div></div>
              <div className="mb-2"><span className="text-muted">Balance:</span> <strong>{dashboard.account?.balanceNative || '0.0000'} {dashboard.account?.gasToken || 'POL'}</strong></div>
              <div className="mb-0"><span className="text-muted">Chain:</span> <strong>{dashboard.account?.chainId ?? dashboard.health?.chainId ?? '—'}</strong></div>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <h2 className="h5 mb-3">Deploy Anchor Contract</h2>
              {canDeploy ? (
                <>
                  <div className="alert alert-light border mb-3">Only MerkleAnchor contracts are exposed in this manager view.</div>
                  <button className="btn btn-outline-primary w-100 mb-2" onClick={handleEstimate} disabled={estimating || deploying}>
                    {estimating ? 'Estimating...' : 'Estimate Anchor Contract Cost'}
                  </button>
                  <button className="btn btn-primary w-100" onClick={handleDeploy} disabled={!estimate || deploying}>
                    {deploying ? 'Deploying...' : 'Deploy New Anchor Contract'}
                  </button>
                </>
              ) : (
                <div className="alert alert-light border mb-0">Only the MIS developer can deploy contracts.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {estimate ? (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body p-4">
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div>
                <h2 className="h5 mb-1">Estimated Deployment Cost</h2>
                <p className="text-muted mb-0">Review the cost before deploying the contract.</p>
              </div>
              <div className="d-flex flex-wrap gap-2 justify-content-end">
                <span className="badge text-bg-dark">{estimate.contractName}</span>
                <span className={`badge ${capabilityClass(estimate.capabilities)}`}>
                  {capabilityLabel(estimate.capabilities)}
                </span>
              </div>
            </div>

            <div className="row g-3">
              <div className="col-md-3"><div className="border rounded p-3 h-100"><div className="text-muted small">Gas Limit</div><div className="fw-semibold">{estimate.gasLimit}</div></div></div>
              <div className="col-md-3"><div className="border rounded p-3 h-100"><div className="text-muted small">Fee / Gas</div><div className="fw-semibold">{estimate.feePerGasGwei} Gwei</div></div></div>
              <div className="col-md-3"><div className="border rounded p-3 h-100"><div className="text-muted small">Estimated Cost</div><div className="fw-semibold">{estimate.totalCostNative} {estimate.gasToken}</div></div></div>
              <div className="col-md-3"><div className="border rounded p-3 h-100"><div className="text-muted small">Wallet</div><div className="fw-semibold text-break">{estimate.walletAddress}</div></div></div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
            <div>
              <h2 className="h5 mb-1">Anchor Contracts</h2>
              <p className="text-muted mb-0">The active contract appears first and is used for future anchoring.</p>
            </div>
            <span className="badge text-bg-secondary">{anchorContracts.length}</span>
          </div>

          <div className="alert alert-light border mb-3 py-2">
            <strong>Active Contract:</strong> {activeAnchorAddress || 'None selected'}
            <span className="mx-2">•</span>
            <strong>Status:</strong> <span className={`badge ${activeContractStatus === 'Ready' ? 'text-bg-success' : 'text-bg-warning'}`}>{activeContractStatus}</span>
          </div>

          {anchorContracts.length === 0 ? (
            <div className="alert alert-light border mb-0">
              No anchor contracts registered.
              <button className="btn btn-primary btn-sm ms-2" onClick={() => setExistingModalOpen(true)} disabled={verifyingExisting}>
                Register Existing Contract
              </button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Contract Address</th>
                    <th>Status</th>
                    <th>Active</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {anchorContracts.map((item) => {
                    const isActiveAnchor =
                      item.contractType === 'merkle_anchor' &&
                      (item.isActive ||
                        item.active ||
                        String(item._id || '') === String(activeAnchorId || '') ||
                        item.address === activeAnchorAddress);
                    const canSetActive =
                      canDeploy &&
                      item.contractType === 'merkle_anchor' &&
                      item.status === 'success' &&
                      item.address &&
                      !isActiveAnchor;

                    const readyStatus =
                      item.capabilities?.canAnchorMerkleRoot || item.capabilities?.canVerifyMerkleRoot
                        ? 'Ready'
                        : 'Not Ready';

                    return (
                      <tr key={item._id || item.txHash || item.address} className={isActiveAnchor ? 'table-success' : ''}>
                        <td className="text-break">
                          {addressLink(item) ? (
                            <a href={addressLink(item)} target="_blank" rel="noreferrer">
                              {item.address}
                            </a>
                          ) : (
                            item.address || 'Pending'
                          )}
                          <div className="text-muted small">{item.contractName || 'MerkleAnchor'}</div>
                        </td>
                        <td>
                          <span className={`badge ${readyStatus === 'Ready' ? 'text-bg-success' : 'text-bg-warning'}`}>
                            {readyStatus}
                          </span>
                        </td>
                        <td>
                          {isActiveAnchor ? <span className="badge text-bg-success">Active</span> : <span className="text-muted small">Inactive</span>}
                        </td>
                        <td>
                          <div className="d-flex flex-wrap gap-2">
                            <button
                              className="btn btn-outline-success btn-sm"
                              onClick={() => handleCheckReadiness(item)}
                              disabled={checkingReadiness}
                            >
                              Check
                            </button>
                            {isActiveAnchor ? (
                              <span className="badge text-bg-success align-self-center">Active</span>
                            ) : canSetActive ? (
                              <button
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => handleSelectActiveAnchor(item)}
                                disabled={deploying}
                              >
                                Set Active
                              </button>
                            ) : (
                              <span className="text-muted small align-self-center">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {existingModalOpen ? (
        <ExistingContractModal
          form={existingForm}
          busy={verifyingExisting}
          onChange={setExistingForm}
          onClose={() => setExistingModalOpen(false)}
          onVerify={handleRegisterExisting}
        />
      ) : null}

      {readinessModalOpen ? (
        <ReadinessModal
          result={readinessResult}
          onClose={() => setReadinessModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
