// @ts-nocheck — This file is being removed in Phase 3 (ADR-009 schema-driven rendering)
import { getWritableFieldPaths } from "#models/traversal";

const TEXTS = {
  character: {
    title: "NAGARA",
    nav: {
      bio: {
        path: "#",
      },
      inventory: {
        path: "#",
      },
      description: {
        path: "#",
      },
    },
    form: {
      attributes: {
        title: "Attributes",
        output: {
          content: 80,
          name: "balance",
          for: "accurate cunning discreet alluring quick resolute vigilant strong",
        },
        primary: {
          title: "Primary",
          attrs: {
            accurate: {
              path: "attributes.primary.accurate",
              placeholder: "5",
            },
            cunning: {
              path: "attributes.primary.cunning",
              placeholder: "5",
            },
            discreet: {
              path: "attributes.primary.discreet",
              placeholder: "5",
            },
            alluring: {
              path: "attributes.primary.alluring",
              placeholder: "5",
            },
            quick: {
              path: "attributes.primary.quick",
              placeholder: "5",
            },
            resolute: {
              path: "attributes.primary.resolute",
              placeholder: "5",
            },
            vigilant: {
              path: "attributes.primary.vigilant",
              placeholder: "5",
            },
            strong: {
              path: "attributes.primary.strong",
              placeholder: "5",
            },
          },
        },
        secondary: {
          title: "Secondary",
          attrs: {
            toughness: {
              path: "attributes.secondary.toughness.max",
              placeholder: "10",
            },
            pain: {
              path: "attributes.secondary.painThreshold",
              placeholder: "10",
            },
            corruption: {
              path: "attributes.secondary.corruptionThreshold",
              placeholder: "10",
            },
            defense: {
              path: "attributes.secondary.defense",
              placeholder: "10",
            },
          },
        },
      },
      sins: {
        title: "Sins",
        add: {
          label: "Icon with a plus sign",
        },
      },
      portrait: {
        title: "Portrait",
        label: "Icon with a plus sign",
        path: "portrait.file",
      },
      experience: {
        output: {
          content: 50,
          name: "experience.unspent",
          for: "",
        },
      },
      abilities: {
        title: "Abilities",
        output: {
          content: 50,
          name: "experience.unspent",
          for: "",
        },
        add: {
          label: "Icon with a plus sign",
        },
        item: {
          equipmentTitle: "Equipment",
          statsTitle: "Stats",
          iconLabel: "Icon displaying novice grade of ability",
        },
      },
      information: {
        title: "Information",
        main: {
          title: "Personal & Equipment",
          personal: {
            data: {
              age: {
                path: "background.age",
                placeholder: "35",
              },
              race: {
                path: "background.race",
                placeholder: "Elf",
              },
              reales: {
                path: "equipment.money",
                placeholder: "5",
              },
              profession: {
                path: "background.profession",
                placeholder: "Profession",
              },
            },
          },
          equipment: {
            label: "Icon with a plus sign",
          },
        },
        mystic: {
          title: "Mystic",
          data: {
            tradition: {
              path: "tradition",
              placeholder: "Mage Circle",
            },
            shadow: {
              path: "background.shadow",
              placeholder: "Describe shadow...",
            },
          },
        },
        social: {
          title: "Social",
          data: {
            assets: {
              path: "assets",
              placeholder: "Write down your contacts...",
            },
          },
        },
      },
    },
  },
};

export function renderCharacter(
  character: Record<string, unknown>,
  { role = "public" }: { role?: string } = {},
): string {
  const ctx = createTemplateContext(character, role);
  // const ctx = createTemplateContext(character, "owner");

  return `
    ${renderMainHeader(ctx)}

    ${renderNavigationBlock(ctx)}

    ${renderCharacterForm(ctx)}
  `;
}

function renderMainHeader() {
  return `
    <article>
      <h1>${TEXTS.character.title}</h1>
    </article>
  `;
}

function renderNavigationBlock() {
  return `
    <nav>
      <ul>
        ${renderNavigationLink("bio")}

        ${renderNavigationLink("inventory")}

        ${renderNavigationLink("description")}
      </ul>
    </nav>
  `;
}

function renderNavigationLink(name) {
  return `
    <li>
      <a href="${TEXTS.character.nav[name].path}">${name.toUpperCase()}</a>
    </li>
  `;
}

