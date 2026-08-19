/**
 * Salary — 給与計算モジュール
 */
const SalaryModule = (() => {

  // 分 → 時間給与を計算
  function calcBaseWage(minutes, hourlyRate) {
    return Math.round((minutes / 60) * hourlyRate);
  }

  // 月の給与を全計算（確定 + 予測）
  function calcMonthSalary(year, month) {
    const profile = DB.Profile.get();
    const hourlyRate = profile.hourlyRate || 100;
    const attendances = DB.Attendance.getByMonth(year, month);
    const bonusEvents = DB.BonusEvents.getByMonth(year, month);

    let totalWorkMinutes = 0;
    let totalOvertimeMinutes = 0;
    let confirmedBaseWage = 0;
    let confirmedOvertimeWage = 0;

    attendances.forEach(att => {
      if (att.status !== 'confirmed') return;
      const workMin = att.workMinutes || 0;
      const overtimeMin = att.overtimeMinutes || 0;

      // 規程バージョンを勤務日時点のものを使う
      const reg = DB.Regulations.getRegAt(att.clockInTime || Date.now());

      totalWorkMinutes += workMin;
      totalOvertimeMinutes += overtimeMin;
      confirmedBaseWage += calcBaseWage(workMin, hourlyRate);
      confirmedOvertimeWage += calcBaseWage(overtimeMin, hourlyRate * reg.overtimeRate);
    });

    // 評価報酬
    const reg = DB.Regulations.getCurrentReg();
    const evalLogs = DB.EvalLogs.getByMonth(year, month);
    let evalPoints = reg.evalStartPoints;
    evalLogs.forEach(log => { evalPoints += log.delta; });
    evalPoints = Math.max(0, Math.min(200, evalPoints));
    const evalRate = evalPoints / 100;
    const evalReward = Math.round(reg.evalRewardBase * evalRate);

    // 成果ボーナス
    let bonusTotal = 0;
    bonusEvents.forEach(ev => {
      bonusTotal += ev.amount || 0;
    });

    const totalConfirmed = confirmedBaseWage + confirmedOvertimeWage + evalReward + bonusTotal;

    // 予測（予定ベース）
    const forecast = calcMonthForecast(year, month, hourlyRate, reg);

    return {
      year, month,
      hourlyRate,
      totalWorkMinutes,
      totalOvertimeMinutes,
      confirmedBaseWage,
      confirmedOvertimeWage,
      evalPoints,
      evalReward,
      bonusTotal,
      totalConfirmed,
      forecast,
    };
  }

  // 月の給与予測（予定ベース）
  function calcMonthForecast(year, month, hourlyRate, reg) {
    const schedules = DB.Schedules.getAll();
    const daysInMonth = new Date(year, month, 0).getDate();

    let forecastWorkMin = 0;
    let forecastOvertimeMin = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const daySchedules = DB.Schedules.getForDate(dateStr);
      daySchedules.forEach(s => {
        if (s.type === 'regular') {
          forecastWorkMin += (s.durationMinutes || 0);
        } else if (s.type === 'special') {
          if (s.isOvertime) {
            forecastOvertimeMin += (s.durationMinutes || 0);
          } else {
            forecastWorkMin += (s.durationMinutes || 0);
          }
        }
      });

      // 通常勤務予定に紐づく予定時間外も加算
      daySchedules.filter(s => s.type === 'regular').forEach(s => {
        if (s.plannedOvertimeMinutes) {
          forecastOvertimeMin += s.plannedOvertimeMinutes;
        }
      });
    }

    const forecastBase      = calcBaseWage(forecastWorkMin, hourlyRate);
    const forecastOvertime  = calcBaseWage(forecastOvertimeMin, hourlyRate * reg.overtimeRate);
    const forecastEvalReward = reg.evalRewardBase; // 100%想定
    const forecastTotal     = forecastBase + forecastOvertime + forecastEvalReward;

    return {
      forecastWorkMinutes: forecastWorkMin,
      forecastOvertimeMinutes: forecastOvertimeMin,
      forecastBase,
      forecastOvertime,
      forecastEvalReward,
      forecastTotal,
    };
  }

  // ---- 給与ページ描画 ----
  function render() {
    const now = new Date();
    const yearSel = document.getElementById('salary-year');
    const monthSel = document.getElementById('salary-month');
    populateYearMonth(yearSel, monthSel, now);

    document.getElementById('salary-filter-btn').addEventListener('click', () => {
      renderSalaryContent(parseInt(yearSel.value), parseInt(monthSel.value));
    });

    renderSalaryContent(now.getFullYear(), now.getMonth() + 1);
  }

  function renderSalaryContent(year, month) {
    const data = calcMonthSalary(year, month);
    const monthLabel = `${year}年${month}月`;
    const attendances = DB.Attendance.getByMonth(year, month).filter(a => a.status === 'confirmed');
    const bonusEvents = DB.BonusEvents.getByMonth(year, month);

    document.getElementById('salary-content').innerHTML = `
      <div style="display:grid;grid-template-columns:360px 1fr;gap:16px;align-items:start">
        <div class="payslip card">
          <div class="payslip-header">
            <div class="payslip-title">${monthLabel}　給与明細</div>
            <div class="payslip-period">
              勤務日数: ${attendances.length}日 /
              勤務時間: ${formatHoursMin(data.totalWorkMinutes)}
            </div>
          </div>
          <div class="payslip-section">
            <div class="payslip-section-title">支給項目</div>
            <div class="payslip-row"><span>基本給与</span><span class="mono">¥${data.confirmedBaseWage.toLocaleString()}</span></div>
            <div class="payslip-row"><span>時間外報酬（${formatHoursMin(data.totalOvertimeMinutes)}）</span><span class="mono">¥${data.confirmedOvertimeWage.toLocaleString()}</span></div>
            <div class="payslip-row"><span>評価報酬（${data.evalPoints}pt → ${Math.round(data.evalPoints)}%）</span><span class="mono">¥${data.evalReward.toLocaleString()}</span></div>
            ${bonusEvents.map(b => `
              <div class="payslip-row"><span>${b.name}</span><span class="mono text-success">¥${(b.amount||0).toLocaleString()}</span></div>
            `).join('')}
          </div>
          <div class="payslip-total">
            <span>総支給額</span>
            <span>¥${data.totalConfirmed.toLocaleString()}</span>
          </div>
        </div>
        <div>
          <div class="card">
            <div class="card-label">給与予測（月全体）</div>
            <div class="forecast-row"><span>予定勤務時間</span><span>${formatHoursMin(data.forecast.forecastWorkMinutes)}</span></div>
            <div class="forecast-row"><span>予定時間外</span><span>${formatHoursMin(data.forecast.forecastOvertimeMinutes)}</span></div>
            <div class="forecast-row"><span>基本給与予想</span><span class="mono">¥${data.forecast.forecastBase.toLocaleString()}</span></div>
            <div class="forecast-row"><span>時間外報酬予想</span><span class="mono">¥${data.forecast.forecastOvertime.toLocaleString()}</span></div>
            <div class="forecast-row"><span>評価報酬予想</span><span class="mono">¥${data.forecast.forecastEvalReward.toLocaleString()}</span></div>
            <div class="forecast-row forecast-total"><span>予想総支給</span><span class="mono">¥${data.forecast.forecastTotal.toLocaleString()}</span></div>
          </div>
          <div class="card mt-1">
            <div class="card-label">成果ボーナス履歴</div>
            ${bonusEvents.length === 0
              ? '<p class="text-muted">今月のボーナスなし</p>'
              : bonusEvents.map(b => `
                <div class="payslip-row">
                  <span>${b.name}<br><span class="text-muted" style="font-size:11px">${b.date} / 偏差値${b.deviation || '-'}</span></span>
                  <span class="mono text-success">+¥${(b.amount||0).toLocaleString()}</span>
                </div>
              `).join('')
            }
            <div style="margin-top:12px">
              <button class="btn btn-secondary btn-sm" id="add-bonus-btn">＋ ボーナスを追加</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('add-bonus-btn')?.addEventListener('click', () => showAddBonus(year, month));
  }

  function showAddBonus(year, month) {
    const reg = DB.Regulations.getCurrentReg();
    const profile = DB.Profile.get();
    const today = new Date();
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    Modal.show('成果ボーナスを追加', `
      <div class="form-group">
        <label>名称</label>
        <input type="text" class="input-field" id="bonus-name" placeholder="例: 数学テスト">
      </div>
      <div class="form-group">
        <label>日付</label>
        <input type="date" class="input-field" id="bonus-date" value="${dateStr}">
      </div>
      <div class="form-group">
        <label>偏差値（任意）</label>
        <input type="number" class="input-field" id="bonus-deviation" min="20" max="80" step="1" placeholder="例: 62">
        <div class="form-hint">入力すると規程テーブルから自動計算されます</div>
      </div>
      <div class="form-group">
        <label>ボーナス金額（円）</label>
        <input type="number" class="input-field" id="bonus-amount" min="0" placeholder="自動計算または手動入力">
      </div>
    `, [
      { text: 'キャンセル', cls: 'btn-secondary', cb: Modal.hide },
      { text: '追加', cls: 'btn-primary', cb: () => addBonus(year, month, reg, profile) }
    ]);

    // 偏差値が変わったら金額を自動計算
    document.getElementById('bonus-deviation').addEventListener('input', (e) => {
      const dev = parseFloat(e.target.value);
      if (!isNaN(dev)) {
        const amount = calcDeviationBonus(dev, profile.hourlyRate, reg);
        document.getElementById('bonus-amount').value = amount;
      }
    });
  }

  function calcDeviationBonus(deviation, hourlyRate, reg) {
    const table = [...(reg.deviationBonusTable || [])].sort((a,b) => a.deviation - b.deviation);
    // 偏差値に対応する倍率を探す（以下に該当する最大）
    let multiplier = 0;
    for (const row of table) {
      if (deviation >= row.deviation) multiplier = row.multiplier;
    }
    return Math.round(hourlyRate * multiplier);
  }

  function addBonus(year, month, reg, profile) {
    const name      = document.getElementById('bonus-name').value.trim();
    const date      = document.getElementById('bonus-date').value;
    const deviation = parseFloat(document.getElementById('bonus-deviation').value) || null;
    const amount    = parseInt(document.getElementById('bonus-amount').value) || 0;

    if (!name) { alert('名称を入力してください'); return; }

    DB.BonusEvents.add({ name, date, deviation, amount });
    Modal.hide();
    renderSalaryContent(year, month);
    UI.toast('ボーナスを追加しました', 'success');
  }

  function populateYearMonth(yearSel, monthSel, now) {
    yearSel.innerHTML = '';
    for (let y = now.getFullYear(); y >= now.getFullYear() - 2; y--) {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y + '年';
      if (y === now.getFullYear()) opt.selected = true;
      yearSel.appendChild(opt);
    }
    monthSel.innerHTML = '';
    for (let m = 1; m <= 12; m++) {
      const opt = document.createElement('option');
      opt.value = m; opt.textContent = m + '月';
      if (m === now.getMonth() + 1) opt.selected = true;
      monthSel.appendChild(opt);
    }
  }

  function formatHoursMin(minutes) {
    if (!minutes) return '0:00';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}:${String(m).padStart(2,'0')}`;
  }

  return { render, calcMonthSalary, calcDeviationBonus, formatHoursMin, populateYearMonth };
})();