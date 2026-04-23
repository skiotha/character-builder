import { LOCALES, DEFAULT_LOCALE } from "#config";

import type { IncomingMessage } from "node:http";
import type { Locale } from "#config";

interface LocaleError {
  error: string;
}

function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Parse the request locale.
 *
 * Resolution order:
 *   1. `?locale=` query parameter — if present but invalid, returns
 *      `{ error }` so the caller can respond 400.
 *   2. `Accept-Language` header — first tag whose primary subtag is in
 *      `LOCALES` wins. Quality factors are ignored (header order wins).
 *   3. `DEFAULT_LOCALE`.
 */
function parseLocale(req: IncomingMessage, url: URL): Locale | LocaleError {
  const queryLocale = url.searchParams.get("locale");
  if (queryLocale !== null) {
    const normalized = queryLocale.toLowerCase();
    if (!isLocale(normalized)) {
      return {
        error: `Unsupported locale: '${queryLocale}'. Supported: ${LOCALES.join(", ")}.`,
      };
    }
    return normalized;
  }

  const acceptLanguage = req.headers["accept-language"];
  if (typeof acceptLanguage === "string" && acceptLanguage.length > 0) {
    const tags = acceptLanguage.split(",");
    for (const raw of tags) {
      const tag = raw.split(";")[0]?.trim().toLowerCase();
      if (!tag) continue;
      const primary = tag.split("-")[0];
      if (primary && isLocale(primary)) {
        return primary;
      }
    }
  }

  return DEFAULT_LOCALE;
}

export { parseLocale };
export type { LocaleError };
