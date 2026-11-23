(() => {
  if (window.__csvYandexFillerInstalled) return;
  window.__csvYandexFillerInstalled = true;

  const norm = s => (s || '').toLocaleLowerCase('ru')
    .replace(/ё/g, 'е').replace(/[«»„“”"']/g, '')
    .replace(/[–—-]/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim().replace(/\s+/g, ' ');
  const txt = el => (el?.innerText || el?.textContent || '').trim();
  const questionTitle = q => {
    const el = q.querySelector('.QuestionLabel-Text') || q.querySelector('h3');
    return txt(el).replace(/^\s*\*\s*/, '').replace(/\s*Обязательное поле\s*$/i, '').trim();
  };
  const splitMulti = s => s.split('|').map(x => x.trim()).filter(Boolean);

  function findHeader(headers, question, rowTitle = '') {
    const expected = norm(rowTitle ? `${question} ${rowTitle}` : question);
    if (!expected) return -1;
    return headers.findIndex(h => norm(h) === expected);
  }

  function clickOption(container, value) {
    const wanted = norm(value);
    const options = [...container.querySelectorAll('label, .MatrixQuestion-Button, [role="radio"], [role="checkbox"]')];
    const target = options.find(el => {
      const label = txt(el.querySelector?.('.OptionContent-Text,.MatrixQuestion-ButtonText') || el);
      return norm(label) === wanted;
    });
    if (!target) return false;
    target.click();
    return true;
  }

  function setText(input, value) {
    const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(input, value); else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fill(headers, row) {
    let filled = 0, skipped = 0;
    const unmatched = [];
    const questions = [...document.querySelectorAll('.QuestionMarkup.Question')];
    for (const q of questions) {
      const isMatrix = q.classList.contains('MatrixQuestion');
      const isRadio = q.classList.contains('RadioQuestion');
      const isCheckbox = q.classList.contains('CheckboxQuestion');
      const isText = q.classList.contains('TextQuestion');
      if (!isMatrix && !isRadio && !isCheckbox && !isText) continue;

      const title = questionTitle(q);
      if (!title) { skipped++; continue; }

      if (isMatrix) {
        const matrixRows = [...q.querySelectorAll('.MatrixQuestion-Row')];
        for (const mr of matrixRows) {
          const rowName = txt(mr.querySelector('.MatrixQuestion-RowTitle'));
          const idx = findHeader(headers, title, rowName);
          if (idx < 0) { skipped++; continue; }
          const val = (row[idx] || '').trim();
          if (!val) { skipped++; continue; }
          if (clickOption(mr, val)) filled++;
          else unmatched.push(`${title} — ${rowName}: «${val}»`);
        }
        continue;
      }

      const idx = findHeader(headers, title);
      if (idx < 0) { skipped++; continue; }
      const val = (row[idx] || '').trim();
      if (!val) { skipped++; continue; }

      if (isRadio) {
        if (clickOption(q, val)) filled++;
        else unmatched.push(`${title}: «${val}»`);
      } else if (isCheckbox) {
        let ok = 0;
        splitMulti(val).forEach(v => {
          if (clickOption(q, v)) ok++;
          else unmatched.push(`${title}: «${v}»`);
        });
        filled += ok;
      } else if (isText) {
        const input = q.querySelector('textarea,input:not([type="hidden"])');
        if (input) { setText(input, val); filled++; }
        else unmatched.push(`${title}: поле ввода не найдено`);
      }
    }
    return { message: `Заполнено элементов: ${filled}\nПропущено пустых/несопоставленных колонок: ${skipped}` +
      (unmatched.length ? `\n\nНе удалось сопоставить (${unmatched.length}):\n• ` + unmatched.slice(0, 12).join('\n• ') + (unmatched.length > 12 ? '\n…' : '') : '') +
      '\n\nПроверьте ответы на странице. Ничего не отправлено.' };
  }

  const listener = msg => {
    if (msg?.type === 'FILL_PROFILE') {
      try { return Promise.resolve(fill(msg.headers || [], msg.row || [])); }
      catch (e) { return Promise.resolve({ message: 'Ошибка заполнения: ' + e.message }); }
    }
  };
  if (typeof browser !== 'undefined' && browser.runtime?.onMessage) browser.runtime.onMessage.addListener(listener);
  else if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) chrome.runtime.onMessage.addListener((m, s, send) => {
    Promise.resolve(listener(m)).then(send);
    return true;
  });
})();
