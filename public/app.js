// app.js - Điều khiển giao diện (UI) và điều phối tiến trình trích xuất

// Cấu hình Model cho 3 Nền tảng (Google Gemini Chính Thức, DeepSeek Chính Thức, Proxy Trung Gian)
const modelsMap = {
  gemini: [
    { id: "gemini-3.6-flash",      label: "gemini-3.6-flash (Mới nhất 2026)" },
    { id: "gemini-3.5-flash",      label: "gemini-3.5-flash (Nhanh & Tốt nhất)" },
    { id: "gemini-3.5-flash-lite", label: "gemini-3.5-flash-lite (Siêu tiết kiệm)" },
    { id: "gemini-3.5-pro",        label: "gemini-3.5-pro (Thông minh nhất)" },
    { id: "gemini-3.1-flash",      label: "gemini-3.1-flash" },
    { id: "gemini-3.1-flash-lite", label: "gemini-3.1-flash-lite" },
    { id: "gemini-3.1-pro",        label: "gemini-3.1-pro" },
    { id: "gemini-3.0-flash",      label: "gemini-3.0-flash" },
    { id: "gemini-2.5-flash",      label: "gemini-2.5-flash" },
    { id: "gemini-1.5-flash",      label: "gemini-1.5-flash" }
  ],
  deepseek: [
    // api.deepseek.com - deepseek-chat và deepseek-reasoner đã bị xóa ngày 24/7/2026
    { id: "deepseek-v4-flash", label: "deepseek-v4-flash (V4 Flash — Chính thức)" },
    { id: "deepseek-v4-pro",   label: "deepseek-v4-pro (V4 Pro — Mạnh nhất)" }
  ],
  proxy: [
    { id: "deepseek-v4-flash", label: "deepseek-v4-flash (V4 Siêu tiết kiệm)" },
    { id: "deepseek-v4-pro",   label: "deepseek-v4-pro (V4 Chất lượng cao)" },
    { id: "deepseek-reasoner", label: "deepseek-reasoner (R1 Proxy)" }
  ]
};


// Bảng giá token thực tế (USD trên 1 Triệu tokens)
const modelPricing = {
  "gemini-3.6-flash": { input: 0.15, output: 0.60 },
  "gemini-3.5-flash": { input: 1.50, output: 9.00 },
  "gemini-3.5-flash-lite": { input: 0.25, output: 1.50 },
  "gemini-3.5-pro": { input: 2.00, output: 12.00 },
  "gemini-3.1-flash": { input: 0.50, output: 3.00 },
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.50 },
  "gemini-3.1-pro": { input: 2.00, output: 12.00 },
  "gemini-3.0-flash": { input: 0.50, output: 3.00 },
  "gemini-2.5-flash": { input: 0.075, output: 0.30 },
  "gemini-1.5-flash": { input: 0.075, output: 0.30 },
  "deepseek-chat": { input: 0.14, output: 0.28 },
  "deepseek-reasoner": { input: 0.55, output: 2.19 },
  "deepseek-v4-flash": { input: 0.14, output: 0.28 },
  "deepseek-v4-pro": { input: 0.435, output: 0.87 }
};

// State toàn cục của ứng dụng
let cleanNamesList = [];
let trashNamesList = [];
let ignoreRulesSet = new Set();       // exact match O(1)
let ignoreSubList  = [];              // substring match O(n) – chỉ khi rule có dấu cách hoặc wildcard
let referenceDictMap = new Map();
let uploadedFileName = "Names.txt";
let currentExtractionController = null;

// Virtual scroll state (mỗi cột render độc lập)
const vsState = {
  clean: { page: 0, sentinel: null, observer: null },
  trash: { page: 0, sentinel: null, observer: null }
};
const VS_PAGE_SIZE = 80; // số dòng mỗi lần load thêm

// escapeHtml dùng cho toàn bộ app (tránh tạo lại mỗi row)
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Khởi chạy ban đầu
document.addEventListener("DOMContentLoaded", () => {
  // Khởi tạo Lucide icons
  lucide.createIcons();
  
  // Load các khóa đã lưu từ localStorage (gọi trước mọi thứ khác)
  loadSettings();
  // Lỗi 2 đã sửa: bỏ phần hardcode provider và model ở dưới — để loadSettings() quyết định

  loadProxyConfig().then(cfg => {
    const keyInput = document.getElementById("deepseek-key");
    // Chỉ điền key từ server nếu user chưa tự nhập
    if (keyInput && cfg.apiKey && !keyInput.value) {
      keyInput.value = cfg.apiKey;
      saveSettings();
    }
  }).catch(() => {});
  
  // Thêm sự kiện đếm ký tự input
  const textInput = document.getElementById("raw-chinese-text");
  textInput.addEventListener("input", () => {
    document.getElementById("input-char-count").innerText = `${textInput.value.length} ký tự`;
  });

  // Auto-save key vào localStorage ngay khi gõ (không cần bấm nút)
  ['gemini-key', 'deepseek-key', 'proxy-key'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', saveSettings);
  });
  // Auto-save khi đổi provider hoặc model
  const ps2 = document.getElementById('provider-select');
  const ms2 = document.getElementById('model-select');
  if (ps2) ps2.addEventListener('change', saveSettings);
  if (ms2) ms2.addEventListener('change', saveSettings);

  // Lưu tự động quy tắc tùy chỉnh khi gõ và đồng bộ vào ignore_rules.txt
  const customRulesInput = document.getElementById("custom-rules");
  let saveIgnoreTimeout = null;
  customRulesInput.addEventListener("input", () => {
    localStorage.setItem("custom_rules", customRulesInput.value);
    parseCustomRules();
    clearTimeout(saveIgnoreTimeout);
    saveIgnoreTimeout = setTimeout(() => {
      fetch('/api/save-ignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: customRulesInput.value })
      }).catch(() => {});
    }, 500);
  });

  
  // Thiết lập nút Toggle cài đặt Kiểu truyện
  setupToggleButtons("novel-type-group");

  // Thêm listener cho các checkbox cấu hình spelling quốc tế
  const spellCheckboxes = document.querySelectorAll(".spell-cat-checkbox");
  spellCheckboxes.forEach(cb => {
    cb.addEventListener("change", updateSpellCountBadge);
  });
  updateSpellCountBadge();
});