function renderCharacterForm(ctx) {
  const mode = ctx.character ? "view" : "creation";
  const characterId = ctx.character?.id || "";

  const editableAttrs = ctx.getEditableDataAttributes();

  return `
    <form
      id="character-form"
      data-mode="${mode}"
      ${ctx.role !== "public" ? `data-character-id="${characterId}"` : ""}
      data-role="${ctx.role}"
        >
      ${renderAttributesBlock(ctx)}

      ${renderSinsBlock({ length: 1 })}

      ${renderPortraitBlock(ctx)}

      ${renderExperienceBlock(ctx)}

      ${renderAbilitiesBlock(ctx)}

      ${renderInformationBlock(ctx)}

      <div id="character-name">
        <input
          type="text"
          id="name"
          data-path="characterName"
          placeholder="Name"
          minlength="3"
          maxlength="16"
          required
          aria-disabled
          readonly
          aria-label="Character name"
          ${ctx.role !== "public" ? 'data-behavior="edit-enabled"' : ""}
          pattern="[\\w\\s\\-']+"
          value="${ctx.character?.characterName || "Name"}"
          tabindex="1"
        />
      </div>
    </form>
  `;
}

function renderExperienceBlock(ctx) {
  return `
    <section id="experience">
      <h3>Experience</h3>

      ${renderOutput("experience", {}, ctx)}
    </section>
  `;
}

function renderAttributesBlock(ctx) {
  return `
    <section id="attributes">
      <h3>${TEXTS.character.form.attributes.title}</h3>

      ${renderPrimaryAttributesBlock(ctx)}

      ${renderSecondaryAttributesBlock(ctx)}
    </section>
  `;
}

function renderPrimaryAttributesBlock(ctx) {
  const LOCATION = TEXTS.character.form.attributes.primary.attrs;

  const flags = [
    ["min", "5"],
    ["max", "15"],
    ["inputmode", "numeric"],
    ["data-behavior", "select-enabled"],
  ];

  return `
    <div id="primary">
      <h4>${TEXTS.character.form.attributes.primary.title}</h4>

      <div>
        ${renderInput("Accurate", "number", LOCATION, { isRequired: true, flags }, ctx)}

        ${renderInput("Cunning", "number", LOCATION, { isRequired: true, flags }, ctx)}

        ${renderInput("Discreet", "number", LOCATION, { isRequired: true, flags }, ctx)}

        ${renderInput("Alluring", "number", LOCATION, { isRequired: true, flags }, ctx)}

        ${renderInput("Quick", "number", LOCATION, { isRequired: true, flags }, ctx)}

        ${renderInput("Resolute", "number", LOCATION, { isRequired: true, flags }, ctx)}

        ${renderInput("Vigilant", "number", LOCATION, { isRequired: true, flags }, ctx)}

        ${renderInput("Strong", "number", LOCATION, { isRequired: true, flags }, ctx)}
      </div>
    </div>
  `;
}

function renderSecondaryAttributesBlock(ctx) {
  const LOCATION = TEXTS.character.form.attributes.secondary.attrs;
  const flags = [
    ["min", "10"],
    ["inputmode", "numeric"],
    ["value", "10"],
  ];

  return `
    <div id="secondary">
      <h4>${TEXTS.character.form.attributes.secondary.title}</h4>

      <div>
        ${renderInput(
          "Toughness",
          "number",
          LOCATION,
          {
            isReadonly: true,
            isRequired: true,
            flags: [
              ["min", "10"],
              ["inputmode", "numeric"],
              ["value", "10"],
            ],
          },
          ctx,
        )}

        ${renderInput("Pain", "number", LOCATION, { isRequired: true, isReadonly: true, flags: [["inputmode", "numeric"]] }, ctx)}

        ${renderInput("Corruption", "number", LOCATION, { isRequired: true, isReadonly: true, flags: [["inputmode", "numeric"]] }, ctx)}

        ${renderInput("Defense", "number", LOCATION, { isRequired: true, isReadonly: true, flags: [["inputmode", "numeric"]] }, ctx)}
      </div>
    </div>
  `;
}

function renderSinsBlock(sins) {
  return `
    <section id="sins">
      <h3>${TEXTS.character.form.sins.title}</h3>

      <ul>
        ${Array.from(sins, (sinData, index) => renderVacantSinItem(sinData, index)).join(" ")}
      </ul>
    </section>
  `;
}

function renderSinItem() {
  // placeholder
  return `
    <li class="sin" data-sin="0">
      <h5>Manipulator</h5>

      <div>
        <output class="inner" for="sin_0">2</output>

        <button
          id="sin_0"
          data-level="2"
          data-action="update-sin-level"
          type="button"
        >
          <svg role="presentation" aria-label="Icon with an arrow up">
            <use
              href="/common/icons/icon-up-2.svg"
            ></use>
          </svg>
        </button>
      </div>

      <dl>
        <dt>All, Vig:</dt>
        <dd>+2</dd>
      </dl>
    </li>
  `;
}

