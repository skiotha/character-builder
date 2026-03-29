import { renderCreation } from "../templates/creation.mjs";

export async function renderCreationView(req, res) {
    const html = renderCreation();

    res.writeHead(200, {
        'Content-Type': 'text/html',
        'Content-Length': Buffer.byteLength(html),
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
    });
    res.end(html);


    return true
}