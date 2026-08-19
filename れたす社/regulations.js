/**
 * Regulations UI & Logic
 */
const RegulationsModule = (() => {

  function render() {
    const reg = DB.Regulations.getCurrentReg();
    const ver = DB.Regulations.getCurrentVersion();

    document.getElementById('reg-version-badge').textContent = `Ver.${ver}`;

    const content = document.getElementById('regulations-content');
    content.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="card">
          <div class="reg-section">
            <div class="reg-section-title">基本設定</div>
            <div class="reg-field"><label>時間外報酬倍率</label><span class="reg-field-val">${reg.overtimeRate}倍</span></div>
            <div class="reg-field"><label>評価報酬基準額</label><span class="reg-field-val">¥${reg.evalRewardBase}</span></div>
            <div class="reg-field"><label>月初評価ポイント</label><span class="reg-field-val">${reg.evalStartPoints}pt</span></div>
          </div>
          <div class="reg-section">
            <div class="reg-section-title">評価ポイント変動</div>
            <div class="reg-field"><label>無断遅刻</label><span class="reg-field-val text-danger">-${reg.lateDeduction}pt</span></div>
            <div class="reg-field"><label>無断欠勤</label><span class="reg-field-val text-danger">-${reg.absentDeduction}pt</span></div>
            <div class="reg-field"><label>良い成果</label><span class="reg-field-val text-success">+${reg.goodWorkBonus}pt</span></div>
            <div class="reg-field"><label>目標達成</label><span class="reg-field-val text-success">+${reg.goalAchieveBonus}pt</span></div>
            <div class="reg-field"><label>高品質業務</label><span class="reg-field-val text-success">+${reg.highQualityBonus}pt</span></div>
          </div>
        </div>
        <div class="card">
          <div class="reg-section">
            <div class="reg-section-title">偏差値ボーナステーブル</div>
            <table class="data-table">
              <thead><tr><th>偏差値</th><th>ボーナス倍率</th><th>例（時給100円の場合）</th></tr></thead>
              <tbody>
                ${reg.deviationBonusTable.map(row => `
                  <tr>
                    <td class="mono">${row.deviation}</td>
                    <td class="mono">${row.multiplier}倍</td>
                    <td class="mono text-success">+¥${Math.round(100 * row.multiplier)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="reg-section">
            <div class="reg-section-title">昇級条件</div>
            <div class="reg-field"><label>必要累計勤務時間</label><span class="reg-field-val">${reg.rankUpConditions.minTotalHours}時間以上</span></div>
            <div class="reg-field"><label>必要評価ポイント</label><span class="reg-field-val">${reg.rankUpConditions.minEvalPoints}pt以上</span></div>
            <div class="reg-field"><label>ゴールド免許必須</label><span class="reg-field-val">${reg.rankUpConditions.goldLicenseRequired ? '必須' : '不要'}</span></div>
          </div>
          <div class="reg-section">
            <div class="reg-section-title">ゴールド免許条件</div>
            <div class="reg-field"><label>無断遅刻なし</label><span class="reg-field-val">${reg.goldLicenseConditions.noUnauthorizedLate ? '必須' : '不要'}</span></div>
            <div class="reg-field"><label>無断欠勤なし</label><span class="reg-field-val">${reg.goldLicenseConditions.noUnauthorizedAbsent ? '必須' : '不要'}</span></div>
            <div class="reg-field"><label>無断早退なし</label><span class="reg-field-val">${reg.goldLicenseConditions.noUnauthorizedEarlyLeave ? '必須' : '不要'}</span></div>
          </div>
        </div>
      </div>
      <div class="card mt-1">
        <div class="card-label">有給管理</div>
        <div class="reg-field" style="max-width:400px">
          <label>付与日数（四半期あたり）</label>
          <span class="reg-field-val">${reg.paidLeavePerQuarter}日分</span>
        </div>
        <p style="font-size:12px;color:var(--text-sub);margin-top:8px">
          有給は分単位で管理されます。その人の1日の所定勤務時間 × 付与日数 = 付与分数として計算されます。
        </p>
      </div>
      <div class="card mt-1">
        <div class="card-label">バージョン履歴</div>
        ${renderVersionHistory()}
      </div>
      <div style="margin-top:16px;text-align:right">
        <button class="btn btn-primary" id="edit-reg-btn">規程を変更する</button>
      </div>
    `;

    document.getElementById('edit-reg-btn').addEventListener('click', showEditModal);
  }

  function renderVersionHistory() {
    const ver = DB.Regulations.getCurrentVersion();
    const rows = [];
    for (let v = ver; v >= 1; v--) {
      const reg = DB.Regulations.getVersion(v);
      if (reg) {
        rows.push(`
          <div class="reg-field">
            <span>Ver.${v}</span>
            <span class="text-muted">${new Date(reg.appliedAt).toLocaleString('ja-JP')}</span>
            ${v === ver ? '<span class="badge badge-info">現在</span>' : ''}
          </div>
        `);
      }
    }
    return rows.join('') || '<p class="text-muted">履歴なし</p>';
  }

  function showEditModal() {
    const reg = DB.Regulations.getCurrentReg();
    Modal.show('会社規程の変更', `
      <p style="font-size:12px;color:var(--warning);margin-bottom:16px">
        ⚠ 変更後は新バージョンとして保存されます。過去の確定データには影響しません。
      </p>
      <div class="form-group">
        <label>時間外報酬倍率</label>
        <input type="number" class="input-field" id="reg-overtime-rate" value="${reg.overtimeRate}" step="0.05" min="1">
      </div>
      <div class="form-group">
        <label>評価報酬基準額（円）</label>
        <input type="number" class="input-field" id="reg-eval-reward" value="${reg.evalRewardBase}" min="0">
      </div>
      <div class="form-group">
        <label>月初評価ポイント</label>
        <input type="number" class="input-field" id="reg-eval-start" value="${reg.evalStartPoints}" min="0">
      </div>
      <div class="form-group">
        <label>無断遅刻 減点</label>
        <input type="number" class="input-field" id="reg-late-ded" value="${reg.lateDeduction}" min="0">
      </div>
      <div class="form-group">
        <label>無断欠勤 減点</label>
        <input type="number" class="input-field" id="reg-absent-ded" value="${reg.absentDeduction}" min="0">
      </div>
    `, [
      { text: 'キャンセル', cls: 'btn-secondary', cb: Modal.hide },
      { text: '保存（新バージョンとして）', cls: 'btn-primary', cb: saveRegulations }
    ]);
  }

  function saveRegulations() {
    const reg = DB.Regulations.getCurrentReg();
    const newReg = {
      ...reg,
      overtimeRate:   parseFloat(document.getElementById('reg-overtime-rate').value) || reg.overtimeRate,
      evalRewardBase: parseInt(document.getElementById('reg-eval-reward').value) || reg.evalRewardBase,
      evalStartPoints:parseInt(document.getElementById('reg-eval-start').value) || reg.evalStartPoints,
      lateDeduction:  parseInt(document.getElementById('reg-late-ded').value) || reg.lateDeduction,
      absentDeduction:parseInt(document.getElementById('reg-absent-ded').value) || reg.absentDeduction,
    };
    DB.Regulations.save(newReg);
    Modal.hide();
    render();
    UI.toast('規程を更新しました（' + 'Ver.' + DB.Regulations.getCurrentVersion() + '）', 'success');
  }

  return { render };
})();