function renderVacantSinItem(_, index) {
  return `
    <li class="sin" id="sin-add" data-sin="${index}">
      <button id="sin_${index}" data-action="sin-add" type="button" aria-label="${TEXTS.character.form.sins.add.label}">
        <svg role="img" aria-hidden="true">
          <use
            href="/common/icons/icon-plus-2.svg"
          ></use>
        </svg>
      </button>
    </li>
  `;
}

function renderPortraitBlock(ctx) {
  const portrait = ctx.character?.portrait;

  if (portrait?.path) {
    const crop = portrait.crop;

    const transform = `translate(${crop.x}px, ${crop.y}px) scale(${crop.scale}) rotate(${crop.rotation}deg)`;

    return `
      <section id="portrait" data-portrait="${ctx.character?.characterName}">
        <div role="region" aria-label="Portrait" tabindex="-1">
          <div id="portrait-preview">
            <img src="${portrait.path}"
              alt="Character portrait"
              style="transform: ${transform};"
            />
          </div>
        </div>
      </section>
    `;
  }

  return `
    <section id="portrait">
      <div role="region"
        aria-label="Portrait upload area"
        tabindex="-1">

        <div id="portrait-placeholder">
          <span>${TEXTS.character.form.portrait.title}</span>
          <svg role="img" aria-label="${TEXTS.character.form.portrait.label}">
            <use href="/common/icons/icon-plus-2.svg"></use>
          </svg>
        </div>

        <div id="portrait-preview" hidden>
          <img alt="Character portrait" />
        </div>
      </div>

      <input type="file"
        id="portrait-input"
        accept="image/png, image/jpeg, image/jpg, image/webp, image/gif, image/avif"
        aria-label="Upload portrait image"
      />
    </section>
  `;
}

function renderAbilitiesBlock(ctx) {
  const abilities =
    ctx.character?.traits?.filter((t) => t.type === "ability") || [];

  const abilitiesHtml =
    abilities.length > 0
      ? abilities
          .map((ability, index) => renderAbilityItem(ability, index, cts))
          .join(" ")
      : renderVacantAbilityItem(0);

  return `
    <section id="abilities">
      <h3>${TEXTS.character.form.abilities.title}</h3>

      <ul>
        ${abilitiesHtml}
      </ul>
    </section>
  `;
}

function renderAbilityItem(ability, index, ctx) {
  const isEditable = ctx.isEditable(`traits[${index}]`);

  return `
    <li class="ability" data-ability="${index}">
      <h4>${ability.name}</h4>

      <dl>
        <div>
          <dt>${TEXTS.character.form.abilities.item.equipmentTitle}</dt>
          <dd>2x daggers</dd>
        </div>

        <div>
          <dt>${TEXTS.character.form.abilities.item.statsTitle}</dt>
          <dd>Dis</dd>
        </div>
      </dl>

      <ol>
        <li>
          <svg
            role="img"
            aria-label="${TEXTS.character.form.abilities.item.iconLabel}"
          >
            <use
              href="/common/icons/icon-grade-novice.svg"
            ></use>
          </svg>

          <p>
            <span>Light, precise: <em>Acc&rarr;Dis</em></span
            ><span>Attacks: <em>advantage</em></span>
          </p>
        </li>

        <li>
          <svg
            role="img"
            aria-label="${TEXTS.character.form.abilities.item.iconLabel}"
          >
            <use
              href="/common/icons/icon-grade-adept.svg"
            ></use>
          </svg>

          <p>
            <span>Defense: <em>Qck&rarr;Dis</em></span>
          </p>
        </li>

        <li class="inactive">
          <svg
            role="img"
            aria-label="${TEXTS.character.form.abilities.item.iconLabel}"
          >
            <use
              href="/common/icons/icon-grade-master.svg"
            ></use>
          </svg>

          <p>
            <span>Dis: <em>free attack</em></span>
          </p>
        </li>
      </ol>
    </li>
  `;
}

function renderVacantAbilityItem(_, index) {
  return `
    <li id="ability-add" class="ability" data-ability="${index}">
      <button id="ability_${index}" data-action="ability-add" type="button" aria-label="${TEXTS.character.form.abilities.add.label}">
        <svg role="img" aria-hidden="true">
          <use
            href="/common/icons/icon-plus-3.svg"
          ></use>
        </svg>
      </button>
    </li>
  `;
}

