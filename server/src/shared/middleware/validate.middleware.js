import { ApiError } from "../utils/ApiError.js";

export function validate(schema, source = "body") {
  return (req, _res, next) => {
    const data = req[source] ?? {};

    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return next(
        new ApiError(
          400,
          "Validation error",
          error.details.map((item) => ({
            message: item.message,
            path: item.path,
          }))
        )
      );
    }

    if (source === "body") req.body = value;
    if (source === "params") req.params = value;

    return next();
  };
}