/* IELTS Listening Practice: start-up. Loads the list of tests, wires the buttons shared by
   several screens, and opens a test straight away when the address ends in #test-N. */
(async function (IL) {
  IL.$('#r-home').onclick = () => IL.home.show();
  IL.$('#intro-back').onclick = () => IL.home.show();
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-test]');
    if (b) IL.home.intro(Number(b.dataset.test));
  });
  try {
    IL.home.render(await IL.getJSON('data/catalog.json'));
  } catch (e) {
    IL.$('#test-list').innerHTML = '<li class="hint">The tests could not be loaded. Reload the page to try again.</li>';
    return;
  }
  const m = /^#test-(\d+)$/.exec(location.hash);
  if (m) IL.home.intro(Number(m[1]));
})(window.IL);
