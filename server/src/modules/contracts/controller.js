import * as contractService from './service.js';

export async function getDashboard(_req, res, next) {
  try {
    const data = await contractService.getContractsDashboard();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function estimate(req, res, next) {
  try {
    const data = await contractService.estimateDeployment(req.body || {});
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deploy(req, res, next) {
  try {
    const data = await contractService.deployContract(req.body || {});
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function registerExisting(req, res, next) {
  try {
    const data = await contractService.registerExistingContract(req.body || {}, req.user);
    res.status(200).json({
      success: true,
      data,
      message: 'Existing contract verified and registered successfully.',
    });
  } catch (error) {
    next(error);
  }
}

export async function getCapabilities(req, res, next) {
  try {
    const data = await contractService.getContractCapabilitiesByAddress(req.params.address);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function selectActiveAnchor(req, res, next) {
  try {
    const data = await contractService.selectActiveAnchorContract(req.body || {}, req.user);
    res.status(200).json({
      success: true,
      data,
      message: 'Active anchor contract updated successfully.',
    });
  } catch (error) {
    next(error);
  }
}

export async function checkReadiness(req, res, next) {
  try {
    const data = await contractService.checkAnchorReadiness(req.params.id || req.params.address);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
