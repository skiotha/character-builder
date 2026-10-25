/**
 * Catalog picker dialog — a transient, promise-returning popup over a native
 * `<dialog>` (ADR-012) for choosing traits, talents and rituals.
 *
 * Not a `NagaraElement` and not schema-bound: callers `await
 * openCatalogDialog(...)` and save the result themselves; the dialog never
 * PATCHes. Layout: header (title, optional caller node, ✕), a scrolling
 * card list on the left, a right column with the search box, and a footer
 * with Cancel and the primary commit button.
 *
 * Lifetime invariants:
 *   - Mounted on `document.body`, not inside the calling host: hosts
 *     `rebuild()` their children on every render, and inside the creation
 *     `<form>` the dialog would nest in it. `showModal()` puts it in the top
 *     layer, so placement only affects lifetime.
 *   - Because nothing tears it down with the view, it closes itself on
 *     `hashchange` (browser Back) and on the caller's `AbortSignal`.
 *   - Every close path — ✕, Cancel, Escape, outside click, navigation,
 *     abort — funnels through the native `close` event, which settles the
 *     promise exactly once, removes the element and restores focus.
 *   - One dialog at a time: opening while one is open resolves `null`.
 *   - The search input sits outside the `method="dialog"` forms, so Enter
 *     in it can never implicitly submit the ✕ / Cancel buttons; the commit
 *     button is `type="button"` for the same reason.
 *   - `entries` may be a promise: the dialog opens at once with a loader,
 *     and a rejection shows an error with Retry (via the caller's
 *     `reload()`). A load that resolves after close, or after a newer
 *     retry, is dropped.
 */

const TITLE_ID = "catalog-dialog-title";

/** @type {HTMLDialogElement|null} */
let openDialog = null;

/**
 * @typedef {object} CatalogDialogOptions
 * @property {string} title - Dialog heading
 * @property {Node} [header] - Extra header content (e.g. the XP balance)
 * @property {object[] | Promise<object[]>} entries - Catalog entries, or a
 *   promise of them (e.g. a `createCatalogCache` `get()`)
 * @property {() => object[] | Promise<object[]>} [reload] - Called by Retry
 *   after `entries` (or a previous reload) rejects; without it no Retry
 *   button is offered
 * @property {(entry: object, select: (detail?: object) => void, selection: object|null) => Node} renderCard
 *   - Builds one card for the left column
 * @property {string} commitLabel - Primary button caption (e.g. "Learn")
 * @property {AbortSignal} [signal] - Aborting closes the dialog with `null`
 * @property {Element | (() => Element|null)} [returnFocus] - Focus target
 *   on close when the opener is no longer in the document
 */

/**
 * Open the catalog picker. Resolves `null` on every dismissal (✕, Cancel,
 * Escape, outside click, `hashchange`, `signal` abort), and immediately
 * when another catalog dialog is already open or `signal` is already
 * aborted.
 * @param {CatalogDialogOptions} options
 * @returns {Promise<object[] | null>} The committed selections, or `null`
 */
export function openCatalogDialog(options) {
  const {
    title,
    header,
    entries,
    reload,
    renderCard,
    commitLabel,
    signal,
    returnFocus,
  } = options;

  if (openDialog || signal?.aborted) return Promise.resolve(null);

  const opener =
    document.activeElement instanceof HTMLElement &&
    document.activeElement !== document.body
      ? document.activeElement
      : null;

  const { promise, resolve } = Promise.withResolvers();
  let settled = false;

  const dialog = buildSkeleton(title, header, commitLabel);
  const listRegion = /** @type {HTMLElement} */ (
    dialog.querySelector("section")
  );
  const searchInput = /** @type {HTMLInputElement} */ (
    dialog.querySelector("input[type=search]")
  );

  const close = () => dialog.close();

  dialog.addEventListener("close", () => {
    if (settled) return;
    settled = true;
    openDialog = null;
    window.removeEventListener("hashchange", close);
    signal?.removeEventListener("abort", close);
    dialog.remove();
    restoreFocus(opener, returnFocus);
    // TODO(catalog-dialog-selection): resolve the committed selections.
    resolve(null);
  });

  // `closedby="any"` handles outside clicks natively; browsers without it
  // get a backdrop-click fallback. Clicks on the backdrop target the dialog
  // itself, so a target check plus a bounds check isolates them.
  if (!("closedBy" in HTMLDialogElement.prototype)) {
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (!inside) close();
    });
  }

  window.addEventListener("hashchange", close);
  signal?.addEventListener("abort", close);

  let loadToken = 0;

  /**
   * Show `source` in the list region, through the loader when it is a
   * promise. Only the most recent load may paint.
   * @param {object[] | Promise<object[]>} source
   */
  const load = (source) => {
    const token = ++loadToken;
    if (Array.isArray(source)) {
      showEntries(listRegion, source, renderCard);
      return;
    }

    showLoading(listRegion);
    Promise.resolve(source).then(
      (items) => {
        if (settled || token !== loadToken) return;
        showEntries(listRegion, Array.isArray(items) ? items : [], renderCard);
      },
      () => {
        if (settled || token !== loadToken) return;
        showError(listRegion, reload ? retry : null);
      },
    );
  };

  const retry = () => {
    // The Retry button is about to disappear; keep focus inside the dialog.
    searchInput.focus();
    let next;
    try {
      next = /** @type {() => object[] | Promise<object[]>} */ (reload)();
    } catch (error) {
      next = Promise.reject(error);
    }
    load(next);
  };

  document.body.append(dialog);
  openDialog = dialog;
  load(entries);
  dialog.showModal();

  return promise;
}

