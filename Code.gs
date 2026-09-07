// 一起撐下去 · Apps Script 後端
// 綁定在 Sheet 上執行，三個分頁全部 append-only：members / goals / checkins。
// 部署為網頁應用（以我身分執行、任何人可存取），前端用 GET 讀狀態、POST 寫入。

const FOLDER_ID = '1x7Gvp-lOITZZJSL7m6b4DBSaQYRBXUF5'; // 照片存放的 Drive 資料夾
const TZ = 'Asia/Taipei';
const WEEKS_BACK = 8; // 前端只顯示近 8 週

const HEADERS = {
  members: ['id', 'name', 'tag', 'initial'],
  goals: ['ts', 'member', 'from_week', 'habit', 'target', 'rule'],
  checkins: ['ts', 'member', 'week', 'type', 'minutes', 'note', 'photo_url'],
};

// ---------- HTTP ----------

function doGet() {
  try {
    return json_(Object.assign({ ok: true }, state_()));
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const body = JSON.parse(e.postData.contents);
    handle_(body);
    return json_(Object.assign({ ok: true }, state_()));
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- actions ----------

function handle_(b) {
  const now = new Date();
  const week = weekKey_(now);
  switch (b.action) {
    case 'checkin': {
      if (!b.photo) throw '照片是必附的';
      const url = savePhoto_(b.photo, b.member, now);
      append_('checkins', [now.toISOString(), b.member, week, 'done', b.minutes || '', b.note || '', url]);
      return;
    }
    case 'rest': {
      append_('checkins', [now.toISOString(), b.member, week, b.on ? 'rest' : 'unrest', '', '', '']);
      return;
    }
    case 'goal': {
      // 調低從下週生效、調高立刻生效：只差 from_week，不需要任何特例
      const cur = effectiveGoal_(rows_('goals'), b.member, week);
      const lowering = cur && Number(b.target) < Number(cur.target);
      const from = lowering ? addDays_(week, 7) : week;
      append_('goals', [now.toISOString(), b.member, from, b.habit, Number(b.target), b.rule]);
      return;
    }
    default:
      throw 'unknown action: ' + b.action;
  }
}

function savePhoto_(dataUrl, member, now) {
  const m = /^data:(image\/[\w+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw '照片格式不對';
  const name = member + '_' + Utilities.formatDate(now, TZ, 'yyyyMMdd_HHmmss') + '.jpg';
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], name);
  const file = DriveApp.getFolderById(FOLDER_ID).createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w800';
}

// ---------- state ----------

function state_() {
  const now = new Date();
  const thisWeek = weekKey_(now);
  const oldest = addDays_(thisWeek, -7 * (WEEKS_BACK - 1));
  return {
    today: Utilities.formatDate(now, TZ, 'yyyy-MM-dd'),
    thisWeek,
    members: rows_('members'),
    goals: rows_('goals'),
    checkins: rows_('checkins').filter(r => r.week >= oldest),
  };
}

// 該成員在某週生效的目標：from_week <= week 的最後一筆
function effectiveGoal_(goals, member, week) {
  let hit = null;
  for (const g of goals) {
    // Sheet 會把純數字 id 轉成 Number，兩邊都轉字串再比
    if (String(g.member) === String(member) && g.from_week <= week) hit = g;
  }
  return hit;
}

// ---------- sheet helpers ----------

function sheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(HEADERS[name]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function rows_(name) {
  const values = sheet_(name).getDataRange().getValues();
  const head = values.shift() || HEADERS[name];
  return values
    .filter(r => r.some(v => v !== ''))
    .map(r => {
      const o = {};
      head.forEach((h, i) => { o[h] = norm_(r[i]); });
      return o;
    });
}

// Sheet 會把 yyyy-MM-dd 自動轉成 Date，讀回來一律轉回字串
function norm_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return v;
}

function append_(name, row) {
  sheet_(name).appendRow(row);
}

// ---------- week math（台北時間、週一起算）----------

function weekKey_(d) {
  const y = Number(Utilities.formatDate(d, TZ, 'yyyy'));
  const m = Number(Utilities.formatDate(d, TZ, 'MM'));
  const day = Number(Utilities.formatDate(d, TZ, 'dd'));
  const dow = Number(Utilities.formatDate(d, TZ, 'u')); // 1 = 週一 … 7 = 週日
  const monday = new Date(Date.UTC(y, m - 1, day - (dow - 1)));
  return Utilities.formatDate(monday, 'UTC', 'yyyy-MM-dd');
}

function addDays_(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return Utilities.formatDate(new Date(Date.UTC(y, m - 1, d + n)), 'UTC', 'yyyy-MM-dd');
}

// ---------- 一次性設定與自我檢查（在編輯器手動執行）----------

// 建立三個分頁的表頭。第一次執行會跳出授權視窗，這是必要的。
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(TZ);
  Object.keys(HEADERS).forEach(sheet_);
  // 週次欄位設成純文字，Sheet 才不會把 yyyy-MM-dd 轉成日期
  sheet_('goals').getRange('C:C').setNumberFormat('@');
  sheet_('checkins').getRange('C:C').setNumberFormat('@');
  DriveApp.getFolderById(FOLDER_ID).getName(); // 順便確認資料夾權限
}

function selfTest() {
  const eq = (a, b, msg) => { if (a !== b) throw new Error(msg + ': ' + a + ' !== ' + b); };
  // 2026-09-06 是週日，週一是 2026-08-31
  eq(weekKey_(new Date('2026-09-06T12:00:00+08:00')), '2026-08-31', 'weekKey sunday');
  eq(weekKey_(new Date('2026-08-31T00:30:00+08:00')), '2026-08-31', 'weekKey monday early');
  eq(weekKey_(new Date('2026-08-30T23:30:00+08:00')), '2026-08-24', 'weekKey sunday late');
  eq(addDays_('2026-08-31', 7), '2026-09-07', 'addDays');
  const goals = [
    { member: 'a', from_week: '2026-08-24', target: 3 },
    { member: 'a', from_week: '2026-09-07', target: 2 }, // 調低，下週才生效
    { member: 'b', from_week: '2026-08-31', target: 4 },
  ];
  eq(effectiveGoal_(goals, 'a', '2026-08-31').target, 3, 'this week still 3');
  eq(effectiveGoal_(goals, 'a', '2026-09-07').target, 2, 'next week 2');
  eq(effectiveGoal_(goals, 'a', '2026-08-17'), null, 'before any goal');
  Logger.log('selfTest OK');
}