function updateSpellCountBadge() {
  const checkedCount = document.querySelectorAll(".spell-cat-checkbox:checked").length;
  // Lỗi 3: dùng optional chaining tránh crash khi element không tồn tại
  const el = document.getElementById("spell-count-text");
  if (el) el.innerText = `${checkedCount}/7`;
}

// Chuyển đổi hiển thị Mật khẩu
function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  const button = input.nextElementSibling.querySelector("i");
  if (input.type === "password") {
    input.type = "text";
    button.setAttribute("data-lucide", "eye-off");
  } else {
    input.type = "password";
    button.setAttribute("data-lucide", "eye");
  }
  lucide.createIcons();
}

// Thay đổi provider (Gemini / Deepseek / Proxy)
function handleProviderChange() {
  const provider = document.getElementById("provider-select").value;
  const modelSelect = document.getElementById("model-select");
  modelSelect.innerHTML = "";

  const models = modelsMap[provider] || [];
  models.forEach(model => {
    const opt = document.createElement("option");
    opt.value = model.id;
    opt.innerText = model.label;
    modelSelect.appendChild(opt);
  });
  // Model mặc định theo provider
  const defaults = { gemini: "gemini-3.6-flash", deepseek: "deepseek-chat", proxy: "deepseek-v4-flash" };
  if (defaults[provider]) modelSelect.value = defaults[provider];
}

// Reset các cài đặt về mặc định
function resetToDefaults() {
  document.getElementById("chunk-size").value = 8000;
  document.getElementById("chunk-overlap").value = 250;
  document.getElementById("concurrency").value = 2;
  document.getElementById("retries").value = 2;
  document.getElementById("timeout").value = 90;
  document.getElementById("custom-rules").value = "";
  localStorage.removeItem("custom_rules");
  
  referenceDictMap.clear();
  document.getElementById("dict-upload-status").innerText = "";
  
  // Reset toggles
  setActiveToggle("novel-type-group", "eastern");
  document.getElementById("western-spelling-config").classList.add("hidden");
  
  // Reset checkboxes
  document.querySelectorAll(".spell-cat-checkbox").forEach(cb => {
    const val = cb.getAttribute("data-value");
    cb.checked = (val === "Person" || val === "Location");
  });
  updateSpellCountBadge();
  
  alert("Đã hoàn tác các tùy chỉnh về thông số mặc định.");
}

// Giao diện toggle button helper
function setupToggleButtons(groupId) {
  const group = document.getElementById(groupId);
  const buttons = group.querySelectorAll(".btn-toggle");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      // Ẩn/hiện panel cấu hình Quốc tế / Nhật - Hàn tương ứng
      if (groupId === "novel-type-group") {
        const val = btn.getAttribute("data-value");
        const configPanel = document.getElementById("western-spelling-config");
        if (val === "western" || val === "anime") {
          configPanel.classList.remove("hidden");
          // Tự động gợi ý mặc định phù hợp cho Nhật-Hàn (Nhân vật + Kỹ năng) hoặc Quốc tế (Nhân vật + Địa danh)
          if (val === "anime") {
            document.querySelectorAll(".spell-cat-checkbox").forEach(cb => {
              const cVal = cb.getAttribute("data-value");
              cb.checked = (cVal === "Person" || cVal === "Skill");
            });
          } else if (val === "western") {
            document.querySelectorAll(".spell-cat-checkbox").forEach(cb => {
              const cVal = cb.getAttribute("data-value");
              cb.checked = (cVal === "Person" || cVal === "Location");
            });
          }
          updateSpellCountBadge();
        } else {
          configPanel.classList.add("hidden");
        }
      }
    });
  });
}

function getActiveToggleValue(groupId) {
  const activeBtn = document.querySelector(`#${groupId} .btn-toggle.active`);
  return activeBtn ? activeBtn.getAttribute("data-value") : "";
}

