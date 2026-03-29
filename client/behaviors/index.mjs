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

export function enhanceElement(rootElement) {
  const behaviorElements = rootElement.querySelectorAll("[data-behavior]");

  behaviorElements.forEach((element) => {
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

      if (config.initFunction) {
        const initFunc = INIT_FUNCS[config.initFunction];

        const cleanup = INIT_FUNCS[config.initFunction](element);
        if (typeof cleanup === "function") {
          if (!element._behaviorCleanups) element._behaviorCleanups = [];

          element._behaviorCleanups.push(cleanup);
        }

        if (initFunc) {
          initFunc(element);
        }
      }
    }
  });
}

export function cleanupBehaviors(rootElement) {
  rootElement.querySelectorAll("[data-behavior]").forEach((el) => {
    if (el._behaviorCleanups) {
      el._behaviorCleanups.forEach((fn) => fn());
      delete el._behaviorCleanups;
    }
  });
}
