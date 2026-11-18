import assert from 'node:assert'
import * as T from '../shared/tasks.js'
import * as lay from '../shared/layout.js'

let n = 0
function t(name, f) { f(); n++; console.log('ok  ' + name) }
const mk = (i, x) => ({ i: i, e: 0, x: x || 'з' + i, c: [0, 1, 2] })
const many = (k) => Array.from({ length: k }, (_, j) => mk('t' + j))
const m10 = (s) => s.length * 10          // ширина строки: 10 px на знак
const W = 100                              // в строку помещается 10 знаков

t('cleanTasks: эмодзи вкладки, уровни цветов, мусор отбрасывается, регистр сохраняется', () => {
  const l = T.cleanTasks([{ i: 1, e: '🧬', x: ' Текст\n ', c: [2, 1, 0] }, null, { e: '🏠' }, { i: 'b', e: '🦄', x: 'x', c: [9, -1, 'a'] }])
  assert.equal(l.length, 2)
  assert.deepEqual(l[0], { i: '1', e: 4, x: 'Текст', c: [2, 1, 0] })
  assert.equal(l[1].e, -1)
  assert.deepEqual(l[1].c, [0, 0, 0])
  assert.equal(T.cleanTasks('не список').length, 0)
  assert.equal(T.cleanTasks(many(100).map((x) => ({ i: x.i, e: '🏠', x: x.x, c: x.c }))).length, T.MAX_TASKS)
})

t('все девять эмодзи вкладок распознаются (с вариативным селектором тоже)', () => {
  for (let k = 0; k < T.EMOJI.length; k++) assert.equal(T.emojiIndex(T.EMOJI[k]), k)
  assert.equal(T.emojiIndex('🏠\uFE0F'), 0)
  assert.equal(T.emojiIndex('📦'), -1)
})

t('текст: короткий — одна строка как есть', () => {
  assert.deepEqual(T.wrapText('греча!', W, m10), ['греча!'])
  assert.deepEqual(T.wrapText('0123456789', W, m10), ['0123456789'])     // ровно впритык
  assert.deepEqual(T.wrapText('', W, m10), [''])
})

t('текст: длиннее — вторая строка, перенос по пробелу', () => {
  assert.deepEqual(T.wrapText('уборка в коридоре', W, m10), ['уборка в', 'коридоре'])
  assert.deepEqual(T.wrapText('найти электрика срочно', W, m10), ['найти', 'электрика'])   // «срочно» в две строки уже не влезло — отрезано
})

t('текст: слово длиннее строки переносится по знакам', () => {
  assert.deepEqual(T.wrapText('абвгдеёжзийклмн', W, m10), ['абвгдеёжзи', 'йклмн'])
})

t('текст: больше двух строк нет — лишнее просто отрезается, без «…»', () => {
  const r = T.wrapText('раз два три четыре пять шесть семь восемь девять десять', W, m10)
  assert.equal(r.length, 2)
  assert.ok(m10(r[0]) <= W && m10(r[1]) <= W)
  assert.ok(!r.join('').includes('…') && !r.join('').includes('...'))
  assert.equal(r[0], 'раз два')
  assert.equal(r[1], 'три четыре')
  const longWord = T.wrapText('а'.repeat(50), W, m10)
  assert.deepEqual(longWord, ['а'.repeat(10), 'а'.repeat(10)])
})

t('текст: первая строка — по словам, вторая — по знакам до края (посреди слова), остаток обрывается', () => {
  assert.deepEqual(T.wrapText('Купить хлеб и молоко завтра', W, m10), ['Купить', 'хлеб и мол'])
  assert.deepEqual(T.wrapText('раз два трииииииииииииииииии', W, m10), ['раз два', 'трииииииии'])
})

t('текст: лишние пробелы на стыке строк не остаются, эмодзи в тексте не рвутся пополам', () => {
  const r = T.wrapText('1234567890   абв', W, m10)
  assert.deepEqual(r, ['1234567890', 'абв'])
  const e = T.wrapText('😀'.repeat(12), 40, (s) => Array.from(s).length * 10)
  assert.deepEqual(e, ['😀😀😀😀', '😀😀😀😀'])
})

t('экран: показываются только шесть первых задач, прокрутки нет', () => {
  assert.equal(T.visibleTasks(many(20)).length, 6)
  assert.deepEqual(T.visibleTasks(many(20)).map((x) => x.i), ['t0', 't1', 't2', 't3', 't4', 't5'])
  assert.equal(T.visibleTasks(many(4)).length, 4)
  assert.equal(T.visibleTasks([]).length, 0)
  assert.equal(T.pack, undefined); assert.equal(T.scrolled, undefined)
})

t('экран: выполненная задача уступает место следующей из очереди', () => {
  const st = T.newState(); st.tasks = many(8)
  assert.deepEqual(T.visibleTasks(T.shownTasks(st)).map((x) => x.i), ['t0', 't1', 't2', 't3', 't4', 't5'])
  T.complete(st, 't1', 1000)
  assert.deepEqual(T.visibleTasks(T.shownTasks(st)).map((x) => x.i), ['t0', 't2', 't3', 't4', 't5', 't6'])
})