function renderInformationBlock(ctx) {
  return `
    <section id="information">
      <h3>${TEXTS.character.form.information.title}</h3>

      ${renderInformationMainBlock(ctx)}

      ${renderInformationMysticBlock(ctx)}

      ${renderInformationSocialBlock(ctx)}
    </section>
  `;
}

function renderInformationMainBlock(ctx) {
  return `
      <div id="main">
        <h4>${TEXTS.character.form.information.main.title}</h4>

        ${renderInformationPersonalBlock(ctx)}

        ${renderInformationEquipmentBlock()}
      </div>
  `;
}

function renderInformationPersonalBlock(ctx) {
  const LOCATION = TEXTS.character.form.information.main.personal.data;

  return `
    <div id="personal">
      ${renderInput(
        "Age",
        "number",
        LOCATION,
        {
          flags: [
            ["min", "0"],
            ["inputmode", "numeric"],
            ["data-behavior", "select-enabled"],
          ],
        },
        ctx,
      )}

      ${renderInput(
        "Race",
        "text",
        LOCATION,
        {
          flags: [
            ["inputmode", "text"],
            ["data-behavior", "select-enabled"],
            ["pattern", "[\\w\\s\\-']+"],
          ],
        },
        ctx,
      )}

      ${renderInput(
        "Reales",
        "number",
        LOCATION,
        {
          flags: [
            ["min", "0"],
            ["inputmode", "numeric"],
            ["data-behavior", "select-enabled"],
          ],
        },
        ctx,
      )}

      ${renderInput(
        "Profession",
        "text",
        LOCATION,
        {
          flags: [
            ["inputmode", "text"],
            ["data-behavior", "select-enabled"],
            ["pattern", "[\\w\\s\\-']+"],
          ],
        },
        ctx,
      )}
    </div>
  `;
}

function renderInformationEquipmentBlock() {
  return `
    <div id="equipment">
      <ul>
        ${renderEquipmentItem("Weapon", "1")}

        ${renderEquipmentItem("Weapon", "2")}

        ${renderEquipmentItem("Weapon", "3")}

        ${renderEquipmentItem("Armor", "1")}
      </ul>

      <ul>
        ${renderEquipmentItem("Rune", "1")}

        ${renderEquipmentItem("Rune", "2")}

        ${renderEquipmentItem("Armor", "2", "Plug")}
      </ul>
    </div>
  `;
}

function renderEquipmentItem(type, index, variant = type) {
  return `
    <li class="inactive">
      <button id="${type.toLowerCase()}_${index}" data-action="${type.toLowerCase()}-add" type="button">
        <h5>${variant}</h5>

        <svg role="presentation" aria-label="${TEXTS.character.form.information.main.equipment.label}">
          <use
            href="/common/icons/icon-plus-4.svg"
          ></use>
        </svg>
      </button>
    </li>
  `;
}

function renderInformationMysticBlock(ctx) {
  const LOCATION = TEXTS.character.form.information.mystic.data;

  return `
    <div id="mystic">
      <h4>${TEXTS.character.form.information.mystic.title}</h4>

      ${renderTextarea("Shadow", LOCATION, ctx)}

      <div class="input">
        <label for="tradition">Mystical tradition</label>
        <input
          id="tradition"
          name="tradition"
          type="text"
          placeholder="Mage Circle"
          inputmode="text"
          form="character-form"
          readonly
        />
      </div>

      <div class="input">
        <label for="permanent-corruption">Permanent corruption</label>
        <input
          id="permanent-corruption"
          name="corruption.permanent"
          type="number"
          placeholder="0"
          inputmode="numeric"
          form="character-form"
          readonly
        />
      </div>
    </div>
  `;
}

function renderInformationSocialBlock(ctx) {
  const LOCATION = TEXTS.character.form.information.social.data;

  return `
    <div id="social">
      <h4>${TEXTS.character.form.information.social.title}</h4>

      ${renderTextarea("assets", LOCATION, ctx, "Membership")}
    </div>
  `;
}

