const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4000;
const APP_DIR = __dirname;
const DATA_DIR = path.join(APP_DIR, 'data');
const PUBLIC_DIR = path.join(APP_DIR, 'public');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// Biến proxy & AI config từ env
const RAW_KEYS_EARLY = process.env.NEXUS_API_KEYS || process.env.API_KEYS || process.env.API_KEY || '';
const BASE_URL_EARLY = (process.env.NEXUS_BASE_URL || process.env.BASE_URL || 'https://api.nexusmmo.store/v1').replace(/\/+$/, '');
const MODEL_NAME_EARLY = process.env.MODEL_NAME || 'deepseek-v4-flash';
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

// Lỗi 7: Giới hạn CORS theo env ALLOWED_ORIGIN
const app = express();
app.use(cors({
    origin: ALLOWED_ORIGIN === '*' ? '*' : ALLOWED_ORIGIN.split(',').map(o => o.trim()),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.disable('x-powered-by');

const RATE_LIMIT_PER_MIN = parseInt(process.env.RATE_LIMIT_PER_MIN || '60', 10);
const rateBuckets = new Map();
function rateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const bucket = rateBuckets.get(ip);
    if (!bucket || now - bucket.start > 60000) {
        rateBuckets.set(ip, { start: now, count: 1 });
    } else {
        bucket.count++;
        if (bucket.count > RATE_LIMIT_PER_MIN) {
            return res.status(429).json({ success: false, error: 'Too many requests. Vui lòng thử lại sau.' });
        }
    }
    if (rateBuckets.size > 10000) rateBuckets.clear();
    next();
}

// Lỗi 6: Middleware xác thực cho các endpoint ghi file (chỉ localhost hoặc có ADMIN_KEY)
function requireAdminKey(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || '';
    const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    if (process.env.NODE_ENV !== 'production' && isLocal) return next();
    if (ADMIN_KEY && req.headers['x-admin-key'] === ADMIN_KEY) return next();
    return res.status(403).json({ success: false, error: 'Forbidden: Admin key required' });
}

// Hàm đọc danh sách từ cấm / bỏ qua từ file ignore_rules.txt
function loadIgnoreRules() {
    const ignoreRulesSet = new Set();
    const rulesFile = path.join(DATA_DIR, 'ignore_rules.txt');
    if (fs.existsSync(rulesFile)) {
        const lines = fs.readFileSync(rulesFile, 'utf-8').split(/\r?\n/);
        lines.forEach(l => {
            const trimmed = l.trim().toLowerCase();
            if (trimmed) ignoreRulesSet.add(trimmed);
        });
    }
    return ignoreRulesSet;
}

// ── Load isProperName từ filter.js ──────────────────────────────────
const vm = require('vm');
const _filterCode = fs.readFileSync(path.join(APP_DIR, 'filter.js'), 'utf8');
const _filterSandbox = { module: { exports: {} }, exports: {}, console, require };
vm.createContext(_filterSandbox);
vm.runInContext(_filterCode, _filterSandbox);
const isProperName = _filterSandbox.isProperName;
console.log('✅ Đã load filter.js (bộ lọc 4 lớp)');

// API: POST /api/filter - Lọc Names sạch bằng filter.js (4 lớp)
app.post('/api/filter', rateLimit, (req, res) => {
    try {
        const { names = [] } = req.body;
        const clean = [];
        const trash = [];
        const ignoreRulesSet = loadIgnoreRules();

        names.forEach(entry => {
            if (!entry || !entry.chinese || !entry.hanviet) return;
            const zh = entry.chinese.trim();
            const vi = entry.hanviet.trim();
            const zhLower = zh.toLowerCase();
            const viLower = vi.toLowerCase();

            // Từ cấm: bỏ hoàn toàn, không xuất hiện ở cả 2 bảng
            if (ignoreRulesSet.has(zhLower) || ignoreRulesSet.has(viLower)) {
                return; // bỏ qua, không push vào clean lẫn trash
            }
            if (entry.isTrash) { trash.push(entry); return; }

            // Lọc qua isProperName của filter.js (4 lớp)
            const type = entry.reading === 'foreign' ? (entry.category === 'anime' ? 'anime' : 'western') : 'eastern';
            if (isProperName(zh, vi, type)) {
                clean.push(entry);
            } else {
                trash.push(entry);
            }
        });

        res.json({ success: true, clean, trash, totalIgnoredRules: ignoreRulesSet.size });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// API: GET /api/get-ignore - Lấy toàn bộ từ cấm (user feature, không cần auth)
app.get('/api/get-ignore', (req, res) => {
    try {
        const rulesFile = path.join(DATA_DIR, 'ignore_rules.txt');
        let text = '';
        if (fs.existsSync(rulesFile)) {
            text = fs.readFileSync(rulesFile, 'utf-8');
        }
        res.json({ success: true, text });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// API: POST /api/save-ignore - Lưu từ cấm (user feature, không cần auth)
app.post('/api/save-ignore', requireAdminKey, rateLimit, (req, res) => {
    try {
        const rulesFile = path.join(DATA_DIR, 'ignore_rules.txt');
        let newRules = [];
        if (Array.isArray(req.body.rules)) {
            newRules = req.body.rules;
        } else if (typeof req.body.text === 'string') {
            newRules = req.body.text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        }
        if (newRules.length === 0) return res.json({ success: true, count: 0 });

        const existingSet = loadIgnoreRules();
        let addedCount = 0;
        newRules.forEach(r => {
            const trimmed = r.trim().toLowerCase();
            if (trimmed && !existingSet.has(trimmed)) {
                existingSet.add(trimmed);
                addedCount++;
            }
        });

        const linesToSave = Array.from(existingSet).sort();
        fs.mkdirSync(path.dirname(rulesFile), { recursive: true });
        fs.writeFileSync(rulesFile, linesToSave.join('\n'), 'utf-8');

        res.json({ success: true, addedCount, totalRules: existingSet.size });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// API: GET /api/get-names - Đọc danh sách Names.txt
app.get('/api/get-names', requireAdminKey, (req, res) => {
    try {
        const namesFile = path.join(DATA_DIR, 'Names.txt');
        let text = '';
        if (fs.existsSync(namesFile)) {
            text = fs.readFileSync(namesFile, 'utf-8');
        }
        res.json({ success: true, text });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// API: POST /api/save-names - Nạp danh sách Names sạch mới (Lỗi 6: thêm requireAdminKey)
app.post('/api/save-names', requireAdminKey, rateLimit, (req, res) => {
    try {
        const { names = [] } = req.body;
        const namesFile = path.join(DATA_DIR, 'Names.txt');
        const existingLines = fs.existsSync(namesFile) ? fs.readFileSync(namesFile, 'utf-8').split(/\r?\n/) : [];

        const existingSet = new Set();
        existingLines.forEach(l => {
            const parts = l.split('=');
            if (parts[0]) existingSet.add(parts[0].trim());
        });

        const newLines = [];
        names.forEach(n => {
            if (n.chinese && n.hanviet && !existingSet.has(n.chinese.trim())) {
                existingSet.add(n.chinese.trim());
                newLines.push(`${n.chinese.trim()}=${n.hanviet.trim()}`);
            }
        });

        if (newLines.length > 0) {
            fs.appendFileSync(namesFile, '\n' + newLines.join('\n'), 'utf-8');
        }

        res.json({ success: true, added: newLines.length, total: existingSet.size });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// TÍCH HỢP AI EXTRACTOR (NEXUSMMO / OPENAI-COMPATIBLE PROXY)
const RAW_KEYS = process.env.NEXUS_API_KEYS || process.env.API_KEYS || process.env.API_KEY || '';
const API_KEYS = RAW_KEYS.split(',').map(k => k.trim()).filter(Boolean);
const BASE_URL = (process.env.NEXUS_BASE_URL || process.env.BASE_URL || 'https://api.nexusmmo.store/v1').replace(/\/+$/, '');
const MODEL_NAME = process.env.MODEL_NAME || 'deepseek-v4-flash';

let keyCounter = 0;
function getNextApiKey() {
    if (!API_KEYS.length) throw new Error('Chưa cấu hình NEXUS_API_KEYS / API_KEYS trên server.');
    const key = API_KEYS[keyCounter % API_KEYS.length];
    keyCounter++;
    return key;
}

let HV_DICT = null;
function _loadHVDict() {
    if (HV_DICT) return HV_DICT;
    HV_DICT = new Map();
    // Lỗi 1: BASE_DIR không khai báo → dùng path tương đối hoặc env
    let p = process.env.VIET_PHRASE_PATH || path.join(APP_DIR, '..', 'QT2025555', 'QT2025', 'VietPhrase', 'VietPhrase.txt');
    if (!fs.existsSync(p)) p = '';
    if (fs.existsSync(p)) {
        const lines = fs.readFileSync(p, 'utf-8').split(/\r?\n/);
        for (const l of lines) {
            const eq = l.indexOf('=');
            if (eq > 0) {
                const cn = l.slice(0, eq).trim();
                if (cn.length === 1) {
                    const vi = l.slice(eq + 1).split('/')[0].split('|')[0].trim();
                    if (vi) HV_DICT.set(cn, vi);
                }
            }
        }
    }
    return HV_DICT;
}

function _fixLiSpelling(str) {
    if (!str) return '';
    return str.split(/\s+/).map(w => {
        if (w === 'Li') return 'Lý';
        if (w === 'li') return 'lý';
        return w;
    }).join(' ');
}

function _translateHV(cn) {
    const dict = _loadHVDict();
    const words = [];
    for (const c of cn) {
        const vi = dict.get(c);
        if (!vi) return null;
        words.push(vi);
    }
    const rawVi = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    return _fixLiSpelling(rawVi);
}

function _isHan(c) {
    const code = c.charCodeAt(0);
    return (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf);
}

function _cleanCNPunct(str) {
    if (!str) return '';
    return str.replace(/^[\s"'«»《》「」『』【】（）()\[\]{}—–\-.,;:!?]+|[\s"'«»《》「」『』【】（）()\[\]{}—–\-.,;:!?]+$/g, '').trim();
}

function _loadExistingNames() {
    // Lỗi 1: Thay BASE_DIR bằng DATA_DIR
    const namesSet = new Set();
    const namesFile = path.join(DATA_DIR, 'Names.txt');
    if (fs.existsSync(namesFile)) {
        fs.readFileSync(namesFile, 'utf-8').split(/\r?\n/).forEach(l => {
            const eq = l.indexOf('=');
            if (eq > 0) namesSet.add(l.slice(0, eq).trim());
        });
    }
    return namesSet;
}

function _isProperEastern(cn, vi) {
    if (!cn || !vi) return false;
    const len = cn.length;
    if (len < 2 || len > 4) return false;
    for (const c of cn) {
        if (!_isHan(c)) return false;
    }

    const viLower = vi.toLowerCase().trim();

    const badWords = [
        'người', 'ta', 'hắn', 'nàng', 'bọn họ', 'chúng ta',
        'cái gì', 'thế nào', 'bởi vì', 'cho nên', 'tuy rằng', 'nhưng là',
        'chính là', 'bất quá', 'nếu như', 'ngay cả', 'không có', 'không thể',
        'như thế nào', 'ở trong', 'bên trong', 'một cái', 'hai cái', 'ba cái',
        'bốn cái', 'năm cái', 'tiểu tử', 'đại hán', 'lão nhân', 'thanh niên',
        'thiếu niên', 'thiếu nữ', 'cô nương', 'huynh đệ',
        'sư huynh', 'sư tỷ', 'sư muội', 'sư đệ', 'lão gia', 'phu nhân',
        'tiểu thư', 'trưởng lão', 'môn chủ', 'bang chủ', 'gia chủ',
        'quân sư', 'chủ nhân', 'đệ tử', 'hoàng đế', 'thái tử',
        'công chúa', 'hoàng tử', 'đại nhân', 'tiền bối', 'đạo hữu',
        'tướng quân', 'pháp sư', 'tu sĩ', 'phàm nhân', 'nhân vật'
    ];
    // Pad chuỗi để match word-boundary, tránh substring false positive (vd: 'ta' khớp 'tam')
    const paddedVi = ' ' + viLower + ' ';
    for (const bw of badWords) {
        if (viLower === bw || paddedVi.includes(' ' + bw + ' ')) return false;
    }

    return true;
}

async function _callDeepSeekChunk(text, batchIdx, totalBatches, prompt, timeoutMs = 120000) {
    const apiKey = getNextApiKey();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const body = {
            model: MODEL_NAME,
            messages: [
                { role: 'system', content: prompt },
                { role: 'user', content: `[Văn bản cần phân tích ${batchIdx + 1}/${totalBatches}]\n\n${text}` }
            ],
            temperature: 0.1,
            max_tokens: 4096,
            thinking: { type: 'disabled' }
        };
        const res = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const rawJsonStr = data.choices?.[0]?.message?.content || '{}';
        const parsed = JSON.parse(rawJsonStr);
        return parsed.names || parsed.entities || parsed.data || [];
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}


// API: POST /api/extract-names - Bóc tách tên bằng DeepSeek
app.post('/api/extract-names', requireAdminKey, rateLimit, async (req, res) => {
    try {
        const { text = '' } = req.body;
        if (!text.trim()) return res.json({ success: true, clean: [], trash: [] });

        // Ã¢â€â‚¬Ã¢â€â‚¬ Chunk 10K + overlap 250 Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
        const CHUNK_SIZE = 10000;
        const OVERLAP    = 250;
        const chunks = [];
        let pos = 0;
        while (pos < text.length) {
            let end = pos + CHUNK_SIZE;
            if (end < text.length) {
                const nl = text.indexOf('\n', end - 100);
                if (nl !== -1 && nl < end + 100) end = nl + 1;
            }
            chunks.push(text.slice(pos, end));
            const next = end - OVERLAP;
            if (next <= pos || end >= text.length) break;
            pos = next;
        }

        // Ã¢â€â‚¬Ã¢â€â‚¬ System prompt chi tiÃ¡ÂºÂ¿t (cao recall) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
        const systemPrompt = [
            'You extract proper names from raw Chinese web novel text.',
            'This is a neutral named-entity extraction task for fiction text.',
            'Do not summarize, continue, translate, classify, judge, or describe sensitive events from the source text.',
            'Only extract proper names and minimal entity metadata needed by the JSON schema.',
            'Return exactly one valid JSON object. No markdown. No prose. No second JSON object. No text before or after JSON.',
            'Schema: {"names":[{"chinese":"子三","hanviet":"Đường Tam","reading":"hanviet","category":"Person|Location|Faction|Artifact|Skill|Title|Creature","description":"","count":1}]}',
            'Rules:',
            'Primary goal: high recall. It is better to include a plausible proper name than to miss it.',
            '- Scan the chunk twice internally before answering: first for obvious names, second for rare/one-off names.',
            '- Extract all named entities, including names that appear only once.',
            '- Do not limit the list to main characters or frequent names.',
            '- Include aliases, courtesy names, titles used as names, place names, sect/faction names (e.g. 羽化门, 青云门, 太清门, 蜀山派, 天道宗, 唐家), artifact names, skill names (e.g. 六脉神指, 寂灭指, 乾坤指, 一阳指, 降龙十八掌), creature names, and unique realm/world names.',
            '- CRITICAL: Always extract 2-character Chinese person names (e.g. 王贵, 萧炎, 叶凡, 张三, 李四). Never skip 2-character names.',
            '- CRITICAL: Always extract Sect/Faction names (Category: Faction), especially those ending with 门 (e.g. 羽化门), 派, 宗, 谷, 宫, 阁, 堂, 院.',
            '- CRITICAL: Always extract Skill/Technique names (Category: Skill), especially finger skills ending with 指 (e.g. 六脉神指, 寂灭指, 乾坤指, 一阳指).',
            '- Skip common words and generic phrases only when they are clearly not used as a name/title/entity.',
            '- For ambiguous 2-4 Chinese character phrases, include them if context treats them like a person, place, faction, item, skill, title, or creature.',
            '- Set "reading" to "hanviet" for every extracted entity.',
            '- This text is Eastern/Chinese fantasy. The "hanviet" field must be Vietnamese Sino-reading with full Vietnamese diacritics, title case with spaces.',
            '- Never output unaccented romanization. Bad: Truong Sinh Benh. Good: Trường Sinh Bệnh.',
            '- Keep chinese exactly as it appears in the source. Strip surrounding 《》, "", 【】 and age/duration prefixes like 十万年 from extracted entity.',
            '- Do not merge different Chinese spellings even if they may refer to the same entity.',
            '- Do not drop a valid entity just because its count is 1.',
            '- Always set description to an empty string.',
            '- "count" = estimated occurrences in this chunk (integer >= 1).'
        ].join('\n');

        // Ã¢â€â‚¬Ã¢â€â‚¬ parseJSON robust: strip <think>, ```json, cÃƒÂ¢n bÃ¡ÂºÂ±ng ngoÃ¡ÂºÂ·c Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
        function parseJSONSafe(raw) {
            if (!raw) return null;
            let s = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
            try { return JSON.parse(s); } catch (_) {
                const st = s.indexOf('{');
                if (st === -1) return null;
                let depth = 0, inQ = false, esc = false;
                for (let i = st; i < s.length; i++) {
                    const c = s[i];
                    if (esc) { esc = false; continue; }
                    if (c === '\\') { esc = true; continue; }
                    if (c === '"') { inQ = !inQ; continue; }
                    if (!inQ) {
                        if (c === '{') depth++;
                        if (c === '}' && --depth === 0) {
                            try { return JSON.parse(s.slice(st, i + 1)); } catch(_) { return null; }
                        }
                    }
                }
                return null;
            }
        }

        // Ã¢â€â‚¬Ã¢â€â‚¬ GÃ¡Â»Âi AI 1 chunk qua CÃ¡Â»â€¢ng Trung Gian (NexusMMO / OpenAI-Compatible) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
        async function callChunk(chunkText, chunkIdx, totalChunks, timeoutMs) {
            const apiKey = getNextApiKey();
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), timeoutMs);
            try {
                const body = {
                    model: MODEL_NAME,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user',   content: `Chunk ${chunkIdx + 1}/${totalChunks}:\n${chunkText}` }
                    ],
                    temperature: 0,
                    max_tokens: 4096,
                    thinking: { type: 'disabled' }
                };
                const r = await fetch(`${BASE_URL}/chat/completions`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: ctrl.signal
                });
                clearTimeout(timer);
                if (!r.ok) {
                    const errTxt = await r.text();
                    throw new Error(`HTTP ${r.status}: ${errTxt}`);
                }
                const data = await r.json();
                const raw  = data.choices?.[0]?.message?.content || '{}';
                const parsed = parseJSONSafe(raw);
                if (!parsed || !Array.isArray(parsed.names) || parsed.names.length === 0) {
                    console.log(`[Extract] Chunk ${chunkIdx + 1}/${totalChunks} không có tên: ${String(raw).slice(0, 200)}`);
                }
                return parsed?.names || [];
            } catch(e) { clearTimeout(timer); throw e; }
        }

        // Ã¢â€â‚¬Ã¢â€â‚¬ Worker pool: concurrency=10 per key, retry=3, timeout=90s Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
        const ignoreRulesSet = loadIgnoreRules();
        const existingNames  = _loadExistingNames();
        const CONC = parseInt(process.env.CONCURRENCY) || Math.max(10, 10 * API_KEYS.length), RETRIES = 3, TIMEOUT = 90000;
        const total = chunks.length;
        const allRaw = [];
        let curIdx = 0;

        async function worker() {
            while (curIdx < total) {
                const i = curIdx++;
                let ok = false;
                for (let attempt = 1; attempt <= RETRIES && !ok; attempt++) {
                    try {
                        const names = await callChunk(chunks[i], i, total, TIMEOUT);
                        allRaw.push(...names);
                        ok = true;
                    } catch(e) {
                        console.error(`[Extract] Worker lỗi chunk ${i + 1}/${total}: ${e.message}`);
                        if (attempt < RETRIES) await new Promise(r => setTimeout(r, Math.min(8000, 1000 * Math.pow(2, attempt))));
                    }
                }
            }
        }
        await Promise.all(Array.from({ length: Math.min(CONC, total) }, () => worker()));

        // Ã¢â€â‚¬Ã¢â€â‚¬ Filter nhÃ¡ÂºÂ¹: ignore_rules + chÃ¡Â»Â©c xÃ†Â°ng cÃ†Â¡ bÃ¡ÂºÂ£n Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
        const commonTitles = new Set([
            'công tử','thế tử','sư huynh','sư tỷ','sư muội','sư đệ','lão gia','phu nhân',
            'tiểu thư','trưởng lão','môn chủ','bang chủ','gia chủ','hoàng đế','thái tử',
            'công chúa','hoàng tử','đại nhân','tiền bối','đạo hữu','tướng quân','pháp sư',
            'tu sĩ','võ giả','hoàng hậu','thái hậu','bác sĩ','thành chủ','viện trưởng',
            'chưởng môn','lão tổ','yêu ma','yêu thú','dị thú','thần thú','linh thú','ma thú'
        ]);

        const cleanMap  = new Map();
        const trashList = [];

        allRaw.forEach(item => {
            if (!item || !item.chinese) return;
            const cn = _cleanCNPunct(item.chinese);
            if (!cn || cn.length < 2 || !_isHan(cn.charAt(0))) return;

            let vi = (item.hanviet && item.hanviet.trim())
                ? _fixLiSpelling(_cleanCNPunct(item.hanviet))
                : _translateHV(cn);
            if (!vi) { trashList.push({ chinese: cn, hanviet: '(no-hv)' }); return; }

            const cnL = cn.toLowerCase(), viL = vi.toLowerCase();
            let ignored = ignoreRulesSet.has(cnL) || ignoreRulesSet.has(viL);
            if (!ignored && !isProperName(cn, vi, 'eastern')) ignored = true;
            if (ignored) { trashList.push({ chinese: cn, hanviet: vi }); return; }
            if (existingNames.has(cn)) return;

            const count = parseInt(item.count) || 1;
            if (cleanMap.has(cn)) {
                cleanMap.get(cn).count += count;
            } else {
                cleanMap.set(cn, { chinese: cn, hanviet: vi, category: item.category || 'Person', count });
            }
        });

        const clean = Array.from(cleanMap.values()).sort((a, b) => b.count - a.count);
        res.json({ success: true, clean, trash: trashList, totalChunks: total, totalRaw: allRaw.length });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Lỗi 2: Thêm /api/ai-config để frontend lấy được baseUrl + model + apiKey từ env
app.get('/api/ai-config', (req, res) => {
    const keys = RAW_KEYS_EARLY.split(',').map(k => k.trim()).filter(Boolean);
    const isAdmin = Boolean(ADMIN_KEY) && req.headers['x-admin-key'] === ADMIN_KEY;
    res.json({
        success: true,
        baseUrl: BASE_URL_EARLY,
        model: MODEL_NAME_EARLY,
        apiKey: isAdmin ? (keys[0] || '') : ''
    });
});

// Lỗi 5: /api/proxy-extract với domain allowlist chống SSRF
const PROXY_ALLOWED_HOSTS = new Set([
    'api.nexusmmo.store',
    'api.deepseek.com',
    'generativelanguage.googleapis.com'
]);

app.post('/api/proxy-extract', rateLimit, async (req, res) => {
    try {
        const { targetUrl, headers, body } = req.body;
        if (!targetUrl) {
            return res.status(400).json({ success: false, error: 'Thiếu targetUrl' });
        }
        // Kiểm tra domain allowlist
        let parsedUrl;
        try { parsedUrl = new URL(targetUrl); } catch(_) {
            return res.status(400).json({ success: false, error: 'targetUrl không hợp lệ' });
        }
        if (!PROXY_ALLOWED_HOSTS.has(parsedUrl.hostname)) {
            return res.status(403).json({ success: false, error: `Domain không được phép: ${parsedUrl.hostname}` });
        }

        const fetchOptions = {
            method: 'POST',
            headers: headers || { 'Content-Type': 'application/json' },
            body: typeof body === 'object' ? JSON.stringify(body) : body
        };

        const response = await fetch(targetUrl, fetchOptions);
        const resText = await response.text();
        res.status(response.status).send(resText);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Health check cho Render
app.get('/healthz', (req, res) => {
    res.json({ success: true, status: 'ok' });
});

// Lỗi 4: Chỉ serve thư mục public/ thay vì toàn bộ APP_DIR để không lộ server.js, package.json, data/
app.use(express.static(PUBLIC_DIR, {
    dotfiles: 'deny',
    index: 'index.html',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    }
}));

const server = app.listen(PORT, () => {
    console.log(`✅ Name Extractor server listening on port ${PORT}`);
});