// filter.js - Bộ lọc thông minh Lớp 2 Hán-Việt
// Chuyên trị rác từ AI khi dịch thuật tên riêng từ tiếng Trung sang Việt Phrase

// 1. Danh sách từ thường (viết thường hoàn toàn)
const commonLowercaseWords = new Set([
  "hạt trác ma", "tẩu mã đăng", "hồi quang phản chiếu", "tác kén tự phược", "họa địa vi lao", "hùng bão",
  "pháp nhãn như cự", "cuồng tượng bôn tập", "liệt hỏa phần tâm", "vạn quân đạp địa",
  "vạn tức biện tung", "âm nhận xé phong", "chướng thiên diệt địa", "hung huyết xung chàng", "huyết lô cuồng hóa",
  "yêu ma", "triều đình", "niết bàn", "viễn chinh đội", "tín ngưỡng giả", "thạch liệu", 
  "liên lạc xứ", "thổ địa miếu", "linh dược đội", "trận đồ tổng cương", "thùy tại trọng khởi thế giới?", 
  "tứ hải thăng bình", "tuyết lĩnh phủ binh", "yêu ma viện lạc", "nhân quan vũ trụ", "hồng trần tiên lộ",
  "hắc ám vật chất", "chân tiên đại kiếp", "tiên vương đại kiếp", "đại thiên vũ trụ", "bạo long cấp",
  "hoàng đạo lĩnh vực", "tế đạo lĩnh vực", "tiên vương lĩnh vực", "pháp tắc lôi trì", "chiến tiên chi đạo",
  "vô thượng thần thuật", "nguyên sơ vật chất", "trường sinh chủng", "nguyên thần hợp đạo binh", "lộ nhân giáp",
  "tập kích bất ngờ", "thời quang chi lực", "thi họa tội khôi họa thủ", "vạn gia đăng hỏa", "tương thân tương ái",
  "đối đầu", "đến đầu", "chương 4674:", "chương 4576:"
]);

// 2. Chức xưng, vai vế và danh từ chung hay bị AI viết hoa linh tinh
const commonTitles = new Set([
  "công tử", "thế tử", "huyện lệnh", "huyện úy", "sư huynh", "sư tỷ", "sư muội", "sư đệ", 
  "đại sư huynh", "đại sư tỷ", "đại sư muội", "đại sư đệ", "lão gia", "phu nhân", "tiểu thư", 
  "trưởng lão", "môn chủ", "bang chủ", "gia chủ", "quân sư", "chủ nhân", "đệ tử", "nhân vật",
  "hoàng đế", "thái tử", "công chúa", "hoàng tử", "đại nhân", "tiền bối", "đạo hữu", "đạo sĩ", 
  "tướng quân", "đại tướng quân", "tông sư", "đại tông sư", "pháp sư", "tu sĩ", "võ giả",
  "hoàng hậu", "phi tần", "quý phi", "thái hậu", "bác sĩ", "thành chủ", "viện trưởng", "chưởng môn",
  "lão tổ", "gia tộc", "phu quân", "nhân loại", "tông môn", "thần tiên", "tiên nhân", "phàm nhân",
  "đệ tử nội môn", "đệ tử ngoại môn", "tiểu hữu", "nội viện", "ngoại viện", "tiên thị", "tộc nhân",
  "yêu ma", "yêu thú", "dị thú", "thần thú", "linh thú", "ma thú", "sinh vật", "dã thú", "hung thú"
]);

