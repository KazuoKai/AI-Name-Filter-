// app.js - Điều khiển giao diện (UI) và điều phối tiến trình trích xuất

// Cấu hình Model của 2 hãng
const modelsMap = {
  gemini: [
    { id: "gemini-3.5-flash", label: "gemini-3.5-flash (Nhanh & Tốt nhất hiện nay)" },
    { id: "gemini-3.5-flash-lite", label: "gemini-3.5-flash-lite (Siêu tiết kiệm thế hệ 3.5)" },
    { id: "gemini-3.5-pro", label: "gemini-3.5-pro (Thông minh đỉnh cao)" },
    { id: "gemini-3.1-flash", label: "gemini-3.1-flash" },
    { id: "gemini-3.1-flash-lite", label: "gemini-3.1-flash-lite" },
    { id: "gemini-3.1-pro", label: "gemini-3.1-pro" },
    { id: "gemini-3.0-flash", label: "gemini-3.0-flash" },
    { id: "gemini-2.5-flash", label: "gemini-2.5-flash" },
    { id: "gemini-2.5-flash-lite", label: "gemini-2.5-flash-lite" },
    { id: "gemini-2.5-pro", label: "gemini-2.5-pro" },
    { id: "gemini-1.5-flash", label: "gemini-1.5-flash (Nhanh & Tiết kiệm nhất)" },
    { id: "gemini-1.5-flash-8b", label: "gemini-1.5-flash-8b (Siêu nhẹ)" },
    { id: "gemini-1.5-pro", label: "gemini-1.5-pro (Thông minh, Dịch mượt nhất)" },
    { id: "gemini-2.0-flash-exp", label: "gemini-2.0-flash-exp (Bản mới 2.0)" }
  ],
  deepseek: [
    { id: "deepseek-chat", label: "deepseek-chat (Mặc định - V4)" },
    { id: "deepseek-v4-flash", label: "deepseek-v4-flash (Khuyên dùng - Siêu tiết kiệm)" },
    { id: "deepseek-v4-pro", label: "deepseek-v4-pro (Khuyên dùng - Chất lượng cực cao)" },
    { id: "deepseek-reasoner", label: "deepseek-reasoner (R1 - Chuyên suy luận logic)" }
  ]
};

