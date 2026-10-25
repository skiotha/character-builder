/**
 * Catalog picker dialog — a transient, promise-returning popup over a native
 * `<dialog>` (ADR-012) for choosing traits, talents and rituals.
 *
 * Not a `NagaraElement` and not schema-bound: callers `await
 * openCatalogDialog(...)` and save the result themselves; the dialog never
 * PATCHes. Layout: header (title, optional caller node, ✕), a scrolling
 * card list on the left, a right column with search, filter groups, the
 * selection preview and the (disabled) remember / recall stubs, and a
 * footer with the commit reason, Cancel and the primary commit button.
 *
 * Lifetime invariants:
 *   - Mounted on `document.body`, not inside the calling host: hosts
 *     `rebuild()` their children on every render, and inside the creation
 *     `<form>` the dialog would nest in it. `showModal()` puts it in the top
 *     layer, so placement only affects lifetime.
 *   - Because nothing tears it down with the view, it closes itself on
 *     `hashchange` (browser Back) and on the caller's `AbortSignal`.
 *   - Every close path — ✕, Cancel, Escape, outside click, navigation,
 *     abort, commit — funnels through the native `close` event, which
 *     settles the promise exactly once, removes the element and restores
 *     focus. Only commit resolves non-`null`.
 *   - One dialog at a time: opening while one is open resolves `null`.
 *   - The search input and filter checkboxes sit outside the
 *     `method="dialog"` forms, so Enter in them can never implicitly submit
 *     the ✕ / Cancel buttons; the commit button is `type="button"` for the
 *     same reason.
 *   - `entries` may be a promise: the dialog opens at once with a loader,
 *     and a rejection shows an error with Retry (via the caller's
 *     `reload()`). A load that resolves after close, or after a newer
 *     retry, is dropped.
 *
 * Selection model:
 *   - Cards only select (via the `select(detail)` callback); the primary
 *     button commits. It is disabled until something is selected and while
 *     `canCommit(selection)` returns anything but `true`; a string return is
 *     shown as the reason.
 *   - The rendered data is frozen at open; a selection change re-renders
 *     only the previously and newly selected cards, keeping focus on the
 *     control at the same position in the new card.
 *   - Search and filters hide list items rather than re-rendering them, and
 *     the selection survives its card being hidden.
 */

import {
  excludeEntries,
  matchesFilters,
  matchesQuery,
  parseQuery,
  searchHaystack,
} from "../utils/catalog-filter.mjs";

const TITLE_ID = "catalog-dialog-title";
const PREVIEW_TITLE_ID = "catalog-dialog-preview-title";
const FOCUSABLE =
  "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])";

/** @type {HTMLDialogElement|null} */
let openDialog = null;

/**
 * @typedef {object} Selection
 * @property {object} entry - The selected catalog entry (frozen at open)
 * @property {object} detail - What the card passed to `select()`, e.g.
 *   `{ tier: "adept" }`; `{}` when it passed nothing
 */

/**
 * @typedef {object} FilterOption
 * @property {string} label - Checkbox caption
 * @property {(entry: object) => boolean} predicate - Entry passes the option
 * @property {boolean} [checked] - Initial state
 */

/**
 * @typedef {object} FilterGroup
 * @property {string} legend - Fieldset caption
 * @property {FilterOption[]} options - OR-ed when checked; an unchecked
 *   group does not restrict, and groups are AND-ed
 */

/**
 * @typedef {object} CatalogDialogOptions
 * @property {string} title - Dialog heading
 * @property {Node} [header] - Extra header content (e.g. the XP balance)
 * @property {object[] | Promise<object[]>} entries - Catalog entries, or a
 *   promise of them (e.g. a `createCatalogCache` `get()`)
 * @property {() => object[] | Promise<object[]>} [reload] - Called by Retry
 *   after `entries` (or a previous reload) rejects; without it no Retry
 *   button is offered
 * @property {Iterable<string>} [exclude] - Entry ids left out of the list
 *   (e.g. those already learned)
 * @property {{ fields: import("../utils/catalog-filter.mjs").SearchField[] }} [search]
 *   - Searched keys / accessors; defaults to `["name"]`
 * @property {FilterGroup[]} [filters] - Filter chip groups
 * @property {(entry: object, select: (detail?: object) => void, selection: Selection|null) => Node} renderCard
 *   - Builds one card for the left column. `selection` is non-`null` only
 *   when this card's entry is the selected one; the card is rebuilt when
 *   that changes
 * @property {(selection: Selection) => Node} [renderPreview] - Builds the
 *   preview of the current selection; without it the entry's name is shown
 * @property {string} commitLabel - Primary button caption (e.g. "Learn")
 * @property {(selection: Selection) => true | string} [canCommit] - `true`
 *   enables the primary button; a string disables it and is shown as the
 *   reason
 * @property {AbortSignal} [signal] - Aborting closes the dialog with `null`
 * @property {Element | (() => Element|null)} [returnFocus] - Focus target
 *   on close when the opener is no longer in the document
 */

