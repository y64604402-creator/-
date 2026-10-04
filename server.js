// Dajare Battle server: rooms, rounds, and AI scoring via the Claude API.
// Env: ANTHROPIC_API_KEY (required for AI scoring), MODEL (optional), PORT
const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.MODEL || 'claude-sonnet-5-5';
const ROUNDS = 5, ROUND_MS = 30000, RESULT_MS = 6000, STALE_MS = 25000;

const NAMES_JP = [
  'ゆうな', 'じょうしゃ', 'さくら', 'たくみ', 'ひろし', 'あかね', 'けんた', 'みなと', 'かえで', 'りょうた',
  'まさき', 'なつき', 'ゆうき', 'はるか', 'ひなた', 'しょうた', 'あおい', 'だいすけ', 'ことね', 'いくと',
  'かおり', 'アキタ', 'たけし', 'まなぶ', 'ひとみ', 'みさき', 'かずき', 'けいすけ', 'ゆうた', 'りな',
  'ののか', 'いおり', 'そうた', 'はると', 'れん', 'ゆいな', 'みゆ', 'あやか', 'さやか', 'ともき',
  'こうた', 'しんじ', 'だいき', 'まこと', 'のぞみ', 'めぐみ', 'ちひろ', 'ゆかり', 'かなた', 'ひかる',
  'つばさ', 'あすか', 'まりこ', 'えいた', 'かずま', 'よしお', 'たかし', 'ゆきお', 'のぶお', 'みつる',
  'くにお', 'しずか', 'いずみ', 'ちさと', 'はなこ', 'たろう', 'じろう', 'さぶろう', 'すぐる', 'いさお',
  'あつし', 'まさる', 'きよし', 'とおる', 'ひでき', 'なおき', 'かいと', 'りく', 'そら', 'ゆま',
  'みお', 'ひまり', 'いちか', 'こはる', 'あかり', 'ゆず', 'るな', 'ここな', 'みつき', 'おさむ',
  'たいが', 'げんき', 'こうき', 'ゆうと', 'しゅん', 'ほのか', 'めい', 'ゆあ', 'れいな', 'さとし',
  'ともこ', 'やすし', 'いさむ', 'ひろき', 'みのる', 'かんな', 'ふみや', 'ゆきな', 'さとる', 'まゆみ',
  'ひろみ', 'きよみ', 'あきら', 'しょうご', 'りゅうき', 'かすみ', 'ちなつ', 'みかん', 'もも', 'いちご',
  'ひなこ', 'たまき', 'とうま', 'まひろ', 'あいり', 'かのん', 'ゆうせい', 'けんじ', 'たけひこ', 'まさと',
  'ゆうすけ', 'てるみ', 'あきこ', 'かおる', 'ひさし'
];
const NAMES_WORLD = [
  'ミカエル', 'ジョン', 'マイク', 'デイビッド', 'ジェームス', 'ロバート', 'ウィリアム', 'トーマス', 'ダニエル', 'マシュー',
  'ケビン', 'ブライアン', 'エリック', 'スティーブ', 'ポール', 'マーク', 'ジェイソン', 'ライアン', 'アレックス', 'ネイサン',
  'オスカー', 'オリバー', 'ヘンリー', 'ジャック', 'ハリー', 'チャーリー', 'ジョージ', 'アーサー', 'ノア', 'リアム',
  'イーサン', 'ルーク', 'エマ', 'オリビア', 'ソフィア', 'イザベラ', 'ミア', 'アメリア', 'エミリー', 'クロエ',
  'リリー', 'グレース', 'ソフィー', 'ジェシカ', 'サラ', 'ローラ', 'ナタリー', 'ステラ', 'ルーシー', 'アリス',
  'ケイト', 'ジェーン', 'ルナ', 'マリア', 'カルロス', 'ペドロ', 'ミゲル', 'ディエゴ', 'ルイス', 'ホセ',
  'ラファエル', 'アントニオ', 'ロベルト', 'パブロ', 'ハビエル', 'ルシア', 'カルメン', 'イザベル', 'ジャン', 'ピエール',
  'ルイ', 'アンリ', 'ジャンヌ', 'ブリジット', 'クロード', 'マルセル', 'ヴィクトル', 'ハンス', 'クラウス', 'フリッツ',
  'ウルリッヒ', 'ヨハン', 'ゲルト', 'マルコ', 'ルカ', 'ジョバンニ', 'ロレンツォ', 'ジュリア', 'イワン', 'ドミトリー',
  'セルゲイ', 'アレクセイ', 'ナターシャ', 'オルガ', 'ボリス', 'ニコライ', 'ミハイル', 'アンナ', 'ムハンマド', 'アリ',
  'ハッサン', 'ファティマ', 'ヤスミン', 'オマール', 'カリム', 'ラシード', 'ラジ', 'アルジュン', 'プリヤ', 'アニル',
  'ラヴィ', 'サンジェイ', 'ワン', 'リー', 'チェン', 'ジャッキー', 'メイ', 'リン', 'シャオ', 'ジホ',
  'ミンジュン', 'ソヨン', 'ジウ', 'ハヌル', 'ヒョンビン', 'グエン', 'ミン', 'ビョルン', 'インゲ', 'ラース',
  'ヨナス', 'ペール', 'クワメ', 'アマニ', 'ザラ', 'ジョモ', 'ニコス', 'ディミトリ', 'ヤン', 'エムレ',
  'ダビデ', 'カイ', 'ナオミ'
];
const SURNAMES = [
  'たけした', 'たんしょ', 'たなか', 'すずき', 'さとう', 'たかはし', 'いとう', 'わたなべ', 'やまもと', 'なかむら',
  'こばやし', 'かとう', 'よしだ', 'やまだ', 'ささき', 'やまぐち', 'まつもと', 'いのうえ', 'きむら', 'はやし',
  'しみず', 'やまざき', 'もり', 'いけだ', 'はしもと', 'あべ', 'いしかわ', 'やました', 'なかじま', 'いしい',
  'おがわ', 'まえだ', 'おかだ', 'はせがわ', 'ふじた', 'ごとう', 'こんどう', 'むらた', 'うえだ', 'さかもと',
  'えんどう', 'あおき', 'ふくだ', 'にしむら', 'みうら', 'ふじわら', 'おかもと', 'まつだ', 'なかがわ', 'なかの',
  'はらだ', 'おの', 'たむら', 'たけうち', 'かねこ', 'わだ', 'なかやま', 'いしだ', 'うえの', 'もりた',
  'はら', 'しばた', 'さかい', 'くどう', 'よこやま', 'みやざき', 'みやもと', 'うちだ', 'たかぎ', 'あんどう',
  'たにぐち', 'おおの', 'まるやま', 'いまい', 'たかだ', 'ふじい', 'たけだ', 'かねだ', 'こじま', 'ほんだ'
];
// 名前の出し方: 海外 1/7 / 日本のうちフルネーム 1/8、苗字だけ 約2割(下の名前より少なめ)、残りは下の名前
function pickName(used) {
  const pick = arr => { const f = arr.filter(n => !used.includes(n)); const a = f.length ? f : arr; return a[Math.floor(Math.random() * a.length)]; };
  if (Math.random() < 1 / 7) return { name: pick(NAMES_WORLD) };
  const r = Math.random();
  if (r < 1 / 8) { const s = SURNAMES[Math.floor(Math.random() * SURNAMES.length)], g = NAMES_JP[Math.floor(Math.random() * NAMES_JP.length)]; return { name: s + g, disp: s + ' ' + g, sei: s, mei: g }; }
  if (r < 1 / 8 + 7 / 8 * 0.2) return { name: pick(SURNAMES) };
  return { name: pick(NAMES_JP) };
}

