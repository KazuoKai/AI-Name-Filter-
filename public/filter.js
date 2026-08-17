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
  "đối đầu", "đến đầu", "chương 4674:", "chương 4576:",
  "vạn sự thắng ý", "tân thời đại", "mễ phấn", "phấn điếm", "tu sĩ", "tu si", "yêu ma", "tu la thần"
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
  "phương", "th thị", "thực", "thuyền", "cấp", "tặc", "tiểu", "lang", "tộc", "mãng", "hổ", "ma", "đồ", 
  "đằng", "phường", "quán", "thảo", "lũ", "ba", "di", "quỷ", "phẩm", "độ", "kiếp", "thể", "hồn", "phách", "cảnh",
  "nhi", "thúc", "bá", "thế", "tướng", "hiệu", "nhiệm", "mẫu", "phu", "đồng", "giả", "soái", "tiên",
  "bà", "khanh", "chấp", "hộ", "đầu", "bí", "phụng", "thí", "thiếu", "phiêu", "thôn", "tự", "tọa", "tứ", "tam", 
  "ngũ", "lâu", "cục", "giới", "đông", "nam", "tây", "bắc", "trung",
  "ibn", "vi", "von", "van", "du", "de", "la", "le", "da", "di", "mac", "mc", "el", "al", "and"
]);

// Danh sách Họ phổ biến Trung Quốc (dành cho bộ lọc thông minh 2 chữ)
const CHINESE_SURNAMES = new Set([
  "李", "王", "张", "刘", "陈", "杨", "赵", "黄", "周", "吴", "徐", "孙", "胡", "朱", "高", "林", "何", "郭", "马", "罗", 
  "梁", "宋", "郑", "谢", "韩", "唐", "冯", "于", "董", "萧", "程", "曹", "袁", "邓", "许", "傅", "沈", "曾", "彭", "吕", 
  "苏", "卢", "蒋", "蔡", "贾", "丁", "魏", "薛", "叶", "阎", "余", "潘", "杜", "戴", "夏", "钟", "汪", "田", "任", "姜", 
  "范", "方", "石", "姚", "谭", "廖", "邹", "熊", "金", "陆", "郝", "孔", "白", "崔", "康", "毛", "邱", "秦", "江", "史", 
  "顾", "侯", "邵", "孟", "龙", "万", "段", "雷", "钱", "湯", "尹", "黎", "易", "常", "武", "乔", "贺", "赖", "龚", "文",
  "司", "慕", "容", "欧", "阳", "诸", "葛", "东", "独", "孤", "尉", "迟", "宫", "姬", "靳", "岳", "斐", "牧", "戚", "裴",
  "祁", "阮", "祝", "童", "简", "耿", "霍", "盛", "甄", "颜", "禹", "詹", "缪", "温", "屠", "闾", "澹", "台", "冷", "厉",
  "楚", "墨", "商", "冉", "曲", "莫", "连", "秋", "印", "封", "花", "景", "风", "云", "夜", "南", "北", "向", "宁", "纪", "喻", "安", "鲁", "盖"
]);

// Hậu tố địa danh/tông phái/pháp bảo/thần thú/võ học hợp lệ
const PROPER_SUFFIXES = new Set([
  "国", "省", "市", "县", "镇", "乡", "村", "山", "河", "江", "湖", "海", "岛", "谷", "泉", "溪", "宗", "门", "派", "帮", "教", "阁", "殿", "寺", "院", "庄", "府", "盟", "路", "街", "领", "堡", "园", "区", "峰", "洞", "部", "团", "眼", "甲", "队", "号",
  "剑", "刀", "枪", "戟", "弓", "鼎", "塔", "印", "镜", "钟", "珠", "琴", "笛", "扇", "鞭", "杖", "符", "阵", "尺", "炉", "龙", "凤", "鹏", "狐", "雀", "麟", "猿", "蛇", "蝶", "蚕", "龟", "兽", "火", "水", "雷", "风", "光", "暗", "冰", "仙", "神", "魔", "圣", "帝", "皇", "武",
  "拳", "掌", "指", "腿", "爪", "步", "体", "身", "功", "法", "经", "诀", "典", "谱", "录", "篇", "卷", "术", "吟", "曲", "歌", "图", "变", "化", "意", "势", "决", "解"
]);