// 3. Các từ lót hợp lệ thường thấy trong tên riêng
const allowedLower = new Set([
  "cung", "chủ", "lão", "quái", "đạo", "nhân", "chân", "sư", "huynh", "vương", "phủ", "tỷ", "ca", "mỗ", 
  "bản", "tiền", "bối", "hữu", "hội", "phó", "tổng", "quản", "trưởng", "đội", "chưởng", "quỹ", "thần", 
  "y", "đại", "cô", "nương", "công", "tử", "tiêu", "thư", "tông", "môn", "gia", "viện", "điện", "phái", 
  "đường", "ty", "quật", "trại", "giáo", "các", "thương", "nhất", "song", "thất", "lục", "bát", "cửu", 
  "thập", "nhị", "vạn", "thiên", "bách", "đan", "thuật", "kinh", "quyết", "điển", "kiếm", "thương", 
  "trận", "pháp", "chưởng", "châm", "chỉ", "bộ", "độn", "đỉnh", "ấn", "phiên", "phiến", "bút", "châu", 
  "xích", "kính", "chung", "quan", "côn", "bào", "thần", "quân", "hải", "sơn", "mạch", "thành", "lục", 
  "hồ", "cương", "động", "trấn", "cốc", "hẻm", "đình", "trường", "tỉnh", "đế", "hoàng", "thượng", "yêu", 
  "thánh", "vương", "quân", "đặc", "biệt", "lộ", "bối", "khu", "hẻm", "địa", "chỉ", "quần", "tha", "mụ", "muội", 
  "hạ", "tổ", "nữ", "cha", "đa", "đệ", "tế", "linh", "thủy", "chí", "tôn", "cổ", "thụ", "phần", "phân", 
  "phương", "thị", "thực", "thuyền", "cấp", "tặc", "tiểu", "lang", "tộc", "mãng", "hổ", "ma", "đồ", 
  "đằng", "phường", "quán", "thảo", "lũ", "ba", "di", "quỷ", "phẩm", "độ", "kiếp", "thể", "hồn", "phách", "cảnh",
  "nhi", "thúc", "bá", "thế", "tướng", "hiệu", "nhiệm", "mẫu", "phu", "đồng", "giả", "soái", "tiên",
  "bà", "khanh", "chấp", "hộ", "đầu", "bí", "phụng", "thí", "thiếu", "phiêu", "thôn", "tự", "tọa", "tứ", "tam", 
  "ngũ", "lâu", "cục", "giới", "đông", "nam", "tây", "bắc", "trung",
  "ibn", "vi", "von", "van", "du", "de", "la", "le", "da", "di", "mac", "mc", "el", "al", "and"
]);

// 4. Các tiền tố báo hiệu cụm danh từ riêng
const properPrefixes = new Set([
  "đảo", "núi", "thác", "tháp", "sân", "nhà", "người", "phái", "bang", "hội", "quận", "vịnh", "giải", "tiếng", "sông", "đoàn"
]);

// 5. Chuẩn hóa chuỗi tiếng Việt Unicode dựng sẵn (NFC)
function normalizeNFC(str) {
  return str.normalize("NFC");
}

function isCapitalizedWord(word) {
  const cleanWord = word.replace(/[^a-zA-ZÀ-ỹ]/g, "");
  if (!cleanWord) return false;
  return cleanWord[0] === cleanWord[0].toUpperCase() && cleanWord[0] !== cleanWord[0].toLowerCase();
}

function isAllCaps(word) {
  const cleanWord = word.replace(/[^a-zA-Z]/g, "");
  return cleanWord.length >= 2 && cleanWord === cleanWord.toUpperCase();
}

