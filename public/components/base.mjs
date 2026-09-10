/**
 * Base class for component-override custom elements (ADR-017).
 *
 * Every schema `ui.component` override is a light-DOM `nagara-*` element
 * extending `NagaraElement` (ADR-017 §light-dom). The registry factory
 * assigns `path`, `fieldSchema`, `role`, `mode` and `character` before the
 * element is attached, so the first render works from the renderer's data
 * and never consults global state (ADR-017 §render-arg).
 *
 * Lifecycle (ADR-017 §deps): in `view` mode the element subscribes to each
 * `static deps` subtree on connect and releases everything on disconnect,
 * so teardown is automatic when the router swaps views. All notifications
 * from one `setCurrentCharacter` collapse into a single `render` via a
 * microtask. In `create` mode no subscriptions are taken; the element
 * renders once from the `character` prop.
 */

import { cleanupBehaviors, enhanceElement } from "../behaviors/index.mjs";
import { getState, subscribeField } from "../state.mjs";

export class NagaraElement extends HTMLElement {
  /** Subtree roots (dotted paths) whose change re-renders the element. */
  static deps = [];

  #unsubscribes = [];
  #renderQueued = false;

  /** Subscribes to deps (view mode only) and performs the first render. */
  connectedCallback() {
    if (this.mode !== "create") {
      for (const dep of this.constructor.deps) {
        this.#unsubscribes.push(subscribeField(dep, () => this.update()));
      }
    }
    this.render(this.character ?? getState().currentCharacter);
  }

  /** Releases dep subscriptions and behaviors attached to the subtree. */
  disconnectedCallback() {
    for (const unsubscribe of this.#unsubscribes) unsubscribe();
    this.#unsubscribes = [];
    this.#renderQueued = false;
    cleanupBehaviors(this);
  }

  /**
   * Schedule one render from current state, however many dep notifications
   * the same state set produces.
   * @returns {void}
   */
  update() {
    if (this.#renderQueued) return;
    this.#renderQueued = true;
    queueMicrotask(() => {
      this.#renderQueued = false;
      if (!this.isConnected) return;
      this.character = getState().currentCharacter;
      this.render(this.character);
    });
  }

  /**
   * Replace all children, releasing behaviors on the old subtree and
   * enhancing `data-behavior` hooks in the new one.
   * @param {...Node} nodes
   * @returns {void}
   */
  rebuild(...nodes) {
    cleanupBehaviors(this);
    this.replaceChildren(...nodes);
    enhanceElement(this);
  }

  /**
   * Rendering entry point; subclasses must override.
   * @param {object} _character - Full character the element renders from
   * @returns {void}
   */
  render(_character) {
    throw new Error(`${this.localName} does not implement render(character)`);
  }
}

/**
 * Build the registry factory for an element class: the returned function
 * matches the `(path, fieldSchema, value, role, mode, data)` registry
 * contract, creates the element and assigns the renderer's props. `value`
 * is ignored — the element reads its own subtree from `character`.
 * @param {typeof NagaraElement} ElementClass - A defined `nagara-*` class
 * @returns {(path: string, fieldSchema: object, value: *, role: string, mode: string, data: object) => NagaraElement}
 */
export function componentFactory(ElementClass) {
  return (path, fieldSchema, _value, role, mode, data) => {
    const el = new ElementClass();
    Object.assign(el, { path, fieldSchema, role, mode, character: data });
    el.dataset.path = path;
    return el;
  };
}
