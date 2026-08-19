/**
 * Schedule — 勤務予定管理
 */
const ScheduleModule = (() => {

  const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];
  const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

  function render() {
    document.getElementById('add-schedule-btn').addEventListener('click', showAddModal);
    renderScheduleLists();
  }

  function renderScheduleLists() {
    const schedules = DB.Schedules.getAll();
    const regulars  = schedules.filter(s => s.type === 'regular');
    const specials  = schedules.filter(s => s.type === 'special');

    // 通常勤務
    const regList = document.getElementById('regular-schedule-list');
    if (regulars.length === 0) {
      regList.innerHTML = '<p class="text-muted">通常勤務予定なし</p>';
    } else {
      regList.innerHTML = regulars.map(s => `
        <div class="schedule-item">
          <div>
            <div class="schedule-days">
              ${DAY_LABELS.map((d, i) => `
                <div class="day-chip ${s.days && s.days.includes(i) ? 'active' : ''}">${d}</div>
              `).join('')}
            </div>
            <div style="margin-top:6px;font-size:13px">
              <span class="mono">${s.startTime} 〜 ${s.endTime}</span>
              <span style="color:var(--text-sub);margin-left:8px">${durationLabel(s.startTime, s.endTime)}</span>
              ${s.plannedOvertimeMinutes > 0 ? `
                <span class="badge badge-purple" style="margin-left:8px">
                  +${s.plannedOvertimeMinutes}分 予定時間外
                </span>
              ` : ''}
            </div>
            ${s.name ? `<div style="font-size:12px;color:var(--text-sub);margin-top:2px">${s.name}</div>` : ''}
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm btn-ghost" onclick="ScheduleModule.showEditModal('${s.id}')">編集</button>
            <button class="btn btn-sm btn-danger" onclick="ScheduleModule.removeSchedule('${s.id}')">削除</button>
          </div>
        </div>
      `).join('');
    }

    // 特別勤務
    const spList = document.getElementById('overtime-schedule-list');
    if (specials.length === 0) {
      spList.innerHTML = '<p class="text-muted">予定時間外勤務なし</p>';
    } else {
      spList.innerHTML = specials.sort((a,b) => a.date.localeCompare(b.date)).map(s => `
        <div class="schedule-item">
          <div>
            <div style="font-weight:600">${s.date}（${DAY_NAMES[new Date(s.date + 'T00:00').getDay()]}）</div>
            <div style="font-size:13px;margin-top:2px">
              <span class="mono">${s.startTime} 〜 ${s.endTime}</span>
              <span style="color:var(--text-sub);margin-left:8px">${durationLabel(s.startTime, s.endTime)}</span>
              ${s.isOvertime ? '<span class="badge badge-purple" style="margin-left:8px">時間外</span>' : ''}
            </div>
            ${s.name ? `<div style="font-size:12px;color:var(--text-sub)">${s.name}</div>` : ''}
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm btn-ghost" onclick="ScheduleModule.showEditModal('${s.id}')">編集</button>
            <button class="btn btn-sm btn-danger" onclick="ScheduleModule.removeSchedule('${s.id}')">削除</button>
          </div>
        </div>
      `).join('');
    }
  }

  function showAddModal() {
    Modal.show('勤務予定を追加', `
      <div class="form-group">
        <label>予定の種類</label>
        <select class="select-input" id="sched-type">
          <option value="regular">通常勤務（曜日指定）</option>
          <option value="special">特別・単発（日付指定）</option>
        </select>
      </div>

      <div id="sched-regular-fields">
        <div class="form-group">
          <label>曜日</label>
          <div class="checkbox-group" id="sched-days">
            ${DAY_LABELS.map((d, i) => `
              <label class="checkbox-label">
                <input type="checkbox" name="sched-day" value="${i}"> ${d}
              </label>
            `).join('')}
          </div>
        </div>
        <div class="form-group">
          <label>予定時間外勤務（分、任意）</label>
          <input type="number" class="input-field" id="sched-planned-overtime" min="0" value="0" placeholder="例: 60">
          <div class="form-hint">通常勤務終了後の予定残業時間（分）</div>
        </div>
      </div>

      <div id="sched-special-fields" class="hidden">
        <div class="form-group">
          <label>日付</label>
          <input type="date" class="input-field" id="sched-date">
        </div>
        <div class="form-group">
          <label>時間外勤務として記録</label>
          <label class="checkbox-label">
            <input type="checkbox" id="sched-is-overtime"> はい
          </label>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label>開始時刻</label>
          <input type="time" class="input-field" id="sched-start" value="17:00">
        </div>
        <div class="form-group">
          <label>終了時刻</label>
          <input type="time" class="input-field" id="sched-end" value="20:00">
        </div>
      </div>
      <div class="form-group">
        <label>名称（任意）</label>
        <input type="text" class="input-field" id="sched-name" placeholder="例: 平日勉強時間">
      </div>
    `, [
      { text: 'キャンセル', cls: 'btn-secondary', cb: Modal.hide },
      { text: '追加', cls: 'btn-primary', cb: addSchedule }
    ]);

    document.getElementById('sched-type').addEventListener('change', (e) => {
      const isRegular = e.target.value === 'regular';
      document.getElementById('sched-regular-fields').classList.toggle('hidden', !isRegular);
      document.getElementById('sched-special-fields').classList.toggle('hidden', isRegular);
    });
  }

  function showEditModal(id) {
    const s = DB.Schedules.getAll().find(s => s.id === id);
    if (!s) return;

    Modal.show('勤務予定を編集', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label>開始時刻</label>
          <input type="time" class="input-field" id="edit-sched-start" value="${s.startTime}">
        </div>
        <div class="form-group">
          <label>終了時刻</label>
          <input type="time" class="input-field" id="edit-sched-end" value="${s.endTime}">
        </div>
      </div>
      ${s.type === 'regular' ? `
        <div class="form-group">
          <label>曜日</label>
          <div class="checkbox-group">
            ${DAY_LABELS.map((d, i) => `
              <label class="checkbox-label">
                <input type="checkbox" name="edit-day" value="${i}" ${s.days?.includes(i) ? 'checked' : ''}> ${d}
              </label>
            `).join('')}
          </div>
        </div>
        <div class="form-group">
          <label>予定時間外（分）</label>
          <input type="number" class="input-field" id="edit-planned-overtime" value="${s.plannedOvertimeMinutes || 0}" min="0">
        </div>
      ` : ''}
      <div class="form-group">
        <label>名称</label>
        <input type="text" class="input-field" id="edit-sched-name" value="${s.name || ''}">
      </div>
    `, [
      { text: 'キャンセル', cls: 'btn-secondary', cb: Modal.hide },
      { text: '保存', cls: 'btn-primary', cb: () => updateSchedule(id, s.type) }
    ]);
  }

  function updateSchedule(id, type) {
    const start = document.getElementById('edit-sched-start').value;
    const end   = document.getElementById('edit-sched-end').value;
    const name  = document.getElementById('edit-sched-name').value;

    const updates = { startTime: start, endTime: end, name,
      durationMinutes: timeDiffMinutes(start, end) };

    if (type === 'regular') {
      const checked = [...document.querySelectorAll('input[name="edit-day"]:checked')];
      updates.days = checked.map(c => parseInt(c.value));
      updates.plannedOvertimeMinutes = parseInt(document.getElementById('edit-planned-overtime').value) || 0;
    }

    DB.Schedules.update(id, updates);
    Modal.hide();
    renderScheduleLists();
    App.refreshDashboard();
    UI.toast('予定を更新しました', 'success');
  }

  function addSchedule() {
    const type  = document.getElementById('sched-type').value;
    const start = document.getElementById('sched-start').value;
    const end   = document.getElementById('sched-end').value;
    const name  = document.getElementById('sched-name').value;

    if (!start || !end) { alert('時刻を入力してください'); return; }

    const base = {
      type, startTime: start, endTime: end, name,
      durationMinutes: timeDiffMinutes(start, end),
    };

    if (type === 'regular') {
      const checked = [...document.querySelectorAll('input[name="sched-day"]:checked')];
      if (checked.length === 0) { alert('曜日を選択してください'); return; }
      base.days = checked.map(c => parseInt(c.value));
      base.plannedOvertimeMinutes = parseInt(document.getElementById('sched-planned-overtime').value) || 0;
    } else {
      const date = document.getElementById('sched-date').value;
      if (!date) { alert('日付を入力してください'); return; }
      base.date = date;
      base.isOvertime = document.getElementById('sched-is-overtime').checked;
    }

    DB.Schedules.add(base);
    Modal.hide();
    renderScheduleLists();
    App.refreshDashboard();
    UI.toast('勤務予定を追加しました', 'success');
  }

  function removeSchedule(id) {
    if (!confirm('この予定を削除しますか？')) return;
    DB.Schedules.remove(id);
    renderScheduleLists();
    App.refreshDashboard();
    UI.toast('予定を削除しました', 'success');
  }

  function timeDiffMinutes(startStr, endStr) {
    const [sh, sm] = startStr.split(':').map(Number);
    const [eh, em] = endStr.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 24 * 60;
    return diff;
  }

  function durationLabel(startStr, endStr) {
    const min = timeDiffMinutes(startStr, endStr);
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}時間` : `${h}時間${m}分`;
  }

  return { render, renderScheduleLists, showEditModal, removeSchedule };
})();