function setActiveToggle(groupId, value) {
  const buttons = document.querySelectorAll(`#${groupId} .btn-toggle`);
  buttons.forEach(btn => {
    if (btn.getAttribute("data-value") === value) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

// Lưu API Key vào Local Storage khi bắt đầu chạy để người dùng đỡ phải nhập lại
function saveSettings() {
  localStorage.setItem("gemini_api_key", document.getElementById("gemini-key").value);
  localStorage.setItem("deepseek_api_key", document.getElementById("deepseek-key").value);
  const proxyKeyEl = document.getElementById("proxy-key");
  localStorage.setItem("proxy_api_key", proxyKeyEl ? proxyKeyEl.value : '');
  localStorage.setItem("custom_rules", document.getElementById("custom-rules").value);
  // Lưu provider và model để khôi phục sau F5
  const ps = document.getElementById("provider-select");
  const ms = document.getElementById("model-select");
  if (ps) localStorage.setItem("selected_provider", ps.value);
  if (ms) localStorage.setItem("selected_model", ms.value);
}

function loadSettings() {
  if (localStorage.getItem("gemini_api_key"))
    document.getElementById("gemini-key").value = localStorage.getItem("gemini_api_key");
  if (localStorage.getItem("deepseek_api_key"))
    document.getElementById("deepseek-key").value = localStorage.getItem("deepseek_api_key");
  if (localStorage.getItem("proxy_api_key") && document.getElementById("proxy-key"))
    document.getElementById("proxy-key").value = localStorage.getItem("proxy_api_key");
  if (localStorage.getItem("custom_rules"))
    document.getElementById("custom-rules").value = localStorage.getItem("custom_rules");

  // Khôi phục provider và model đã chọn trước đó
  const savedProvider = localStorage.getItem("selected_provider");
  const savedModel    = localStorage.getItem("selected_model");
  const ps = document.getElementById("provider-select");
  const ms = document.getElementById("model-select");
  if (savedProvider && ps) {
    ps.value = savedProvider;
    handleProviderChange(); // build lại model dropdown theo provider
    // Set model SAU khi handleProviderChange đã tạo options
    if (savedModel && ms) {
      ms.value = savedModel; // trình duyệt tự show option khớp value
    }
  } else {
    // Lần đầu dùng: mặc định proxy
    if (ps) ps.value = 'proxy';
    handleProviderChange();
  }

  fetch('/api/get-ignore')
    .then(r => r.json())
    .then(data => {
      if (data && data.success && data.text) {
        document.getElementById("custom-rules").value = data.text;
        localStorage.setItem("custom_rules", data.text);
        parseCustomRules();
      }
    }).catch(() => {});
  parseCustomRules();
}


// Phân tích danh sách từ bỏ qua – tách exact vs substring để tối ưu O(1) lookup
function parseCustomRules() {
  ignoreRulesSet.clear();
  ignoreSubList = [];

  const rawRules = document.getElementById("custom-rules").value.split("\n");
  rawRules.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const lowerRule = trimmed.toLowerCase();
    // Nạp exact match vào Set (O(1))
    ignoreRulesSet.add(lowerRule);

    // Rule nhiều từ (có khoảng trắng) → cần substring matching
    if (lowerRule.includes(' ')) {
      ignoreSubList.push(lowerRule);
    }

    // Tự động dịch chữ Hán → Hán Việt và nạp vào cả exact + substring
    if (typeof Po !== "undefined" && Po(trimmed)) {
      const viTrans = translateChineseToHanViet(trimmed);
      if (viTrans) {
        const viLower = viTrans.toLowerCase();
        ignoreRulesSet.add(viLower);
        if (viLower.includes(' ')) ignoreSubList.push(viLower);
      }
    }
  });
}

// Helper kiểm tra 1 entry có bị cấm không – dùng chung toàn bộ app
function isIgnoredItem(cnLower, viLower) {
  // Fast path: exact Set lookup O(1)
  if (ignoreRulesSet.has(cnLower) || ignoreRulesSet.has(viLower)) return true;
  // Slow path: chỉ chạy khi có rule nhiều từ (substring)
  for (const rule of ignoreSubList) {
    if (cnLower.includes(rule) || viLower.includes(rule)) return true;
  }
  return false;
}

// Khởi chạy quy trình trích xuất
async function startExtraction() {
  const rawText = document.getElementById("raw-chinese-text").value.trim();
  if (!rawText) {
    alert("Vui lòng dán văn bản tiếng Trung cần trích xuất!");
    return;
  }
  
  const provider = document.getElementById("provider-select").value;
  let apiKey = "";
  if (provider === "gemini") {
    apiKey = document.getElementById("gemini-key").value.trim();
  } else if (provider === "deepseek") {
    apiKey = document.getElementById("deepseek-key").value.trim();
  } else {
    apiKey = (document.getElementById("proxy-key") ? document.getElementById("proxy-key").value.trim() : "") || document.getElementById("deepseek-key").value.trim();
  }
    
  if (provider !== "proxy" && !apiKey) {
    alert(`Vui lòng nhập ${provider === "gemini" ? "Google Gemini" : "DeepSeek Official"} API Key!`);
    return;
  }
  
  // Lưu Key vào local storage
  saveSettings();
  
  // Phân tích quy tắc tùy chỉnh Hán Việt
  parseCustomRules();
  
  // Đọc các tham số giao diện
  const modelId = document.getElementById("model-select").value;
  const type = getActiveToggleValue("novel-type-group");
  const mode = "balanced"; // Mặc định cân bằng
  
  // Thu thập danh sách category được tick giữ spelling quốc tế
  const foreignReadingCategories = [];
  document.querySelectorAll(".spell-cat-checkbox:checked").forEach(cb => {
    foreignReadingCategories.push(cb.getAttribute("data-value"));
  });
  
  const chunkSize = parseInt(document.getElementById("chunk-size").value) || 8000;
  const overlap = parseInt(document.getElementById("chunk-overlap").value) || 250;
  const concurrency = parseInt(document.getElementById("concurrency").value) || 2;
  const retries = parseInt(document.getElementById("retries").value) || 2;
  const timeoutSecs = parseInt(document.getElementById("timeout").value) || 90;
  
  // Reset thống kê chi phí trên UI
  document.getElementById("progress-tokens").innerText = "0";
  document.getElementById("progress-cost").innerText = "0đ";
  document.getElementById("final-tokens").innerText = "0";
  document.getElementById("final-cost").innerText = "0đ";

  // Biến lưu trữ số lượng tokens thực tế
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  // Kiểm tra giờ cao điểm của DeepSeek (Giờ Việt Nam UTC+7: 8:00-11:00 và 13:00-17:00)
  function isDeepSeekPeakHour() {
    const now = new Date();
    const hr = now.getHours();
    const min = now.getMinutes();
    const timeVal = hr + min / 60;
    
    // Khung 1: 8:00 - 11:00 sáng
    const isMorningPeak = (timeVal >= 8.0 && timeVal <= 11.0);
    // Khung 2: 13:00 - 17:00 chiều
    const isAfternoonPeak = (timeVal >= 13.0 && timeVal <= 17.0);
    
    return isMorningPeak || isAfternoonPeak;
  }

  function updateCostDisplay() {
    const pricing = modelPricing[modelId] || { input: 0.14, output: 0.28 };
    let inputMultiplier = 1;
    let outputMultiplier = 1;
    let peakWarning = "";
    
    // Nếu mô hình thuộc DeepSeek và đang ở khung giờ cao điểm -> x2 giá
    if (provider === "deepseek" && isDeepSeekPeakHour()) {
      inputMultiplier = 2;
      outputMultiplier = 2;
      peakWarning = " (Giờ cao điểm x2)";
    }
    
    const totalTokens = totalPromptTokens + totalCompletionTokens;
    // Tính tiền
    const costUsd = (totalPromptTokens / 1000000) * pricing.input * inputMultiplier + 
                    (totalCompletionTokens / 1000000) * pricing.output * outputMultiplier;
    const costVnd = Math.ceil(costUsd * 25400); // 1 USD = 25,400 VND

    // Hiển thị ở Panel tiến trình
    document.getElementById("progress-tokens").innerText = totalTokens.toLocaleString();
    document.getElementById("progress-cost").innerText = `${costVnd.toLocaleString()}đ${peakWarning}`;

    // Hiển thị ở Panel kết quả
    document.getElementById("final-tokens").innerText = totalTokens.toLocaleString();
    document.getElementById("final-cost").innerText = `${costVnd.toLocaleString()}đ${peakWarning}`;
  }

  // Chia nhỏ text
  const chunks = splitTextIntoChunks(rawText, chunkSize, overlap);
  if (chunks.length === 0) return;
  
  // Hiển thị Panel tiến trình
  const progressPanel = document.getElementById("progress-panel");
  const resultsPanel = document.getElementById("results-panel");
  progressPanel.classList.remove("hidden");
  resultsPanel.classList.add("hidden");
  
  // Reset logs & progress bar
  const logBox = document.getElementById("progress-log");
  logBox.innerHTML = `<p class="info">Khởi tạo tiến trình. Tổng số chunk cần xử lý: ${chunks.length}</p>`;
  updateProgressBar(0, 0, chunks.length);
  
  // Khởi tạo bộ nhớ danh sách kết quả tạm
  cleanNamesList = [];
  trashNamesList = [];
  
  // Lỗi 9: AbortController toàn cục – hủy thực sự các fetch đang chạy
  let isCancelled = false;
  const abortController = new AbortController();
  currentExtractionController = {
    cancel: () => {
      isCancelled = true;
      abortController.abort();
    }
  };
  window.__extractAbortSignal = abortController.signal;
  
  try {
    const rawExtractedList = await runParallelExtraction({
      provider,
      apiKey,
      modelId,
      chunks,
      mode,
      type,
      foreignReadingCategories,
      concurrency,
      retries,
      timeoutSecs,
      onProgress: (percent, completed, total) => {
        if (isCancelled) return;
        updateProgressBar(percent, completed, total);
      },
      onChunkSuccess: (index, names, usage) => {
        if (isCancelled) return;
        // Cộng dồn token thực tế từ API response
        totalPromptTokens += usage.promptTokens || 0;
        totalCompletionTokens += usage.completionTokens || 0;
        updateCostDisplay();

        addLogMessage(`Chunk ${index + 1} thành công: tìm thấy ${names.length} thực thể.`);
        processAndFilterNames(names, type, foreignReadingCategories);
      },
      onChunkError: (index, error) => {
        if (isCancelled) return;
        addLogMessage(`Lỗi tại Chunk ${index + 1}: ${error.message}`, "err");
      },
      onChunkRetry: (index, attempt, maxRetries, error) => {
        if (isCancelled) return;
        addLogMessage(`Chunk ${index + 1} lỗi tạm thời (lần ${attempt}/${maxRetries}): ${error.message}. Đang thử lại...`, "err");
      }
    });
    
    if (isCancelled) {
      addLogMessage("Đã hủy bỏ tiến trình theo yêu cầu.", "err");
      return;
    }
    
    // Áp dụng bộ lọc nâng cao tần suất + hậu tố cho các danh mục phi nhân vật
    const finalClean = [];
    const finalTrash = [...trashNamesList];
    const genericBaseSuffixes = [
      "骑士", "巫师", "女巫", "魔女", "怪物", "异兽", "巨兽", "甲虫", "地宫", "墓园", "位面", "高地", "高原", 
      "档案馆", "图书馆", "学院", "要塞", "堡垒", "废墟", "遗迹", "城堡", "庄园", "小屋", "战舰", "古渊", 
      "深渊", "高塔", "环塔", "教团", "学会", "协会", "会", "帮", "教", "阁", "殿", "门", "谷", "城", "域", 
      "学者", "飞船", "甲", "铠", "靴", "盔", "帽", "戒", "链", "袍", "鞍", "线", "飞弹", "导弹", "火枪", 
      "大炮", "骷髅", "丧尸", "僵尸", "野猪", "药剂", "魔药", "药水", "药草", "灵草", "流", "构装", "炼金术", "章节",
      "之门", "之书", "之箭", "之刃", "之触", "之吻", "之手", "之盾", "之眼", "之风", "之水", "之火", "之光", "之影", 
      "之心", "之魂", "之血", "之体", "之骨", "之力", "之拥", "之石", "之花", "之草", "之树", "之林", 
      "泉", "池", "湖", "山", "峰", "洞", "河", "江", "海", "岛", "林", "树", "花", "草", "石", "血", "骨", 
      "心", "魂", "体", "法", "术", "诀", "经", "印", "咒", "枪", "剑", "刀", "杖", "棒", "弓", "斧", "铲", 
      "盾", "鼎", "炉", "卷", "册", "图", "符", "盘", "镜", "珠", "玉", "饰", "冠", "佩", "囊"
    ];
    
    cleanNamesList.forEach(item => {
      if (item.category !== "Person" && 
          item.category !== "Location" && 
          item.category !== "Faction" &&
          item.category !== "Skill" &&
          item.category !== "Artifact") {
        
        // Không tự ý lọc các danh từ chứa "之" (mệnh danh đặc biệt, sở hữu cách)
        if (item.chinese.includes("之")) {
          finalClean.push(item);
          return;
        }
        
        // Loại bỏ hoàn toàn các từ trong danh sách Từ bỏ qua (Cấm trích xuất)
        const isIgnored = ignoreRulesSet.has(item.chinese.toLowerCase()) || 
                          ignoreRulesSet.has(item.hanviet.toLowerCase());
        if (isIgnored) {
          return;
        }

        // Bỏ qua lọc đối với danh sách từ tích lũy cũ
        const isBypassed = referenceDictMap.has(item.chinese);
        if (isBypassed) {
          finalClean.push(item);
          return;
        }
        
        const hasGenericSuffix = genericBaseSuffixes.some(s => item.chinese.endsWith(s));
        if (item.count === 1 && hasGenericSuffix) {
          finalTrash.push(item);
          return;
        }
      }
      finalClean.push(item);
    });
    
    cleanNamesList = finalClean;
    trashNamesList = finalTrash;
    
    // Cập nhật giao diện bảng kết quả
    renderTables();
    
    // Ẩn panel tiến trình và hiện kết quả
    setTimeout(() => {
      progressPanel.classList.add("hidden");
      resultsPanel.classList.remove("hidden");
      lucide.createIcons();
    }, 1000);
    
  } catch (error) {
    addLogMessage(`Tiến trình thất bại đột ngột: ${error.message}`, "err");
    alert(`Lỗi tiến trình: ${error.message}`);
  }
}

// Xử lý hủy tiến trình đang chạy
function cancelExtraction() {
  if (currentExtractionController) {
    currentExtractionController.cancel();
    document.getElementById("progress-status").innerText = "Đã hủy bỏ!";
    addLogMessage("Tiến trình đang hủy...", "err");
    setTimeout(() => {
      document.getElementById("progress-panel").classList.add("hidden");
    }, 1000);
  }
}

// Thêm tin nhắn log vào khung hiển thị
function addLogMessage(msg, type = "info") {
  const logBox = document.getElementById("progress-log");
  const p = document.createElement("p");
  if (type === "err") p.className = "err";
  p.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logBox.appendChild(p);
  logBox.scrollTop = logBox.scrollHeight;
}

// Cập nhật thanh Progress
function updateProgressBar(percent, completed, total) {
  document.getElementById("progress-bar-fill").style.width = `${percent}%`;
  document.getElementById("progress-ratio").innerText = `${percent}%`;
  document.getElementById("progress-status").innerText = `Đang chạy: ${completed}/${total} chunk...`;
}

// Chuẩn hóa phân loại từ AI sang định dạng chuẩn tiếng Anh
function normalizeCategory(cat) {
  if (!cat) return "Person";
  const c = cat.trim().toLowerCase();
  if (c === "person" || c === "nhân vật" || c === "nhânvật") return "Person";
  if (c === "location" || c === "địa danh" || c === "địadanh") return "Location";
  if (c === "faction" || c === "tông phái" || c === "môn phái" || c === "tôngphái" || c === "mônphái") return "Faction";
  if (c === "artifact" || c === "vật phẩm" || c === "vậtphẩm") return "Artifact";
  if (c === "skill" || c === "công pháp" || c === "côngpháp") return "Skill";
  if (c === "title" || c === "danh hiệu" || c === "cảnh giới" || c === "danhhiệu" || c === "cảnhgiới") return "Title";
  if (c === "creature" || c === "sinh vật" || c === "yêu thú" || c === "sinhvật" || c === "yêuthú") return "Creature";
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

// Xử lý lọc tên riêng lớp 2 và gom nhóm
function processAndFilterNames(namesArray, type, foreignReadingCategories) {
  const foreignCats = Array.isArray(foreignReadingCategories) ? foreignReadingCategories : [];
  
  namesArray.forEach(item => {
    if (!item.chinese || !item.hanviet) return;
    
    // Tự động gọt bỏ ngoặc sách 《》, ngoặc kép “”, ngoặc vuông 【】 và tiền tố thời gian/niên đại (xx năm / thập vạn niên / vạn niên...) bao quanh tên riêng
    const cn = (typeof cleanEntityPunctuation === "function" ? cleanEntityPunctuation(item.chinese) : item.chinese.replace(/^[《“"\'【‹「«\s]+|[》”"\'】›」»\s]+$/g, "").replace(/^(?:[0-9一二三四五六七八九十百千万亿]+\s*年|十万年|百万年|千万年|亿年|万年|千年|百年|十年)\s*/, "")).trim();
    let vi = (typeof cleanEntityPunctuation === "function" ? cleanEntityPunctuation(item.hanviet) : item.hanviet.replace(/^[《“"\'【‹「«\s]+|[》”"\'】›」»\s]+$/g, "")).trim();
    
    // Gọt bỏ tiền tố thời gian Hán-Việt ở đầu (ví dụ: thập vạn niên, bách vạn niên, vạn niên, thiên niên, bách niên, thập niên...)
    const timePrefixVI = /^(?:thập vạn niên|bách vạn niên|thiên vạn niên|ức niên|vạn niên|thiên niên|bách niên|thập niên|[0-9]+\s*niên)\s*/i;
    vi = vi.replace(timePrefixVI, "").trim();
    
    if (!cn || !vi) return;

    const cat = normalizeCategory(item.category);
    const count = parseInt(item.count) || 1;
    const isForeignCat = (type === "western" || type === "anime") && foreignCats.includes(cat);
    
    // Bản dịch Hán Việt gốc của AI
    let viRaw = vi;
    
    // Tra cứu dịch nghĩa trước để có bản dịch Hán Việt hiển thị thực tế và viết hoa chuẩn
    let viTranslated = vi;
    if (isForeignCat) {
      // 1. Nếu bản dịch từ AI đã có sẵn dấu tiếng Việt (ví dụ: "Kim Bằng", "Bạch Hồ Tử", "Hải Thần Các") -> Giữ nguyên bản dịch có dấu
      const hasAccents = typeof hasVietnameseAccents === "function" ? hasVietnameseAccents(vi) : /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]/.test(vi);
      if (hasAccents) {
        viTranslated = vi;
      } else {
        const isCleanCapitalizedLatin = /^[A-Z][a-zA-Z\s·-]*$/.test(vi);
        const dictTranslation = translateChineseToHanViet(cn);
        
        if (isCleanCapitalizedLatin && dictTranslation) {
          // Nếu AI trả về tên tiếng Việt không dấu (như "Thai Than" cho "Thái Thản", "Ngon Thieu Triet" cho "Ngôn Thiếu Triết", "Mong Hong Tran" cho "Mộng Hồng Trần", "Ngau Thien" cho "Ngưu Thiên", "Mac An" cho "Mục Ân")
          // thì tự động THAY THẾ bằng bản dịch Hán-Việt CÓ DẤU từ từ điển local!
          const isUnaccentedVariant = typeof isUnaccentedHanVietVariant === "function" ? isUnaccentedHanVietVariant(vi, dictTranslation) : false;
          if (isUnaccentedVariant) {
            viTranslated = dictTranslation;
          } else {
            // Ngược lại, là tên phiên âm Anime/Quốc tế xịn (như "Kakuzu", "Naruto", "Marco", "Imu") -> Giữ tên AI!
            viTranslated = vi;
          }
        } else if (dictTranslation) {
          viTranslated = dictTranslation;
        } else {
          viTranslated = vi.split(/\s+/).map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : "").join(" ");
        }
      }
    } else {
      // Đông phương hoặc category không giữ spelling -> Tra cứu từ điển Hán Việt local
      const dictTranslation = translateChineseToHanViet(cn);
      if (dictTranslation) {
        viTranslated = dictTranslation;
      } else {
        // Viết hoa chữ cái đầu nếu AI trả về chữ viết thường
        viTranslated = vi.split(/\s+/).map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : "").join(" ");
      }
    }
    
    // Áp dụng định dạng chuẩn hóa chức vụ/bối phận và "Li/Ly"
    if (typeof cleanTranslation === "function") {
      viTranslated = cleanTranslation(viTranslated);
    }
    
    // 1. Kiểm tra từ cấm – fast path O(1)
    const cnLower = cn.toLowerCase();
    const viRawLower = viRaw.toLowerCase();
    const viTransLower = viTranslated.toLowerCase();
    if (isIgnoredItem(cnLower, viRawLower) || isIgnoredItem(cnLower, viTransLower)) return;
    
    // Nếu từ đã tồn tại trong từ điển tích lũy thì BỎ QUA KHÔNG ĐƯA VÀO BẢNG KẾT QUẢ (để chỉ hiển thị từ mới)
    if (referenceDictMap.has(cn)) {
      return;
    }
    
    // Lưu nghĩa hiển thị thực tế vào biến vi
    vi = viTranslated;
    
    // Áp dụng chuẩn hóa viết hoa danh hiệu/bối phận Hán Việt (chỉ viết hoa tên/họ đứng trước)
    if (type === "eastern" || !isForeignCat) {
      vi = formatHonorifics(vi);
    }
    
    // Chạy Bộ lọc thông minh bẫy rác Hán Việt (Lớp 2.2)
    isClean = isProperName(cn, vi, type);
    
    if (isClean) {
      mergeIntoList(cleanNamesList, { chinese: cn, hanviet: vi, category: cat, count });
    } else {
      mergeIntoList(trashNamesList, { chinese: cn, hanviet: vi.toLowerCase(), category: cat, count });
    }
  });
}

// Gom nhóm các từ trùng (Cộng dồn số lần xuất hiện, ưu tiên tên riêng viết hoa)
function mergeIntoList(list, item) {
  const existing = list.find(x => x.chinese === item.chinese);
  if (existing) {
    existing.count += item.count;
    // Cập nhật lại nghĩa nếu nghĩa cũ ngắn hơn hoặc chưa chuẩn
    if (item.hanviet && (!existing.hanviet || existing.hanviet.length < item.hanviet.length)) {
      existing.hanviet = item.hanviet;
    }
  } else {
    list.push(item);
  }
}

// Render 2 bảng với virtual scroll
function renderTables() {
  cleanNamesList.sort((a, b) => b.count - a.count);
  trashNamesList.sort((a, b) => b.count - a.count);

  document.getElementById("clean-count").innerText = cleanNamesList.length;
  document.getElementById("trash-count").innerText = trashNamesList.length;

  initVirtualScroll("clean-names-body", cleanNamesList, "clean");
  initVirtualScroll("trash-names-body", trashNamesList, "trash");
}

// Khởi tạo virtual scroll cho 1 cột
function initVirtualScroll(tbodyId, list, colType) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = "";

  const st = vsState[colType];
  st.page = 0;

  // Dừng observer cũ
  if (st.observer) { st.observer.disconnect(); st.observer = null; }

  // Render trang đầu
  appendVSRows(tbody, list, colType, 0);

  // Nếu còn dữ liệu, gắn sentinel để auto-load khi scroll xuống
  if (list.length > VS_PAGE_SIZE) {
    attachSentinel(tbody, list, colType);
  }

  lucide.createIcons({ nodes: [tbody] });
}

// Thêm batch dòng vào tbody
function appendVSRows(tbody, list, colType, startIdx) {
  const end = Math.min(startIdx + VS_PAGE_SIZE, list.length);
  const frag = document.createDocumentFragment();

  for (let i = startIdx; i < end; i++) {
    frag.appendChild(buildRow(list[i], colType));
  }
  // Xóa sentinel cũ (nếu có) trước khi thêm row mới
  const old = tbody.querySelector('.vs-sentinel');
  if (old) tbody.removeChild(old);

  tbody.appendChild(frag);
}

// Gắn sentinel row ở cuối bảng, khi hiện ra viewport thì tải thêm
function attachSentinel(tbody, list, colType) {
  const st = vsState[colType];
  const sentinel = document.createElement('tr');
  sentinel.className = 'vs-sentinel';
  sentinel.innerHTML = '<td colspan="5" style="text-align:center;padding:8px;color:var(--text-muted);font-size:0.8rem">đang tải thêm…</td>';
  tbody.appendChild(sentinel);
  st.sentinel = sentinel;

  st.observer = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    st.page++;
    const nextStart = st.page * VS_PAGE_SIZE;
    if (nextStart >= list.length) {
      st.observer.disconnect();
      sentinel.remove();
      return;
    }
    appendVSRows(tbody, list, colType, nextStart);
    lucide.createIcons({ nodes: [tbody] });
    // Nếu vẫn còn dữ liệu, gắn lại sentinel
    if ((st.page + 1) * VS_PAGE_SIZE < list.length) {
      attachSentinel(tbody, list, colType);
    } else {
      st.observer.disconnect();
    }
  }, { rootMargin: '200px' });

  st.observer.observe(sentinel);
}

// Xây dựng 1 đối tượng <tr> (không append, chỉ tạo)
function buildRow(item, colType) {
  const tr = document.createElement('tr');
  tr.setAttribute('data-chinese', item.chinese);
  tr.setAttribute('data-hanviet', item.hanviet);

  const sCn   = escapeHtml(item.chinese);
  const sHv   = escapeHtml(item.hanviet);
  const sCat  = escapeHtml(getCategoryLabel(item.category));
  const sCls  = escapeHtml('cat-badge cat-' + (item.category || '').toLowerCase());
  const sCnt  = escapeHtml(String(item.count));
  const sRawCat = escapeHtml(item.category);

  const moveBtn = colType === 'clean'
    ? `<button class="btn-icon btn-move" title="Đẩy sang Từ Thường" onclick="moveItem('${sCn}','clean','trash')"><i data-lucide="chevron-right"></i></button>`
    : `<button class="btn-icon btn-move" title="Khôi phục thành Tên Riêng" onclick="moveItem('${sCn}','trash','clean')"><i data-lucide="chevron-left"></i></button>`;

  tr.innerHTML = `
    <td class="chinese-cell" title="${sCn}">${sCn}</td>
    <td class="hanviet-cell">${sHv}</td>
    <td><span class="${sCls}">${sCat}</span></td>
    <td style="text-align:center;color:var(--text-muted);font-size:0.85rem">${sCnt}</td>
    <td><div class="row-actions">
      ${moveBtn}
      <button class="btn-icon btn-edit" title="Sửa" onclick="openEditModal('${sCn}','${sHv}','${sRawCat}','${colType}')"><i data-lucide="edit"></i></button>
      <button class="btn-icon btn-delete" title="Xóa" onclick="deleteItem('${sCn}','${colType}')"><i data-lucide="trash-2"></i></button>
    </div></td>
  `;
  return tr;
}

function getCategoryLabel(cat) {
  const labels = {
    Person: "Nhân vật",
    Location: "Địa danh",
    Faction: "Môn phái",
    Artifact: "Vật phẩm",
    Skill: "Công pháp",
    Title: "Cảnh giới",
    Creature: "Yêu thú"
  };
  return labels[cat] || cat;
}

// Di chuyển dòng qua lại giữa 2 bảng
function moveItem(chinese, fromCol, toCol) {
  const fromList = fromCol === "clean" ? cleanNamesList : trashNamesList;
  const toList = toCol === "clean" ? cleanNamesList : trashNamesList;
  
  const idx = fromList.findIndex(x => x.chinese === chinese);
  if (idx !== -1) {
    const item = fromList.splice(idx, 1)[0];
    
    // Chuẩn hóa viết hoa chữ cái đầu khi đổi sang cột Sạch
    if (toCol === "clean") {
      item.hanviet = item.hanviet.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    } else {
      item.hanviet = item.hanviet.toLowerCase();
    }
    
    mergeIntoList(toList, item);
    renderTables();
  }
}

// Xóa dòng dữ liệu
function deleteItem(chinese, colType) {
  const list = colType === "clean" ? cleanNamesList : trashNamesList;
  const idx = list.findIndex(x => x.chinese === chinese);
  if (idx !== -1) {
    list.splice(idx, 1);
    renderTables();
  }
}

// Tìm kiếm lọc kết quả trên bảng
function filterResultsTable() {
  const query = document.getElementById("search-filter").value.toLowerCase().trim();
  
  const tables = ["clean-names-body", "trash-names-body"];
  tables.forEach(tbodyId => {
    const tbody = document.getElementById(tbodyId);
    const rows = tbody.querySelectorAll("tr");
    rows.forEach(row => {
      const cn = row.getAttribute("data-chinese").toLowerCase();
      const vi = row.getAttribute("data-hanviet").toLowerCase();
      
      if (cn.includes(query) || vi.includes(query)) {
        row.classList.remove("hidden");
      } else {
        row.classList.add("hidden");
      }
    });
  });
}

// MODAL EDIT DÒNG
function openEditModal(chinese, hanviet, category, colType) {
  document.getElementById("edit-original-chinese").value = chinese;
  document.getElementById("edit-original-hanviet").value = hanviet;
  document.getElementById("edit-origin-column").value = colType;
  
  document.getElementById("edit-chinese-input").value = chinese;
  document.getElementById("edit-hanviet-input").value = hanviet;
  document.getElementById("edit-category-select").value = category;
  
  document.getElementById("edit-modal").classList.remove("hidden");
}

function closeEditModal() {
  document.getElementById("edit-modal").classList.add("hidden");
}

function saveRowEdit() {
  const cn = document.getElementById("edit-original-chinese").value;
  const colType = document.getElementById("edit-origin-column").value;
  
  const newHanviet = document.getElementById("edit-hanviet-input").value.trim();
  const newCategory = document.getElementById("edit-category-select").value;
  
  if (!newHanviet) {
    alert("Vui lòng nhập nghĩa Hán Việt!");
    return;
  }
  
  const list = colType === "clean" ? cleanNamesList : trashNamesList;
  const item = list.find(x => x.chinese === cn);
  if (item) {
    item.hanviet = newHanviet;
    item.category = newCategory;
    renderTables();
  }
  
  closeEditModal();
}

// DOWNLOAD FILE & COPY TO CLIPBOARD
function getFormattedText(list) {
  // Trả về dạng Chinese=Vietnamese, mỗi dòng 1 từ
  return list.map(item => `${item.chinese}=${item.hanviet}`).join("\n");
}

function copyColumnToClipboard(colType) {
  const list = colType === "clean" ? cleanNamesList : trashNamesList;
  if (list.length === 0) {
    alert("Bảng không có dữ liệu để sao chép!");
    return;
  }
  const text = getFormattedText(list);
  navigator.clipboard.writeText(text)
    .then(() => alert(`Đã sao chép danh sách ${colType === "clean" ? "Tên Riêng" : "Từ Thường"} vào Clipboard!`))
    .catch(err => alert("Lỗi sao chép: " + err));
}

function downloadColumnFile(colType) {
  const list = colType === "clean" ? cleanNamesList : trashNamesList;
  if (list.length === 0 && colType === "trash") {
    alert("Bảng không có dữ liệu để tải!");
    return;
  }
  
  let text = "";
  if (colType === "clean") {
    // Đảm bảo cập nhật danh sách từ cấm mới nhất
    parseCustomRules();

    // Tạo bản gộp giữa từ điển tích lũy cũ và các từ mới trích xuất
    const mergedMap = new Map();
    
    // 1. Nạp từ điển cũ vào, tự động lọc từ cấm, chuyển Li->Ly và viết thường bối phận
    for (const [cn, vi] of referenceDictMap.entries()) {
      const cnLower = cn.toLowerCase();
      const viClean = cleanTranslation(vi);
      const viLower = viClean.toLowerCase();
      
      // Lọc bỏ từ cấm – fast path O(1)
      if (isIgnoredItem(cnLower, viLower)) continue;
      
      mergedMap.set(cn, viClean);
    }
    
    // 2. Nạp từ mới đã duyệt vào sau
    list.forEach(item => {
      const cnLower = item.chinese.toLowerCase();
      const viClean = cleanTranslation(item.hanviet);
      const viLower = viClean.toLowerCase();
      
      // Lọc bỏ từ cấm – fast path O(1)
      if (isIgnoredItem(cnLower, viLower)) return;
      
      mergedMap.set(item.chinese, viClean);
    });
    
    const lines = [];
    mergedMap.forEach((vi, cn) => {
      lines.push(`${cn}=${vi}`);
    });
    text = lines.join("\n");
  } else {
    text = getFormattedText(list);
  }
  
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = colType === "clean" ? uploadedFileName : "Names2.txt";
  document.body.appendChild(a);
  a.click();
  
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportBothFiles() {
  downloadColumnFile("clean");
  setTimeout(() => downloadColumnFile("trash"), 300);
}

// Xử lý tải file .txt lên trực tiếp
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    document.getElementById("raw-chinese-text").value = text;
    document.getElementById("input-char-count").innerText = `${text.length.toLocaleString()} ký tự`;
    // Reset giá trị uploader để có thể tải lại cùng một file nếu cần
    event.target.value = "";
  };
  reader.onerror = function() {
    alert("Không thể đọc file. Vui lòng kiểm tra định dạng file!");
  };
  reader.readAsText(file, "utf-8");
}

// Xử lý nạp file từ điển tích lũy gốc Names.txt
function handleDictUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  uploadedFileName = file.name;
  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    referenceDictMap.clear();
    
    // Nạp lại danh sách từ cấm mới nhất trước khi duyệt
    parseCustomRules();
    
    const lines = text.split(/\r?\n/);
    let count = 0;
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const cn = trimmed.slice(0, idx).trim();
        const vi = trimmed.slice(idx + 1).trim();
        if (cn && vi) {
          // Làm sạch bản dịch: chuyển Li -> Ly, viết thường bối phận
          const viClean = cleanTranslation(vi);
          
          // Lỗi 1 đã sửa: khai báo biến trước khi gọi isIgnoredItem
          const cnLower = cn.toLowerCase();
          const viLower = viClean.toLowerCase();
          if (isIgnoredItem(cnLower, viLower)) return;
          
          referenceDictMap.set(cn, viClean);
          count++;
        }
      }
    });
    
    document.getElementById("dict-upload-status").innerText = `Đã nạp ${count.toLocaleString()} từ tích lũy (đã tự động làm sạch).`;
    event.target.value = "";
  };
  reader.onerror = function() {
    alert("Không thể đọc file từ điển. Vui lòng kiểm tra định dạng!");
  };
  reader.readAsText(file, "utf-8");
}

