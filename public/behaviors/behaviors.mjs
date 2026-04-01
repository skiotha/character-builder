export const BEHAVIOR_CONFIG = {
  ["clipboard-enabled"]: {
    cssClasses: ["copyable", "interactable"],
    attributes: {
      tabindex: "2",
    },
    requiredData: ["data-clipboard-text"],
    initFunction: "initCopyable",
  },
  ["hint-enabled"]: {
    cssClasses: ["hintable", "interactable"],
    attributes: {
      tabindex: "2",
    },
    requiredData: ["data-tooltip-text"],
    initFunction: "initHintable",
  },
  ["link-enabled"]: {
    cssClasses: ["interactable"],
    attributes: {
      rel: "noopener noreferrer author",
      target: "_blank",
    },
  },
  ["select-enabled"]: {
    initFunction: "initAutoSelectable",
  },
  ["edit-enabled"]: {
    attributes: {
      "aria-disabled": "false",
    },
    requiredData: ["name", "data-role-allowed"],
    initFunction: "initEditable",
  },
};
