import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  deployContract,
  estimateDeployment,
  getContractsDashboard,
} from '../contractsAPI';

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
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [dashboard, setDashboard] = useState({
    health: null,
    account: null,
    contracts: [],
  });
  const [estimate, setEstimate] = useState(null);

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
      const data = await estimateDeployment();
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
      const data = await deployContract();
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

  if (loading) {
    return <div className="card border-0 shadow-sm"><div className="card-body p-4">Loading contract manager...</div></div>;
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-1">Contract Manager</h1>
          <p className="text-muted mb-0">Deploy contracts and review the saved deployment list from the smart contract service.</p>
        </div>
        <button className="btn btn-outline-secondary" onClick={() => loadDashboard(true)} disabled={refreshing}>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
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
                  <button className="btn btn-outline-primary w-100 mb-2" onClick={handleEstimate} disabled={estimating || deploying}>
                    {estimating ? 'Estimating...' : 'Estimate Deploy Cost'}
                  </button>
                  <button className="btn btn-primary w-100" onClick={handleDeploy} disabled={!estimate || deploying}>
                    {deploying ? 'Deploying...' : 'Deploy Contract'}
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
              <span className="badge text-bg-dark">{estimate.contractName}</span>
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
                    <th>Address</th>
                    <th>Status</th>
                    <th>Network</th>
                    <th>Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.contracts.map((item) => (
                    <tr key={item._id || item.txHash || item.address}>
                      <td>
                        <div className="fw-semibold">{item.contractName || 'AdminContract'}</div>
                        <div className="text-muted small">{item.gasToken || 'POL'}</div>
                      </td>
                      <td className="text-break">{item.address || 'Pending'}</td>
                      <td>
                        <span className={`badge ${item.status === 'success' ? 'text-bg-success' : item.status === 'pending' ? 'text-bg-warning' : 'text-bg-danger'}`}>
                          {item.status || 'unknown'}
                        </span>
                      </td>
                      <td>{item.network || item.chainId || '—'}</td>
                      <td>
                        {item.explorerUrl ? (
                          <a href={item.explorerUrl} target="_blank" rel="noreferrer">Open</a>
                        ) : item.txHash ? (
                          <span className="text-break small">{item.txHash}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
