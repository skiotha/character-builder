import { BEHAVIOR_CONFIG } from "./behaviors.mjs";
import { initCopyable } from "./copyable.mjs";
import { initHintable } from "./hintable.mjs";
import { initAutoSelectable } from "./selectable.mjs";
import { initEditable } from "./editable.mjs";

const INIT_FUNCS = {
  initCopyable: initCopyable,
  initHintable: initHintable,
  initAutoSelectable: initAutoSelectable,
  initEditable: initEditable,
};

/**
 * True when `element` sits inside a `nagara-*` component host that is a
 * strict descendant of `root`. Hosts enhance and clean up their own
 * subtree (ADR-017 §deps), so a view-level sweep must leave it alone or
 * every behavior inside gets wired twice.
 * @param {Element} element
 * @param {Element} root
 * @returns {boolean}
 */
function ownedByNestedHost(element, root) {
  for (
    let node = element.parentElement;
    node && node !== root;
    node = node.parentElement
  ) {
    if (node.localName.startsWith("nagara-")) return true;
  }
  return false;
}

export function enhanceElement(rootElement) {
  const behaviorElements = rootElement.querySelectorAll("[data-behavior]");

  behaviorElements.forEach((element) => {
    if (ownedByNestedHost(element, rootElement)) return;

    const behaviorTags = element.dataset.behavior.trim().split(/\s+/);

    const configs = [];

    for (const tag of behaviorTags) {
      const config = BEHAVIOR_CONFIG[tag];

      if (!config) {
        console.warn(`Unknown behavior tag: ${tag}`, element);
        continue;
      }
      configs.push(config);
    }

    for (const config of configs) {
      if (config.cssClasses) {
        element.classList.add(...config.cssClasses);
      }

      if (config.attributes) {
        Object.entries(config.attributes).forEach(([key, value]) => {
          element.setAttribute(key, value);
        });
      }

      const initFunc = INIT_FUNCS[config.initFunction];
      if (initFunc) {
        const cleanup = initFunc(element);
        if (typeof cleanup === "function") {
          if (!element._behaviorCleanups) element._behaviorCleanups = [];

          element._behaviorCleanups.push(cleanup);
        }
      }
    }
  });
}

export function cleanupBehaviors(rootElement) {
  rootElement.querySelectorAll("[data-behavior]").forEach((el) => {
    if (ownedByNestedHost(el, rootElement)) return;

    if (el._behaviorCleanups) {
      el._behaviorCleanups.forEach((fn) => fn());
      delete el._behaviorCleanups;
    }
  });
}
