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
    const expenses = DB.Wallet.getExpenses().filter(expense => expense.date.startsWith(`${year}-${String(month).padStart(2, '0')}`));

    document.getElementById('salary-content').innerHTML = `
      <div class="salary-layout">
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
            <div class="payslip-row"><span>基本給与</span><span class="mono">${formatCurrency(data.confirmedBaseWage)}</span></div>
            <div class="payslip-row"><span>時間外報酬（${formatHoursMin(data.totalOvertimeMinutes)}）</span><span class="mono">${formatCurrency(data.confirmedOvertimeWage)}</span></div>
            <div class="payslip-row"><span>評価報酬（${data.evalPoints}pt → ${Math.round(data.evalPoints)}%）</span><span class="mono">${formatCurrency(data.evalReward)}</span></div>
            ${bonusEvents.map(b => `
              <div class="payslip-row"><span>${b.name}</span><span class="mono text-success">+${formatCurrency(b.amount || 0)}</span></div>
            `).join('')}
          </div>
          <div class="payslip-total">
            <span>総支給額</span>
            <span>${formatCurrency(data.totalConfirmed)}</span>
          </div>
        </div>
        <div>
          <div class="card">
            <div class="card-label">給与予測（月全体）</div>
            <div class="forecast-row"><span>予定勤務時間</span><span>${formatHoursMin(data.forecast.forecastWorkMinutes)}</span></div>
            <div class="forecast-row"><span>予定時間外</span><span>${formatHoursMin(data.forecast.forecastOvertimeMinutes)}</span></div>
            <div class="forecast-row"><span>基本給与予想</span><span class="mono">${formatCurrency(data.forecast.forecastBase)}</span></div>
            <div class="forecast-row"><span>時間外報酬予想</span><span class="mono">${formatCurrency(data.forecast.forecastOvertime)}</span></div>
            <div class="forecast-row"><span>評価報酬予想</span><span class="mono">${formatCurrency(data.forecast.forecastEvalReward)}</span></div>
            <div class="forecast-row forecast-total"><span>予想総支給</span><span class="mono">${formatCurrency(data.forecast.forecastTotal)}</span></div>
          </div>
          <div class="card mt-1">
            <div class="card-label">成果ボーナス履歴</div>
            ${bonusEvents.length === 0
              ? '<p class="text-muted">今月のボーナスなし</p>'
              : bonusEvents.map(b => `
                <div class="payslip-row">
                  <span>${b.name}<br><span class="text-muted" style="font-size:11px">${b.date} / 偏差値${b.deviation || '-'}</span></span>
                  <span class="mono text-success">+${formatCurrency(b.amount || 0)}</span>
                </div>
              `).join('')
            }
            <div style="margin-top:12px">
              <button class="btn btn-secondary btn-sm" id="add-bonus-btn">＋ ボーナスを追加</button>
            </div>
          </div>
          <div class="card mt-1">
            <div class="card-label">手持ち通貨</div>
            <div class="payslip-total" style="margin-top:0">
              <span>現在の残高</span>
              <span>${formatCurrency(getWalletBalance())}</span>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
              <button class="btn btn-danger btn-sm" id="add-expense-btn">− 支出を登録</button>
            </div>
          </div>
          <div class="card mt-1">
            <div class="card-label">${monthLabel}の収支履歴</div>
            ${renderWalletHistory(year, month, data, expenses)}
          </div>
          ${renderPurchasedLeaveSection(year, month)}
        </div>
      </div>
    `;

    document.getElementById('add-bonus-btn')?.addEventListener('click', () => showAddBonus(year, month));
    document.getElementById('add-expense-btn')?.addEventListener('click', () => showAddExpense(year, month));
    document.querySelectorAll('[data-remove-expense]').forEach(button => {
      button.addEventListener('click', () => removeExpense(button.dataset.removeExpense, year, month));
    });
    document.getElementById('buy-leave-btn')?.addEventListener('click', () => showBuyLeaveModal(year, month));
    document.getElementById('apply-leave-btn')?.addEventListener('click', showLeaveApplicationModal);
    document.getElementById('set-paid-leave-btn')?.addEventListener('click', showPaidLeaveModal);
  }

  function getWalletBalance() {
    const earned = getEarnedTotal();
    const spent = DB.Wallet.getExpenses().reduce((total, expense) => total + (expense.amount || 0), 0);
    return earned - spent;
  }

  function getEarnedTotal() {
    const confirmed = DB.Attendance.getAll().filter(attendance => attendance.status === 'confirmed');
    const earnedFromAttendance = confirmed.reduce((total, attendance) => {
      const reg = DB.Regulations.getRegAt(attendance.clockInTime || Date.now());
      const profile = DB.Profile.get();
      return total + calcBaseWage(attendance.workMinutes || 0, profile.hourlyRate || 100)
        + calcBaseWage(attendance.overtimeMinutes || 0, (profile.hourlyRate || 100) * reg.overtimeRate);
    }, 0);
    const confirmedMonths = new Set(confirmed.map(attendance => attendance.date.slice(0, 7)));
    const earnedBonuses = DB.BonusEvents.getAll().reduce((total, bonus) => total + (bonus.amount || 0), 0);
    const earnedEvaluation = [...confirmedMonths].reduce((total, monthKey) => {
      const [year, month] = monthKey.split('-').map(Number);
      return total + calcMonthSalary(year, month).evalReward;
    }, 0);
    return earnedFromAttendance + earnedBonuses + earnedEvaluation;
  }

  function renderWalletHistory(year, month, salary, expenses) {
    const incomeRows = [];
    if (salary.confirmedBaseWage) incomeRows.push({ date: `${year}-${String(month).padStart(2, '0')}`, label: '基本給与', amount: salary.confirmedBaseWage });
    if (salary.confirmedOvertimeWage) incomeRows.push({ date: `${year}-${String(month).padStart(2, '0')}`, label: '時間外報酬', amount: salary.confirmedOvertimeWage });
    if (salary.evalReward && DB.Attendance.getByMonth(year, month).some(attendance => attendance.status === 'confirmed')) incomeRows.push({ date: `${year}-${String(month).padStart(2, '0')}`, label: '評価報酬', amount: salary.evalReward });
    salary.bonusTotal && DB.BonusEvents.getByMonth(year, month).forEach(bonus => incomeRows.push({ date: bonus.date, label: bonus.name, amount: bonus.amount || 0 }));
    const rows = [
      ...incomeRows.map(row => `<div class="payslip-row"><span>${row.date}<br><span class="text-muted">${row.label}</span></span><span class="mono text-success">+${formatCurrency(row.amount)}</span></div>`),
      ...expenses.map(expense => `<div class="payslip-row"><span>${expense.date}<br><span class="text-muted">${escapeHtml(expense.memo)} / ${escapeHtml(expense.purpose)}</span></span><span class="mono text-danger">−${formatCurrency(expense.amount)}</span>${expense.category === 'purchased_leave' ? '' : `<button class="btn btn-sm btn-ghost" data-remove-expense="${expense.id}">取消</button>`}</div>`),
    ];
    if (rows.length === 0) return '<p class="text-muted">この月の履歴はありません</p>';
    return rows.join('');
  }

  function showAddExpense(year, month) {
    const today = new Date();
    const defaultDate = `${year}-${String(month).padStart(2, '0')}-${String(Math.min(today.getDate(), new Date(year, month, 0).getDate())).padStart(2, '0')}`;
    Modal.show('支出を登録', `
      <div class="form-group"><label>用途</label><input class="input-field" id="expense-purpose" placeholder="例: ゲーム"></div>
      <div class="form-group"><label>金額（C）</label><input type="text" inputmode="numeric" class="input-field" id="expense-amount" placeholder="例: 3,000"></div>
      <div class="form-group"><label>日付</label><input type="date" class="input-field" id="expense-date" value="${defaultDate}"></div>
      <div class="form-group"><label>メモ</label><textarea class="textarea-field" id="expense-memo" rows="2" placeholder="例: 誕生日に購入"></textarea></div>
    `, [
      { text: 'キャンセル', cls: 'btn-secondary', cb: Modal.hide },
      { text: '支出を登録', cls: 'btn-danger', cb: () => addExpense(year, month) },
    ]);
  }

  function addExpense(year, month) {
    const purpose = document.getElementById('expense-purpose').value.trim();
    const amount = parseInt(document.getElementById('expense-amount').value.replace(/,/g, ''), 10);
    const date = document.getElementById('expense-date').value;
    const memo = document.getElementById('expense-memo').value.trim();
    if (!purpose || !Number.isInteger(amount) || amount <= 0 || !date) {
      alert('用途、正しい金額、日付を入力してください');
      return;
    }
    if (amount > getWalletBalance()) {
      alert('手持ち残高を超える支出は登録できません');
      return;
    }
    DB.Wallet.addExpense({ purpose, amount, date, memo });
    Modal.hide();
    renderSalaryContent(year, month);
    App.refreshDashboard();
    UI.toast(`${formatCurrency(amount)} を支出しました`, 'success');
  }

  function removeExpense(id, year, month) {
    if (!confirm('この支出履歴を取り消しますか？')) return;
    DB.Wallet.removeExpense(id);
    renderSalaryContent(year, month);
    App.refreshDashboard();
    UI.toast('支出を取り消しました', 'success');
  }

  const PURCHASE_LEAVE_MULTIPLIER = 1.5;

  function getPurchasedLeaveBalance() {
    return DB.PurchasedLeave.getPurchases().reduce((total, purchase) => total + (purchase.remainingMinutes || 0), 0);
  }

  function getPurchaseLeaveRate(year, month) {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    return DB.PurchasedLeave.getMonthlyRate(monthKey) || {
      hourlyRate: DB.Profile.get().hourlyRate || 100,
      multiplier: PURCHASE_LEAVE_MULTIPLIER,
      monthKey,
      isPreview: true,
    };
  }

  function renderPurchasedLeaveSection(year, month) {
    const paidBalance = DB.PaidLeave.getBalance().minutes || 0;
    const purchasedBalance = getPurchasedLeaveBalance();
    const rate = getPurchaseLeaveRate(year, month);
    const purchases = DB.PurchasedLeave.getPurchases().sort((a, b) => b.createdAt - a.createdAt);
    const applications = DB.LeaveApplications.getAll().sort((a, b) => b.createdAt - a.createdAt);

    return `
      <div class="card mt-1">
        <div class="card-label">購入休暇</div>
        <div class="summary-grid">
          <div class="summary-item"><div class="summary-num">${purchasedBalance}分</div><div class="summary-label">購入休暇残高</div></div>
          <div class="summary-item"><div class="summary-num">${paidBalance}分</div><div class="summary-label">有給残高</div></div>
        </div>
        <div class="forecast-row"><span>${year}年${month}月の購入価格</span><span class="mono">${rate.hourlyRate} C/h × ${rate.multiplier}倍</span></div>
        <p class="form-hint" style="margin-top:8px">購入価格 = 基本時給 × 購入休暇倍率 ×（購入時間 ÷ 60）。月内の価格は初回購入時に固定されます。</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          <button class="btn btn-primary btn-sm" id="buy-leave-btn">＋ 購入休暇を購入</button>
          <button class="btn btn-secondary btn-sm" id="apply-leave-btn">休暇を申請</button>
          <button class="btn btn-ghost btn-sm" id="set-paid-leave-btn">有給残高を設定</button>
        </div>
      </div>
      <div class="card mt-1">
        <div class="card-label">購入履歴</div>
        ${purchases.length === 0 ? '<p class="text-muted">購入履歴はありません</p>' : purchases.map(purchase => `
          <div class="payslip-row">
            <span>${new Date(purchase.purchasedAt || purchase.createdAt).toLocaleString('ja-JP')}<br><span class="text-muted">${purchase.minutes}分購入 / 残り${purchase.remainingMinutes}分</span></span>
            <span class="mono text-danger">−${formatCurrency(purchase.amount)}</span>
          </div>
          <div class="text-muted" style="font-size:11px;margin:-4px 0 8px">時給${purchase.hourlyRate} C / 倍率${purchase.multiplier}倍</div>
        `).join('')}
      </div>
      <div class="card mt-1">
        <div class="card-label">休暇申請履歴</div>
        ${applications.length === 0 ? '<p class="text-muted">申請履歴はありません</p>' : applications.map(application => `
          <div class="payslip-row">
            <span>${application.date} / ${application.requestedMinutes}分<br><span class="text-muted">${application.priority === 'paid_first' ? '有給を優先' : '購入休暇を優先'} / 有給${application.paidLeaveMinutes}分 / 購入休暇${application.purchasedLeaveMinutes}分</span></span>
            <span class="badge badge-success">申請済み</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  function showBuyLeaveModal(year, month) {
    const rate = getPurchaseLeaveRate(year, month);
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    Modal.show('購入休暇を購入', `
      <p class="text-muted" style="font-size:12px;margin-bottom:14px">${monthKey}の価格: ${rate.hourlyRate} C/h × ${rate.multiplier}倍</p>
      <div class="form-group"><label>購入時間（分）</label><input type="text" inputmode="numeric" class="input-field" id="buy-leave-minutes" placeholder="例: 30"></div>
      <div class="forecast-row"><span>支払額</span><strong id="buy-leave-cost">0 C</strong></div>
    `, [
      { text: 'キャンセル', cls: 'btn-secondary', cb: Modal.hide },
      { text: '購入する', cls: 'btn-primary', cb: () => buyLeave(year, month) },
    ]);
    document.getElementById('buy-leave-minutes').addEventListener('input', event => {
      const minutes = parseInt(event.target.value.replace(/,/g, ''), 10) || 0;
      document.getElementById('buy-leave-cost').textContent = formatCurrency(calculateLeavePrice(minutes, rate));
    });
  }

  function calculateLeavePrice(minutes, rate) {
    return Math.floor(rate.hourlyRate * rate.multiplier * (minutes / 60));
  }

  function buyLeave(year, month) {
    const minutes = parseInt(document.getElementById('buy-leave-minutes').value.replace(/,/g, ''), 10);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      alert('購入時間を1分以上の整数で入力してください');
      return;
    }
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const currentRate = getPurchaseLeaveRate(year, month);
    const rate = DB.PurchasedLeave.saveMonthlyRate(monthKey, {
      hourlyRate: currentRate.hourlyRate,
      multiplier: currentRate.multiplier,
      monthKey,
    });
    const amount = calculateLeavePrice(minutes, rate);
    if (amount > SalaryModule.getWalletBalance()) {
      alert('手持ち通貨が不足しています');
      return;
    }
    const purchase = DB.PurchasedLeave.addPurchase({
      minutes,
      remainingMinutes: minutes,
      amount,
      hourlyRate: rate.hourlyRate,
      multiplier: rate.multiplier,
      monthKey,
      purchasedAt: Date.now(),
    });
    DB.Wallet.addExpense({
      purpose: '購入休暇',
      amount,
      date: new Date().toISOString().slice(0, 10),
      memo: `${minutes}分の購入休暇`,
      category: 'purchased_leave',
      leavePurchaseId: purchase.id,
    });
    Modal.hide();
    renderSalaryContent(year, month);
    App.refreshDashboard();
    UI.toast(`${minutes}分の購入休暇を購入しました`, 'success');
  }

  function showPaidLeaveModal() {
    const current = DB.PaidLeave.getBalance().minutes || 0;
    Modal.show('有給残高を設定', `
      <p class="text-muted" style="font-size:12px;margin-bottom:14px">有給は購入休暇とは別の残高です。分単位で設定します。</p>
      <div class="form-group"><label>有給残高（分）</label><input type="number" min="0" step="1" class="input-field" id="paid-leave-balance" value="${current}"></div>
    `, [
      { text: 'キャンセル', cls: 'btn-secondary', cb: Modal.hide },
      { text: '保存', cls: 'btn-primary', cb: () => savePaidLeave() },
    ]);
  }

  function savePaidLeave() {
    const minutes = parseInt(document.getElementById('paid-leave-balance').value, 10);
    if (!Number.isInteger(minutes) || minutes < 0) { alert('0以上の整数を入力してください'); return; }
    DB.PaidLeave.setBalance(minutes);
    Modal.hide();
    render();
    UI.toast('有給残高を更新しました', 'success');
  }

  function showLeaveApplicationModal() {
    const purchasedBalance = getPurchasedLeaveBalance();
    const paidBalance = DB.PaidLeave.getBalance().minutes || 0;
    Modal.show('休暇を申請', `
      <div class="form-group"><label>休暇時間（分）</label><input type="number" min="1" step="1" class="input-field" id="leave-request-minutes" placeholder="例: 90"></div>
      <div class="form-group"><label>使用する休暇の優先順位</label><select class="select-input" id="leave-priority"><option value="paid_first">有給を優先</option><option value="purchased_first">購入休暇を優先</option></select></div>
      <div class="form-hint">有給残高: ${paidBalance}分 / 購入休暇残高: ${purchasedBalance}分</div>
    `, [
      { text: 'キャンセル', cls: 'btn-secondary', cb: Modal.hide },
      { text: '申請を確定', cls: 'btn-primary', cb: saveLeaveApplication },
    ]);
  }

  function saveLeaveApplication() {
    const requestedMinutes = parseInt(document.getElementById('leave-request-minutes').value, 10);
    const priority = document.getElementById('leave-priority').value;
    const paidBalance = DB.PaidLeave.getBalance().minutes || 0;
    const purchasedBalance = getPurchasedLeaveBalance();
    if (!Number.isInteger(requestedMinutes) || requestedMinutes <= 0) { alert('休暇時間を1分以上で入力してください'); return; }
    if (requestedMinutes > paidBalance + purchasedBalance) { alert('有給と購入休暇を合わせても残高が不足しています'); return; }

    const paidLeaveMinutes = priority === 'paid_first'
      ? Math.min(requestedMinutes, paidBalance)
      : Math.min(Math.max(0, requestedMinutes - purchasedBalance), paidBalance);
    const purchasedLeaveMinutes = requestedMinutes - paidLeaveMinutes;
    consumePurchasedLeave(purchasedLeaveMinutes);
    DB.PaidLeave.setBalance(paidBalance - paidLeaveMinutes);
    DB.LeaveApplications.add({
      date: new Date().toISOString().slice(0, 10),
      requestedMinutes,
      priority,
      paidLeaveMinutes,
      purchasedLeaveMinutes,
    });
    Modal.hide();
    render();
    UI.toast(`${requestedMinutes}分の休暇を申請しました`, 'success');
  }

  function consumePurchasedLeave(minutes) {
    if (minutes <= 0) return;
    const purchases = DB.PurchasedLeave.getPurchases().sort((a, b) => a.createdAt - b.createdAt);
    let remaining = minutes;
    purchases.forEach(purchase => {
      if (remaining <= 0) return;
      const used = Math.min(purchase.remainingMinutes || 0, remaining);
      purchase.remainingMinutes -= used;
      remaining -= used;
    });
    DB.PurchasedLeave.savePurchases(purchases);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function formatCurrency(amount) {
    return `${amount.toLocaleString()} C`;
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

  return { render, calcMonthSalary, calcDeviationBonus, formatHoursMin, populateYearMonth, getWalletBalance };
})();