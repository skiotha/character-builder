import { rpgValidators } from "./engine.mjs";

export const SCHEMA = {
  characterName: {
    required: true,
    type: "string",
    minLength: 3,
    maxLength: 16,
    pattern: /^[A-Za-z\s\-']+$/,
    message: "Character names must be 3-16 letters and spaces only",
  },

  corruption: {
    permanent: {
      type: "number",
      min: 0,
      message: "Permanent corruption must be a positive integer",
    },

    temporary: {
      type: "number",
      min: 0,
      message: "Temporary corruption can't go below zero",
    },
  },

  experience: {
    total: {
      type: "number",
      min: 0,
      integer: true,
      message: "Experience cannot be negative",
    },

    unspent: {
      type: "number",
      min: 0,
      integer: true,
      message: "Experience cannot be negative",
    },
  },

  attributes: {
    validate: rpgValidators.attributePointsValid,
    message: "Cannot exceed the attributes assign budget of 80",

    primary: {
      accurate: {
        type: "number",
        min: 5,
        max: 15,
        integer: true,
        message: "Accurate must be between 5 and 15",
      },

      cunning: {
        type: "number",
        min: 5,
        max: 15,
        integer: true,
        message: "Cunning must be between 5 and 15",
      },

      discreet: {
        type: "number",
        min: 5,
        max: 15,
        integer: true,
        message: "Discreet must be between 5 and 15",
      },

      alluring: {
        type: "number",
        min: 5,
        max: 15,
        integer: true,
        message: "Alluring must be between 5 and 15",
      },

      quick: {
        type: "number",
        min: 5,
        max: 15,
        integer: true,
        message: "Quick must be between 5 and 15",
      },

      resolute: {
        type: "number",
        min: 5,
        max: 15,
        integer: true,
        message: "Resolute must be between 5 and 15",
      },

      vigilant: {
        type: "number",
        min: 5,
        max: 15,
        integer: true,
        message: "Vigilant must be between 5 and 15",
      },

      strong: {
        type: "number",
        min: 5,
        max: 15,
        integer: true,
        message: "Strong must be between 5 and 15",
      },
    },

    secondary: {
      toughness: {
        max: {
          type: "number",
          min: 10,
          integer: true,
          message: "Max toughness can't be lower that 10",
        },

        current: {
          type: "number",
          min: 0,
          integer: true,
          validate: rpgValidators.currentHealthValid,
          message: "Current health must be between 0 and maximum health",
        },
      },

      defense: {
        validate: rpgValidators.defenseValid,
        message: "Defense value is incorrect for this character",
      },

      painThreshold: {
        validate: rpgValidators.painThresholdValid,
        message: "Pain threshold is incorrect for this character",
      },

      corruptionThreshold: {
        validate: rpgValidators.corruptionThresholdValid,
        message: "Corruption threshold is incorrect for this character",
      },
    },
  },

  traditions: {
    type: "array",
    message: "Traditions must be an array of tradition names",
  },

  background: {
    age: {
      type: "number",
      min: 0,
      integer: true,
      message: "Age must be a positive number",
    },

    race: {
      type: "string",
      message: "Race must be a string",
    },

    profession: {
      type: "string",
      message: "Profession must be a string",
    },

    shadow: {
      type: "string",
      maxLength: 500,
      sanitize: true,
      message: "Shadow desctiption is too long (max 500 characters)",
    },

    notes: {
      validate: rpgValidators.notesValid,
      message: "Some notes are too long, or are not an array",
    },
  },

  affiliations: {
    validate: rpgValidators.affiliationsValid,
    message: "Affiliations are too long, or are not an array",
  },

  equipment: {
    money: {
      type: "number",
      min: 0,
      message: "Cannot have negative amount of money",
    },
  },

  //   traits: {
  //     validate: (traits) => validateTraits(traits),
  //   },

  //   corruption: {
  //     validate: (corruption, allData) => {
  //       if (corruption.permanent > corruptionThreshold(allData)) {
  //         return "Permanent corruption exceeds threshold";
  //       }
  //       return true;
  //     },
  //   },
};
