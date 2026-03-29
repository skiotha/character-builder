const TEXTS = {
  creation: {
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

export function renderCreation() {
  return `
    ${renderMainHeader()}

    ${renderNavigationBlock()}

    ${renderCreationForm()}

    ${renderSubmitButton()}
  `;
}

function renderMainHeader() {
  return `
    <article>
      <h1>${TEXTS.creation.title}</h1>
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
      <a href="${TEXTS.creation.nav[name].path}">${name.toUpperCase()}</a>
    </li>
  `;
}

function renderCreationForm() {
  return `
    <form id="creation-form">
      ${renderAttributesBlock()}

      ${renderSinsBlock({ length: 1 })}

      ${renderPortraitBlock()}

      ${renderAbilitiesBlock({ length: 1 })}

      ${renderInformationBlock()}

      <div id="character-name">
        <input
          type="text"
          id="name"
          name="characterName"
          placeholder="Name"
          minlength="3"
          maxlength="16"
          required
          aria-label="Character name"
          data-behavior="select-enabled"
          pattern="[\\w\\s\\-']"
          tabindex="1"
        />
      </div>
    </form>
  `;
}

function renderAttributesBlock() {
  return `
    <section id="attributes">
      <h3>${TEXTS.creation.form.attributes.title}</h3>

      ${renderOutput("attributes", true)}

      ${renderPrimaryAttributesBlock()}

      ${renderSecondaryAttributesBlock()}
    </section>
  `;
}

function renderPrimaryAttributesBlock() {
  const LOCATION = TEXTS.creation.form.attributes.primary.attrs;

  return `
    <div id="primary">
      <h4>${TEXTS.creation.form.attributes.primary.title}</h4>

      <div>
        ${renderInput("Accurate", "number", LOCATION, true, false, true)}

        ${renderInput("Cunning", "number", LOCATION)}

        ${renderInput("Discreet", "number", LOCATION)}

        ${renderInput("Alluring", "number", LOCATION)}

        ${renderInput("Quick", "number", LOCATION)}

        ${renderInput("Resolute", "number", LOCATION)}

        ${renderInput("Vigilant", "number", LOCATION)}

        ${renderInput("Strong", "number", LOCATION)}
      </div>
    </div>
  `;
}

function renderSecondaryAttributesBlock() {
  const LOCATION = TEXTS.creation.form.attributes.secondary.attrs;
  const flags = [
    ["min", "10"],
    ["inputmode", "numeric"],
    ["value", "10"],
  ];

  return `
    <div id="secondary">
      <h4>${TEXTS.creation.form.attributes.secondary.title}</h4>

      <div>
        ${renderInput("Toughness", "number", LOCATION, false, true, false, flags)}

        ${renderInput("Pain", "number", LOCATION, false, true, false, flags)}

        ${renderInput("Corruption", "number", LOCATION, false, true, false, flags)}

        ${renderInput("Defense", "number", LOCATION, false, true, false, flags)}
      </div>
    </div>
  `;
}

function renderSinsBlock(sins) {
  return `
    <section id="sins">
      <h3>${TEXTS.creation.form.sins.title}</h3>

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
      <button id="sin_${index}" data-action="sin-add" type="button" aria-label="${TEXTS.creation.form.sins.add.label}">
        <svg role="img" aria-hidden="true">
          <use
            href="/common/icons/icon-plus-2.svg"
          ></use>
        </svg>
      </button>
    </li>
  `;
}

function renderPortraitBlock() {
  return `
    <section id="portrait">
      <div role="region"
        aria-label="Portrait upload area"
        tabindex="-1">

        <div id="portrait-placeholder">
          <span>${TEXTS.creation.form.portrait.title}</span>
          <svg role="img" aria-label="${TEXTS.creation.form.portrait.label}">
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

function renderAbilitiesBlock(abilities) {
  return `
    <section id="abilities">
      <h3>${TEXTS.creation.form.abilities.title}</h3>

      ${renderOutput("abilities")}

      <ul>
        ${Array.from(abilities, (abilityData, index) => renderVacantAbilityItem(abilityData, index)).join(" ")}
      </ul>
    </section>
  `;
}

function renderAbilityItem() {
  // placeholder
  return `
    <li class="ability" data-ability="0">
      <h4>Smoke & Mirrors</h4>

      <dl>
        <div>
          <dt>Equipment</dt>
          <dd>2x daggers</dd>
        </div>

        <div>
          <dt>Stats</dt>
          <dd>Dis</dd>
        </div>
      </dl>

      <ol>
        <li>
          <svg
            role="img"
            aria-label="Icon displaying novice grade of ability"
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
            aria-label="Icon displaying adept grade of ability"
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
            aria-label="Icon displaying master grade of ability"
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
      <button id="ability_${index}" data-action="ability-add" type="button" aria-label="${TEXTS.creation.form.abilities.add.label}">
        <svg role="img" aria-hidden="true">
          <use
            href="/common/icons/icon-plus-3.svg"
          ></use>
        </svg>
      </button>
    </li>
  `;
}

function renderInformationBlock() {
  return `
    <section id="information">
      <h3>${TEXTS.creation.form.information.title}</h3>

      ${renderInformationMainBlock()}

      ${renderInformationMysticBlock()}

      ${renderInformationSocialBlock()}
    </section>
  `;
}

function renderInformationMainBlock() {
  return `
      <div id="main">
        <h4>${TEXTS.creation.form.information.main.title}</h4>

        ${renderInformationPersonalBlock()}

        ${renderInformationEquipmentBlock()}
      </div>
  `;
}

function renderInformationPersonalBlock() {
  const LOCATION = TEXTS.creation.form.information.main.personal.data;

  return `
    <div id="personal">
      ${renderInput("Age", "number", LOCATION, false, false, false, null)}

      ${renderInput("Race", "text", LOCATION, false, false, false, null)}

      ${renderInput("Reales", "number", LOCATION, false, true, false, ["value", "5"])}

      ${renderInput("Profession", "text", LOCATION, false, true, false, null)}
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

        <svg role="presentation" aria-label="${TEXTS.creation.form.information.main.equipment.label}">
          <use
            href="/common/icons/icon-plus-4.svg"
          ></use>
        </svg>
      </button>
    </li>
  `;
}

function renderInformationMysticBlock() {
  const LOCATION = TEXTS.creation.form.information.mystic.data;

  return `
    <div id="mystic">
      <h4>${TEXTS.creation.form.information.mystic.title}</h4>

      ${renderTextarea("Shadow", LOCATION)}

      <div class="input">
        <label for="tradition">Mystical tradition</label>
        <input
          id="tradition"
          name="tradition"
          type="text"
          placeholder="Mage Circle"
          inputmode="text"
          form="creation-form"
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
          form="creation-form"
          readonly
        />
      </div>
    </div>
  `;
}

function renderInformationSocialBlock() {
  const LOCATION = TEXTS.creation.form.information.social.data;

  return `
    <div id="social">
      <h4>${TEXTS.creation.form.information.social.title}</h4>

      ${renderTextarea("assets", LOCATION, "Membership")}
    </div>
  `;
}

function renderOutput(section, isUI = false) {
  return `
    <output
      form="creation-form"
      name="${TEXTS.creation.form[section].output.name}"
      aria-live="polite"
      role="status"
      ${isUI ? 'data-ui-only="true"' : ""}
      id="${TEXTS.creation.form[section].output.name}"
      for="${TEXTS.creation.form[section].output.for}"
      >${TEXTS.creation.form[section].output.content}</output
    >
  `;
}

function renderTextarea(attr, textsLocation, content = attr) {
  return `
    <div class="textarea">
      <label for="${attr.toLowerCase()}">${content}</label>
      <textarea
        rows="3"
        id="${attr.toLowerCase()}"
        name="${textsLocation[attr.toLowerCase()].path}"
        placeholder="${textsLocation[attr.toLowerCase()].placeholder}"
        tabindex="1"
        data-behavior="select-enabled"
      ></textarea>
    </div>
  `;
}

function renderInput(
  attr,
  type,
  textsLocation,
  isRequired = true,
  isReadonly = false,
  isAutoFocused = false,
  flags = [],
) {
  // if (flags && flags.length)
  if (!Object.is(flags, null) || !!flags?.length)
    switch (type) {
      case "number":
        flags.push(
          ["min", "5"],
          ["max", "15"],
          ["inputmode", "numeric"],
          ["data-behavior", "select-enabled"],
        );
        break;
      case "text":
        flags.push(
          ["inputmode", "text"],
          ["data-behavior", "select-enabled"],
          ["pattern", "[\\w\\s\\-']"],
        );
        break;
    }

  return `
    <div class="input">
      <label for="${attr.toLowerCase()}">${attr}</label>
      <input
        id="${attr.toLowerCase()}"
        name="${textsLocation[attr.toLowerCase()].path}"
        type="${type}"
        form="creation-form"
        placeholder="${textsLocation[attr.toLowerCase()].placeholder}"
        ${(flags || []).map(([htmlAttribute, value]) => `${htmlAttribute}="${value}"`).join(" ")}
        ${isAutoFocused ? "autofocus" : ""}
        ${isRequired ? "required" : ""}
        ${isReadonly ? "readonly" : ""}
        tabindex="${isReadonly ? "-1" : "1"}"
      />
    </div>
  `;
}

function formatHTMLLabel(string) {
  const str = string.toLowerCase();

  return str.replace(/[^a-zA-Z0-9]+(.)/g, (match, chr) => {
    return chr.toUpperCase();
  });
}

function renderSubmitButton() {
  return `
    <button style="display: none;" form="creation-form" formnovalidate type="submit"></button>
  `;
}