const server = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'text/plain' }); r.end('Dajare server running\n'); });
const wss = new WebSocket.Server({ server });
const rooms = new Map();
const genId = () => Math.random().toString(36).slice(2, 10);
const send = (ws, o) => { if (ws.readyState === 1) try { ws.send(JSON.stringify(o)); } catch (e) {} };
const bc = (room, o) => room.players.forEach(p => send(p.ws, o));

function hostId(room) { let b = null; for (const [id, p] of room.players) if (!b || p.joinedAt < room.players.get(b).joinedAt) b = id; return b; }
function roomInfo(room) {
  return { t: 'room', phase: room.phase, hostId: hostId(room),
    players: [...room.players].map(([id, p]) => ({ id, name: p.name, total: p.total, done: p.sub !== null })) };
}

function startGame(room) {
  room.round = 0; room.used = [];
  room.players.forEach(p => { p.total = 0; });
  nextRound(room);
}
function nextRound(room) {
  room.round++;
  const pk = pickName(room.used); room.name = pk.name; room.disp = pk.disp || pk.name; room.sei = pk.sei || ''; room.mei = pk.mei || ''; room.used.push(room.name);
  room.phase = 'play';
  room.players.forEach(p => { p.sub = null; });
  bc(room, { t: 'round', round: room.round, rounds: ROUNDS, name: room.name, disp: room.disp, ms: ROUND_MS });
  bc(room, roomInfo(room));
  clearTimeout(room.timer);
  room.timer = setTimeout(() => score(room), ROUND_MS + 500);
}

