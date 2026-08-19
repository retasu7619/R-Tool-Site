/**
 * Attendance — 勤怠・出退勤管理
 */
const AttendanceModule = (() => {

  // ---- 出勤処理 ----
  function clockIn() {
    const now = new Date();
    const dateStr = toDateStr(now);

    // 既存の当日記録チェック
    const existing = DB.Attendance.getByDate(dateStr);
    if (existing && existing.status !== 'abandoned') {
      UI.toast('本日はすでに出勤済みです', 'warning');
      return;
    }

    const daySchedules = DB.Schedules.getForDate(dateStr);
    const regularSchedule = daySchedules.find(s => s.type === 'regular');

    // 遅刻計算
    let lateMinutes = 0;
    if (regularSchedule && regularSchedule.startTime) {
      const planned = parseTimeToday(regularSchedule.startTime, now);
      lateMinutes = Math.max(0, Math.round((now - planned) / 60000));
    }

    const session = {
      date: dateStr,
      clockInTime: now.getTime(),
      clockInDisplay: toTimeStr(now),
      scheduleId: regularSchedule?.id || null,
      plannedEndTime: regularSchedule?.endTime || null,
      lateMinutes,
      status: 'active',   // active | planning | working | overtime | finished
      phase: 'planning',  // planning → working → (overtime) → done
      planSubmitted: false,
      overtimeStartTime: null,
    };

    DB.CurrentSession.set(session);

    // 当日の出勤記録を作成
    const record = {
      date: dateStr,
      clockInTime: now.getTime(),
      clockInDisplay: toTimeStr(now),
      clockOutTime: null,
      clockOutDisplay: null,
      workMinutes: 0,
      overtimeMinutes: 0,
      lateMinutes,
      lateAuthorized: false,
      absent: false,
      earlyLeaveMinutes: 0,
      earlyLeaveAuthorized: false,
      planSubmitted: false,
      reflectionDone: false,
      selfEval: null,
      status: 'active',  // active | confirmed | pending_reflection
      scheduleId: regularSchedule?.id || null,
      regVersion: DB.Regulations.getCurrentVersion(),
    };
    DB.Attendance.add(record);

    // 遅刻があれば評価ポイント自動減点
    if (lateMinutes > 0) {
      EvaluationModule.autoAddFromAttendance(record);
    }

    updateNavStatus();
    App.refreshDashboard();

    UI.toast(`出勤しました（${toTimeStr(now)}）${lateMinutes > 0 ? ` ※${lateMinutes}分遅刻` : ''}`, 'success');

    // 業務計画を促すモーダル
    showPlanPrompt(dateStr);
  }

  // ---- 業務計画入力 ----
  function showPlanPrompt(dateStr) {
    Modal.show('業務計画（出勤後10分以内）', `
      <p style="font-size:13px;color:var(--text-sub);margin-bottom:16px">
        今日の業務計画を入力してください。この時間も勤務時間として記録されます。
      </p>
      <div class="form-group">
        <label>今日の目標・計画</label>
        <textarea class="textarea-field" id="plan-goal" rows="4" placeholder="例: ログイン機能を完成させる。バグ修正2件。"></textarea>
      </div>
      <div class="form-group">
        <label>予定業務（箇条書き）</label>
        <textarea class="textarea-field" id="plan-tasks" rows="3" placeholder="例:&#10;・出勤ボタン実装&#10;・タイムスタンプ保存&#10;・遅刻時間計算"></textarea>
      </div>
    `, [
      { text: 'あとで入力', cls: 'btn-secondary', cb: Modal.hide },
      { text: '計画を保存', cls: 'btn-primary', cb: () => submitPlan(dateStr) }
    ]);
  }

  function submitPlan(dateStr) {
    const goal  = document.getElementById('plan-goal').value.trim();
    const tasks = document.getElementById('plan-tasks').value.trim();
    const now   = new Date();

    const att = DB.Attendance.getByDate(dateStr);
    if (!att) return;

    DB.Attendance.update(att.id, { planSubmitted: true, planGoal: goal, planTasks: tasks, planSubmittedAt: now.getTime() });

    const session = DB.CurrentSession.get();
    if (session) {
      DB.CurrentSession.set({ ...session, planSubmitted: true, phase: 'working' });
    }

    Modal.hide();
    App.refreshDashboard();
    UI.toast('業務計画を保存しました', 'success');

    // 最初の業務ブロックを追加するか促す
    setTimeout(() => {
      if (confirm('業務ブロックを追加しますか？')) {
        WorkBlocksModule.showAddModal(dateStr, att.id);
      }
    }, 300);
  }

  // ---- 退勤処理 ----
  function clockOut() {
    const session = DB.CurrentSession.get();
    if (!session) return;

    const now = new Date();
    const att = DB.Attendance.getByDate(session.date);
    if (!att) return;

    const clockInTime = session.clockInTime;
    const totalMs = now.getTime() - clockInTime;
    const totalMinutes = Math.round(totalMs / 60000);

    // 通常勤務時間と時間外を計算
    let workMinutes = totalMinutes;
    let overtimeMinutes = 0;

    // 予定終了時刻を過ぎていれば時間外
    if (session.plannedEndTime) {
      const plannedEnd = parseTimeToday(session.plannedEndTime, new Date(clockInTime));
      const overtimeMs = Math.max(0, now.getTime() - plannedEnd.getTime());
      overtimeMinutes = Math.round(overtimeMs / 60000);
      workMinutes = totalMinutes - overtimeMinutes;
    }

    // 早退チェック
    let earlyLeaveMinutes = 0;
    if (session.plannedEndTime) {
      const plannedEnd = parseTimeToday(session.plannedEndTime, new Date(clockInTime));
      if (now < plannedEnd) {
        earlyLeaveMinutes = Math.round((plannedEnd.getTime() - now.getTime()) / 60000);
      }
    }

    DB.Attendance.update(att.id, {
      clockOutTime: now.getTime(),
      clockOutDisplay: toTimeStr(now),
      workMinutes: Math.max(0, workMinutes),
      overtimeMinutes,
      earlyLeaveMinutes,
      status: 'pending_reflection',
    });

    DB.CurrentSession.clear();
    updateNavStatus();
    App.refreshDashboard();

    UI.toast(`退勤しました（${toTimeStr(now)}）`, 'success');

    // 振り返りモーダルを開く
    setTimeout(() => showReflectionModal(att.id), 400);
  }

  // ---- 振り返り ----
  function showReflectionModal(attId) {
    const att = DB.Attendance.getById(attId);
    if (!att) return;

    const blocks = DB.WorkBlocks.getByAttendanceId(attId);

    Modal.show('本日の振り返り', `
      <div style="margin-bottom:16px;padding:12px;background:var(--bg-card2);border-radius:6px">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;text-align:center">
          <div>
            <div style="font-size:11px;color:var(--text-sub)">出勤</div>
            <div class="mono">${att.clockInDisplay}</div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--text-sub)">退勤</div>
            <div class="mono">${att.clockOutDisplay}</div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--text-sub)">勤務時間</div>
            <div class="mono">${SalaryModule.formatHoursMin(att.workMinutes)}</div>
          </div>
        </div>
      </div>

      ${att.planGoal ? `
        <div class="reflection-group">
          <div class="reflection-label">今日の計画</div>
          <div style="font-size:13px;color:var(--text-sub);white-space:pre-line">${att.planGoal}</div>
        </div>
      ` : ''}

      ${blocks.length > 0 ? `
        <div class="reflection-group">
          <div class="reflection-label">実施した業務ブロック（${blocks.length}件）</div>
          ${blocks.map(b => `
            <div style="display:flex;gap:8px;align-items:center;padding:4px 0">
              <span class="badge badge-info">${b.category || 'その他'}</span>
              <span style="font-size:13px">${b.title}</span>
              <span style="font-size:12px;color:var(--text-sub)">${b.actualStart || b.plannedStart || ''}〜${b.actualEnd || b.plannedEnd || ''}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="reflection-group">
        <div class="reflection-label">成果・完了したこと</div>
        <textarea class="textarea-field" id="ref-achievements" rows="3" placeholder="今日達成できたことを書きましょう"></textarea>
      </div>
      <div class="reflection-group">
        <div class="reflection-label">未完了・問題点</div>
        <textarea class="textarea-field" id="ref-issues" rows="2" placeholder="できなかったこと、発生した問題"></textarea>
      </div>
      <div class="reflection-group">
        <div class="reflection-label">改善点・明日への申し送り</div>
        <textarea class="textarea-field" id="ref-improvements" rows="2" placeholder="次回に向けての改善点"></textarea>
      </div>
      <div class="reflection-group">
        <div class="reflection-label">自己評価（1〜5）</div>
        <div style="display:flex;gap:8px">
          ${[1,2,3,4,5].map(n => `
            <label style="cursor:pointer;display:flex;align-items:center;gap:4px;font-size:14px">
              <input type="radio" name="self-eval" value="${n}"> ${n}
            </label>
          `).join('')}
        </div>
        <div style="font-size:11px;color:var(--text-sub);margin-top:4px">
          1=低品質・成果なし ／ 3=普通 ／ 5=高品質・目標達成
        </div>
      </div>
    `, [
      { text: 'あとで振り返る', cls: 'btn-secondary', cb: Modal.hide },
      { text: '振り返りを保存', cls: 'btn-primary', cb: () => saveReflection(attId) }
    ]);
  }

  function saveReflection(attId) {
    const achievements = document.getElementById('ref-achievements').value.trim();
    const issues       = document.getElementById('ref-improvements').value.trim();
    const improvements = document.getElementById('ref-improvements').value.trim();
    const evalRadio    = document.querySelector('input[name="self-eval"]:checked');
    const selfEval     = evalRadio ? parseInt(evalRadio.value) : null;

    const att = DB.Attendance.update(attId, {
      reflectionDone: true,
      refAchievements: achievements,
      refIssues: issues,
      refImprovements: improvements,
      selfEval,
      status: 'confirmed',
    });

    // 自己評価に応じて評価ポイントを自動追加
    if (selfEval !== null && att) {
      const reg = DB.Regulations.getCurrentReg();
      const now = new Date();
      if (selfEval >= 4) {
        DB.EvalLogs.add({
          reason: `高品質業務（自己評価${selfEval}）`,
          date: att.date,
          time: now.toTimeString().slice(0,5),
          delta: selfEval === 5 ? reg.highQualityBonus : reg.goalAchieveBonus,
          auto: true,
        });
      }
    }

    Modal.hide();
    App.refreshDashboard();
    render();
    UI.toast('振り返りを保存しました。お疲れさまでした！', 'success');
  }

  // ---- 未確定勤務チェック ----
  function checkUnconfirmedSession() {
    const session = DB.CurrentSession.get();
    if (!session) return;

    const now = new Date();
    const sessionDate = new Date(session.clockInTime);

    // 予定終了時刻を1時間以上過ぎている場合、または翌日になった場合
    const isNextDay = toDateStr(now) !== session.date;
    const plannedEnd = session.plannedEndTime
      ? parseTimeToday(session.plannedEndTime, sessionDate)
      : null;
    const isLongOverdue = plannedEnd && (now.getTime() - plannedEnd.getTime()) > 3600000;

    if (isNextDay || isLongOverdue) {
      showUnconfirmedAlert(session);
    }
  }

  function showUnconfirmedAlert(session) {
    const alert = document.getElementById('unconfirmed-alert');
    const msg   = document.getElementById('unconfirmed-message');
    const btn   = document.getElementById('confirm-attendance-btn');

    alert.classList.remove('hidden');
    msg.textContent = `${session.date} の勤務が未確定です（出勤: ${session.clockInDisplay}）`;
    btn.onclick = () => showConfirmUnconfirmed(session);
  }

  function showConfirmUnconfirmed(session) {
    const now = new Date();
    Modal.show('未確定の勤務を確定', `
      <p style="color:var(--text-sub);font-size:13px;margin-bottom:16px">
        ${session.date} の退勤時刻が記録されていません。実際の退勤時刻を入力してください。
      </p>
      <div class="form-group">
        <label>実際の退勤時刻</label>
        <input type="time" class="input-field" id="confirm-clockout-time"
          value="${session.plannedEndTime || toTimeStr(now).slice(0,5)}">
      </div>
      <div class="form-group">
        <label>メモ（任意）</label>
        <input type="text" class="input-field" id="confirm-memo" placeholder="例: うっかり退勤忘れ">
      </div>
    `, [
      { text: 'キャンセル', cls: 'btn-secondary', cb: Modal.hide },
      { text: '確定する', cls: 'btn-primary', cb: () => confirmUnconfirmed(session) }
    ]);
  }

  function confirmUnconfirmed(session) {
    const timeInput = document.getElementById('confirm-clockout-time').value;
    const memo      = document.getElementById('confirm-memo').value;

    if (!timeInput) { alert('退勤時刻を入力してください'); return; }

    const [h, m] = timeInput.split(':').map(Number);
    const clockOut = new Date(session.clockInTime);
    clockOut.setHours(h, m, 0, 0);
    // 翌日の場合
    if (clockOut.getTime() < session.clockInTime) {
      clockOut.setDate(clockOut.getDate() + 1);
    }

    const totalMinutes = Math.round((clockOut.getTime() - session.clockInTime) / 60000);
    let workMinutes = totalMinutes;
    let overtimeMinutes = 0;

    if (session.plannedEndTime) {
      const plannedEnd = parseTimeToday(session.plannedEndTime, new Date(session.clockInTime));
      const overtimeMs = Math.max(0, clockOut.getTime() - plannedEnd.getTime());
      overtimeMinutes = Math.round(overtimeMs / 60000);
      workMinutes = totalMinutes - overtimeMinutes;
    }

    const att = DB.Attendance.getByDate(session.date);
    if (att) {
      DB.Attendance.update(att.id, {
        clockOutTime: clockOut.getTime(),
        clockOutDisplay: toTimeStr(clockOut),
        workMinutes: Math.max(0, workMinutes),
        overtimeMinutes,
        unconfirmedMemo: memo,
        status: 'pending_reflection',
      });

      DB.CurrentSession.clear();
      document.getElementById('unconfirmed-alert').classList.add('hidden');
      Modal.hide();
      App.refreshDashboard();
      render();
      UI.toast('勤務を確定しました', 'success');
      setTimeout(() => showReflectionModal(att.id), 400);
    }
  }

  // ---- 勤怠ページ描画 ----
  function render() {
    const now = new Date();
    const yearSel  = document.getElementById('attendance-year');
    const monthSel = document.getElementById('attendance-month');
    SalaryModule.populateYearMonth(yearSel, monthSel, now);

    document.getElementById('attendance-filter-btn').addEventListener('click', () => {
      renderTable(parseInt(yearSel.value), parseInt(monthSel.value));
    });

    renderTable(now.getFullYear(), now.getMonth() + 1);
  }

  function renderTable(year, month) {
    const records = DB.Attendance.getByMonth(year, month);
    const tbody = document.getElementById('attendance-body');

    if (records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted">記録なし</td></tr>';
      return;
    }

    const DAY_NAMES = ['日','月','火','水','木','金','土'];

    tbody.innerHTML = records.sort((a,b) => a.date.localeCompare(b.date)).map(att => {
      const d = new Date(att.date);
      const dayName = DAY_NAMES[d.getDay()];
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

      let statusBadge = '';
      if (att.status === 'confirmed')            statusBadge = '<span class="badge badge-success">確定</span>';
      else if (att.status === 'pending_reflection') statusBadge = '<span class="badge badge-warning">要振り返り</span>';
      else if (att.status === 'active')          statusBadge = '<span class="badge badge-info">勤務中</span>';

      return `
        <tr style="${isWeekend ? 'color:var(--text-dim)' : ''}">
          <td>${att.date}</td>
          <td>${dayName}</td>
          <td class="mono">${att.clockInDisplay || '-'}</td>
          <td class="mono">${att.clockOutDisplay || '-'}</td>
          <td class="mono ${att.lateMinutes > 0 ? 'text-danger' : ''}">${att.lateMinutes > 0 ? `${att.lateMinutes}分` : '-'}</td>
          <td class="mono">${att.workMinutes ? SalaryModule.formatHoursMin(att.workMinutes) : '-'}</td>
          <td class="mono ${att.overtimeMinutes > 0 ? 'text-overtime' : ''}">${att.overtimeMinutes > 0 ? SalaryModule.formatHoursMin(att.overtimeMinutes) : '-'}</td>
          <td>${att.planSubmitted ? '<span class="badge badge-success">済</span>' : '<span class="badge badge-dim">未</span>'}</td>
          <td>${att.reflectionDone ? '<span class="badge badge-success">済</span>' : att.status !== 'active' ? '<span class="badge badge-dim">未</span>' : '-'}</td>
          <td>${att.selfEval ? `★${att.selfEval}` : '-'}</td>
          <td>
            <div style="display:flex;gap:4px">
              ${att.status === 'pending_reflection'
                ? `<button class="btn btn-sm btn-warning" onclick="AttendanceModule.showReflectionFromPage('${att.id}')">振り返り</button>`
                : ''}
              <button class="btn btn-sm btn-ghost" onclick="AttendanceModule.showDetailModal('${att.id}')">詳細</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function showReflectionFromPage(attId) {
    showReflectionModal(attId);
  }

  function showDetailModal(attId) {
    const att = DB.Attendance.getById(attId);
    if (!att) return;
    const blocks = DB.WorkBlocks.getByAttendanceId(attId);

    Modal.show(`勤怠詳細 — ${att.date}`, `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div><div class="reflection-label">出勤</div><div class="mono">${att.clockInDisplay || '-'}</div></div>
        <div><div class="reflection-label">退勤</div><div class="mono">${att.clockOutDisplay || '-'}</div></div>
        <div><div class="reflection-label">勤務時間</div><div class="mono">${att.workMinutes ? SalaryModule.formatHoursMin(att.workMinutes) : '-'}</div></div>
        <div><div class="reflection-label">時間外</div><div class="mono">${att.overtimeMinutes ? SalaryModule.formatHoursMin(att.overtimeMinutes) : '0:00'}</div></div>
        <div><div class="reflection-label">遅刻</div><div class="mono ${att.lateMinutes > 0 ? 'text-danger' : ''}">${att.lateMinutes > 0 ? `${att.lateMinutes}分` : 'なし'}</div></div>
        <div><div class="reflection-label">自己評価</div><div>${att.selfEval ? `★${att.selfEval}` : '-'}</div></div>
      </div>

      ${att.planGoal ? `<div class="reflection-group"><div class="reflection-label">今日の計画</div><div style="font-size:13px;color:var(--text-sub);white-space:pre-line">${att.planGoal}</div></div>` : ''}

      ${blocks.length > 0 ? `
        <div class="reflection-group">
          <div class="reflection-label">業務ブロック（${blocks.length}件）</div>
          ${blocks.map(b => `
            <div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
              <span class="badge badge-info">${b.category || 'その他'}</span>
              <strong style="margin-left:6px">${b.title}</strong>
              <span style="color:var(--text-sub);margin-left:8px">${b.actualStart || b.plannedStart || ''}〜${b.actualEnd || b.plannedEnd || ''}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${att.refAchievements ? `<div class="reflection-group"><div class="reflection-label">成果</div><div style="font-size:13px;white-space:pre-line">${att.refAchievements}</div></div>` : ''}
      ${att.refIssues ? `<div class="reflection-group"><div class="reflection-label">問題点</div><div style="font-size:13px;white-space:pre-line">${att.refIssues}</div></div>` : ''}
      ${att.refImprovements ? `<div class="reflection-group"><div class="reflection-label">改善点</div><div style="font-size:13px;white-space:pre-line">${att.refImprovements}</div></div>` : ''}
    `, [
      { text: '閉じる', cls: 'btn-secondary', cb: Modal.hide }
    ]);
  }

  // ---- ユーティリティ ----
  function toDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function toTimeStr(d) {
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  }

  function parseTimeToday(timeStr, baseDate) {
    // timeStr: "HH:MM" or "HH:MM:SS"
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(baseDate);
    d.setHours(h, m, 0, 0);
    return d;
  }

  function updateNavStatus() {
    const session = DB.CurrentSession.get();
    const dot  = document.getElementById('status-dot');
    const text = document.getElementById('status-text');

    if (!session) {
      dot.className = 'status-dot';
      text.textContent = '未出勤';
    } else {
      dot.className = 'status-dot working';
      text.textContent = '勤務中';
    }
  }

  return {
    clockIn, clockOut, render, renderTable,
    showReflectionFromPage, showDetailModal,
    checkUnconfirmedSession, updateNavStatus, submitPlan,
    parseTimeToday, toDateStr, toTimeStr
  };
})();