/**
 * Build the dialog's static regions. Caller strings are set as text, never
 * parsed as markup.
 * @param {string} title
 * @param {Node | undefined} header
 * @param {string} commitLabel
 * @returns {HTMLDialogElement}
 */
function buildSkeleton(title, header, commitLabel) {
  const dialog = document.createElement("dialog");
  dialog.classList.add("catalog-dialog");
  dialog.setAttribute("closedby", "any");
  dialog.setAttribute("aria-labelledby", TITLE_ID);

  dialog.innerHTML = `
    <header>
      <h2 id="${TITLE_ID}"></h2>
      <form method="dialog">
        <button value="close" aria-label="Close">✕</button>
      </form>
    </header>
    <section aria-label="Catalog entries"></section>
    <aside>
      <search>
        <label>
          Search
          <input type="search" autocomplete="off" autofocus />
        </label>
      </search>
    </aside>
    <footer>
      <form method="dialog">
        <button value="cancel">Cancel</button>
        <button type="button" class="primary" disabled></button>
      </form>
    </footer>
  `;

  const heading = /** @type {HTMLElement} */ (dialog.querySelector("h2"));
  heading.textContent = title;
  if (header) heading.after(header);

  // TODO(catalog-dialog-selection): enable once a card selection exists.
  const commit = /** @type {HTMLButtonElement} */ (
    dialog.querySelector("button.primary")
  );
  commit.textContent = commitLabel;

  return dialog;
}

/**
 * Render the card list.
 * @param {HTMLElement} region
 * @param {object[]} items
 * @param {CatalogDialogOptions["renderCard"]} renderCard
 */
function showEntries(region, items, renderCard) {
  region.removeAttribute("aria-busy");

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "Nothing to choose from.";
    region.replaceChildren(empty);
    return;
  }

  const list = document.createElement("ul");
  for (const entry of items) {
    const item = document.createElement("li");
    item.append(renderCard(entry, selectNothing, null));
    list.append(item);
  }
  region.replaceChildren(list);
}

/**
 * Placeholder `select` callback handed to card renderers.
 * TODO(catalog-dialog-selection): replace with real selection state.
 */
function selectNothing() {}

/**
 * Show the pending-load state.
 * @param {HTMLElement} region
 */
function showLoading(region) {
  region.setAttribute("aria-busy", "true");
  const loader = document.createElement("p");
  loader.setAttribute("role", "status");
  loader.textContent = "Loading…";
  region.replaceChildren(loader);
}

/**
 * Show the load-failure state, with a Retry button when `retry` is given.
 * @param {HTMLElement} region
 * @param {(() => void) | null} retry
 */
function showError(region, retry) {
  region.removeAttribute("aria-busy");
  const message = document.createElement("p");
  message.setAttribute("role", "alert");
  message.textContent = "The catalog could not be loaded.";

  if (!retry) {
    region.replaceChildren(message);
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Retry";
  button.addEventListener("click", retry);
  region.replaceChildren(message, button);
}

/**
 * Return focus to the opener, or to the caller's fallback when the opener
 * has left the document (hosts rebuild their children, so the button that
 * opened the dialog is often gone by now).
 * @param {HTMLElement | null} opener
 * @param {CatalogDialogOptions["returnFocus"]} fallback
 */
function restoreFocus(opener, fallback) {
  if (opener?.isConnected) {
    opener.focus();
    return;
  }
  const target = typeof fallback === "function" ? fallback() : fallback;
  if (target instanceof HTMLElement && target.isConnected) target.focus();
}
