import { DM_TOKEN } from "#config";

function requireDmToken(req) {
  const providedToken = req.headers["x-dm-id"];
  if (!providedToken || providedToken !== DM_TOKEN) {
    const error = new Error("DM authorization required");
    error.statusCode = 401;
    throw error;
  }
}

function validateDmToken(token) {
  return token === DM_TOKEN;
}

export { requireDmToken, validateDmToken };