// Bộ chữ chuyên dùng phiên âm tên ngoại quốc / anime / light novel
const TRANSLIT_CHARS = new Set([
  "克", "斯", "德", "尔", "亚", "特", "罗", "贝", "莉", "纳", "维", "萨", "蒙", "森", "莱", "昂", "迪", "普", "姆", "恩", "杰", "瑞", "约", "翰", "逊", "霍", "华", "雅", "卡", "尼", "奇", "拉", "格", "里", "香", "梅", "露", "莎", "艾", "奥", "巴", "法", "赫", "伦",
  "伊", "姆", "团", "藏", "鸣", "根", "忍", "叶", "木", "纲", "手", "蛇", "丸", "斑", "柱", "扉", "鼬", "佐", "助", "路", "飞", "索", "隆", "山", "治", "娜", "美", "宾", "凯", "多", "白", "胡", "黑", "贼", "洛", "海", "写", "轮", "眼", "查"
]);

// Địa danh 2 chữ nổi tiếng không dùng hậu tố chỉ định
const POPULAR_PLACES = new Set([
  "大理", "上海", "北京", "东京", "南京", "西藏", "海南", "云南", "魔都", "帝都", "哥谭", "纽约", "香江", "华夏", "九州", "神州", "湘南", "蜀山", "昆仑", "少林", "武当", "峨眉", "咏春", "太极"
]);

// 4. Các tiền tố báo hiệu cụm danh từ riêng
const properPrefixes = new Set([
  "đảo", "núi", "thác", "tháp", "sân", "nhà", "người", "phái", "bang", "hội", "quận", "vịnh", "giải", "tiếng", "sông", "đoàn"
]);

