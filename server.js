const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const dataDir = path.join(__dirname, '../data');
const ignoreRulesFile = path.join(dataDir, 'ignore_rules.txt');
const namesFile = path.join(dataDir, 'Names.txt');

function loadIgnoreRules() {
    const ignoreRulesSet = new Set();
    if (fs.existsSync(ignoreRulesFile)) {
        const lines = fs.readFileSync(ignoreRulesFile, 'utf-8').split(/\r?\n/);
        lines.forEach(l => {
            const trimmed = l.trim().toLowerCase();
            if (trimmed) ignoreRulesSet.add(trimmed);
        });
    }
    return ignoreRulesSet;
}

// API: POST /api/filter
app.post('/api/filter', (req, res) => {
    try {
        const { names = [] } = req.body;
        const clean = [];
        const trash = [];
        const ignoreRulesSet = loadIgnoreRules();

        const commonTitles = new Set(['công tử','thế tử','sư huynh','sư tỷ','sư muội','sư đệ','lão gia','phu nhân','tiểu thư','trưởng lão','môn chủ','bang chủ','gia chủ','hoàng đế','thái tử','công chúa','hoàng tử','đại nhân','tiền bối','đạo hữu','tướng quân','pháp sư','tu sĩ','võ giả','hoàng hậu','thái hậu','bác sĩ','thành chủ','viện trưởng','chưởng môn','lão tổ','yêu ma','yêu thú','dị thú','thần thú','linh thú','ma thú']);

        names.forEach(entry => {
            if (!entry || !entry.chinese || !entry.hanviet) return;
            const zh = entry.chinese.trim().toLowerCase();
            const vi = entry.hanviet.trim().toLowerCase();

            let isIgnored = false;
            for (const rule of ignoreRulesSet) {
                if (zh.includes(rule) || vi.includes(rule)) {
                    isIgnored = true;
                    break;
                }
            }
            if (isIgnored) { trash.push(entry); return; }
            if (commonTitles.has(vi)) { trash.push(entry); return; }
            if (entry.isTrash) { trash.push(entry); return; }
            if (entry.chinese.length < 2) { trash.push(entry); return; }

            clean.push(entry);
        });

        res.json({ success: true, clean, trash, totalIgnoredRules: ignoreRulesSet.size });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// API: GET /api/get-ignore
app.get('/api/get-ignore', (req, res) => {
    try {
        let text = '';
        if (fs.existsSync(ignoreRulesFile)) {
            text = fs.readFileSync(ignoreRulesFile, 'utf-8');
        }
        res.json({ success: true, text });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// API: POST /api/save-ignore
app.post('/api/save-ignore', (req, res) => {
    try {
        const { rules = [], text = null } = req.body;
        if (text !== null) {
            fs.mkdirSync(path.dirname(ignoreRulesFile), { recursive: true });
            fs.writeFileSync(ignoreRulesFile, text, 'utf-8');
            res.json({ success: true, count: text.split(/\r?\n/).filter(Boolean).length });
        } else {
            const existing = loadIgnoreRules();
            const toAdd = rules.map(r => r.trim().toLowerCase()).filter(r => r && !existing.has(r));
            if (toAdd.length > 0) {
                fs.mkdirSync(path.dirname(ignoreRulesFile), { recursive: true });
                fs.appendFileSync(ignoreRulesFile, '\n' + toAdd.join('\n'), 'utf-8');
            }
            res.json({ success: true, added: toAdd.length });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// API: POST /api/save-names
app.post('/api/save-names', (req, res) => {
    try {
        const { names = [] } = req.body;
        const existing = new Set();
        if (fs.existsSync(namesFile)) {
            fs.readFileSync(namesFile, 'utf-8').split(/\r?\n/).forEach(l => {
                if (l.includes('=')) existing.add(l.split('=')[0].trim());
            });
        }
        const toAdd = names.filter(n => n.chinese && n.hanviet && !existing.has(n.chinese.trim()));
        if (toAdd.length > 0) {
            fs.mkdirSync(path.dirname(namesFile), { recursive: true });
            fs.appendFileSync(namesFile, '\n' + toAdd.map(n => `${n.chinese.trim()}=${n.hanviet.trim()}`).join('\n'), 'utf-8');
        }
        res.json({ success: true, added: toAdd.length, skipped: names.length - toAdd.length });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Serve static frontend files
app.use(express.static(__dirname));

app.listen(PORT, () => {
    console.log(`Name Extractor Server running on port ${PORT}`);
});
