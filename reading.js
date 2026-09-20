// Keys retain the positions used by existing saved answers, including fixed starts.
function readingAnswerKey(q, index) {
  const offset = q.type === 'sentence_ordering' && q.metadata.sentences[0] ? 1 : 0;
  return `a${index + offset}`;
}

function gradeReading(q, answers = {}) {
  if (!q.review?.answers?.length) return null;
  const rows = q.review.answers.map((expected, index) => {
    const key = readingAnswerKey(q, index);
    const actual = String(answers[key] ?? '');
    return { key, expected: String(expected), actual, correct: actual === String(expected) };
  });
  return { rows, correct: rows.filter(row => row.correct).length,
    total: rows.length, unanswered: rows.filter(row => !row.actual).length };
}

let reviewedReading = {};
try { reviewedReading = JSON.parse(localStorage.getItem('aptis-reading-reviews') || '{}'); } catch {}

function saveReadingReview(q) {
  reviewedReading[q.id] = JSON.stringify(saved[q.id] || {});
  try { localStorage.setItem('aptis-reading-reviews', JSON.stringify(reviewedReading)); } catch {}
}

function clearReadingMarks() {
  document.querySelectorAll('.answer-result').forEach(node => node.remove());
  document.querySelectorAll('.answer-correct,.answer-incorrect,.choice-correct,.choice-incorrect').forEach(node => {
    node.classList.remove('answer-correct', 'answer-incorrect', 'choice-correct', 'choice-incorrect');
    node.removeAttribute('aria-invalid');
    node.removeAttribute('aria-describedby');
  });
}

function showReadingReview(q) {
  const result = gradeReading(q, saved[q.id]);
  if (!result) return;
  clearReadingMarks();
  for (const row of result.rows) {
    const inputs = Array.from(document.querySelectorAll(`[data-key="${row.key}"]`));
    if (!inputs.length) continue;

    if (inputs[0].type === 'radio') {
      let expectedLabel = row.expected;
      inputs.forEach(radio => {
        const label = radio.closest('.choice') || radio.parentElement;
        const isExpected = String(radio.value) === String(row.expected);
        const isActual = String(radio.value) === String(row.actual);

        if (isExpected) {
          label.classList.add('choice-correct');
          const span = label.querySelector('span');
          if (span) expectedLabel = span.innerText.trim();
        }
        if (isActual && !row.correct) {
          label.classList.add('choice-incorrect');
        }
      });

      const lastRadio = inputs[inputs.length - 1];
      const lastChoice = lastRadio.closest('.choice') || lastRadio.parentElement;
      const message = document.createElement('div');
      message.id = `result-${row.key}`;
      message.className = `answer-result ${row.correct ? 'correct' : 'incorrect'} choice-feedback`;
      message.innerHTML = row.correct ? '✓ Chính xác!' :
        `${row.actual ? '✕ Chưa đúng.' : '○ Chưa trả lời.'} Đáp án đúng: <strong>${esc(expectedLabel)}</strong>`;
      lastChoice.after(message);
    } else {
      const input = inputs[0];
      input.classList.add(row.correct ? 'answer-correct' : 'answer-incorrect');
      input.setAttribute('aria-invalid', String(!row.correct));
      input.setAttribute('aria-describedby', `result-${row.key}`);
      const message = document.createElement('span');
      message.id = `result-${row.key}`;
      message.className = `answer-result ${row.correct ? 'correct' : 'incorrect'}`;
      message.innerHTML = row.correct ? '✓ Chính xác' :
        `${row.actual ? '✕ Chưa đúng.' : '○ Chưa trả lời.'} Đáp án đúng: <strong>${esc(row.expected)}</strong>`;
      input.after(message);
    }
  }
  const order = q.review.ordered_sentences;
  document.querySelector('#feedback').innerHTML = `
    <section class="reading-result" aria-label="Kết quả Reading">
      <div class="score-row"><div><div class="eyebrow">KẾT QUẢ KIỂM TRA</div>
        <h3>${result.correct === result.total ? 'Chính xác tất cả các ý!' : 'Cùng xem lại bài làm nhé.'}</h3></div>
        <strong class="reading-score">${result.correct}/${result.total}<small>ý đúng</small></strong></div>
      ${result.unanswered ? `<p class="muted">${result.unanswered} ý chưa trả lời được tính là chưa đúng.</p>` : ''}
      ${order?.length ? `<div class="correct-order"><b>Thứ tự câu đúng</b>
        ${q.metadata.sentences[0] ? `<p>${esc(plain(q.metadata.sentences[0]))}</p>` : ''}
        <ol>${order.map(s => `<li>${esc(plain(s))}</li>`).join('')}</ol></div>` : ''}
      <div class="explanation"><h3>Giải thích đáp án</h3>
        ${q.review.explanation || '<p>File đáp án của bài này không có phần giải thích.</p>'}</div>
      <p class="answer-source">Nguồn: <a href="${esc(q.review.source)}" target="_blank" rel="noopener">${esc(q.review.source)}</a></p>
    </section>`;
  saveReadingReview(q);
}

function restoreReadingReview() {
  if (!location.hash.startsWith('#lesson/') || !activeGroup || !activeGroup) return;
  const q = activeGroup.questions[qi];
  if (reviewedReading[q.id] === JSON.stringify(saved[q.id] || {})) showReadingReview(q);
}

function finishReading() {
  const results = activeGroup.questions.map(q => ({ q, result: gradeReading(q, saved[q.id]) }));
  const graded = results.filter(item => item.result);
  const correct = graded.reduce((sum, item) => sum + item.result.correct, 0);
  const total = graded.reduce((sum, item) => sum + item.result.total, 0);
  graded.forEach(item => saveReadingReview(item.q));
  showReadingReview(activeGroup.questions[qi]);
  document.querySelector('#feedback').insertAdjacentHTML('afterbegin', `
    <section class="reading-result reading-summary" aria-label="Tổng kết bộ bài">
      <h3>Kết quả cả bộ bài: ${correct}/${total} ý đúng</h3>
      <p class="muted">Chọn một câu để xem đáp án và giải thích. Các ý bỏ trống được tính là chưa đúng.</p>
      <div class="summary-items">${results.map(({ q, result }, index) =>
        `<a href="#lesson/${activeGroup.id}/${index}" class="secondary">Câu ${index + 1}: ${result ? `${result.correct}/${result.total}` : 'Chưa có đáp án'}</a>`).join('')}</div>
    </section>`);
}

// Run after app.js has rendered the controls and attached its normal handlers.
window.addEventListener('DOMContentLoaded', () => {
window.addEventListener('hashchange', restoreReadingReview);
document.querySelector('#app').addEventListener('input', event => {
  if (event.target.matches('[data-key]')) clearReadingMarks();
});
document.querySelector('#app').addEventListener('change', event => {
  if (event.target.matches('[data-key]')) clearReadingMarks();
});
document.querySelector('#app').addEventListener('click', event => {
  if (event.target.closest('#next') && true && qi === activeGroup.questions.length - 1) {
    // The normal navigation handler changes the hash before the next route render.
    // Finish only when the existing final question is still on screen.
    const hashIndex = Number(location.hash.split('/')[2]);
    if (hashIndex === qi) finishReading();
  }
});
restoreReadingReview();
});