function renderOutput(section, options = {}, ctx) {
  const { isUI = false } = options;
  const outputConfig = TEXTS.character.form[section]?.output;
  if (!outputConfig) return "";

  let value = outputConfig.content;
  if (ctx.character) {
    if (section === "attributes") {
      const primary = ctx.getValue("attributes.primary", {});
      const total = Object.values(primary).reduce((sum, val) => sum + val, 0);
      value = 80 - total;
    } else if (section === "abilities" || section === "experience") {
      const total = ctx.getValue("experience.total", 0);
      // const spent = calculateSpentExperience?.(ctx.character) || 0;
      const spent = ctx.getValue("experience.unspent", 0);
      value = total - spent;
    }
  }

  return `
    <output
      form="character-form"
      name="${outputConfig.name}"
      aria-live="polite"
      role="status"
      ${isUI ? 'data-ui-only="true"' : ""}
      id="${outputConfig.name}"
      for="${outputConfig.for}"
      >${value}</output
    >
  `;
}

function renderTextarea(attr, textsLocation, ctx, content = attr) {
  const path = textsLocation[attr.toLowerCase()]?.path;
  const value = ctx.getValue(path, "");
  const placeholder = textsLocation[attr.toLowerCase()]?.placeholder || "";
  const isFieldReadonly = !ctx.isEditable(path);

  return `
    <div class="textarea">
      <label for="${attr.toLowerCase()}">${content}</label>
      <textarea
        rows="3"
        id="${attr.toLowerCase()}"
        name="${path}"
        placeholder="${placeholder}"
        ${isFieldReadonly ? "readonly" : ""}
        tabindex="${isFieldReadonly ? "-1" : "1"}"
        data-behavior="select-enabled"
      >${value}</textarea>
    </div>
  `;
}

function renderInput(attr, type, textsLocation, options = {}, ctx) {
  const {
    isRequired = true,
    isReadonly = false,
    isAutoFocused = false,
    flags = [],
  } = options;

  const path = textsLocation[attr.toLowerCase()]?.path;
  const value = ctx.getValue(path, "");
  const placeholder = textsLocation[attr.toLowerCase()]?.placeholder || "";

  const isFieldReadonly = !ctx.isEditable(path) || isReadonly;
  const editBehaviorAttrs = !isFieldReadonly
    ? [
        ["data-role-allowed", ctx.role],
        ["data-behavior", "edit-enabled"],
      ]
    : [["aria-disabled", "true"]];

  const tabindex = isFieldReadonly ? "-1" : "1";

  const attrs = [
    `id="${attr.toLowerCase()}"`,
    `data-path="${path}"`,
    `type="${type}"`,
    `placeholder="${placeholder}"`,
    `value="${value}"`,
    isFieldReadonly ? "readonly" : "",
    isAutoFocused ? "autofocus" : "",
    isRequired && !ctx.character ? "required" : "",
    `tabindex="${tabindex}"`,
    ...editBehaviorAttrs.map(([key, val]) => `${key}="${val}"`),
    ...flags.map(([key, val]) => `${key}="${val}"`),
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <div class="input">
      <label for="${attr.toLowerCase()}">${attr}</label>
      <input ${attrs} />
    </div>
  `;
}

function formatHTMLLabel(string) {
  const str = string.toLowerCase();

  return str.replace(/[^a-zA-Z0-9]+(.)/g, (match, chr) => {
    return chr.toUpperCase();
  });
}

function createTemplateContext(character, role = "public") {
  const editablePaths = getWritableFieldPaths(role);
  const editablePrefixes = generatePrefixes(editablePaths);

  return {
    character,
    role,

    getValue(path, defaultValue = "") {
      if (!character) return defaultValue;

      return (
        path.split(".").reduce((obj, key) => obj?.[key], character) ??
        defaultValue
      );
    },

    isEditable(fieldPath) {
      // if (role === "dm") return true;

      // if (role === "owner") {
      //   const ownerEditable = [
      //     "characterName",
      //     "attributes.primary",
      //     "experience.unspest",
      //     "corruption.temporary",
      //     "background",
      //     "equipment.money",
      //   ];

      //   return ownerEditable.some((pattern) => fieldPath.startsWith(pattern));
      // }

      // return false;

      if (editablePaths.has(fieldPath)) return true;

      for (const prefix of editablePrefixes) {
        if (fieldPath.startsWith(prefix + ".")) return true;
      }

      return false;
    },

    getEditableDataAttributes() {
      return {
        "data-editable-fields": JSON.stringify(Array.from(editablePaths)),
        "data-role": role,
      };
    },
  };
}

function generatePrefixes(paths) {
  const prefixes = new Set();

  for (const path of paths) {
    const parts = path.split(".");

    for (let i = 1; i < parts.length; i++) {
      prefixes.add(parts.slice(0, i).join("."));
    }
  }

  return prefixes;
}
