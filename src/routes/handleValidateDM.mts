import { validateDmToken } from "#auth";

export async function handleValidateDM(req, res) {
  const token = req.headers["x-dm-id"];

  if (validateDmToken(token)) {
    res.writeHead(200);
    res.end();
  } else {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Token validation failed",
      }),
    );
  }

  return true;
}
