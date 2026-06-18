import { writeAuditLog } from '../../modules/audit/service.js';

export function auditAction(options = {}) {
  return (req, res, next) => {
    const startedAt = Date.now();

    res.on('finish', async () => {
      const statusCode = res.statusCode || 200;

      if (options.onlySuccess !== false && statusCode >= 400) {
        return;
      }

      await writeAuditLog({
        req,
        user: req.user,
        module: options.module || 'system',
        action: options.action || `${req.method}_${req.path}`,
        label:
          typeof options.label === 'function'
            ? options.label(req, res)
            : options.label || '',
        description:
          typeof options.description === 'function'
            ? options.description(req, res)
            : options.description || '',
        target:
          typeof options.target === 'function'
            ? options.target(req, res)
            : {
                id: req.params?.id || req.params?.studentId || '',
                type: options.targetType || '',
                label: '',
              },
        status: statusCode >= 400 ? 'failed' : 'success',
        metadata: {
          statusCode,
          durationMs: Date.now() - startedAt,
          params: req.params || {},
          query: req.query || {},
          ...(typeof options.metadata === 'function'
            ? options.metadata(req, res)
            : options.metadata || {}),
        },
      });
    });

    next();
  };
}