// Bảng giá token thực tế (USD trên 1 Triệu tokens) theo công bố của nhà phát triển
const modelPricing = {
  "gemini-3.5-flash": { input: 0.075, output: 0.3 },
  "gemini-3.5-flash-lite": { input: 0.0375, output: 0.15 },
  "gemini-3.5-pro": { input: 1.25, output: 5 },
  "gemini-3.1-flash": { input: 0.075, output: 0.3 },
  "gemini-3.1-flash-lite": { input: 0.0375, output: 0.15 },
  "gemini-3.1-pro": { input: 1.25, output: 5 },
  "gemini-3.0-flash": { input: 0.075, output: 0.3 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "gemini-2.5-pro": { input: 1.25, output: 5 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  "gemini-1.5-flash-8b": { input: 0.0375, output: 0.15 },
  "gemini-1.5-pro": { input: 1.25, output: 5 },
  "gemini-2.0-flash-exp": { input: 0, output: 0 },
  "deepseek-chat": { input: 0.14, output: 0.28 },
  "deepseek-v4-flash": { input: 0.14, output: 0.28 },
  "deepseek-v4-pro": { input: 0.27, output: 1.10 },
  "deepseek-reasoner": { input: 0.55, output: 2.19 }
};

// State toàn cục của ứng dụng
let cleanNamesList = [];
let trashNamesList = [];
let customRulesMap = new Map();
let currentExtractionController = null; // Quản lý hủy bỏ hàng đợi song song

// Khởi chạy ban đầu
document.addEventListener("DOMContentLoaded", () => {
  // Khởi tạo Lucide icons
  lucide.createIcons();
  
  // Load các khóa đã lưu từ localStorage
  loadSettings();
  
  // Tải danh sách model ban đầu
  handleProviderChange();
  
  // Thêm sự kiện đếm ký tự input
  const textInput = document.getElementById("raw-chinese-text");
  textInput.addEventListener("input", () => {
    document.getElementById("input-char-count").innerText = `${textInput.value.length} ký tự`;
  });
  
  // Thiết lập các nút Toggle cài đặt (Kiểu truyện, Độ phủ)
  setupToggleButtons("novel-type-group");
  setupToggleButtons("coverage-group");
});

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

// Thay đổi provider (Gemini / Deepseek)
function handleProviderChange() {
  const provider = document.getElementById("provider-select").value;
  const modelSelect = document.getElementById("model-select");
  modelSelect.innerHTML = "";
  
  const models = modelsMap[provider];
  models.forEach(model => {
    const opt = document.createElement("option");
    opt.value = model.id;
    opt.innerText = model.label;
    
    // Đặt mặc định khuyên dùng
    if (provider === "gemini" && model.id === "gemini-1.5-flash") opt.selected = true;
    if (provider === "deepseek" && model.id === "deepseek-v4-flash") opt.selected = true;
    
    modelSelect.appendChild(opt);
  });
}

// Reset các cài đặt về mặc định
function resetToDefaults() {
  document.getElementById("chunk-size").value = 8000;
  document.getElementById("chunk-overlap").value = 250;
  document.getElementById("concurrency").value = 2;
  document.getElementById("retries").value = 2;
  document.getElementById("timeout").value = 90;
  document.getElementById("custom-rules").value = "";
  
  // Reset toggles
  setActiveToggle("novel-type-group", "eastern");
  setActiveToggle("coverage-group", "balanced");
  
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
}

function loadSettings() {
  if (localStorage.getItem("gemini_api_key")) {
    document.getElementById("gemini-key").value = localStorage.getItem("gemini_api_key");
  }
  if (localStorage.getItem("deepseek_api_key")) {
    document.getElementById("deepseek-key").value = localStorage.getItem("deepseek_api_key");
  }
}

// Phân tích quy tắc tùy chỉnh Han=Viet trong khung textarea
function parseCustomRules() {
  customRulesMap.clear();
  const rawRules = document.getElementById("custom-rules").value.split("\n");
  rawRules.forEach(line => {
    if (line.includes("=")) {
      const parts = line.split("=");
      const cn = parts[0].trim();
      const vi = parts[1].trim();
      if (cn && vi) {
        customRulesMap.set(cn, vi);
      }
    }
  });
}

// Khởi chạy quy trình trích xuất
async function startExtraction() {
  const rawText = document.getElementById("raw-chinese-text").value.trim();
  if (!rawText) {
    alert("Vui lòng dán văn bản tiếng Trung cần trích xuất!");
    return;
  }
  
  const provider = document.getElementById("provider-select").value;
  const apiKey = provider === "gemini" 
    ? document.getElementById("gemini-key").value.trim() 
    : document.getElementById("deepseek-key").value.trim();
    
  if (!apiKey) {
    alert(`Vui lòng nhập API Key cho ${provider === "gemini" ? "Google Gemini" : "DeepSeek"}!`);
    return;
  }
  
  // Lưu Key vào local storage
  saveSettings();
  
  // Phân tích quy tắc tùy chỉnh Hán Việt
  parseCustomRules();
  
  // Đọc các tham số giao diện
  const modelId = document.getElementById("model-select").value;
  const type = getActiveToggleValue("novel-type-group");
  const mode = getActiveToggleValue("coverage-group");
  
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

  function updateCostDisplay() {
    const pricing = modelPricing[modelId] || { input: 0.075, output: 0.3 };
    const totalTokens = totalPromptTokens + totalCompletionTokens;
    // Tính tiền: inputUsd / 1M + outputUsd / 1M
    const costUsd = (totalPromptTokens / 1000000) * pricing.input + (totalCompletionTokens / 1000000) * pricing.output;
    const costVnd = Math.ceil(costUsd * 25400); // 1 USD = 25,400 VND

    // Hiển thị ở Panel tiến trình
    document.getElementById("progress-tokens").innerText = totalTokens.toLocaleString();
    document.getElementById("progress-cost").innerText = `${costVnd.toLocaleString()}đ`;

    // Hiển thị ở Panel kết quả
    document.getElementById("final-tokens").innerText = totalTokens.toLocaleString();
    document.getElementById("final-cost").innerText = `${costVnd.toLocaleString()}đ`;
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
  
  // Thiết lập biến trạng thái hủy
  let isCancelled = false;
  currentExtractionController = {
    cancel: () => { isCancelled = true; }
  };
  
  try {
    const rawExtractedList = await runParallelExtraction({
      provider,
      apiKey,
      modelId,
      chunks,
      mode,
      type,
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
        processAndFilterNames(names, type);
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
    
    // Hoàn thành trích xuất
    addLogMessage(`Trích xuất hoàn tất! Tổng cộng thu được ${cleanNamesList.length} tên sạch và ${trashNamesList.length} từ thường.`);
    
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

// Xử lý lọc tên riêng lớp 2 và gom nhóm
function processAndFilterNames(namesArray, type) {
  namesArray.forEach(item => {
    if (!item.chinese || !item.hanviet) return;
    
    const cn = item.chinese.trim();
    let vi = item.hanviet.trim();
    const cat = item.category || "Person";
    const count = parseInt(item.count) || 1;
    
    // Áp dụng luật Sửa Hán Việt ghi đè (Lớp 2.1)
    if (customRulesMap.has(cn)) {
      vi = customRulesMap.get(cn);
    } else if (type === "eastern") {
      // Tra cứu từ điển Hán Việt local để đồng bộ dịch nghĩa chuẩn xác 100% như web gốc
      const dictTranslation = translateChineseToHanViet(cn);
      if (dictTranslation) {
        vi = dictTranslation;
      }
    }
    
    // Chạy Bộ lọc thông minh bẫy rác Hán Việt (Lớp 2.2)
    const isClean = isProperName(cn, vi, type);
    
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

// Render dữ liệu ra 2 bảng
function renderTables() {
  // Sắp xếp theo số lần xuất hiện giảm dần
  cleanNamesList.sort((a, b) => b.count - a.count);
  trashNamesList.sort((a, b) => b.count - a.count);
  
  // Hiển thị số lượng
  document.getElementById("clean-count").innerText = cleanNamesList.length;
  document.getElementById("trash-count").innerText = trashNamesList.length;
  
  renderColumnTable("clean-names-body", cleanNamesList, "clean");
  renderColumnTable("trash-names-body", trashNamesList, "trash");
  
  // Vẽ lại icons
  lucide.createIcons();
}

function renderColumnTable(tbodyId, list, colType) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = "";
  
  list.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.setAttribute("data-chinese", item.chinese);
    tr.setAttribute("data-hanviet", item.hanviet);
    
    // Badge class phân loại
    const catClass = `cat-badge cat-${item.category.toLowerCase()}`;
    
    // Nút chức năng đổi cột (Qua lại giữa cột Sạch và Rác)
    const moveBtnHtml = colType === "clean" 
      ? `<button class="btn-icon btn-move" title="Đẩy sang Từ Thường" onclick="moveItem('${item.chinese}', 'clean', 'trash')"><i data-lucide="chevron-right"></i></button>`
      : `<button class="btn-icon btn-move" title="Khôi phục thành Tên Riêng" onclick="moveItem('${item.chinese}', 'trash', 'clean')"><i data-lucide="chevron-left"></i></button>`;
      
    tr.innerHTML = `
      <td class="chinese-cell" title="${item.chinese}">${item.chinese}</td>
      <td class="hanviet-cell">${item.hanviet}</td>
      <td><span class="${catClass}">${getCategoryLabel(item.category)}</span></td>
      <td>
        <div class="row-actions">
          ${moveBtnHtml}
          <button class="btn-icon btn-edit" title="Sửa" onclick="openEditModal('${item.chinese}', '${item.hanviet}', '${item.category}', '${colType}')"><i data-lucide="edit"></i></button>
          <button class="btn-icon btn-delete" title="Xóa" onclick="deleteItem('${item.chinese}', '${colType}')"><i data-lucide="trash-2"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
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
  if (list.length === 0) {
    alert("Bảng không có dữ liệu để tải!");
    return;
  }
  const text = getFormattedText(list);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = colType === "clean" ? "Names.txt" : "Names2.txt";
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
