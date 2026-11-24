const { FormattingController } = require('./formatting-controller.cjs');
function browserRuntime(document, window) {
  const button = document.getElementById('print');
  let pendingReady, printing = false, frame;
  function fit() {
    for (const element of document.querySelectorAll('.print-document .katex-display')) {
      element.style.fontSize = '';
      const math = element.querySelector('.katex');
      if (math && math.scrollWidth > element.clientWidth && element.clientWidth > 0) {
        element.style.fontSize = (element.clientWidth / math.scrollWidth * 100) + '%';
      }
    }
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
    window.removeEventListener('beforeprint', fit);
    document.fonts.removeEventListener('loadingdone', scheduleFit);
    button.removeEventListener('click', print);
  } };
}
module.exports = { browserRuntime };
