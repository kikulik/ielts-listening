/* IELTS Listening Practice: rows of pill-shaped radio buttons on the home screen (mode, review time). */
(function (IL) {
  /* options: [[value, label], ...]; onChange gets the newly picked value as a string. */
  IL.picker = ({ el, name, options, selected, onChange }) => {
    const box = IL.$(el);
    box.innerHTML = options.map(([value, label]) =>
      `<label><input type="radio" name="${name}" value="${value}"${String(value) === String(selected) ? ' checked' : ''}><span>${IL.esc(label)}</span></label>`).join('');
    box.addEventListener('change', () => onChange(IL.$(`input[name="${name}"]:checked`).value));
  };
})(window.IL);
