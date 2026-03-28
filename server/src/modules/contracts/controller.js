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
    const data = await contractService.estimateDeployment(req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deploy(req, res, next) {
  try {
    const data = await contractService.deployContract(req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