// Hàm chính lọc tên riêng
function isProperName(chinese, hanviet, type = "eastern") {
  if (!hanviet) return false;
  if (hanviet.includes("/")) {
    return hanviet.split("/").some(part => isProperName(chinese, part, type));
  }

  const viClean = normalizeNFC(hanviet.replace(/[《》]/g, "").trim());
  const viLower = viClean.toLowerCase();

  // 1. Kiểm tra danh sách rác cứng & Bẫy lọc rác nâng cao (Lớp 2.2)
  if (commonLowercaseWords.has(viLower) || commonTitles.has(viLower)) {
    return false;
  }

  // Lọc các từ chỉ vật phẩm/spell dạng mô tả chung chung có chứa "chi" (之)
  if (chinese.includes("之") && !chinese.includes("·") && !chinese.includes("•")) {
    const isGenericOf = chinese.endsWith("门") || chinese.endsWith("书") || chinese.endsWith("箭") || 
                          chinese.endsWith("刃") || chinese.endsWith("触") || chinese.endsWith("石") || 
                          chinese.endsWith("水") || chinese.endsWith("火") || chinese.endsWith("光") || 
                          chinese.endsWith("影") || chinese.endsWith("心") || chinese.endsWith("魂") || 
                          chinese.endsWith("血") || chinese.endsWith("体") || chinese.endsWith("骨") ||
                          chinese.endsWith("力") || chinese.endsWith("拥");
    if (isGenericOf) {
      return false;
    }
  }

  // Sắp xếp các hậu tố rác của vật phẩm, quái vật, kỹ thuật chung
  const genericSuffixesCN = ["甲", "铠", "靴", "盔", "帽", "戒", "链", "袍", "鞍", "线", "飞弹", "导弹", "火枪", "大炮", "骷髅", "丧尸", "僵尸", "野猪", "药剂", "魔药", "药水", "药草", "灵草", "流"];
  if (genericSuffixesCN.some(s => chinese.endsWith(s))) {
    return false;
  }

  // Lọc các danh từ chung đơn thuần
  const genericWordsCN = new Set(["精准", "毁灭者", "记录者", "超越者", "掌控者", "撕裂者", "守护者", "漫步者", "探索者", "遗迹", "废墟", "要塞", "堡垒", "战舰", "巨舰", "圣船", "飞船"]);
  if (genericWordsCN.has(chinese)) {
    return false;
  }

  // Kết hợp tiền tố & hậu tố chung
  const genericPrefixesCN = ["以太", "远古", "死黑", "机械", "吸血", "虚妄", "精神", "心脏", "幽冥", "复活", "记录者", "无面", "血魔"];
  const genericBaseSuffixes = ["骑士", "巫师", "女巫", "魔女", "怪物", "异兽", "巨兽", "甲虫", "地宫", "墓园", "位面", "高地", "高原", "档案馆", "图书馆", "学院", "要塞", "堡垒", "废墟", "遗迹", "城堡", "庄园", "小屋", "战舰", "古渊", "深渊", "高塔", "环塔", "教团", "学会", "协会", "会", "帮", "教", "阁", "殿", "门", "谷", "城", "域", "学者", "飞船"];
  if (genericPrefixesCN.some(p => chinese.startsWith(p)) && genericBaseSuffixes.some(s => chinese.endsWith(s))) {
    return false;
  }

  // Đối với truyện Quốc tế (western), nếu tên đã được khôi phục thành dạng tiếng Anh/Latin
  // (ví dụ: "Robert", "Mercury", "Natsume Chikage") thì giữ lại luôn làm tên riêng sạch.
  if (type === "western") {
    // Nếu chứa ký tự Latin chuẩn và viết hoa (không thuộc danh sách rác cứng ở trên)
    const hasEnglishLetters = /^[a-zA-Z\s·-]+$/.test(viClean);
    if (hasEnglishLetters && viClean[0] === viClean[0].toUpperCase()) {
      return true;
    }
  }

  const words = viClean.split(/\s+/);
  if (words.length === 0) return false;
  const wordsL = words.map(w => w.toLowerCase());

  // 2. Chức nghiệp (đệ tử)
  if (wordsL.length >= 2) {
    const lastTwo = wordsL.slice(-2).join(" ");
    if (lastTwo === "đệ tử") {
      return false;
    }
  }

  // 4. Các loại đồ ăn ("nhục")
  const lastWord = wordsL[wordsL.length - 1];
  if (lastWord === "nhục") {
    return false;
  }

  // 5. Thú / yêu thú chung ("thú" hoặc "thú vương")
  if (wordsL.length >= 2 && ["thú", "thú vương"].includes(lastWord)) {
    const beastPrefixes = ["chân", "tai", "dị", "yêu", "thần", "linh", "hung", "dã", "ma", "ngũ"];
    if (beastPrefixes.includes(wordsL[wordsL.length - 2])) {
      return false;
    }
  }

  // 7. Địa điểm chung viết hoa sai
  const commonLocations = new Set([
    "nội thành", "ngoại thành", "nội viện", "ngoại viện", "quyền viện", 
    "huyện nha", "huyền nha", "phủ nha", "ngoại thành quách"
  ]);
  if (commonLocations.has(viLower)) {
    return false;
  }

  // 8. Từ đơn
  if (words.length === 1) {
    return isCapitalizedWord(words[0]) && !isAllCaps(words[0]);
  }

  // 9. Cụm từ có chữ đầu viết thường nhưng có tiền tố được phép và từ viết hoa đi kèm
  const firstCap = isCapitalizedWord(words[0]);
  if (!firstCap) {
    const w0Clean = words[0].replace(/[^a-zA-ZÀ-ỹ]/g, "").toLowerCase();
    if (properPrefixes.has(w0Clean) || allowedLower.has(w0Clean)) {
      const hasCapAfter = words.slice(1).some(w => isCapitalizedWord(w));
      if (hasCapAfter) {
        if (/[;.,，]/g.test(viClean)) return false;
        return true;
      }
    }
    return false;
  }

  // 10. Cụm từ dài
  if (words.length <= 3) {
    return true;
  }

  if (/[;.,，]/g.test(viClean)) {
    const capCount = words.filter(w => isCapitalizedWord(w) || allowedLower.has(w.replace(/[^a-zA-ZÀ-ỹ]/g, "").toLowerCase())).length;
    return (capCount / words.length) >= 0.7;
  }

  const hasCapAfter = words.slice(1).some(w => isCapitalizedWord(w));
  return hasCapAfter;
}

// --- BỘ DỊCH TỪ ĐIỂN HÁN-VIỆT NỘI BỘ ---