// Cleans surrounding book title marks / quotes and age/duration prefixes (xx năm) from entities
function cleanEntityPunctuation(str) {
  if (!str) return "";
  let cleaned = str.replace(/^[《“"\'【‹「«\s]+|[》”"\'】›」»\s]+$/g, "").trim();
  const timePrefixCN = /^(?:[0-9一二三四五六七八九十百千万亿]+\s*年|十万年|百万年|千万年|亿年|万年|千年|百年|十年)\s*/;
  if (timePrefixCN.test(cleaned)) {
    cleaned = cleaned.replace(timePrefixCN, "").trim();
  }
  return cleaned;
}

// 5. Chuẩn hóa chuỗi tiếng Việt Unicode dựng sẵn (NFC)
function normalizeNFC(str) {
  return str.normalize("NFC");
}

// Bỏ dấu tiếng Việt
function removeVietnameseTones(str) {
  if (!str) return "";
  return str.normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d").replace(/Đ/g, "D");
}

// Kiểm tra xem chuỗi có chứa dấu tiếng Việt hay không
function hasVietnameseAccents(str) {
  if (!str) return false;
  return /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]/.test(str);
}

// Kiểm tra xem chuỗi AI trả về có phải biến thể không dấu của từ Hán Việt từ điển local hay không
function isUnaccentedHanVietVariant(viAI, dictHV) {
  if (!viAI || !dictHV) return false;
  
  const aiClean = removeVietnameseTones(viAI).toLowerCase().trim();
  const dictClean = removeVietnameseTones(dictHV).toLowerCase().trim();
  
  if (aiClean === dictClean) return true;
  
  const aiWords = aiClean.split(/\s+/);
  const dictWords = dictClean.split(/\s+/);
  
  if (aiWords.length === dictWords.length && aiWords.length >= 2) {
    let matchCount = 0;
    for (let i = 0; i < aiWords.length; i++) {
      const w1 = aiWords[i];
      const w2 = dictWords[i];
      if (w1 === w2 || (w1.length >= 2 && w2.length >= 2 && (w1.slice(0, 2) === w2.slice(0, 2) || w1.slice(-2) === w2.slice(-2)))) {
        matchCount++;
      }
    }
    if (matchCount >= aiWords.length - 1) return true;
  }
  
  return false;
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
function isProperName(chineseRaw, hanvietRaw, type = "eastern") {
  if (!hanvietRaw) return false;

  const chinese = cleanEntityPunctuation(chineseRaw);
  const hanviet = cleanEntityPunctuation(hanvietRaw);

  if (!chinese || !hanviet) return false;

  if (hanviet.includes("/")) {
    return hanviet.split("/").some(part => isProperName(chinese, part, type));
  }

  const viClean = normalizeNFC(hanviet);
  const viLower = viClean.toLowerCase();

  // 1. Kiểm tra danh sách rác cứng & Bẫy lọc rác nâng cao (Lớp 2.2)
  if (commonLowercaseWords.has(viLower) || commonTitles.has(viLower)) {
    return false;
  }

  if (type === "western" || type === "anime") {
    const hasEnglishLetters = /^[a-zA-Z\s·-]+$/.test(viClean);
    if (hasEnglishLetters && viClean[0] === viClean[0].toUpperCase()) {
      return true;
    }
  }

  if (chinese.length === 1 || viClean.split(/\s+/).length === 1) {
    return false;
  }

  if (chinese.length === 2) {
    const firstChar = chinese.charAt(0);
    const lastChar = chinese.charAt(1);
    
    const isSurname = CHINESE_SURNAMES.has(firstChar);
    const isPlaceSuffix = PROPER_SUFFIXES.has(lastChar);
    const isTranslit = TRANSLIT_CHARS.has(firstChar) || TRANSLIT_CHARS.has(lastChar);
    const isPopularPlace = POPULAR_PLACES.has(chinese);
    const isNickname = ["老", "小", "阿"].includes(firstChar);
    const isDoubleChar = (firstChar === lastChar);
    const isForeignAllowed = (type === "anime" || type === "western") && (viClean[0] === viClean[0].toUpperCase());
    
    if (!isSurname && !isPlaceSuffix && !isTranslit && !isPopularPlace && !isNickname && !isDoubleChar && !isForeignAllowed) {
      return false;
    }
  }

  if (chinese.length >= 3) {
    const lastChar = chinese.charAt(chinese.length - 1);
    const genericFacilitySuffixes = ["室", "馆", "站", "处", "中", "班", "楼", "园", "场", "课", "会", "吧", "店", "粉", "版"];
    if (genericFacilitySuffixes.includes(lastChar) || (lastChar === "科" && (chinese.endsWith("务科") || chinese.endsWith("政科") || chinese.endsWith("生科") || chinese.endsWith("理科") || chinese.endsWith("文科")))) {
      return false;
    }
  }

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

  const genericSuffixesCN = ["铠", "靴", "盔", "帽", "戒", "链", "袍", "鞍", "线", "飞弹", "导弹", "火枪", "大炮", "骷髅", "丧尸", "僵尸", "野猪", "药剂", "魔药", "药水", "药草", "灵草", "流", "骨", "器", "环", "解", "徒", "婆", "带", "卡", "包", "盒", "仪", "考", "力", "纸"];
  if (genericSuffixesCN.some(s => chinese.endsWith(s)) && !chinese.endsWith("遁甲")) {
    return false;
  }

  const genericWordsCN = new Set([
    "精准", "毁灭者", "记录者", "超越者", "掌控者", "撕裂者", "守护者", "漫步者", "探索者", "遗迹", "废墟", "要塞", "堡垒", "战舰", "巨舰", "圣船", "飞船",
    "卫生纸", "山洞", "波涛汹涌", "黄金一代", "头号叛徒", "多金小富婆", "三魂核凝聚法", "道种法", "悟道丹",
    "本命魂环", "魂导器", "唐门暗器", "外附魂骨", "超神器", "乱披风锤法", "自适应魂环", "自凝魂环",
    "信仰之力", "海神之光", "魂兽探测仪", "十大核心竞争力", "六翼天使武魂", "四大大单属性家族", "尖尾雨燕武魂",
    "姐姐管得严", "我不是社恐", "性感小舔猫", "蓝电霸王龙家族", "魂师精英大赛", "全大陆高级魂师学院精英大赛",
    "威压", "契约", "复制", "土和", "铜镜", "奇怪", "自由", "石子", "非凡", "穿梭", "贫民窟", "坊市", "牵引", "风行", "残阳", "大运", "孤狼", "感知", "黑市", "檀香", "世界", "精致", "坐骑", "能量", "起源", "山门", "前世", "白刃", "灭绝", "禁区", "金光", "关中", "不灭", "沉重", "光幕", "了然", "法阵", "炼化", "沉默", "知识", "融合", "桥头", "无敌", "陀螺", "分身", "嘲讽", "虚空", "表哥", "梦魇", "怪物", "存在", "吞噬", "自信", "骄傲", "机制", "机遇", "无礼", "独尊", "复活", "渴望", "生命", "睥睨", "绝望", "修仙", "进贡", "天赋", "灌顶", "归化", "选择", "规则", "成仙", "镇压", "困境", "无犯", "执念", "虚幻", "破限", "顺应", "交换", "勘破", "邪恶", "星辰", "污染", "压制", "分解", "狱卒", "色欲", "黑暗", "预警", "废物", "愤怒", "审判", "贪婪", "轮回", "灭世", "序列", "服气", "操场", "阳光", "时空", "系统", "湮灭", "天幕", "嫉妒", "随风", "诡异", "功法", "侍女", "紫色", "识海", "土地", "玉简", "永恒", "通道", "命运", "大道", "闪烁", "光芒", "尘埃", "火焰", "大小", "传音", "苍生", "老者", "善良", "虚无", "寻常", "短刀", "裁判", "安然", "可能", "情报", "记忆", "一指"
  ]);
  if (genericWordsCN.has(chinese)) {
    return false;
  }

  if (chinese.toLowerCase().includes("buff") || viClean.toLowerCase().includes("buff") || chinese.includes(" ") || chinese.includes("+") || chinese.includes("=")) {
    return false;
  }

  if ((chinese.includes("不") || chinese.includes("得")) && chinese.length >= 4 && !chinese.includes("·") && !chinese.includes("•")) {
    return false;
  }

  if (chinese.length >= 6 && !chinese.includes("·") && !chinese.includes("•") && !viClean.includes("·")) {
    const isAllowedLongEntity = type === "anime" || type === "western" || 
      chinese.endsWith("海贼团") || chinese.endsWith("团") || chinese.endsWith("写轮眼") || chinese.endsWith("眼") || chinese.endsWith("号") || chinese.endsWith("阵") || chinese.endsWith("术");
    if (!isAllowedLongEntity) {
      return false;
    }
  }

  const genericPrefixesCN = ["以太", "远古", "死黑", "机械", "吸血", "虚妄", "精神", "心脏", "幽冥", "复活", "记录者", "无面", "血魔"];
  const genericBaseSuffixes = ["骑士", "巫师", "女巫", "魔女", "怪物", "异兽", "巨兽", "甲虫", "地宫", "墓园", "位面", "高地", "高原", "档案馆", "图书馆", "学院", "要塞", "堡垒", "废墟", "遗迹", "城堡", "庄园", "小屋", "战舰", "古渊", "深渊", "高塔", "环塔", "教团", "学会", "协会", "会", "帮", "教", "阁", "殿", "门", "谷", "城", "域", "学者", "飞船"];
  if (genericPrefixesCN.some(p => chinese.startsWith(p)) && genericBaseSuffixes.some(s => chinese.endsWith(s))) {
    return false;
  }

  const words = viClean.split(/\s+/);
  if (words.length === 0) return false;
  const wordsL = words.map(w => w.toLowerCase());

  if (wordsL.length >= 2) {
    const lastTwo = wordsL.slice(-2).join(" ");
    if (lastTwo === "đệ tử") {
      return false;
    }
  }

  const lastWord = wordsL[wordsL.length - 1];
  if (lastWord === "nhục") {
    return false;
  }

  if (wordsL.length >= 2 && ["thú", "thú vương"].includes(lastWord)) {
    const beastPrefixes = ["chân", "tai", "dị", "yêu", "thần", "linh", "hung", "dã", "ma", "ngũ"];
    if (beastPrefixes.includes(wordsL[wordsL.length - 2])) {
      return false;
    }
  }

  const commonLocations = new Set([
    "nội thành", "ngoại thành", "nội viện", "ngoại viện", "quyền viện", 
    "huyện nha", "huyền nha", "phủ nha", "ngoại thành quách"
  ]);
  if (commonLocations.has(viLower)) {
    return false;
  }

  if (words.length === 1) {
    return false;
  }

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
  const extra = [
    "của", "và", "nhà", "người", "đảo", "thác", "tháp", "sân", "vịnh", "giải", "tiếng", "đoàn", "nhóm", "cánh", "đồng", "sau", "trước", "dưới", "trên",
    "gia", "tộc", "hiệp", "sĩ", "phu", "nhân", "lão", "tiểu", "phố", "thị", "trấn", "núi", "sông", "hồ", "rừng", "lâu", "đài", "vương", "quốc", "lãnh", "địa", "thương", "hội", "quán", "rượu", "đại", "chủ", "giáo", "công", "tước", "bá", "hầu", "nam", "tử", "đông", "nam", "tây", "bắc", "trung", "phái", "bang", "hội"
  ];
  extra.forEach(w => viDictWords.add(w));
}

const PRE_SORTED_HONORIFICS = [
  "phó chủ tịch tỉnh", "chủ tịch tỉnh", "phó tỉnh trưởng", "tỉnh trưởng",
  "phó chủ tịch", "chủ tịch", "phó thị trưởng", "thị trưởng",
  "phó giám đốc", "giám đốc", "tổng giám đốc", "phó tổng giám đốc",
  "phó chủ nhiệm", "chủ nhiệm", "phó trưởng phòng", "trưởng phòng",
  "phó phòng", "trưởng khoa", "phó khoa", "trưởng ban", "phó ban",
  "phó hiệu trưởng", "hiệu trưởng", "phó viện trưởng", "viện trưởng",
  "phó cục trưởng", "cục trưởng", "phó sở trưởng", "sở trưởng",
  "phó xưởng trưởng", "xưởng trưởng", "phó đội trưởng", "đội trưởng",
  "phó bí thư", "bí thư", "thủ trưởng", "chủ tịch hội đồng",
  "đại hội trưởng", "đại sư huynh", "đại sư tỷ",
  "trưởng lão", "sư huynh", "sư tỷ", "sư muội", "sư đệ",
  "tiền bối", "đạo hữu", "công tử", "phu nhân", "tiểu thư",
  "đại nhân", "lão tổ", "chưởng môn", "thành chủ", "môn chủ",
  "bang chủ", "gia chủ", "tướng quân", "đệ tử", "võ giả",
  "đạo sĩ", "y sư", "pháp sư", "phong chủ", "tông chủ",
  "động chủ", "cốc chủ", "các chủ", "lão sư", "sư phụ",
  "a di", "tẩu", "bà bà", "cô cô", "hội trưởng", "đội trưởng",
  "tộc trưởng", "lâu chủ", "trang chủ", "phủ chủ", "minh chủ",
  "điện chủ", "viện chủ", "đường chủ", "quán chủ", "tự chủ",
  "lãnh chúa", "thị", "thành", "tỉnh", "huyện", "xã", "thôn",
  "trấn", "tỷ", "muội", "huynh", "đệ", "chủ", "phó", "trưởng",
  "sư", "lão", "bà", "cô", "dì", "chú", "bác"
].sort((a, b) => b.length - a.length);

function formatHonorifics(text) {
  if (!text) return "";
  const textLower = text.toLowerCase();
  for (let i = 0; i < PRE_SORTED_HONORIFICS.length; i++) {
    const h = PRE_SORTED_HONORIFICS[i];
    const suffix = " " + h;
    if (textLower.endsWith(suffix) && textLower.length > suffix.length) {
      const index = text.length - h.length;
      return text.slice(0, index) + h;
    }
  }
  return text;
}

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
      let d = kv.get(y);
      if (!d) return "";
      if (y === "司" && m === o.length - 1 && o.length >= 2) {
        d = "ty";
      }
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
  const rawHV = c ? Im(r.join(" ")) : "";
  const formatted = formatHonorifics(rawHV);
  return safeReplaceLi(formatted);
}

const VI_LETTERS = 'a-zA-Zàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồ ổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ';
const standaloneLiRegex = new RegExp('(?<=^|[^' + VI_LETTERS + '])([Ll]i)(?=$|[^' + VI_LETTERS + '])', 'g');

function safeReplaceLi(text) {
  if (!text || (!text.includes("Li") && !text.includes("li"))) return text || "";
  return text.replace(standaloneLiRegex, match => match === "Li" ? "Ly" : "ly");
}

function cleanTranslation(vi) {
  if (!vi) return "";
  let cleaned = vi;
  if (vi.includes("Li") || vi.includes("li")) {
    cleaned = safeReplaceLi(vi);
  }
  if (cleaned.includes(" ") || cleaned.includes("-")) {
    cleaned = formatHonorifics(cleaned);
  }
  return cleaned;
}
