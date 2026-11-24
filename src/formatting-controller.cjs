const { FIELDS, normalizeSettings, resolveSettings } = require('./formatting.cjs');
const { createStyles } = require('./styles.cjs');

class FormattingController {
  #initial;
  #settings;
  #listeners = [];
  constructor({ document, settings, onLayoutChange }) {
    this.document = document;
    this.#initial = normalizeSettings(settings);
    this.#settings = { ...this.#initial };
    this.onLayoutChange = onLayoutChange;
  }
  get settings() { return { ...this.#settings }; }
  listen(element, event, handler) {
    element.addEventListener(event, handler);
    this.#listeners.push(() => element.removeEventListener(event, handler));
  }
  mount() {
    this.controls = [...this.document.querySelectorAll('[data-format]')];
    this.preset = this.document.getElementById('preset');
    for (const control of this.controls) this.listen(control, 'input', () => {
      const key = control.dataset.format, field = FIELDS[key];
      if (!field) return;
      if (control.type === 'number' && (!Number.isFinite(control.valueAsNumber) || !control.checkValidity())) {
        this.status('Enter ' + field.label.toLowerCase() + ' between ' + field.min + ' and ' + field.max + '.');
        return;
      }
      const value = field.type === 'boolean' ? control.checked : field.options ? control.value : control.valueAsNumber;
      this.#settings = normalizeSettings({ ...this.#settings, [key]: value });
      this.preset.value = '';
      this.apply();
    });
    this.listen(this.preset, 'change', () => {
      if (!this.preset.value) return;
      this.#settings = resolveSettings(this.preset.value);
      this.apply();
    });
    this.listen(this.document.getElementById('reset-format'), 'click', () => {
      this.#settings = { ...this.#initial };
      this.preset.value = '';
      this.apply();
    });
    this.sync();
    return this;
  }
  status(message) { this.document.getElementById('format-status').textContent = message; }
  sync() {
    for (const control of this.controls) {
      const value = this.#settings[control.dataset.format];
      if (control.type === 'checkbox') control.checked = value;
      else control.value = value;
    }
  }
  apply() {
    this.document.getElementById('document-styles').textContent = createStyles(this.#settings);
    this.sync();
    this.status('Formatting updated. Changes are for this preview only.');
    this.onLayoutChange();
  }
  destroy() { this.#listeners.splice(0).forEach(remove => remove()); }
}
module.exports = { FormattingController };
