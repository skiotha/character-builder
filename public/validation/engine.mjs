import { SECONDARY_ATTRIBUTES_RULES, MAX_EXP } from "../utils/rpg.mjs";

export const validators = {
  required: (value) => value !== null && value !== "",
  range: (value, min, max) => value >= min && value <= max,
  type: (value, expected) => typeof value === expected,
  min: (value, min) => value >= min,
  max: (value, max) => value <= max,
  minLength: (value, min) => value?.length >= min,
  maxLength: (value, max) => value?.length <= max,
  pattern: (value, regex) => regex.test(value),
  integer: (value) => Number.isInteger(value),

  //   diceNotation: (value) => /^\d+d\d+$/.test(value),
  //   attributeSum: (attributes, maxTotal) => {
  //     const sum = Object.value(attributes).reduce((at, sum) => at + sum, 0);
  //     return sum <= maxTotal;
  //   },
};

export function validateField(fieldValue, fieldSchema, allData = {}) {
  const errors = [];

  for (const [rule, param] of Object.entries(fieldSchema)) {
    if (rule === "message" || rule === "validate" || rule === "sanitize")
      continue;

    const validator = validators[rule];
    if (!validator) continue;

    const isValid = validator(fieldValue, param);
    if (!isValid) {
      errors.push(fieldSchema.message || `Failed ${rule} rule`);
      break;
    }
  }

  if (fieldSchema.validate) {
    const customResult = fieldSchema.validate(fieldValue, allData, fieldSchema);
    if (customResult !== true) {
      errors.push(fieldSchema.message);
    }
  }

  return errors;
}

export function validateForm(data, schema, prefix = "") {
  const errors = {};
  let isValid = true;

  for (const [key, value] of Object.entries(schema)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (isValidationRule(value)) {
      const fieldValue = getNestedValue(data, path);
      const fieldErrors = validateField(fieldValue, value, data);

      if (fieldErrors.length > 0) {
        errors[path] = fieldErrors;
        isValid = false;
      }
    }

    if (value && typeof value === "object") {
      const nestedResult = validateForm(data, value, path);

      Object.assign(errors, nestedResult.errors);
      if (!nestedResult.isValid) {
        isValid = false;
      }
    }
  }

  return { isValid, errors };
}

export function hasPathInSchema(schema, path) {
  if (!schema || !path) return false;

  return (
    path.split(".").reduce((current, key) => {
      return current ? current[key] : undefined;
    }, schema) !== undefined
  );
}

export function getSchemaRules(schema, path) {
  const keys = path.split(".");
  let current = schema;

  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = current[key];
    } else {
      return null;
    }
  }

  if (
    current &&
    (current.type || current.validate || current.required !== undefined)
  ) {
    return current;
  }

  return null;
}

// function validateRPG(data) {
//   const errors = [];

//   const attributes = data.attributes?.primary || {};
//   const totalPoints = Object.values(attributes).reduce(
//     (at, sum) => at + sum,
//     0,
//   );
//   const MAX_EXP = 80;

//   if (totalPoints > MAX_EXP) {
//     errors.push(
//       `Total attribute points (${totalPoints}) exceeds maximum (${MAX_EXP})`,
//     );
//   }

//   const spentExperience = calculateSpentExperience(data);
//   if (spentExperience > data.experience.total) {
//     errors.push(
//       `Spent more experience (${spentExperience}) than available (${data.experience.total})`,
//     );
//   }

//   return errors;
// }

export const rpgValidators = {
  diceNotation: (value) => /^\d+d\d+(?:\+\d+)?$/.test(value),

  //   abilityPrerequisites: (abilityId, character) => {
  //     const ability = ABILITY_LIBRARY.find((ab) => ab.id === abilityId);
  //     if (!ability.prerequisites) return true;

  //     return ability.prerequisites.every((prereq) =>
  //       character.traits.some((ab) => ab.id === prereq),
  //     );
  //   },

  //   encumbrance: (equipment) => {
  //     const totalWeight = equipment.reduce((sum, item) => sum + item.weight, 0);
  //     const maxWeight = calculateCarryingCapacity(
  //       character.attributes.strong,
  //       modifiers,
  //     );
  //     return totalWeight <= maxWeight;
  //   },

  currentHealthValid: (currentToughness, allData) => {
    const maxHealth = allData?.attributes?.secondary?.toughness?.max;

    if (maxHealth === undefined) return true;

    return currentToughness >= 0 && currentToughness <= maxHealth;
  },

  //   experienceSpendingValid: (experience, _, allData) => {
  //     const { total = 0, unspent = 0 } = experience || {};

  //     const spent = total - unspent;
  //     const calculatedSpent = calculateSpentExperience(allData);

  //     return Math.abs(spent - calculatedSpent) < 0.01;
  //   },

  attributePointsValid: (attributes) => {
    const sum = Object.values(attributes?.primary || {}).reduce(
      (cur, sum) => cur + sum,
      0,
    );
    return sum <= MAX_EXP;
  },

  defenseValid: (defense, allData) => {
    const calculatedDefense = calculateDefense(allData);
    return Math.abs(defense - calculatedDefense) <= 0.5;
  },

  painThresholdValid: (painThreshold, allData) => {
    const calculatedPain = calculatePainThreshold(allData);
    return Math.abs(painThreshold - calculatedPain) <= 0.5;
  },

  corruptionThresholdValid: (corruptionThreshold, allData) => {
    const calculatedCorruption = calculatedCorruptionThreshold(allData);
    return Math.abs(corruptionThreshold - calculatedCorruption) <= 0.5;
  },

  notesValid: (notes) => {
    if (!Array.isArray(notes)) return false;

    const invalidNotes = notes.filter(
      (note) => typeof note !== "string" || note.length > 200,
    );

    if (invalidNotes.length > 0) return false;

    return true;
  },

  affiliationsValid: (affiliations) => {
    if (!Array.isArray(affiliations)) return false;

    const invalid = affiliations.filter(
      (a) => typeof a !== "object" || !a || typeof a.name !== "string" || a.name.length > 200,
    );

    if (invalid.length > 0) return false;

    return true;
  },
};

function calculateDefense(data) {
  return data?.attributes?.primary?.[
    SECONDARY_ATTRIBUTES_RULES.defense.dependsOn
  ];
}

function calculatePainThreshold(data) {
  return Math.ceil(
    data?.attributes?.primary?.[SECONDARY_ATTRIBUTES_RULES.pain.dependsOn] *
      0.5,
  );
}

function calculatedCorruptionThreshold(data) {
  return Math.ceil(
    data?.attributes?.primary?.[
      SECONDARY_ATTRIBUTES_RULES.corruption.dependsOn
    ] * 0.5,
  );
}

function getNestedValue(obj, path) {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

function isValidationRule(obj) {
  if (!obj || typeof obj !== "object") return false;

  const hasValidationProperties =
    "type" in obj ||
    "validate" in obj ||
    "required" in obj ||
    "min" in obj ||
    "max" in obj ||
    "pattern" in obj ||
    "message" in obj;

  return hasValidationProperties;
}
