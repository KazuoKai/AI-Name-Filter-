// api.js - Quản lý cuộc gọi API, chia nhỏ văn bản và xếp hàng đợi song song

// Hàm chia văn bản thành các chunk có độ dài và độ lặp lại chỉ định
function splitTextIntoChunks(text, chunkSize, overlap) {
  if (!text) return [];
  const chunks = [];
  let index = 0;
  
  while (index < text.length) {
    let start = index;
    let end = start + chunkSize;
    
    // Nếu chưa chạm cuối văn bản, cố gắng ngắt chunk tại dấu xuống dòng để không làm rách câu
    if (end < text.length) {
      const nextNewline = text.indexOf("\n", end - 100);
      if (nextNewline !== -1 && nextNewline < end + 100) {
        end = nextNewline + 1;
      }
    }
    
    chunks.push(text.slice(start, end));
    
    // Tiến tới cho chunk tiếp theo (trừ đi độ lặp gối đầu)
    index = end - overlap;
    if (index >= text.length || end >= text.length) {
      break;
    }
    if (index <= start) {
      // Đề phòng vòng lặp vô tận khi overlap >= chunkSize
      index = start + chunkSize;
    }
  }
  return chunks;
}

// Xây dựng prompt động dựa trên chế độ độ phủ và loại truyện
function buildSystemPrompt(mode, type, foreignReadingCategories) {
  const schema = 'Schema: {"names":[{"chinese":"中文原文","hanviet":"Vietnamese display name","reading":"hanviet|foreign","category":"Person|Location|Faction|Artifact|Skill|Title|Creature","description":"","count":estimated_occurrences_in_this_chunk}]}';
  
  let typeRules = [];
  if (type === "western") {
    const foreignCats = Array.isArray(foreignReadingCategories) ? foreignReadingCategories : [];
    const hanvietCats = ["Person", "Location", "Faction", "Artifact", "Skill", "Title", "Creature"].filter(c => !foreignCats.includes(c));
    
    typeRules.push("- This text contains international/Western names, Japanese, Korean, or mixed settings (e.g., superhero, sci-fi, modern urban, or European-like fantasy novels).");
    
    if (foreignCats.length > 0) {
      const d = foreignCats.join(", ");
      typeRules.push(
        `- For category [${d}], the "hanviet" field is the Vietnamese display name and should keep the original Latin/English spelling or standard romanization when the Chinese text is a phonetic transliteration. Bad: "La Bá Đặc", "Mặc Khâu Lợi". Good: "Robert", "Mercury".`,
        `- For category [${d}], set "reading" to "foreign" and recover the original Latin/English spelling for any name that is a Chinese phonetic transliteration of a Western name.`,
        `- Recognize transliteration characters: Chinese transliterated names are usually made of characters like 克, 斯, 德, 尔, 亚, 特, 罗, 贝, 莉, 纳, 维, 萨, 蒙, 森, 莱, 昂, 迪, 普, 姆, 恩, 杰, 瑞, 约, 翰, 逊, 霍, 华, 雅, etc. (e.g., 维林 -> "Werin/Vilin", 凯恩 -> "Kane/Cain", 莫雷德 -> "Moled/Mored", 月洛缇 -> "Yuelotte", 罗恩 -> "Ron/Rowan", 奥蕾莉亚 -> "Aurelia", 亚格伦 -> "Agren", 费南 -> "Finan", 亚魔斯 -> "Amos", West -> "West", 西拉斯 -> "Silas", 克鲁恩 -> "Krun", 洛薇娜 -> "Rowena", 施密t -> "Schmidt", 施密特 -> "Schmidt", 伦纳德 -> "Leonard", 斯特林 -> "Sterling", 德拉克 -> "Drake", 奥维尔 -> "Orville", 埃文 -> "Evan", 安德鲁 -> "Andrew", 罗莎琳 -> "Rosalind", 弗拉德 -> "Vlad"). Names in category [${d}] composed of these characters in this setting MUST be translated to their Western spelling (e.g., Robert, Al, Flora, Johnson, Howard) in the "hanviet" field.`,
        `- Do not output pinyin with tones for Western names. Bad: "Xīlāsī", "Luo En". Good: "Silas", "Ron".`,
        `- For category [${d}] with multi-word Western names separated by a dot (·) or dash (-), translate each segment to its English/Latin equivalent (e.g., 墨丘利 · 安德森 -> "Mercury Anderson", 威利 · 约翰逊 -> "Willy Johnson", 诺娃 · 萨温娜 -> "Nova Savina/Savannah", 凯恩 · 莫雷德 -> "Kane Moled"). Do not mix Western spelling with Sino-Vietnamese reading.`,
        `- For Japanese personal names in category [${d}] (if Person is selected), use Hepburn-style romanization consistently (e.g. Natsume Chikage over Hạ Mục Thiên Cảnh, Fujiwara Aoi over Đằng Nguyên Quỳ, Kondo Miyuki over Cận Đằng Mỹ Tuyết, Tsukishima Rin over Nguyệt Đảo Lẫm).`,
        `- For category [${d}] (if Location is selected), do NOT translate location qualifiers literally to English if it makes it unrecognizable. Prepend/append the standard Vietnamese qualifier (e.g., "Vương Quốc", "Lãnh Địa", "Thị Trấn", "Rừng", "Thương Hội", "Quán Rượu"). For example, "瓦雷利亚王国" -> "Vương Quốc Valeria", "金树林" -> "Rừng Kim Thụ", "银爪领" -> "Lãnh Địa Ngân Trảo", "寒风堡小镇" -> "Hàn Phong Bảo Tiểu Trấn".`
      );
    }
    
    if (hanvietCats.length > 0) {
      const j = hanvietCats.join(", ");
      typeRules.push(
        `- For category [${j}], set "reading" to "hanviet" and use Vietnamese Sino-reading with full Vietnamese diacritics, even in international/Western settings.`,
        `- Do NOT output Latin/English spelling for category [${j}]. These categories should remain understandable to Vietnamese readers through Hán Việt display names.`
      );
    }
  } else {
    typeRules = [
      '- Set "reading" to "hanviet" for every extracted entity.',
      '- This text is Eastern/Chinese fantasy. The "hanviet" field must be Vietnamese Sino-reading with full Vietnamese diacritics, title case with spaces.',
      "- Never output unaccented romanization for Eastern names. Bad: Truong Sinh Benh, Cuc De, Luu Vu. Good: Trường Sinh Bệnh, Cực Đế, Lưu Vũ.",
      "- Use common Vietnamese Sino-Vietnamese readings: 天=Thiên, 算=Toán, 老=Lão, 人=Nhân, Vương=Vương, 国=Quốc, Sơn=Sơn, Hải=Hải, Thần=Thần, Phong=Phong, Tử=Tử."
    ];
  }

  const modeRules = mode === "strict" ? [
    "Primary goal: same recall as balanced mode, but higher precision by filtering specific noise categories.",
    "- Extract all named entities that balanced mode would extract — do NOT be more conservative on people, locations, factions, items, or named techniques.",
    "- Additionally filter out these specific noise types that balanced mode over-includes:",
    "  1. Pure cultivation/game mechanics words used as generic concepts, NOT as names: e.g., 攻击, 防御, 速度, 修炼, 功 pháp, 武功, 境界, 气功, 功德, 魂力, 武魂, 体质, 灵力, 真气, 斗气 — skip only when these appear as generic labels, not as part of a specific named technique.",
    '  2. Generic rank-prefixed labels like "一阶炼丹", "二阶功法" — skip unless they are the specific name of a titled entity.',
    "  3. Common address forms that are not proper names: 老X, 小X, X哥, X叔, X爷, X师兄, X师妹 — skip unless the full form (e.g., 老刘) is the only name by which a character is known in the text.",
    "- If unsure, include it — missing a real name is worse than including a borderline one."
  ] : mode === "balanced" ? [
    "Primary goal: balanced precision and recall.",
    "- Extract named entities only when the context reasonably supports that they are proper names.",
    "- Include one-off names if they are clearly entities.",
    "- Skip ambiguous common 2-4 character phrases unless the surrounding context treats them like a person, place, faction, item, skill, title, or creature.",
    "- If unsure, include medium/high confidence entities and skip very weak guesses."
  ] : [
    "Primary goal: high recall. It is better to include a plausible proper name than to miss it.",
    "- Scan the chunk twice internally before answering: first for obvious names, second for rare/one-off names.",
    "- Extract all named entities, including names that appear only once.",
    "- Do not limit the list to main characters or frequent names.",
    "- Include aliases, courtesy names, titles used as names, place names, sect/faction names, artifact names, skill names, creature names, and unique realm/world names.",
    "- Skip common words and generic phrases only when they are clearly not used as a name/title/entity.",
    "- For ambiguous 2-4 Chinese character phrases, include them if the surrounding context treats them like a person, place, faction, item, skill, title, or creature."
  ];

  return [
    "You extract proper names from raw Chinese web novel text.",
    "This is a neutral named-entity extraction task for fiction text.",
    "Do not summarize, continue, translate, classify, judge, or describe sensitive events from the source text.",
    "Only extract proper names and minimal entity metadata needed by the JSON schema.",
    "If surrounding content is sensitive, ignore the sensitive action and still extract names/entities only.",
    "Return exactly one valid JSON object. No markdown. No prose. No second JSON object. No text before or after JSON.",
    schema,
    "Rules:",
    ...modeRules,
    "- Keep chinese exactly as it appears in the source.",
    ...typeRules,
    "- Do not merge different Chinese spellings even if they may refer to the same entity.",
    "- Do not drop a valid entity just because its count is 1.",
    "- Always set description to an empty string. Do not infer or write any description."
  ].join("\n");
}

