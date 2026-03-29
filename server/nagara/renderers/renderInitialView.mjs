import { renderInitial } from "../templates/initial.mjs";

export async function renderInitialView(req, res) {
    const html = renderInitial();

    // @TODO: set CSP everywhere
    res.writeHead(200, {
        'Content-Type': 'text/html',
        'Content-Length': Buffer.byteLength(html),
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
    });
    res.end(html);

    return true;
}