function Wv(u) {
  const o = new Map();
  if (!u) return o;
  for (const r of u.split(/\r?\n/)) {
    const c = r.replace(/^\uFEFF/, "").trim();
    if (!c || c.startsWith("#")) continue;
    const f = c.indexOf("=");
    if (f <= 0) continue;
    const m = c.slice(0, f).trim(),
          y = c.slice(f + 1).replace(/\s+/g, " ").trim();
    if (Array.from(m).length === 1 && y) {
      o.set(m, y);
    }
  }
  return o;
}

function Fv(u) {
  const o = [];
  if (!u) return o;
  for (const r of u.split(/\r?\n/)) {
    const c = r.replace(/^\uFEFF/, "").trim();
    if (!c || c.startsWith("#")) continue;
    const f = c.indexOf("=");
    if (f <= 0) continue;
    const m = c.slice(0, f).trim(),
          y = c.slice(f + 1).replace(/\s+/g, " ").trim().toLowerCase();
    const x = Array.from(m);
    if (x.length < 2 || !x.every(S => Po(S)) || !y) continue;
    o.push({ key: m, words: y.split(" ") });
  }
  return o.sort((r, c) => Array.from(c.key).length - Array.from(r.key).length || c.key.length - r.key.length);
}

function Po(u) {
  return new RegExp("\\p{Script=Han}", "u").test(u);
}

function Pv(u) {
  return u === "·" || u === "・" || u === "•" || u === "-" || u === "‐" || u === "‑" || u === "‒" || u === "–" || u === "—" || u === "―" || u === "－";
}

function t0(u) {
  return u.split(/\s+/).filter(Boolean).map(o => o.charAt(0).toUpperCase() + o.slice(1).toLowerCase()).join(" ");
}

function Im(u) {
  return t0(u);
}

// Khởi tạo các Map tra cứu từ điển
let kv = null;
let qv = null;

function initDictionary() {
  if (!kv && typeof ovDataRaw !== "undefined") {
    kv = Wv(ovDataRaw);
  }
  if (!qv && typeof gmDataRaw !== "undefined") {
    qv = Fv(gmDataRaw);
  }
}

// Tập hợp từ Hán Việt dùng để nhận biết tên riêng tiếng Anh/Latin
let viDictWords = null;
function initViDictWords() {
  if (viDictWords) return;
  initDictionary();
  viDictWords = new Set();
  if (kv) {
    for (const val of kv.values()) {
      val.toLowerCase().split(/\s+/).forEach(w => viDictWords.add(w));
    }
  }
  if (qv) {
    qv.forEach(({ words }) => {
      words.forEach(w => viDictWords.add(w));
    });
  }
  // Các từ đệm/từ khóa Hán Việt chung dùng trong đặt tên dịch
  const extra = [
    "của", "và", "nhà", "người", "đảo", "thác", "tháp", "sân", "vịnh", "giải", "tiếng", "đoàn", "nhóm", "cánh", "đồng", "sau", "trước", "dưới", "trên",
    "gia", "tộc", "hiệp", "sĩ", "phu", "nhân", "lão", "tiểu", "phố", "thị", "trấn", "núi", "sông", "hồ", "rừng", "lâu", "đài", "vương", "quốc", "lãnh", "địa", "thương", "hội", "quán", "rượu", "đại", "chủ", "giáo", "công", "tước", "bá", "hầu", "nam", "tử", "đông", "nam", "tây", "bắc", "trung", "phái", "bang", "hội"
  ];
  extra.forEach(w => viDictWords.add(w));
}

// Hàm chính tra từ điển dịch Hán-Việt
function translateChineseToHanViet(chineseText) {
  initDictionary();
  if (!kv || !qv) return "";
  
  const o = Array.from(chineseText.trim());
  const r = [];
  let c = false, f = false, m = 0;
  
  while (m < o.length) {
    const y = o[m];
    if (Po(y)) {
      const x = o.slice(m).join("");
      const S = qv.find(({ key: j }) => x.startsWith(j));
      if (S) {
        r.push(...S.words);
        m += Array.from(S.key).length;
        c = true;
        f = false;
        continue;
      }
      const d = kv.get(y);
      if (!d) return "";
      r.push(d);
      c = true;
      f = false;
      m++;
      continue;
    }
    if (/\s/u.test(y)) {
      m++;
      continue;
    }
    if (Pv(y)) {
      if (!c || f) {
        m++;
        continue;
      }
      r.push("·");
      f = true;
      m++;
      continue;
    }
    return "";
  }
  
  while (r[r.length - 1] === "·") r.pop();
  return c ? Im(r.join(" ")) : "";
}
