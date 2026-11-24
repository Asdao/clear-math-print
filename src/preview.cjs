const fontCss = require("./font-css.json");
const families = {
  classic: "Georgia,serif",
  serif: '"Source Serif 4 Variable",serif',
  sans: '"Source Sans 3 Variable",sans-serif',
  inter: '"Inter Variable",sans-serif'
};
const script = `
const families=${JSON.stringify(families)};
const byId=id=>document.getElementById(id);
function fit(){for(const e of document.querySelectorAll('.katex-display')){e.style.fontSize='';const k=e.querySelector('.katex');if(k&&k.scrollWidth>e.clientWidth)e.style.fontSize=(e.clientWidth/k.scrollWidth*100)+'%';}}
function apply(){
 const size=Number(byId('font-size').value),margin=Number(byId('margins').value);
 document.body.style.setProperty('--print-font',size+'pt');
 document.body.style.setProperty('--print-family',families[byId('font-family').value]||families.classic);
 document.body.style.setProperty('--page-width',(210-2*margin)+'mm');
 byId('page-settings').textContent='@page{size:A4;margin:'+margin+'mm}';
 document.body.classList.toggle('note-breaks',byId('note-breaks').checked);
 document.body.classList.toggle('hide-contents',!byId('contents').checked);
 document.body.classList.toggle('hide-titles',!byId('titles').checked);
 fit();document.fonts.ready.then(fit);
}
async function ready(){await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));fit();document.body.dataset.ready='true';}
for(const id of ['font-family','font-size','margins','note-breaks','contents','titles'])byId(id).addEventListener('change',apply);
apply();ready();window.addEventListener('resize',fit);window.addEventListener('beforeprint',fit);
byId('print').onclick=async()=>{await ready();window.print();};
`;
const css = `body{font-size:var(--print-font);}.note+.note{break-before:auto;margin-top:28px}body.note-breaks .note+.note{break-before:page;margin-top:0}.hide-contents .toc,.hide-titles .note-title{display:none}.note img{max-width:100%}.toolbar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;border-radius:8px}.toolbar label{display:flex;gap:6px;align-items:center}.toolbar select{font:inherit;padding:5px}.toolbar button{font:inherit}@media screen{body{max-width:var(--page-width);padding:0}}@media print{.toolbar{display:none!important}body{max-width:none}}`;
function toolbar(compact, noteBreaks) {
  return '<div class="toolbar" role="region" aria-label="Print layout">' +
    '<label>Font <select id="font-family"><option value="classic">Georgia (system)</option><option value="serif">Source Serif 4</option><option value="sans">Source Sans 3</option><option value="inter">Inter</option></select></label>' +
    '<label>Text size <select id="font-size">' + [6,7,8,8.5,9,9.5,10,10.5,11,11.5,12,13,14,15,16,18,20,22,24,28,32,36,48].map(n=>'<option value="'+n+'"'+(n===(compact?10:11)?' selected':'')+'>'+n+' pt</option>').join('') + '</select></label>' +
    '<label>Margins <select id="margins"><option value="8">Narrow</option><option value="12" selected>Normal</option><option value="18">Wide</option></select></label>' +
    '<label><input id="note-breaks" type="checkbox"'+(noteBreaks?' checked':'')+'>New page per note</label>' +
    '<label><input id="contents" type="checkbox">Contents</label>' +
    '<label><input id="titles" type="checkbox" checked>Note titles</label>' +
    '<button id="print">Print / Save as PDF</button></div>';
}
module.exports = { script, css: fontCss + css + 'body{font-family:var(--print-family,Georgia,serif)}', toolbar };
