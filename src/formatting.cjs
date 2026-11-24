// One schema shared by the exported browser and the Node renderer.
const FIELDS = Object.freeze({
  font: Object.freeze({ label: 'Font', options: Object.freeze({ serif: 'Georgia / serif', sans: 'Arial / sans serif', mono: 'Courier / monospace' }), default: 'serif' }),
  fontSize: Object.freeze({ label: 'Text size (pt)', min: 8, max: 24, step: 0.5, default: 10 }),
  lineHeight: Object.freeze({ label: 'Line spacing', min: 1, max: 2.5, step: 0.05, default: 1.4 }),
  marginTop: Object.freeze({ label: 'Top margin (mm)', min: 5, max: 40, step: 1, default: 12 }),
  marginRight: Object.freeze({ label: 'Right margin (mm)', min: 5, max: 40, step: 1, default: 12 }),
  marginBottom: Object.freeze({ label: 'Bottom margin (mm)', min: 5, max: 40, step: 1, default: 14 }),
  marginLeft: Object.freeze({ label: 'Left margin (mm)', min: 5, max: 40, step: 1, default: 12 }),
  headingScale: Object.freeze({ label: 'Heading scale', min: 0.75, max: 1.5, step: 0.05, default: 1 }),
  imageHeight: Object.freeze({ label: 'Maximum image height (mm)', min: 30, max: 250, step: 5, default: 95 }),
  paper: Object.freeze({ label: 'Paper size', options: Object.freeze({ A4: 'A4', Letter: 'Letter' }), default: 'A4' }),
  orientation: Object.freeze({ label: 'Orientation', options: Object.freeze({ portrait: 'Portrait', landscape: 'Landscape' }), default: 'portrait' }),
  noteBreaks: Object.freeze({ label: 'Start each note on a new page', type: 'boolean', default: false })
});
const DEFAULTS = Object.freeze(Object.fromEntries(Object.entries(FIELDS).map(([key, field]) => [key, field.default])));
const PRESETS = Object.freeze({
  compact: Object.freeze({ label: 'Compact', values: Object.freeze({}) }),
  comfortable: Object.freeze({ label: 'Comfortable', values: Object.freeze({ fontSize: 11, imageHeight: 230 }) }),
  academic: Object.freeze({ label: 'Academic', values: Object.freeze({ fontSize: 12, lineHeight: 1.6, marginTop: 20, marginRight: 20, marginBottom: 20, marginLeft: 20, imageHeight: 180, noteBreaks: true }) })
});
function normalizeSettings(input = {}) {
  const result = {};
  for (const [key, field] of Object.entries(FIELDS)) {
    const value = input?.[key];
    if (field.options) result[key] = Object.hasOwn(field.options, value) ? value : field.default;
    else if (field.type === 'boolean') result[key] = typeof value === 'boolean' ? value : field.default;
    else result[key] = typeof value === 'number' && Number.isFinite(value) ? Math.min(field.max, Math.max(field.min, value)) : field.default;
  }
  return result;
}
function resolveSettings(preset = 'compact', overrides = {}) {
  return normalizeSettings({ ...DEFAULTS, ...(PRESETS[preset]?.values || {}), ...overrides });
}
function initialSettings(config = {}) {
  return resolveSettings(config.compact === false ? 'comfortable' : 'compact', { noteBreaks: config.noteBreaks === true, ...config.formatting });
}
module.exports = { FIELDS, DEFAULTS, PRESETS, normalizeSettings, resolveSettings, initialSettings };