// Gọi API có hỗ trợ Hủy yêu cầu (Timeout)
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const { signal } = controller;
  const id = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { ...options, signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// Gửi yêu cầu trích xuất cho 1 chunk
async function extractChunk({ provider, apiKey, modelId, text, mode, type, foreignReadingCategories, chunkIndex, totalChunks, timeoutSecs }) {
  const systemPrompt = buildSystemPrompt(mode, type, foreignReadingCategories);
  const timeoutMs = timeoutSecs * 1000;
  
  if (provider === "gemini") {
    // Gọi API của Google Gemini
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\nChunk ${chunkIndex + 1}/${totalChunks}:\n${text}` }]
        }
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 16384,
        responseMimeType: "application/json"
      }
    };
    
    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    }, timeoutMs);
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Error ${response.status}: ${errText}`);
    }
    
    const data = await response.json();
    let names = [];
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
      const parsed = parseJSONResponse(data.candidates[0].content.parts[0].text);
      names = (parsed && Array.isArray(parsed.names)) ? parsed.names : [];
    }
    const usage = data.usageMetadata ? {
      promptTokens: data.usageMetadata.promptTokenCount || 0,
      completionTokens: data.usageMetadata.candidatesTokenCount || 0
    } : { promptTokens: 0, completionTokens: 0 };
    
    return { names, usage };
  } else {
    // Gọi API của DeepSeek hoặc OpenAI Proxy
    const url = "https://api.deepseek.com/chat/completions";
    const requestBody = {
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Chunk ${chunkIndex + 1}/${totalChunks}:\n${text}` }
      ],
      temperature: 0,
      max_tokens: 16384,
      response_format: { type: "json_object" },
      stream: false
    };
    
    // Thêm các tham số suy luận bổ sung của Deepseek nếu là model Reasoner
    if (modelId === "deepseek-reasoner") {
      delete requestBody.response_format; 
    } else {
      // Tắt suy luận (thinking: disabled) giúp chạy nhanh hơn rất nhiều và tốn ít chi phí hơn
      requestBody.thinking = { type: "disabled" };
    }
    
    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    }, timeoutMs);
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepSeek API Error ${response.status}: ${errText}`);
    }
    
    const data = await response.json();
    let names = [];
    if (data.choices && data.choices[0] && data.choices[0].message) {
      const parsed = parseJSONResponse(data.choices[0].message.content);
      names = (parsed && Array.isArray(parsed.names)) ? parsed.names : [];
    }
    const usage = data.usage ? {
      promptTokens: data.usage.prompt_tokens || 0,
      completionTokens: data.usage.completion_tokens || 0
    } : { promptTokens: 0, completionTokens: 0 };
    
    return { names, usage };
  }
}

