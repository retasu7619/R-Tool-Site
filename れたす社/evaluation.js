/**
 * Evaluation — 評価ポイント管理
 */
const EvaluationModule = (() => {

  function render() {
    const now = new Date();
    const yearSel = document.getElementById('eval-year');
    const monthSel = document.getElementById('eval-month');
    SalaryModule.populateYearMonth(yearSel, monthSel, now);

    document.getElementById('eval-filter-btn').addEventListener('click', () => {
      renderEvalContent(parseInt(yearSel.value), parseInt(monthSel.value));
    });

    renderEvalContent(now.getFullYear(), now.getMonth() + 1);
  }

  function renderEvalContent(year, month) {
    const reg = DB.Regulations.getCurrentReg();
    const logs = DB.EvalLogs.getByMonth(year, month);

    let points = reg.evalStartPoints;
    logs.forEach(log => { points += log.delta; });
    points = Math.max(0, Math.min(200, points));

    const evalRate = points / 100;
    const evalReward = Math.round(reg.evalRewardBase * evalRate);

    // ゴールド免許チェック
    const goldStatus = checkGoldLicense();

    const content = document.getElementById('evaluation-content');
    content.innerHTML = `
      <div class="evaluation-layout">
        <div class="card" style="text-align:center">
          <div class="card-label">評価ポイント</div>
          <div class="eval-point-display">
            <div>
              <span class="eval-point-value" style="color:${pointColor(points)}">${points}</span>
              <span class="eval-point-max">/ 100pt基準</span>
            </div>
            <div style="margin-top:8px;font-size:13px;color:var(--text-sub)">
              評価報酬率: ${Math.round(evalRate * 100)}%
            </div>
            <div style="margin-top:4px;font-size:16px;font-weight:700;color:var(--success)">
              評価報酬: ¥${evalReward.toLocaleString()}
            </div>
          </div>
          <div style="margin-top:16px">
            <button class="btn btn-secondary btn-sm" id="add-eval-btn">＋ ポイントを手動追加</button>
          </div>
        </div>

        <div>
          <div class="card">
            <div class="card-label">ゴールド免許</div>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
              <div style="font-size:32px">${goldStatus.hasGold ? '🥇' : '🔘'}</div>
              <div>
                <div style="font-weight:700;color:${goldStatus.hasGold ? 'var(--warning)' : 'var(--text-sub)'}">
                  ${goldStatus.hasGold ? 'ゴールド免許取得中' : '未取得'}
                </div>
                <div style="font-size:12px;color:var(--text-sub)">
                  ${goldStatus.hasGold ? '昇級対象です' : '無断遅刻・欠勤・早退があると失効'}
                </div>
              </div>
            </div>
            <div>
              ${goldStatus.issues.map(issue => `
                <div style="display:flex;gap:6px;font-size:12px;color:var(--danger);padding:3px 0">
                  <span>✕</span><span>${issue}</span>
                </div>
              `).join('')}
              ${goldStatus.issues.length === 0
                ? '<div style="font-size:12px;color:var(--success)">✓ すべての条件を満たしています</div>'
                : ''}
            </div>
          </div>

          <div class="card mt-1">
            <div class="card-label">評価ポイントログ（${year}年${month}月）</div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-weight:600">
              <span>月初スタート</span>
              <span class="mono">+${reg.evalStartPoints}pt</span>
            </div>
            ${logs.length === 0
              ? '<p class="text-muted mt-half">記録なし</p>'
              : logs.map(log => `
                <div class="eval-log-item">
                  <div>
                    <div>${log.reason}</div>
                    <div style="font-size:11px;color:var(--text-dim)">${log.date} ${log.time || ''}</div>
                  </div>
                  <span class="${log.delta >= 0 ? 'eval-delta-plus' : 'eval-delta-minus'}">
                    ${log.delta >= 0 ? '+' : ''}${log.delta}pt
                  </span>
                </div>
              `).join('')
            }
          </div>
        </div>
      </div>
    `;

    document.getElementById('add-eval-btn')?.addEventListener('click', () => showAddEvalModal(year, month));
  }

  function pointColor(pts) {
    if (pts >= 110) return 'var(--success)';
    if (pts >= 90)  return 'var(--accent)';
    if (pts >= 70)  return 'var(--warning)';
    return 'var(--danger)';
  }

  function checkGoldLicense() {
    const attendances = DB.Attendance.getAll();
    const issues = [];

    const hasUnauthorizedLate = attendances.some(a => a.lateMinutes > 0 && !a.lateAuthorized);
    const hasUnauthorizedAbsent = attendances.some(a => a.absent && !a.absentAuthorized);
    const hasUnauthorizedEarlyLeave = attendances.some(a => a.earlyLeaveMinutes > 0 && !a.earlyLeaveAuthorized);

    if (hasUnauthorizedLate) issues.push('無断遅刻の記録があります');
    if (hasUnauthorizedAbsent) issues.push('無断欠勤の記録があります');
    if (hasUnauthorizedEarlyLeave) issues.push('無断早退の記録があります');

    return { hasGold: issues.length === 0, issues };
  }

  function showAddEvalModal(year, month) {
    const reg = DB.Regulations.getCurrentReg();
    const now = new Date();
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

    Modal.show('評価ポイントを手動追加', `
      <div class="form-group">
        <label>理由</label>
        <input type="text" class="input-field" id="eval-reason" placeholder="例: テストで高得点">
      </div>
      <div class="form-group">
        <label>日付</label>
        <input type="date" class="input-field" id="eval-date" value="${dateStr}">
      </div>
      <div class="form-group">
        <label>変動ポイント（マイナスも可）</label>
        <input type="number" class="input-field" id="eval-delta" value="5" placeholder="例: +5 または -5">
      </div>
      <div style="margin-top:8px">
        <p class="text-muted" style="font-size:12px">よく使う変動：</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
          ${[
            { label: `良い成果 +${reg.goodWorkBonus}`, delta: reg.goodWorkBonus },
            { label: `目標達成 +${reg.goalAchieveBonus}`, delta: reg.goalAchieveBonus },
            { label: `高品質業務 +${reg.highQualityBonus}`, delta: reg.highQualityBonus },
            { label: `無断遅刻 -${reg.lateDeduction}`, delta: -reg.lateDeduction },
            { label: `無断欠勤 -${reg.absentDeduction}`, delta: -reg.absentDeduction },
          ].map(item => `
            <button class="btn btn-ghost btn-sm" onclick="document.getElementById('eval-delta').value=${item.delta}">${item.label}</button>
          `).join('')}
        </div>
      </div>
    `, [
      { text: 'キャンセル', cls: 'btn-secondary', cb: Modal.hide },
      { text: '追加', cls: 'btn-primary', cb: () => addEvalPoint(year, month) }
    ]);
  }

  function addEvalPoint(year, month) {
    const reason = document.getElementById('eval-reason').value.trim();
    const date   = document.getElementById('eval-date').value;
    const delta  = parseInt(document.getElementById('eval-delta').value);

    if (!reason) { alert('理由を入力してください'); return; }
    if (isNaN(delta)) { alert('ポイントを入力してください'); return; }

    const now = new Date();
    DB.EvalLogs.add({
      reason, date, delta,
      time: now.toTimeString().slice(0,5),
      manual: true,
    });

    Modal.hide();
    renderEvalContent(year, month);
    UI.toast('評価ポイントを追加しました', 'success');
  }

  // 勤怠から自動的に評価ポイントを追加する
  function autoAddFromAttendance(att) {
    const reg = DB.Regulations.getCurrentReg();
    const dateStr = att.date;
    const now = new Date();
    const timeStr = now.toTimeString().slice(0,5);

    // 無断遅刻
    if (att.lateMinutes > 0 && !att.lateAuthorized) {
      DB.EvalLogs.add({ reason: '無断遅刻', date: dateStr, time: timeStr, delta: -reg.lateDeduction, auto: true });
    }
  }

  return { render, renderEvalContent, autoAddFromAttendance, checkGoldLicense };
})();