const RULES = `あなたは日本語ダジャレ大会の審査員です。お題の名前に対する各回答を採点します。
ルール:
- 必須条件: 回答文に、お題の名前そのもの(その人を指す名前)が必ず入っていること。入っていなければ全体で0点。
- フルネームのお題(姓・名が別に渡される。お題は姓と名をつなげた文字列。スペースの有無は問わない): 回答にはフルネーム全体がそのまま入っていること(必須)。ダジャレは、名だけ・姓だけ・フルネーム全体・姓と名を別々にダジャレ化、のどれでも成立する。姓と名の両方(または全体)をうまく隠したものほど高く、片方だけでも成立として採点する(例: たんしょけいた→「たんしょけいたが抜く短小チン毛、いた」は、たんしょ(う)とけいたを別々に隠した高評価)。
- ダジャレ成立: 上の名前とは別に、名前と同じ音が別の意味の言葉として文中に自然に含まれていること。この2つが揃って成立(例: ゆうな→「ゆうなを悪くゆうな」は、名前のゆうな+「言うな」。「悪くゆうな」だけは名前が無いので不成立。名前を2回繰り返すだけも不成立)。
- 韻を踏んでいるだけ(音が入っていない)はダジャレ不成立。pun=0。
- 救済ルール: 名前の音の間に1文字程度の挿入、小さい文字の変換(っ↔つ、ゃ↔や等)は許可。ただし使うと減点(trick、-15〜0)。名前が短いほど減点を大きく。
- 韻(rhyme): ダジャレとは別に、名前や隠した音と母音が似て響き合う別の言葉があること(例: ミカエル→「ミカエル、3日エルサルバドルに帰る」は、3日エルがダジャレ、「に帰る」がエルと響き合う韻)。名前と全く同じ音を別の意味で繰り返す・つなげるのはダジャレであって韻ではないので、rhymeには数えない(0)。ダジャレ成立に加え韻も踏めば高得点。
- 名前をそのまま言うだけ、名前が無関係の文は0点。
- 文の意味: 文として日本語の意味が通っているかを厳しく見る(sense)。名前の音を入れるために言葉を無理やり並べただけ、文法が崩れている、何を言いたいか分からない文は、ダジャレが成立していても sense を低くし、pun も減らす。意味が全く通らない文は全体で20点以下。
- senseは細かく刻まず、意味が伝わるなら満点(10)、伝わらないなら0〜3の二択に近く採点する。funは、笑える・うまい・オチがある、といった面白さをしっかり差をつけて採点する。
採点手順: 先に各回答を全てひらがなに直し(reading)、名前の読みが単語の切れ目をまたいで含まれる箇所を漏れなく探す(hits)。例: 名前「たんしょけいた」→「短小チン毛、いた」=たんしょうちんけいた。「たんしょ(う)」と「けいた」が離れて両方入っている。長音(う・ー)・促音・清濁・小文字の違いは許容するが、使った分はtrickで減点する。単独の名前なら名前全体が隠れているかを確認する(フルネームは上のルール)。見落としがないか確認してから採点する。
配点: pun 0-60, rhyme 0-15, sense(文の意味の通りやすさ) 0-10, fun(面白さ) 0-15, trick -15〜0。score=合計(0-100の整数)。
JSON配列のみ返す(前後の文章やコードブロック禁止):
[{"id":"入力のid","reading":"","hits":[],"pun":0,"rhyme":0,"sense":0,"fun":0,"trick":0,"score":0,"comment":"25字以内の講評"}]`;

async function judge(name, entries, parts) {
  const fallback = () => entries.map(e => {
    const ok = e.text.replace(/\s/g, '').includes(name) && e.text.length > name.length + 1;
    return { id: e.id, pun: ok ? 40 : 0, rhyme: 0, sense: 0, fun: 0, trick: 0, score: ok ? 40 : 0, comment: KEY ? '採点エラー(簡易判定)' : 'AIキー未設定(簡易判定)' };
  });
  if (!KEY || !entries.length) return fallback();
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 2500, system: RULES,
        messages: [{ role: 'user', content: JSON.stringify({ お題: name, ...(parts && parts[0] ? { 姓: parts[0], 名: parts[1] } : {}), 回答: entries.map(e => ({ id: e.id, text: e.text })) }) }] })
    });
    const d = await r.json();
    const txt = (d.content || []).map(c => c.text || '').join('').replace(/```json|```/g, '').trim();
    const arr = JSON.parse(txt);
    return entries.map(e => {
      const a = arr.find(x => x.id === e.id) || {};
      const n = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(+v || 0)));
      const pun = n(a.pun, 0, 60), rhyme = pun ? n(a.rhyme, 0, 15) : 0, sense = pun ? n(a.sense, 0, 10) : 0, fun = pun ? n(a.fun, 0, 15) : 0, trick = pun ? n(a.trick, -15, 0) : 0;
      return { id: e.id, pun, rhyme, sense, fun, trick, score: Math.max(0, pun + rhyme + sense + fun + trick), comment: String(a.comment || '').slice(0, 40) };
    });
  } catch (err) { console.error('judge error', err.message); return fallback(); }
}