// Cân bằng dấu ngoặc nhọn để bóc tách chuỗi JSON khi AI bị lỗi thừa text đầu/cuối
function balanceBraces(str) {
  const start = str.indexOf("{");
  if (start === -1) return "";
  let count = 0, inQuote = false, escape = false;
  
  for (let i = start; i < str.length; i++) {
    const char = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote) {
      if (char === "{") count++;
      if (char === "}") {
        count--;
        if (count === 0) {
          return str.slice(start, i + 1);
        }
      }
    }
  }
  return "";
}

function parseJSONResponse(rawText) {
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    const balanced = balanceBraces(trimmed);
    if (!balanced) throw new Error("Mẫu kết quả AI trả về không chứa JSON hợp lệ.");
    return JSON.parse(balanced);
  }
}

// Hàm chạy tiến trình song song và quản lý lỗi/gọi lại
async function runParallelExtraction({
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
  onProgress,
  onChunkSuccess,
  onChunkError,
  onChunkRetry
}) {
  const total = chunks.length;
  let completed = 0;
  const results = [];
  
  // Hàng đợi công việc
  const queue = chunks.map((text, index) => ({ text, index }));
  
  // Trình chạy luồng (Worker)
  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) break;
      
      let attempt = 0;
      let success = false;
      let lastError = null;
      
      while (attempt < retries && !success) {
        attempt++;
        try {
          const data = await extractChunk({
            provider,
            apiKey,
            modelId,
            text: task.text,
            mode,
            type,
            foreignReadingCategories,
            chunkIndex: task.index,
            totalChunks: total,
            timeoutSecs
          });
          
          // Trích xuất thành công
          success = true;
          const names = data.names || [];
          const usage = data.usage || { promptTokens: 0, completionTokens: 0 };
          onChunkSuccess(task.index, names, usage);
          results.push(...names);
        } catch (error) {
          lastError = error;
          if (onChunkRetry) {
            onChunkRetry(task.index, attempt, retries, error);
          }
          // Chờ một khoảng thời gian tăng dần trước khi gọi lại (exponential backoff)
          if (attempt < retries) {
            const waitMs = Math.min(10000, 1000 * Math.pow(2, attempt) + Math.random() * 500);
            await new Promise(resolve => setTimeout(resolve, waitMs));
          }
        }
      }
      
      if (!success) {
        onChunkError(task.index, lastError || new Error("Thất bại sau nhiều lần thử."));
      }
      
      completed++;
      onProgress(Math.round((completed / total) * 100), completed, total);
    }
  }
  
  // Khởi động các worker chạy song song
  const workers = [];
  const workerCount = Math.min(concurrency, total);
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker());
  }
  
  await Promise.all(workers);
  return results;
}
