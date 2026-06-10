import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  deployContract,
  estimateDeployment,
  getContractsDashboard,
  registerExistingContract,
  selectActiveAnchorContract,
} from '../contractsAPI';

const CONTRACT_TYPES = [
  { value: 'admin', label: 'Admin Contract' },
  { value: 'merkle_anchor', label: 'Merkle Anchor Contract' },
];

function contractTypeLabel(value) {
  return CONTRACT_TYPES.find((item) => item.value === value)?.label || 'Admin Contract';
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
  const [selectedContractType, setSelectedContractType] = useState('merkle_anchor');
  const [existingModalOpen, setExistingModalOpen] = useState(false);
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
      const data = await estimateDeployment({ contractType: selectedContractType });
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
      const data = await deployContract({ contractType: selectedContractType });
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

  if (loading) {
    return <div className="card border-0 shadow-sm"><div className="card-body p-4">Loading contract manager...</div></div>;
  }

  const activeAnchorAddress =
    dashboard.activeAnchorContractAddress || dashboard.activeAnchorContract?.address || '';
  const activeAnchorId =
    dashboard.activeAnchorContractId || dashboard.activeAnchorContract?._id || activeAnchorAddress;

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-1">Contract Manager</h1>
          <p className="text-muted mb-0">Deploy contracts and review the saved deployment list from the smart contract service.</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          {canDeploy ? (
            <button
              className="btn btn-primary"
              onClick={() => setExistingModalOpen(true)}
              disabled={verifyingExisting}
            >
              Add Existing Contract
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
              <h2 className="h5 mb-3">Deployment</h2>
              {canDeploy ? (
                <>
                  <div className="btn-group w-100 mb-3" role="group" aria-label="Contract type">
                    {CONTRACT_TYPES.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        className={`btn ${selectedContractType === item.value ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => {
                          setSelectedContractType(item.value);
                          setEstimate(null);
                        }}
                        disabled={estimating || deploying}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <button className="btn btn-outline-primary w-100 mb-2" onClick={handleEstimate} disabled={estimating || deploying}>
                    {estimating ? 'Estimating...' : `Estimate ${contractTypeLabel(selectedContractType)} Cost`}
                  </button>
                  <button className="btn btn-primary w-100" onClick={handleDeploy} disabled={!estimate || deploying}>
                    {deploying ? 'Deploying...' : `Deploy ${contractTypeLabel(selectedContractType)}`}
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

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
            <div>
              <h2 className="h5 mb-1">Active Anchor Contract</h2>
              <p className="text-muted mb-0">New credential anchors use this MerkleAnchor deployment.</p>
            </div>
            <span className={`badge ${activeAnchorAddress ? 'text-bg-success' : 'text-bg-warning'}`}>
              {activeAnchorAddress ? 'Selected' : 'Not selected'}
            </span>
          </div>
          <div className="row g-3 mt-1">
            <div className="col-md-6">
              <div className="small text-muted">Contract</div>
              <div className="fw-semibold">{dashboard.activeAnchorContract?.contractName || 'MerkleAnchor'}</div>
            </div>
            <div className="col-md-6">
              <div className="small text-muted">Address</div>
              <div className="fw-semibold text-break">{activeAnchorAddress || 'Deploy and select a MerkleAnchor contract'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <h2 className="h5 mb-1">Deployed Contracts</h2>
              <p className="text-muted mb-0">Records are coming from the smart contract backend deployment collection.</p>
            </div>
            <span className="badge text-bg-secondary">{dashboard.contracts.length}</span>
          </div>

          {dashboard.contracts.length === 0 ? (
            <div className="alert alert-light border mb-0">No deployments found yet.</div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Contract</th>
                    <th>Type</th>
                    <th>Address</th>
                    <th>Capability</th>
                    <th>Status</th>
                    <th>Network</th>
                    <th>Tx</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.contracts.map((item) => {
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

                    return (
                      <tr key={item._id || item.txHash || item.address}>
                        <td>
                          <div className="fw-semibold">{item.contractName || 'AdminContract'}</div>
                          <div className="text-muted small">{item.gasToken || 'POL'}</div>
                        </td>
                        <td>{contractTypeLabel(item.contractType)}</td>
                        <td className="text-break">
                          {addressLink(item) ? (
                            <a href={addressLink(item)} target="_blank" rel="noreferrer">
                              {item.address}
                            </a>
                          ) : (
                            item.address || 'Pending'
                          )}
                        </td>
                        <td>
                          <span className={`badge ${capabilityClass(item.capabilities)}`}>
                            {capabilityLabel(item.capabilities)}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${item.status === 'success' ? 'text-bg-success' : item.status === 'pending' ? 'text-bg-warning' : 'text-bg-danger'}`}>
                            {item.status || 'unknown'}
                          </span>
                          {item.verified ? <div className="small text-muted">Verified</div> : null}
                        </td>
                        <td>{item.network || item.chainId || '-'}</td>
                        <td>
                          {item.txHash && item.explorerUrl && /\/tx\//i.test(item.explorerUrl) ? (
                            <a href={item.explorerUrl} target="_blank" rel="noreferrer">Open</a>
                          ) : item.txHash ? (
                            <span className="text-break small">{item.txHash}</span>
                          ) : (
                            <span className="text-muted small">Registered</span>
                          )}
                        </td>
                        <td>
                          {isActiveAnchor ? (
                            <span className="badge text-bg-success">Active</span>
                          ) : canSetActive ? (
                            <button
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => handleSelectActiveAnchor(item)}
                              disabled={deploying}
                            >
                              Set Active
                            </button>
                          ) : (
                            <span className="text-muted small">-</span>
                          )}
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
    </div>
  );
}
