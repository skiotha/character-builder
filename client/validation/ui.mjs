import { deepMerge } from "../utils/merge.mjs";
import { DEFAULT_CHARACTER } from "../utils/rpg.mjs";
import {
  validateForm,
  getSchemaRules,
  hasPathInSchema,
  validateField,
} from "./engine.mjs";

export class FormValidator {
  form;
  schema;
  fieldMap;

  errors = {};

  constructor(formElement, schema, enhancedData = null) {
    this.form = formElement;
    this.schema = schema;

    this.fieldMap = this.buildFieldMap();

    // this.setupEventListeners();

    console.log(`Mapped ${this.fieldMap.size} fields to schema paths`);
  }

  buildFieldMap() {
    const map = new Map();

    this.form.querySelectorAll("[name]").forEach((field) => {
      const path = field.name;

      if (path && hasPathInSchema(this.schema, path)) {
        map.set(field, path);
      } else if (path) {
        console.warn(`Field path not found in schema: ${path}`);
      }
    });

    return map;
  }

  setupEventListeners() {
    this.fieldMap.forEach((path, field) => {
      field.addEventListener(
        "input",
        this.debounce(() => {
          this.validateField(field, path);
        }, 300),
      );

      field.addEventListener("blur", () => {
        this.validateField(field, path);
      });
    });

    this.form.addEventListener("submit", (e) => {
      if (!this.validateAll()) {
        e.preventDefault();
        this.showAllErrors();
      }
    });
  }

  validateField(field, schemaPath) {
    const fieldSchema = getSchemaRules(this.schema, schemaPath);

    if (!fieldSchema) {
      console.error(`No validation rules found for path: ${schemaPath}`);
      return true;
    }

    const value = this.getFieldValue(field);
    const allData = this.getFormData();

    const errors = validateField(value, fieldSchema, allData);
    // const errors = this.validateField(value, this.schema[schemaPath], allData);

    // this.updateFieldUI(field, errors);

    if (errors.length > 0) {
      this.errors[schemaPath] = errors;
    } else {
      delete this.errors[schemaPath];
    }

    return errors.length === 0;
  }

  validateAll() {
    const formData = this.getFormData();
    const result = validateForm(formData, this.schema);

    // this.validateAllFormFields(formData, result);

    this.errors = result.errors;
    return result;
  }

  updateFieldUI(field, errors) {
    field.classList.remove("invalid");
    const existingError = field.parentElement.querySelector(".field-error");
    if (existingError) existingError.remove();

    if (errors.length > 0) {
      field.classList.add("invalid");

      const errorElement = document.createElement("div");
      errorElement.className = "field-error";
      errorElement.textContent = errors[0];
      errorElement.setAttribute("role", "alert");
      errorElement.setAttribute("aria-live", "polite");

      field.parentElement.appendChild(errorElement);
    }
  }

  showAllErrors() {
    this.fieldMap.forEach((path, field) => {
      const errors = this.errors[path];
      // this.updateFieldUI(field, errors || []);
    });

    const firstInvalid = this.form.querySelector(".invalid");
    if (firstInvalid) {
      firstInvalid.focus();
    }
  }

  getFieldValue(field) {
    const tagName = field.tagName.toLowerCase();
    const type = field.type;

    if (tagName === "input") {
      if (type === "number") {
        return parseInt(field.value) || 0;
      }
      return field.value;
    }

    if (tagName === "output") {
      return parseFloat(field.value);
    }

    if (tagName === "select") {
      return field.multiple
        ? Array.from(field.selectedOptions).map((opt) => opt.value)
        : field.value;
    }

    if (tagName === "textarea") return field.value;

    return field.value || field.textContent;
  }

  getFormData() {
    const dataFromForm = {};

    this.fieldMap.forEach((path, field) => {
      this.setNestedValue(dataFromForm, path, this.getFieldValue(field));
    });

    const completeData = deepMerge(DEFAULT_CHARACTER, dataFromForm, {
      skipUndefined: true,
    });

    return completeData;
  }

  setNestedValue(obj, path, value) {
    const keys = path.split(".");
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  debounce(func, wait) {
    let timeout;

    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  debugSchemaPaths() {
    console.log("=== SCHEMA PATH DEBUG === ");

    const formPaths = Array.from(this.form.querySelectorAll("[name]"))
      .map((field) => field.name)
      .filter((name) => name);

    console.log("Form field names:", formPaths);

    formPaths.forEach((path) => {
      const exists = hasPathInSchema(this.schema, path);
      console.log(`${exists ? "OK" : "NO"} ${path}`);

      if (exists) {
        const rules = getSchemaRules(this.schema, path);
        console.log(" Rules:", rules);
      }
    });
  }

  [Symbol.dispose]() {
    this.fieldMap = null;
    this.errors = {};

    console.log("Validator disposed");
  }
}
