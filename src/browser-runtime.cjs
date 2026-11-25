const { FormattingController } = require('./formatting-controller.cjs');
function browserRuntime(document, window) {
  const button = document.getElementById('print');
  let pendingReady, printing = false, frame;
  function fit() {
    const equations = [...document.querySelectorAll('.print-document .katex-display')];
    // Reset all sizes, measure together, then apply: avoid layout per equation.
    for (const element of equations) element.style.fontSize = '';
    const sizes = equations.map(element => {
      const math = element.querySelector('.katex');
      const width = element.clientWidth;
      const mathWidth = math?.scrollWidth || 0;
      return width > 0 && mathWidth > width ? (width / mathWidth * 100) + '%' : '';
    });
    equations.forEach((element, index) => { element.style.fontSize = sizes[index]; });
  }

  function ready() {
    if (!pendingReady) pendingReady = (async () => {
      try {
        await document.fonts.ready;
        await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
        fit();
        document.body.dataset.ready = 'true';
      } finally { pendingReady = null; }
    })();
    return pendingReady;
  }
  function scheduleFit() {
    document.body.dataset.ready = 'false';
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(() => { ready(); });
  }
  const controller = new FormattingController({ document, settings: JSON.parse(document.getElementById('initial-formatting').textContent), onLayoutChange: scheduleFit }).mount();
  window.addEventListener('resize', scheduleFit);
  window.addEventListener('afterprint', scheduleFit);
  window.addEventListener('beforeprint', fit);
  document.fonts.addEventListener('loadingdone', scheduleFit);
  async function print() {
    if (printing) return;
    printing = true;
    button.disabled = true;
    try {
      await ready();
      window.print();
    } catch {
      controller.status('Printing could not start. Try Print / Save as PDF again.');
    } finally {
      printing = false;
      button.disabled = false;
    }
  }
  button.addEventListener('click', print);
  ready();
  return { controller, ready, destroy() {
    controller.destroy();
    window.cancelAnimationFrame(frame);
    window.removeEventListener('resize', scheduleFit);
    window.removeEventListener('afterprint', scheduleFit);
    window.removeEventListener('beforeprint', fit);
    document.fonts.removeEventListener('loadingdone', scheduleFit);
    button.removeEventListener('click', print);
  } };
}
module.exports = { browserRuntime };