/**
 * @typedef {object} CardRecord
 * @property {object} entry
 * @property {HTMLLIElement} item - Stable wrapper; its children are rebuilt
 * @property {string[]} haystack - Folded search strings, built once
 */

/**
 * Open the catalog picker. Resolves `[selection]` when the primary button
 * commits, `null` on every dismissal (✕, Cancel, Escape, outside click,
 * `hashchange`, `signal` abort), and `null` immediately when another
 * catalog dialog is already open or `signal` is already aborted.
 * @param {CatalogDialogOptions} options
 * @returns {Promise<Selection[] | null>} The committed selections, or `null`
 */
export function openCatalogDialog(options) {
  const {
    title,
    header,
    entries,
    reload,
    exclude,
    search,
    filters = [],
    renderCard,
    renderPreview,
    commitLabel,
    canCommit,
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
  /** @type {Selection[] | null} */
  let result = null;

  const fields = search?.fields ?? ["name"];
  /** @type {boolean[][]} */
  const checkedState = filters.map((group) =>
    group.options.map((option) => Boolean(option.checked)),
  );

  const dialog = buildSkeleton(title, header, commitLabel);
  const listRegion = /** @type {HTMLElement} */ (
    dialog.querySelector(":scope > section")
  );
  const searchInput = /** @type {HTMLInputElement} */ (
    dialog.querySelector("input[type=search]")
  );
  const previewRegion = /** @type {HTMLElement} */ (
    dialog.querySelector(":scope > aside > section")
  );
  const commitButton = /** @type {HTMLButtonElement} */ (
    dialog.querySelector("button.primary")
  );
  const reasonLine = /** @type {HTMLOutputElement} */ (
    dialog.querySelector("output")
  );

  /** @type {CardRecord[]} */
  let records = [];
  /** @type {HTMLElement | null} */
  let noMatches = null;
  /** @type {Selection | null} */
  let selection = null;
  /** @type {CardRecord | null} */
  let selectedRecord = null;

  const close = () => dialog.close();

  dialog.addEventListener("close", () => {
    if (settled) return;
    settled = true;
    openDialog = null;
    window.removeEventListener("hashchange", close);
    signal?.removeEventListener("abort", close);
    dialog.remove();
    restoreFocus(opener, returnFocus);
    resolve(result);
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

  /** Hide the cards the current query and filters rule out. */
  const applyVisibility = () => {
    const tokens = parseQuery(searchInput.value);
    const groups = filters.map((group, g) =>
      group.options
        .filter((_, o) => checkedState[g]?.[o])
        .map((option) => option.predicate),
    );
    let shown = 0;
    for (const record of records) {
      const visible =
        matchesQuery(record.haystack, tokens) &&
        matchesFilters(record.entry, groups);
      record.item.hidden = !visible;
      if (visible) shown++;
    }
    if (noMatches) noMatches.hidden = shown > 0;
  };

  /**
   * (Re)build one card from the current selection.
   * @param {CardRecord} record
   */
  const renderRecord = (record) => {
    const own = record === selectedRecord ? selection : null;
    if (own) record.item.setAttribute("aria-current", "true");
    else record.item.removeAttribute("aria-current");
    record.item.replaceChildren(
      renderCard(record.entry, (detail) => select(record, detail), own),
    );
  };

  /**
   * Rebuild a card, keeping focus on the control at the same position when
   * focus was inside it.
   * @param {CardRecord} record
   */
  const rerender = (record) => {
    const before = focusables(record.item);
    const index = before.findIndex((el) => el === document.activeElement);
    renderRecord(record);
    if (index < 0) return;

    const after = focusables(record.item);
    after[Math.min(index, after.length - 1)]?.focus();
    if (!record.item.contains(document.activeElement)) {
      const fallback = after.find(
        (el) => !(/** @type {HTMLButtonElement} */ (el).disabled),
      );
      (fallback ?? searchInput).focus();
    }
  };

  /**
   * Make `record` the selection with `detail`.
   * @param {CardRecord} record
   * @param {object | undefined} detail
   */
  const select = (record, detail) => {
    if (settled || !records.includes(record)) return;
    const previous = selectedRecord;
    selection = { entry: record.entry, detail: { ...detail } };
    selectedRecord = record;
    if (previous && previous !== record) rerender(previous);
    rerender(record);
    showPreview();
    updateCommit();
  };

  const showPreview = () => {
    const heading = /** @type {HTMLElement} */ (
      previewRegion.querySelector("h3")
    );
    let content;
    if (!selection) {
      content = document.createElement("p");
      content.textContent = "Select an entry to preview it here.";
    } else if (renderPreview) {
      content = renderPreview(selection);
    } else {
      content = document.createElement("p");
      const { entry } = /** @type {{ entry: { name?: string, id?: string } }} */ (
        selection
      );
      content.textContent = entry.name ?? entry.id ?? "";
    }
    previewRegion.replaceChildren(heading, content);
  };

  const updateCommit = () => {
    const verdict = selection
      ? canCommit
        ? canCommit(selection)
        : true
      : false;
    commitButton.disabled = verdict !== true;
    reasonLine.textContent = typeof verdict === "string" ? verdict : "";
  };

  commitButton.addEventListener("click", () => {
    if (!selection || commitButton.disabled) return;
    result = [selection];
    close();
  });

  searchInput.addEventListener("input", applyVisibility);
  /** @type {HTMLElement} */ (searchInput.closest("search")).after(
    ...buildFilters(filters, (g, o, checked) => {
      const group = checkedState[g];
      if (group) group[o] = checked;
      applyVisibility();
    }),
  );

  /**
   * Render the card list for a loaded catalog.
   * @param {object[]} items
   */
  const showEntries = (items) => {
    listRegion.removeAttribute("aria-busy");
    const visible = excludeEntries(items, exclude);

    if (visible.length === 0) {
      records = [];
      noMatches = null;
      const empty = document.createElement("p");
      empty.textContent = "Nothing to choose from.";
      listRegion.replaceChildren(empty);
      return;
    }

    const list = document.createElement("ul");
    records = visible.map((entry) => {
      const item = document.createElement("li");
      /** @type {CardRecord} */
      const record = { entry, item, haystack: searchHaystack(entry, fields) };
      list.append(item);
      return record;
    });
    for (const record of records) renderRecord(record);

    noMatches = document.createElement("p");
    noMatches.setAttribute("role", "status");
    noMatches.textContent = "No matches.";
    listRegion.replaceChildren(list, noMatches);
    applyVisibility();
  };

  let loadToken = 0;

  /**
   * Show `source` in the list region, through the loader when it is a
   * promise. Only the most recent load may paint.
   * @param {object[] | Promise<object[]>} source
   */
  const load = (source) => {
    const token = ++loadToken;
    if (Array.isArray(source)) {
      showEntries(source);
      return;
    }

    records = [];
    noMatches = null;
    showLoading(listRegion);
    Promise.resolve(source).then(
      (items) => {
        if (settled || token !== loadToken) return;
        showEntries(Array.isArray(items) ? items : []);
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

  showPreview();
  updateCommit();
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

  // TODO(trait-recall): Remember / Recall are inert placeholders for the
  // roadmap "Catalog picker: remember / recall to compare" item.
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
      <section aria-labelledby="${PREVIEW_TITLE_ID}">
        <h3 id="${PREVIEW_TITLE_ID}">Preview</h3>
      </section>
      <menu aria-label="Compare">
        <li><button type="button" disabled>Remember</button></li>
        <li><button type="button" disabled>Recall</button></li>
      </menu>
    </aside>
    <footer>
      <form method="dialog">
        <output></output>
        <button value="cancel">Cancel</button>
        <button type="button" class="primary" disabled></button>
      </form>
    </footer>
  `;

  const heading = /** @type {HTMLElement} */ (dialog.querySelector("h2"));
  heading.textContent = title;
  if (header) heading.after(header);

  const commit = /** @type {HTMLButtonElement} */ (
    dialog.querySelector("button.primary")
  );
  commit.textContent = commitLabel;

  return dialog;
}

/**
 * Build one `<fieldset>` of checkboxes per filter group. Caller strings are
 * set as text.
 * @param {FilterGroup[]} groups
 * @param {(group: number, option: number, checked: boolean) => void} onToggle
 * @returns {HTMLFieldSetElement[]}
 */
function buildFilters(groups, onToggle) {
  return groups.map((group, g) => {
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = group.legend;
    fieldset.append(legend);

    group.options.forEach((option, o) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = Boolean(option.checked);
      input.addEventListener("change", () => onToggle(g, o, input.checked));
      label.append(input, option.label);
      fieldset.append(label);
    });

    return fieldset;
  });
}

/**
 * Keyboard-focusable candidates inside `root`, in tree order. Disabled
 * controls are included so positions stay stable across a rebuild that
 * toggles `disabled`.
 * @param {Element} root
 * @returns {HTMLElement[]}
 */
function focusables(root) {
  return /** @type {HTMLElement[]} */ ([...root.querySelectorAll(FOCUSABLE)]);
}

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
