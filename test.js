// 前端純邏輯自我檢查：node test.js。stub 掉 DOM 與 storage，跑 addDays / goalFor / weekStat
global.localStorage = { getItem: () => null, setItem() {} };
global.document = { querySelector: () => ({ addEventListener() {}, innerHTML: '' }), createElement: () => ({}) };
global.fetch = async () => ({ json: async () => ({ ok: true }) });
const src = require('fs').readFileSync(__dirname + '/index.html', 'utf8').replace(/^[\s\S]*?<script>/, '').replace(/<\/script>[\s\S]*$/, '')
  .replace("const API = '';", "const API = '';")
  .replace(/\(async function boot\(\)[\s\S]*$/, ''); // 不啟動
const fn = new Function(src + `
  S.data = { today: '2026-09-06', thisWeek: '2026-08-31', members: [{id:'a',name:'苡晴',tag:'我',initial:'晴'}],
    goals: [
      { member:'a', from_week:'2026-08-24', habit:'跑步', target:3, rule:'至少 30 分鐘' },
      { member:'a', from_week:'2026-09-07', habit:'跑步', target:2, rule:'至少 30 分鐘' },
    ],
    checkins: [
      { ts:'2026-08-31T10:00:00Z', member:'a', week:'2026-08-31', type:'done', minutes:30, note:'', photo_url:'' },
      { ts:'2026-09-02T10:00:00Z', member:'a', week:'2026-08-31', type:'done', minutes:'', note:'河濱', photo_url:'' },
      { ts:'2026-08-25T10:00:00Z', member:'a', week:'2026-08-24', type:'rest', minutes:'', note:'', photo_url:'' },
    ] };
  const eq = (x, y, m) => { if (JSON.stringify(x) !== JSON.stringify(y)) throw new Error(m + ': ' + JSON.stringify(x) + ' !== ' + JSON.stringify(y)); };
  eq(addDays('2026-08-31', 7), '2026-09-07', 'addDays');
  eq(addDays('2026-01-05', -7), '2025-12-29', 'addDays year wrap');
  eq(goalFor('a', '2026-08-31').target, 3, 'this week goal');
  eq(goalFor('a', '2026-09-07').target, 2, 'next week goal');
  eq(goalFor('a', '2026-08-17'), null, 'no goal yet');
  const st = weekStat('a', '2026-08-31');
  eq([st.done, st.target, st.hit, st.rest], [2, 3, false, false], 'this week stat');
  eq(weekStat('a', '2026-08-24').rest, true, 'rest week');
  const v = view('a');
  eq(v.encourage, '再 1 次就達標', 'encourage');
  eq(v.goalText, '每週 3 次 · 至少 30 分鐘', 'goalText');
  eq(weekKeys().length, 8, 'weekKeys');
  eq(weekKeys()[7], '2026-08-31', 'weekKeys last is this week');
  return 'FE_TEST_OK';
`);
console.log(fn());
