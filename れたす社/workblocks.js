/**
 * WorkBlocks — 業務ブロック管理
 */
const WorkBlocksModule = (() => {

  const CATEGORIES = ['プログラミング', '勉強', '動画編集', '読書', 'デザイン', 'ライティング', '調査・リサーチ', 'その他'];

  function render() {
    const today = new Date();
    const dateFilter = document.getElementById('wb-date-filter');
    dateFilter.value = AttendanceModule.toDateStr(today);

    document.getElementById('wb-filter-btn').addEventListener('click', () => {
      renderForDate(dateFilter.value);
    });

    renderForDate(AttendanceModule.toDateStr(today));
  }

  function renderForDate(dateStr) {
    const blocks = DB.WorkBlocks.getByDate(dateStr);
    const att = DB.Attendance.getByDate(dateStr);

    const container = document.getElementById('work-blocks-content');
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:13px;color:var(--text-sub)">${dateStr} の業務ブロック（${blocks.length}件）</div>
        <button class="btn btn-primary btn-sm" onclick="WorkBlocksModule.showAddModal('${dateStr}', '${att?.id || ''}')">
          ＋ ブロック追加
        </button>
      </div>
      ${blocks.length === 0
        ? '<div class="card"><p class="text-muted text-center">この日の業務ブロックはありません</p></div>'
        : blocks.sort((a,b) => (a.plannedStart||'').localeCompare(b.plannedStart||'')).map(b => renderBlock(b)).join('')
      }
    `;
  }

  function renderBlock(b) {
    const hasActual = b.actualStart || b.actualEnd;
    const isComplete = b.status === 'done';

    return `
      <div class="work-block-card ${isComplete ? 'opacity-80' : ''}">
        <div class="work-block-header">
          <div style="display:flex;align-items:center;gap:8px">
            ${isComplete ? '<span style="color:var(--success)">✓</span>' : '<span style="color:var(--text-dim)">○</span>'}
            <span class="work-block-title">${b.title || '無題'}</span>
            ${b.category ? `<span class="badge badge-info">${b.category}</span>` : ''}
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm btn-ghost" onclick="WorkBlocksModule.showEditModal('${b.id}')">編集</button>
            <button class="btn btn-sm btn-ghost" onclick="WorkBlocksModule.showCompleteModal('${b.id}')">完了入力</button>
            <button class="btn btn-sm btn-danger" onclick="WorkBlocksModule.removeBlock('${b.id}')">×</button>
          </div>
        </div>

        <div class="work-block-meta">
          <span>
            予定: <span class="mono">${b.plannedStart || '?'} 〜 ${b.plannedEnd || '?'}</span>
          </span>
          ${hasActual ? `
            <span style="color:var(--success)">
              実績: <span class="mono">${b.actualStart || '?'} 〜 ${b.actualEnd || '?'}</span>
            </span>
          ` : ''}
          ${b.plannedStart && b.plannedEnd ? `<span>${planMinLabel(b.plannedStart, b.plannedEnd)}</span>` : ''}
          ${b.actualStart && b.actualEnd ? `<span style="color:var(--success)">${planMinLabel(b.actualStart, b.actualEnd)}（実績）</span>` : ''}
        </div>

        ${b.goal ? `
          <div class="work-block-detail">
            <span style="color:var(--text-dim);font-size:11px">目標: </span>${b.goal}
          </div>
        ` : ''}

        ${b.tasks && b.tasks.length > 0 ? `
          <ul class="work-block-tasks" style="margin-top:6px">
            ${b.tasks.filter(t => t).map(t => `<li>${t}</li>`).join('')}
          </ul>
        ` : ''}

        ${b.actualResult ? `
          <div class="work-block-detail" style="margin-top:6px;color:var(--success)">
            <span style="font-size:11px">実績: </span>${b.actualResult}
          </div>
        ` : ''}

        ${b.achievementRate !== undefined ? `
          <div style="margin-top:6px">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:11px;color:var(--text-sub)">達成度</span>
              <div style="flex:1;height:4px;background:var(--border);border-radius:2px">
                <div style="width:${b.achievementRate}%;height:100%;background:${achieveColor(b.achievementRate)};border-radius:2px"></div>
              </div>
              <span style="font-size:12px;font-weight:700;color:${achieveColor(b.achievementRate)}">${b.achievementRate}%</span>
            </div>
          </div>
        ` : ''}

        ${b.history && b.history.length > 0 ? `
          <div style="margin-top:8px;font-size:11px;color:var(--text-dim)">
            変更履歴: ${b.history.length}件
            <button class="btn btn-sm btn-ghost" style="font-size:11px;padding:1px 6px" onclick="WorkBlocksModule.showHistory('${b.id}')">表示</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  function showAddModal(dateStr, attId) {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    Modal.show('業務ブロックを追加', `
      <div class="form-group">
        <label>業務名</label>
        <input type="text" class="input-field" id="wb-title" placeholder="例: ログイン機能の実装">
      </div>
      <div class="form-group">
        <label>カテゴリ</label>
        <select class="select-input" id="wb-category">
          ${CATEGORIES.map(c => `<option>${c}</option>`).join('')}
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label>予定開始</label>
          <input type="time" class="input-field" id="wb-plan-start" value="${timeStr}">
        </div>
        <div class="form-group">
          <label>予定終了</label>
          <input type="time" class="input-field" id="wb-plan-end">
        </div>
      </div>
      <div class="form-group">
        <label>目標</label>
        <input type="text" class="input-field" id="wb-goal" placeholder="例: ログインボタンを押すとセッションが保存される">
      </div>
      <div class="form-group">
        <label>具体的な作業（1行1項目）</label>
        <textarea class="textarea-field" id="wb-tasks" rows="3" placeholder="例:&#10;出勤ボタン実装&#10;タイムスタンプ保存&#10;遅刻時間計算"></textarea>
      </div>
      <div class="form-group">
        <label>メモ（任意）</label>
        <textarea class="textarea-field" id="wb-memo" rows="2"></textarea>
      </div>
    `, [
      { text: 'キャンセル', cls: 'btn-secondary', cb: Modal.hide },
      { text: '追加', cls: 'btn-primary', cb: () => addBlock(dateStr, attId) }
    ]);
  }

  function addBlock(dateStr, attId) {
    const title    = document.getElementById('wb-title').value.trim();
    const category = document.getElementById('wb-category').value;
    const start    = document.getElementById('wb-plan-start').value;
    const end      = document.getElementById('wb-plan-end').value;
    const goal     = document.getElementById('wb-goal').value.trim();
    const tasksRaw = document.getElementById('wb-tasks').value.trim();
    const memo     = document.getElementById('wb-memo').value.trim();

    if (!title) { alert('業務名を入力してください'); return; }

    const tasks = tasksRaw.split('\n').map(t => t.trim()).filter(t => t);

    DB.WorkBlocks.add({
      date: dateStr,
      attendanceId: attId,
      title, category,
      plannedStart: start,
      plannedEnd: end,
      goal, tasks, memo,
      status: 'planned',  // planned | in_progress | done
    });

    Modal.hide();
    renderForDate(dateStr);
    UI.toast('業務ブロックを追加しました', 'success');
  }

  function showEditModal(id) {
    const b = DB.WorkBlocks.getById(id);
    if (!b) return;

    Modal.show('業務ブロックを編集', `
      <div class="form-group">
        <label>業務名</label>
        <input type="text" class="input-field" id="edit-wb-title" value="${b.title || ''}">
      </div>
      <div class="form-group">
        <label>カテゴリ</label>
        <select class="select-input" id="edit-wb-category">
          ${CATEGORIES.map(c => `<option ${c === b.category ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label>予定開始</label>
          <input type="time" class="input-field" id="edit-wb-start" value="${b.plannedStart || ''}">
        </div>
        <div class="form-group">
          <label>予定終了</label>
          <input type="time" class="input-field" id="edit-wb-end" value="${b.plannedEnd || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>目標</label>
        <input type="text" class="input-field" id="edit-wb-goal" value="${b.goal || ''}">
      </div>
      <div class="form-group">
        <label>具体的な作業（1行1項目）</label>
        <textarea class="textarea-field" id="edit-wb-tasks" rows="3">${(b.tasks || []).join('\n')}</textarea>
      </div>
    `, [
      { text: 'キャンセル', cls: 'btn-secondary', cb: Modal.hide },
      { text: '保存', cls: 'btn-primary', cb: () => updateBlock(id, b.date) }
    ]);
  }

  function updateBlock(id, dateStr) {
    const b = DB.WorkBlocks.getById(id);
    const title    = document.getElementById('edit-wb-title').value.trim();
    const category = document.getElementById('edit-wb-category').value;
    const start    = document.getElementById('edit-wb-start').value;
    const end      = document.getElementById('edit-wb-end').value;
    const goal     = document.getElementById('edit-wb-goal').value.trim();
    const tasks    = document.getElementById('edit-wb-tasks').value.split('\n').map(t => t.trim()).filter(t => t);

    DB.WorkBlocks.update(id, { title, category, plannedStart: start, plannedEnd: end, goal, tasks });
    Modal.hide();
    renderForDate(dateStr || b.date);
    UI.toast('業務ブロックを更新しました', 'success');
  }

  function showCompleteModal(id) {
    const b = DB.WorkBlocks.getById(id);
    if (!b) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    Modal.show('業務ブロック完了入力', `
      <div style="margin-bottom:12px;padding:10px;background:var(--bg-card2);border-radius:6px">
        <strong>${b.title}</strong>
        <div style="font-size:12px;color:var(--text-sub)">予定: ${b.plannedStart || '?'} 〜 ${b.plannedEnd || '?'}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label>実際の開始時刻</label>
          <input type="time" class="input-field" id="actual-start" value="${b.actualStart || b.plannedStart || ''}">
        </div>
        <div class="form-group">
          <label>実際の終了時刻</label>
          <input type="time" class="input-field" id="actual-end" value="${timeStr}">
        </div>
      </div>
      <div class="form-group">
        <label>実績・成果</label>
        <textarea class="textarea-field" id="actual-result" rows="3" placeholder="実際に達成した内容">${b.actualResult || ''}</textarea>
      </div>
      <div class="form-group">
        <label>達成度 (%)</label>
        <input type="range" id="achieve-rate" min="0" max="100" step="10" value="${b.achievementRate || 80}"
          oninput="document.getElementById('achieve-rate-label').textContent=this.value+'%'">
        <div style="text-align:right;font-size:14px;font-weight:700;color:var(--accent)" id="achieve-rate-label">${b.achievementRate || 80}%</div>
      </div>
      <div class="form-group">
        <label>メモ</label>
        <textarea class="textarea-field" id="complete-memo" rows="2" placeholder="気づき、問題など">${b.memo || ''}</textarea>
      </div>
    `, [
      { text: 'キャンセル', cls: 'btn-secondary', cb: Modal.hide },
      { text: '完了として保存', cls: 'btn-success', cb: () => completeBlock(id, b.date) }
    ]);
  }

  function completeBlock(id, dateStr) {
    const actualStart  = document.getElementById('actual-start').value;
    const actualEnd    = document.getElementById('actual-end').value;
    const actualResult = document.getElementById('actual-result').value.trim();
    const achieveRate  = parseInt(document.getElementById('achieve-rate').value);
    const memo         = document.getElementById('complete-memo').value.trim();

    DB.WorkBlocks.update(id, {
      actualStart, actualEnd, actualResult,
      achievementRate: achieveRate,
      memo, status: 'done',
    });

    Modal.hide();
    renderForDate(dateStr);
    UI.toast('業務ブロックを完了しました', 'success');
  }

  function showHistory(id) {
    const b = DB.WorkBlocks.getById(id);
    if (!b || !b.history) return;

    Modal.show(`変更履歴 — ${b.title}`, `
      ${b.history.map((h, i) => `
        <div style="padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:11px;color:var(--text-dim)">変更 #${i+1} — ${new Date(h.at).toLocaleString('ja-JP')}</div>
          <div style="font-size:13px;margin-top:2px">
            予定: ${h.plannedStart || '?'} 〜 ${h.plannedEnd || '?'}
            ${h.goal ? `<span style="color:var(--text-sub)"> / 目標: ${h.goal}</span>` : ''}
          </div>
        </div>
      `).join('')}
    `, [
      { text: '閉じる', cls: 'btn-secondary', cb: Modal.hide }
    ]);
  }

  function removeBlock(id) {
    const b = DB.WorkBlocks.getById(id);
    if (!b) return;
    if (!confirm('この業務ブロックを削除しますか？')) return;
    DB.WorkBlocks.remove(id);
    renderForDate(b.date);
    UI.toast('業務ブロックを削除しました', 'success');
  }

  function planMinLabel(startStr, endStr) {
    if (!startStr || !endStr) return '';
    const [sh, sm] = startStr.split(':').map(Number);
    const [eh, em] = endStr.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 24 * 60;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return h > 0 ? `${h}h${m > 0 ? m + 'm' : ''}` : `${m}m`;
  }

  function achieveColor(rate) {
    if (rate >= 90) return 'var(--success)';
    if (rate >= 60) return 'var(--accent)';
    if (rate >= 30) return 'var(--warning)';
    return 'var(--danger)';
  }

  return { render, renderForDate, showAddModal, showEditModal, showCompleteModal, showHistory, removeBlock };
})();