/**
 * DB — localStorageラッパー
 * キー構造:
 *   vw_profile          : プロフィール設定
 *   vw_regulations_v{n} : 規程バージョン
 *   vw_reg_current      : 現在の規程バージョン番号
 *   vw_schedules        : 勤務予定リスト
 *   vw_attendance       : 勤怠記録リスト
 *   vw_work_blocks      : 業務ブロックリスト
 *   vw_eval_logs        : 評価ポイントログ
 *   vw_eval_monthly     : 月別評価ポイント確定値
 *   vw_salary_monthly   : 月別給与確定
 *   vw_bonus_events     : 成果ボーナスイベント
 *   vw_current_session  : 現在の勤務セッション
 */

const DB = (() => {
  const PREFIX = 'vw_';

  function get(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function set(key, val) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(val));
      return true;
    } catch { return false; }
  }

  function remove(key) {
    localStorage.removeItem(PREFIX + key);
  }

  // ---- プロフィール ----
  const Profile = {
    get() {
      return get('profile') || {
        name: '',
        hourlyRate: 100,       // 基本時給（円）
        createdAt: Date.now(),
      };
    },
    set(data) { set('profile', data); }
  };

  // ---- 規程 ----
  const Regulations = {
    getCurrentVersion() {
      return get('reg_current') || 1;
    },
    setCurrentVersion(v) { set('reg_current', v); },

    getVersion(v) {
      return get(`regulations_v${v}`);
    },

    getCurrentReg() {
      const v = this.getCurrentVersion();
      return this.getVersion(v) || this._defaultReg(v);
    },

    _defaultReg(version) {
      return {
        version,
        appliedAt: Date.now(),
        overtimeRate: 1.25,       // 時間外倍率
        evalRewardBase: 100,       // 評価報酬基準（円）
        evalStartPoints: 100,      // 月初評価ポイント
        lateDeduction: 5,          // 無断遅刻 減点
        absentDeduction: 20,       // 無断欠勤 減点
        goodWorkBonus: 5,          // 良い成果 加点
        goalAchieveBonus: 3,       // 目標達成 加点
        highQualityBonus: 5,       // 高品質業務 加点
        deviationBonusTable: [     // 偏差値ボーナステーブル
          { deviation: 55, multiplier: 0.3 },
          { deviation: 60, multiplier: 0.8 },
          { deviation: 65, multiplier: 1.2 },
          { deviation: 70, multiplier: 2.0 },
        ],
        rankUpConditions: {
          minTotalHours: 100,
          minEvalPoints: 90,
          goldLicenseRequired: true,
        },
        goldLicenseConditions: {
          noUnauthorizedLate: true,
          noUnauthorizedAbsent: true,
          noUnauthorizedEarlyLeave: true,
        },
        paidLeavePerQuarter: 3, // 四半期あたり有給付与日数
      };
    },

    save(regData) {
      const current = this.getCurrentVersion();
      const newVersion = current + 1;
      const newReg = { ...regData, version: newVersion, appliedAt: Date.now() };
      set(`regulations_v${newVersion}`, newReg);
      set('reg_current', newVersion);
      return newVersion;
    },

    initialize() {
      if (!this.getVersion(1)) {
        set('regulations_v1', this._defaultReg(1));
        set('reg_current', 1);
      }
    },

    // 指定日時点の規程を取得
    getRegAt(timestamp) {
      const currentV = this.getCurrentVersion();
      for (let v = currentV; v >= 1; v--) {
        const reg = this.getVersion(v);
        if (reg && reg.appliedAt <= timestamp) return reg;
      }
      return this.getVersion(1) || this._defaultReg(1);
    }
  };

  // ---- 勤務予定 ----
  const Schedules = {
    getAll() { return get('schedules') || []; },
    save(list) { set('schedules', list); },

    add(schedule) {
      const list = this.getAll();
      schedule.id = `sch_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
      schedule.createdAt = Date.now();
      list.push(schedule);
      this.save(list);
      return schedule;
    },

    update(id, data) {
      const list = this.getAll();
      const idx = list.findIndex(s => s.id === id);
      if (idx >= 0) { list[idx] = { ...list[idx], ...data }; this.save(list); }
    },

    remove(id) {
      this.save(this.getAll().filter(s => s.id !== id));
    },

    // 指定日の予定を取得 (date: 'YYYY-MM-DD')
    getForDate(dateStr) {
      const d = new Date(dateStr);
      const dayOfWeek = d.getDay(); // 0=日, 1=月 ... 6=土
      const all = this.getAll();
      return all.filter(s => {
        if (s.type === 'regular') {
          return s.days && s.days.includes(dayOfWeek);
        } else if (s.type === 'special') {
          return s.date === dateStr;
        }
        return false;
      });
    }
  };

  // ---- 勤怠記録 ----
  const Attendance = {
    getAll() { return get('attendance') || []; },
    save(list) { set('attendance', list); },

    getById(id) { return this.getAll().find(a => a.id === id) || null; },

    getByDate(dateStr) {
      return this.getAll().find(a => a.date === dateStr) || null;
    },

    getByMonth(year, month) {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      return this.getAll().filter(a => a.date.startsWith(prefix));
    },

    add(record) {
      const list = this.getAll();
      record.id = `att_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
      list.push(record);
      this.save(list);
      return record;
    },

    update(id, data) {
      const list = this.getAll();
      const idx = list.findIndex(a => a.id === id);
      if (idx >= 0) { list[idx] = { ...list[idx], ...data }; this.save(list); return list[idx]; }
      return null;
    },

    remove(id) {
      this.save(this.getAll().filter(a => a.id !== id));
    }
  };

  // ---- 業務ブロック ----
  const WorkBlocks = {
    getAll() { return get('work_blocks') || []; },
    save(list) { set('work_blocks', list); },

    getById(id) { return this.getAll().find(b => b.id === id) || null; },

    getByAttendanceId(attId) {
      return this.getAll().filter(b => b.attendanceId === attId);
    },

    getByDate(dateStr) {
      return this.getAll().filter(b => b.date === dateStr);
    },

    add(block) {
      const list = this.getAll();
      block.id = `wb_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
      block.createdAt = Date.now();
      block.history = []; // 変更履歴
      list.push(block);
      this.save(list);
      return block;
    },

    update(id, data) {
      const list = this.getAll();
      const idx = list.findIndex(b => b.id === id);
      if (idx >= 0) {
        // 変更前の重要フィールドを履歴に保存
        const prev = { ...list[idx] };
        if (!list[idx].history) list[idx].history = [];
        list[idx].history.push({
          at: Date.now(),
          plannedStart: prev.plannedStart,
          plannedEnd: prev.plannedEnd,
          goal: prev.goal,
        });
        list[idx] = { ...list[idx], ...data };
        this.save(list);
        return list[idx];
      }
      return null;
    },

    remove(id) {
      this.save(this.getAll().filter(b => b.id !== id));
    }
  };

  // ---- 評価ログ ----
  const EvalLogs = {
    getAll() { return get('eval_logs') || []; },
    save(list) { set('eval_logs', list); },

    getByMonth(year, month) {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      return this.getAll().filter(e => e.date.startsWith(prefix));
    },

    add(log) {
      const list = this.getAll();
      log.id = `ev_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
      log.createdAt = Date.now();
      list.push(log);
      this.save(list);
      return log;
    }
  };

  // ---- 月別給与確定 ----
  const SalaryMonthly = {
    getAll() { return get('salary_monthly') || []; },
    save(list) { set('salary_monthly', list); },

    getByMonth(year, month) {
      return this.getAll().find(s => s.year === year && s.month === month) || null;
    },

    upsert(year, month, data) {
      const list = this.getAll();
      const idx = list.findIndex(s => s.year === year && s.month === month);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...data, year, month };
      } else {
        list.push({ ...data, year, month, id: `sal_${year}_${month}` });
      }
      this.save(list);
    }
  };

  // ---- ボーナスイベント ----
  const BonusEvents = {
    getAll() { return get('bonus_events') || []; },
    save(list) { set('bonus_events', list); },

    getByMonth(year, month) {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      return this.getAll().filter(b => b.date.startsWith(prefix));
    },

    add(event) {
      const list = this.getAll();
      event.id = `bon_${Date.now()}`;
      event.createdAt = Date.now();
      list.push(event);
      this.save(list);
      return event;
    }
  };

  // ---- 現在セッション ----
  const CurrentSession = {
    get() { return get('current_session'); },
    set(data) { set('current_session', data); },
    clear() { remove('current_session'); }
  };

  // ---- エクスポート/インポート ----
  const Backup = {
    export() {
      const keys = [
        'profile', 'reg_current', 'schedules', 'attendance',
        'work_blocks', 'eval_logs', 'salary_monthly', 'bonus_events'
      ];
      // 規程全バージョン
      const regVer = Regulations.getCurrentVersion();
      const data = { _version: '1.0', _exportedAt: Date.now() };
      keys.forEach(k => { data[k] = get(k); });
      for (let v = 1; v <= regVer; v++) {
        data[`regulations_v${v}`] = get(`regulations_v${v}`);
      }
      return JSON.stringify(data, null, 2);
    },

    import(jsonStr) {
      const data = JSON.parse(jsonStr);
      Object.keys(data).forEach(k => {
        if (!k.startsWith('_')) {
          set(k, data[k]);
        }
      });
    }
  };

  return {
    Profile, Regulations, Schedules, Attendance,
    WorkBlocks, EvalLogs, SalaryMonthly, BonusEvents,
    CurrentSession, Backup
  };
})();