async function score(room) {
  if (room.phase !== 'play') return;
  clearTimeout(room.timer);
  room.phase = 'scoring'; bc(room, { t: 'scoring' });
  const entries = [...room.players].filter(([, p]) => p.sub).map(([id, p]) => ({ id, text: p.sub }));
  const res = await judge(room.name, entries, [room.sei, room.mei]);
  const results = [...room.players].map(([id, p]) => {
    const r = res.find(x => x.id === id) || { pun: 0, rhyme: 0, sense: 0, fun: 0, trick: 0, score: 0, comment: '未提出' };
    p.total += r.score;
    return Object.assign({ id, name: p.name, text: p.sub || '' }, r);
  }).sort((a, b) => b.score - a.score);
  room.phase = 'result';
  bc(room, { t: 'result', name: room.name, disp: room.disp, round: room.round, rounds: ROUNDS, results });
  bc(room, roomInfo(room));
  room.timer = setTimeout(() => {
    if (room.round < ROUNDS) return nextRound(room);
    room.phase = 'final';
    bc(room, { t: 'final', ranking: [...room.players].map(([id, p]) => ({ id, name: p.name, total: p.total })).sort((a, b) => b.total - a.total) });
    bc(room, roomInfo(room));
  }, RESULT_MS);
}

wss.on('connection', ws => {
  let room = null, id = null, lastJudge = 0;
  const leave = () => {
    if (!room) return;
    room.players.delete(id);
    if (!room.players.size) { clearTimeout(room.timer); rooms.delete(room.code); }
    else {
      bc(room, roomInfo(room));
      if (room.phase === 'play' && [...room.players.values()].every(p => p.sub !== null)) score(room);
    }
    room = null; id = null;
  };
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'judge') { // stateless scoring for solo practice (rate-limited per connection)
      const name = String(m.name || '').trim().slice(0, 20), text = String(m.text || '').trim().slice(0, 60);
      if (!name || !text || Date.now() - lastJudge < 3000) return;
      lastJudge = Date.now();
      judge(name, [{ id: 'me', text }], [String(m.sei || '').slice(0, 10), String(m.mei || '').slice(0, 10)]).then(r => send(ws, { t: 'judged', result: r[0] }));
      return;
    }
    if (m.t === 'join' && !room) {
      const code = (String(m.room || 'LOBBY').trim().toUpperCase().slice(0, 16)) || 'LOBBY';
      let r = rooms.get(code);
      if (!r) { r = { code, players: new Map(), phase: 'lobby', round: 0, used: [], name: '', timer: null }; rooms.set(code, r); }
      if (r.players.size >= 8) return send(ws, { t: 'error', msg: '部屋が満員です(最大8人)' });
      if (r.phase !== 'lobby' && r.phase !== 'final') return send(ws, { t: 'error', msg: 'ゲーム進行中です。終わるまで待ってね' });
      room = r; id = genId();
      const icon = (typeof m.icon === 'string' && m.icon.length <= 30000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(m.icon)) ? m.icon : '';
      r.players.set(id, { ws, name: String(m.name || 'ななし').slice(0, 10), icon, total: 0, sub: null, joinedAt: Date.now(), lastSeen: Date.now() });
      send(ws, { t: 'welcome', id, room: code });
      bc(r, roomInfo(r));
      bc(r, { t: 'icons', icons: Object.fromEntries([...r.players].map(([pid, p]) => [pid, p.icon])) });
      return;
    }
    if (!room || !room.players.has(id)) return;
    const p = room.players.get(id); p.lastSeen = Date.now();
    if (m.t === 'start' && id === hostId(room) && (room.phase === 'lobby' || room.phase === 'final') && room.players.size >= 2) startGame(room);
    else if (m.t === 'submit' && room.phase === 'play' && p.sub === null) {
      p.sub = String(m.text || '').trim().slice(0, 60) || '(無回答)';
      bc(room, roomInfo(room));
      if ([...room.players.values()].every(x => x.sub !== null)) score(room);
    }
    else if (m.t === 'again' && id === hostId(room) && room.phase === 'final') { room.phase = 'lobby'; bc(room, roomInfo(room)); bc(room, { t: 'lobby' }); }
    else if (m.t === 'leave') leave();
  });
  ws.on('close', leave); ws.on('error', leave);
});

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) for (const p of room.players.values()) if (now - p.lastSeen > STALE_MS) p.ws.terminate();
}, 5000);

server.listen(PORT, () => console.log('Dajare server on ' + PORT + (KEY ? '' : ' (ANTHROPIC_API_KEY not set: fallback scoring)')));
