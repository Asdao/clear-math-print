const { FIELDS, PRESETS } = require('./formatting.cjs');
const { esc } = require('./html.cjs');
function createFormattingPanel(settings, noteCount) {
  const fields = Object.entries(FIELDS).map(([key, field]) => {
    const id = 'format-' + key;
    let control;
    if (field.options) control = '<select id="' + id + '" data-format="' + key + '">' + Object.entries(field.options).map(([value, label]) => '<option value="' + esc(value) + '"' + (settings[key] === value ? ' selected' : '') + '>' + esc(label) + '</option>').join('') + '</select>';
    else if (field.type === 'boolean') control = '<input id="' + id + '" data-format="' + key + '" type="checkbox"' + (settings[key] ? ' checked' : '') + '>';
    else control = '<input id="' + id + '" data-format="' + key + '" type="number" min="' + field.min + '" max="' + field.max + '" step="' + field.step + '" value="' + settings[key] + '">';
    return '<label for="' + id + '">' + esc(field.label) + control + '</label>';
  }).join('');
  return '<aside class="toolbar" aria-label="Print formatting"><div class="toolbar-heading"><div><strong>Clear Math Print</strong><p>' + noteCount + ' notes · Offline print preview</p></div><button id="print" type="button">Print / Save as PDF</button></div><details open><summary>Formatting</summary><div class="format-grid"><label for="preset">Style preset<select id="preset"><option value="">Custom / initial</option>' + Object.entries(PRESETS).map(([key, preset]) => '<option value="' + key + '">' + esc(preset.label) + '</option>').join('') + '</select></label>' + fields + '</div><button id="reset-format" type="button">Reset to initial settings</button></details><p id="format-status" role="status" aria-live="polite"></p><p>Changes apply to this open preview only; they do not save the HTML or change your notes. The preview is continuous, not an exact page preview. In the print dialog, use the same paper and orientation, scale 100%, and enable background graphics.</p></aside>';
}
module.exports = { createFormattingPanel };