t('выполнение: задача уходит из показа сразу, событие ждёт подтверждения, повторно не создаётся', () => {
  const st = T.newState(); st.tasks = many(8)
  const id = T.complete(st, 't2', 1000)
  assert.ok(id)
  assert.equal(T.shownTasks(st).length, 7)
  assert.equal(T.complete(st, 't2', 1001), '')
  assert.equal(T.complete(st, 'нет такой', 1002), '')
  assert.equal(T.due(st, 1000, 15000).length, 1)
  st.pend[0].tried = 1000
  assert.equal(T.due(st, 5000, 15000).length, 0)
  assert.equal(T.due(st, 16000, 15000).length, 1)
  assert.equal(T.applyTasks(st, T.cleanTasks(many(8).map((x) => ({ i: x.i, e: '🏠', x: x.x, c: x.c })))), false)
  assert.equal(T.shownTasks(st).length, 7)
  assert.ok(T.ack(st, id))
  assert.equal(st.pend.length, 0)
  assert.equal(T.ack(st, id), false)
  assert.equal(st.tasks.some((x) => x.i === 't2'), false)
})

t('хранение: сохранённое состояние восстанавливается, мусор — пустое состояние', () => {
  const st = T.newState(); st.tasks = T.cleanTasks([{ i: 'a', e: '🧬', x: 'икс', c: [1, 2, 0] }]); 
  T.complete(st, 'a', 5)
  const back = T.restore(T.serialize(st))
  assert.equal(back.tasks[0].e, 4)
  assert.equal(back.pend.length, 1)
  assert.equal(back.pend[0].tid, 'a')
  assert.equal(T.restore('{{{').tasks.length, 0)
  assert.equal(T.restore('').pend.length, 0)
})

console.log('\nвсего: ' + n)

t('эмодзи вкладок: 🎵 🎞️ 🏠 🧭 🤖 есть среди картинок (🎞️ — с селектором варианта и без него)', () => {
  for (const e of ['🎵', '🎞️', '🎞', '🏠', '🧭', '🤖']) assert.ok(T.emojiIndex(e) >= 0, e)
  assert.equal(T.emojiIndex('🎞️'), T.emojiIndex('🎞'))
  assert.equal(T.cleanTasks([{ i: 'a', e: '🎵', x: 'x', c: [0, 0, 0] }])[0].e, T.emojiIndex('🎵'))
  assert.equal(T.emojiIndex('🦄'), -1)                       // чужого эмодзи картинки нет — место пустое
})

t('эмодзи 💊 🐿️ 🎞️ 🧠: распознаются как вкладки (с селектором варианта и без), старые номера картинок не сдвинулись', () => {
  assert.equal(T.emojiIndex('💊'), 13)
  assert.equal(T.emojiIndex('🐿️'), 14)
  assert.equal(T.emojiIndex('🐿'), 14)
  assert.equal(T.emojiIndex('🧠'), 15)
  assert.equal(T.emojiIndex('🎞️'), 10)
  assert.deepEqual(T.EMOJI.slice(0, 13), ['🏠', '🍀', '🔍', '📖', '🧬', '💀', '🤿', '🎨', '🩸', '🎵', '🎞', '🧭', '🤖'])   // номера хранятся в памяти часов
  assert.equal(T.cleanTasks([{ i: 'p', e: '💊', x: 'x', c: [0, 0, 0] }])[0].e, 13)
  assert.equal(T.cleanTasks([{ i: 'p', e: '🐿️', x: 'x', c: [0, 0, 0] }])[0].e, 14)
})

const SP = 10
t('эмодзи в тексте: hasEmoji видит новые эмодзи (в том числе 🐿️ и 🎞️ с селектором, который normText убирает)', () => {
  for (const e of ['💊', '🐿', '🎞', '🧠']) assert.ok(T.hasEmoji('а ' + e + ' б'), e)
  assert.equal(T.hasEmoji('обычный текст'), false)
  assert.equal(T.hasEmoji('🦄'), false)                                 // чужого эмодзи картинки нет
  assert.equal(T.normText('🐿️ белка'), '🐿 белка')
})

t('эмодзи в тексте: раскладка — куски текста и картинки подряд, пробелы по краям кусков считаются отдельно', () => {
  const L = T.layoutLine('выпить 💊 утром', m10, SP)
  assert.deepEqual(L.segs.map((g) => g.s !== undefined ? g.s : 'e' + g.e), ['выпить', 'e13', 'утром'])
  assert.deepEqual(L.segs.map((g) => g.x), [0, 60 + SP, 60 + SP + T.INL_ADV + SP])
  assert.equal(L.width, 60 + SP + T.INL_ADV + SP + 50)
  const E = T.layoutLine('💊🧠', m10, SP)                                  // подряд, без текста
  assert.deepEqual(E.segs.map((g) => g.e), [13, 15])
  assert.equal(E.width, 2 * T.INL_ADV)
  assert.deepEqual(T.layoutLine('', m10, SP), { segs: [], width: 0 })
  assert.equal(T.layoutLine('   ', m10, SP).width, 3 * SP)
})

t('эмодзи в тексте: без эмодзи ширина строки — ровно measure, как раньше', () => {
  assert.equal(T.lineWidth('обычный текст', m10, SP), m10('обычный текст'))
  assert.equal(T.lineWidth('а 💊', m10, SP), 10 + SP + T.INL_ADV)
})

t('эмодзи в тексте: перенос считает ширину эмодзи и не рвёт его пополам', () => {
  const mw = (s) => T.lineWidth(s, m10, SP)
  const r = T.wrapText('💊💊💊💊💊💊💊💊', 100, mw)                     // три картинки по 32 влезают в 100 px
  assert.deepEqual(r, ['💊💊💊', '💊💊💊'])
  assert.ok(r.every((x) => mw(x) <= 100))
  const q = T.wrapText('выпить 💊 вечером', 100, mw)
  assert.ok(q.every((x) => mw(x) <= 100))
  assert.equal(q.join(' ').includes('💊'), true)
})
