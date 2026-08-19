/**
 * App — アプリケーション起動・ページ切り替え・ダッシュボード
 */
const App = (() => {
	let clockTimer = null;

	function init() {
		DB.Regulations.initialize();
		bindNavigation();
		bindDashboardActions();
		bindModalActions();

		AttendanceModule.updateNavStatus();
		renderSettings();
		refreshDashboard();
		startClock();

		AttendanceModule.checkUnconfirmedSession();
	}

	function bindNavigation() {
		document.querySelectorAll('.nav-btn').forEach(button => {
			button.addEventListener('click', () => showPage(button.dataset.page));
		});
	}

	function showPage(pageName) {
		document.querySelectorAll('.nav-btn').forEach(button => {
			button.classList.toggle('active', button.dataset.page === pageName);
		});
		document.querySelectorAll('.page').forEach(page => {
			page.classList.toggle('active', page.id === `page-${pageName}`);
			page.classList.toggle('hidden', page.id !== `page-${pageName}`);
		});

		const renderers = {
			attendance: AttendanceModule.render,
			schedule: ScheduleModule.render,
			'work-blocks': WorkBlocksModule.render,
			salary: SalaryModule.render,
			evaluation: EvaluationModule.render,
			regulations: RegulationsModule.render,
		};
		if (renderers[pageName]) renderers[pageName]();
		if (pageName === 'settings') renderSettings();
	}

	function bindDashboardActions() {
		document.getElementById('btn-clockin').addEventListener('click', AttendanceModule.clockIn);
		document.getElementById('btn-clockout').addEventListener('click', AttendanceModule.clockOut);
	}

	function bindModalActions() {
		document.getElementById('modal-close').addEventListener('click', Modal.hide);
		document.getElementById('modal-overlay').addEventListener('click', event => {
			if (event.target.id === 'modal-overlay') Modal.hide();
		});
		document.addEventListener('keydown', event => {
			if (event.key === 'Escape') Modal.hide();
		});
	}

	function startClock() {
		updateClock();
		clockTimer = window.setInterval(updateClock, 1000);
	}

	function updateClock() {
		const now = new Date();
		document.getElementById('live-clock').textContent = AttendanceModule.toTimeStr(now);
		document.getElementById('today-date').textContent = now.toLocaleDateString('ja-JP', {
			year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
		});

		const session = DB.CurrentSession.get();
		if (session) {
			const elapsed = Math.max(0, Math.round((now.getTime() - session.clockInTime) / 1000));
			document.getElementById('elapsed-time').textContent = formatClockDuration(elapsed);
		}
	}

	function refreshDashboard() {
		const now = new Date();
		const today = AttendanceModule.toDateStr(now);
		const session = DB.CurrentSession.get();
		const todayAttendance = DB.Attendance.getByDate(today);

		document.getElementById('clock-actions').classList.toggle('hidden', Boolean(session));
		document.getElementById('work-status').classList.toggle('hidden', !session);
		if (session) {
			document.getElementById('clockin-time').textContent = session.clockInDisplay;
			document.getElementById('plan-status').textContent = session.planSubmitted ? '入力済み' : '未入力';
		}

		renderTodaySchedule(today);
		renderMonthSummary(now.getFullYear(), now.getMonth() + 1);
		renderRecentAttendance();
		AttendanceModule.updateNavStatus();
		updateClock();

		if (todayAttendance?.status === 'pending_reflection') {
			document.getElementById('plan-status').textContent = '振り返り待ち';
		}
	}

	function renderTodaySchedule(dateStr) {
		const schedules = DB.Schedules.getForDate(dateStr);
		const content = document.getElementById('today-schedule-content');
		if (schedules.length === 0) {
			content.innerHTML = '<p class="text-muted">予定なし</p>';
			return;
		}
		content.innerHTML = schedules.map(schedule => `
			<div class="forecast-row">
				<span>${schedule.name || (schedule.type === 'regular' ? '通常勤務' : '特別勤務')}</span>
				<span class="mono">${schedule.startTime} 〜 ${schedule.endTime}</span>
			</div>
		`).join('');
	}

	function renderMonthSummary(year, month) {
		const data = SalaryModule.calcMonthSalary(year, month);
		const attendances = DB.Attendance.getByMonth(year, month);
		const workMinutes = attendances.reduce((sum, attendance) => sum + (attendance.workMinutes || 0), 0);
		const evalLogs = DB.EvalLogs.getByMonth(year, month);
		const reg = DB.Regulations.getCurrentReg();
		const points = Math.max(0, Math.min(200, reg.evalStartPoints + evalLogs.reduce((sum, log) => sum + log.delta, 0)));

		document.getElementById('month-label').textContent = `${year}年${month}月のサマリー`;
		document.getElementById('month-work-days').textContent = attendances.length;
		document.getElementById('month-work-hours').textContent = `${(workMinutes / 60).toFixed(1)}h`;
		document.getElementById('month-salary-est').textContent = `¥${data.forecast.forecastTotal.toLocaleString()}`;
		document.getElementById('month-eval-pts').textContent = `${points}pt`;
		document.getElementById('fc-base').textContent = `¥${data.forecast.forecastBase.toLocaleString()}`;
		document.getElementById('fc-overtime').textContent = `¥${data.forecast.forecastOvertime.toLocaleString()}`;
		document.getElementById('fc-eval').textContent = `¥${data.forecast.forecastEvalReward.toLocaleString()}`;
		document.getElementById('fc-total').textContent = `¥${data.forecast.forecastTotal.toLocaleString()}`;
	}

	function renderRecentAttendance() {
		const records = DB.Attendance.getAll().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
		const body = document.getElementById('recent-attendance-body');
		if (records.length === 0) {
			body.innerHTML = '<tr><td colspan="7" class="text-center text-muted">記録なし</td></tr>';
			return;
		}
		body.innerHTML = records.map(attendance => `
			<tr>
				<td>${attendance.date}</td>
				<td class="mono">${attendance.clockInDisplay || '-'}</td>
				<td class="mono">${attendance.clockOutDisplay || '-'}</td>
				<td class="mono">${attendance.workMinutes ? SalaryModule.formatHoursMin(attendance.workMinutes) : '-'}</td>
				<td class="mono">${attendance.overtimeMinutes ? SalaryModule.formatHoursMin(attendance.overtimeMinutes) : '-'}</td>
				<td>${attendance.selfEval ? `★${attendance.selfEval}` : '-'}</td>
				<td>${statusBadge(attendance.status)}</td>
			</tr>
		`).join('');
	}

	function statusBadge(status) {
		const labels = {
			confirmed: ['確定', 'success'],
			pending_reflection: ['要振り返り', 'warning'],
			active: ['勤務中', 'info'],
		};
		const [label, type] = labels[status] || ['未確定', 'dim'];
		return `<span class="badge badge-${type}">${label}</span>`;
	}

	function renderSettings() {
		const profile = DB.Profile.get();
		document.getElementById('settings-content').innerHTML = `
			<div class="card">
				<div class="card-label">プロフィール</div>
				<div class="form-group">
					<label>名前</label>
					<input class="input-field" id="profile-name" value="${profile.name || ''}">
				</div>
				<div class="form-group">
					<label>基本時給（円）</label>
					<input type="number" class="input-field" id="profile-hourly-rate" min="0" value="${profile.hourlyRate || 0}">
				</div>
				<button class="btn btn-primary" id="save-profile-btn">保存</button>
			</div>
			<div class="card mt-1">
				<div class="card-label">データ管理</div>
				<button class="btn btn-secondary" id="export-data-btn">データを書き出す</button>
				<button class="btn btn-secondary" id="import-data-btn">データを読み込む</button>
				<input type="file" id="import-data-file" accept="application/json" class="hidden">
			</div>
		`;

		document.getElementById('save-profile-btn').addEventListener('click', () => {
			DB.Profile.set({ ...profile, name: document.getElementById('profile-name').value.trim(), hourlyRate: parseInt(document.getElementById('profile-hourly-rate').value) || 0 });
			refreshDashboard();
			UI.toast('プロフィールを保存しました', 'success');
		});
		document.getElementById('export-data-btn').addEventListener('click', exportData);
		document.getElementById('import-data-btn').addEventListener('click', () => document.getElementById('import-data-file').click());
		document.getElementById('import-data-file').addEventListener('change', importData);
	}

	function exportData() {
		const blob = new Blob([DB.Backup.export()], { type: 'application/json' });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = `virtualwork-backup-${AttendanceModule.toDateStr(new Date())}.json`;
		link.click();
		URL.revokeObjectURL(link.href);
	}

	function importData(event) {
		const file = event.target.files[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			try {
				DB.Backup.import(reader.result);
				UI.toast('データを読み込みました。画面を更新します', 'success');
				window.setTimeout(() => window.location.reload(), 500);
			} catch {
				UI.toast('データの読み込みに失敗しました', 'danger');
			}
		};
		reader.readAsText(file);
	}

	function formatClockDuration(totalSeconds) {
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;
		return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}

	return { init, showPage, refreshDashboard };
})();

document.addEventListener('DOMContentLoaded', App.init);
