// Self-contained: the document assembler serializes this function into offline HTML.
function browserRuntime(document, window) {
  function fit() {
    for (const element of document.querySelectorAll('.katex-display')) {
      element.style.fontSize = '';
      const math = element.querySelector('.katex');
      if (math && math.scrollWidth > element.clientWidth) {
        element.style.fontSize = (element.clientWidth / math.scrollWidth * 100) + '%';
      }
    }
  }
  async function ready() {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
    fit();
    document.body.dataset.ready = 'true';
  }
  ready();
  window.addEventListener('beforeprint', fit);
  document.getElementById('print').onclick = async () => {
    await ready();
    window.print();
  };
}
module.exports = { browserRuntime };
