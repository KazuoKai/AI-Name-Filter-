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
  if (type === "western" || type === "anime") {
    const foreignCats = Array.isArray(foreignReadingCategories) ? foreignReadingCategories : [];
    const hanvietCats = ["Person", "Location", "Faction", "Artifact", "Skill", "Title", "Creature"].filter(c => !foreignCats.includes(c));
    
    if (type === "anime") {
      typeRules.push("- This text is a Japanese/Korean Anime, Light Novel, Manhwa, Manga, or Anime-crossover novel (e.g., Hokage, One Piece, Bleach, Dragon Ball, Solo Leveling, Fate, Genshin, Isekai, Urban Anime).");
      if (foreignCats.length > 0) {
        const d = foreignCats.join(", ");
        typeRules.push(
          `- For category [${d}], the "hanviet" field is the Vietnamese display name and should keep the original Latin/English spelling, Japanese Hepburn romanization, or Korean romanization.`,
          `- For category [${d}], set "reading" to "foreign" and recover original Romanized spelling for any Japanese/Korean/Western transliteration.`,
          `- For Person names in category [${d}]: Use Hepburn-style Japanese romanization or standard Korean romanization (e.g., "Naruto" over "Nam Đấu", "Sasuke" over "Vũ Trí Ba Tá Trợ", "Hidan" over "Phi Đoạn", "Kakuzu" over "Giác Đô", "Sung Jinwoo" over "Thành Chấn Vũ", "Gojo Satoru" over "Ngũ Điều Ngộ", "Marco" over "Mã Nhĩ Khoa", "Imu" over "Y Mỗ", "Danzo" over "Đoàn Tàng", "Minato", "Kushina", "Saito", "Goku", "Rimuru", "Luffy", "Zoro").`,
          `- For Skill / Ability names in category [${d}]: Keep Anime skill/technique names in Romanized/English form if it is an anime skill (e.g., "Rasengan", "Chidori", "Amaterasu", "Bankai", "Excalibur", "Gate of Babylon", "Getsuga Tensho", "Unlimited Blade Works", "Kamehameha", "Eight Gates", "Chakra", "Byakugan" over "Bạch Nhãn", "Sharingan" over "Tả Luân Nhãn").`,
          `- Recognize transliteration characters & famous Anime entities: (e.g., 飞段 -> Hidan, 角都 -> Kakuzu, 又旅 -> Matatabi, 蛞蝓 -> Katsuya / Sên Thần, 白眼 -> Byakugan, 鸣人 -> Naruto, 波风水门 -> Minato, 宇智波 -> Uchiha, 写轮眼 -> Sharingan, 万花筒写轮眼 -> Mangekyou Sharingan, 八门遁甲 -> Eight Gates, 查克拉 -> Chakra, 团藏 -> Danzo, 根部 -> Foundation/Root, 马尔科 -> Marco, 伊姆 -> Imu, 白胡子 -> Whitebeard, 黑胡子海贼团 -> Blackbeard Pirates, 洛克斯海贼团 -> Rocks Pirates, 莫比迪克号 -> Moby Dick).`,
          `- IMPORTANT: For Chinese names in Japanese/Korean Anime setting that do NOT have an official Japanese/Western anime name (e.g. 泰坦 -> "Thái Thản", 言少哲 -> "Ngôn Thiếu Triết", 梦红尘 -> "Mộng Hồng Trần", 牛天 -> "Ngưu Thiên", 穆恩 -> "Mục Ân"), ALWAYS output full Vietnamese Sino-reading (Hán Việt) WITH FULL DIACRITICS/ACCENTS (e.g. "Thái Thản", "Ngôn Thiếu Triết", "Mộng Hồng Trần", "Ngưu Thiên", "Mục Ân"). NEVER drop diacritics / accents for Chinese Hán-Việt names.`,
          `- ALWAYS capitalize the first letter of every word in the "hanviet" display name (e.g. "Naruto", "Minh Nhân", "Đoàn Tàng", "Mã Nhĩ Khoa", "Hắc Hồ Tử Hải Tặc Đoàn").`,
          `- Do not output pinyin with tones for Western/Anime names. Bad: "Xīlāsī", "Luo En". Good: "Silas", "Ron".`,
          `- For multi-word foreign names separated by a dot (·) or dash (-), translate each segment to its English/Latin/Romanized equivalent (e.g., 墨丘利 · 安德森 -> "Mercury Anderson"). Do not mix foreign spelling with Sino-Vietnamese reading.`
        );
      }
    } else {
      typeRules.push("- This text contains international/Western names, settings (e.g., superhero, sci-fi, modern urban, or European-like Western fantasy/mythology novels).");
      if (foreignCats.length > 0) {
        const d = foreignCats.join(", ");
        typeRules.push(
          `- For category [${d}], the "hanviet" field is the Vietnamese display name and should recover and keep the original English/Latin spelling instead of Hán Việt.`,
          `- For category [${d}], set "reading" to "foreign" and recover original Romanized/English spelling for any Western transliteration.`,
          `- For Person names in category [${d}]: Use standard English/Western romanization (e.g., "Harry Potter" over "Cáp Lợi Ba Đặc" or "Cáp Lợi", "Lucifer" over "Lộ Tây Pháp", "Arthur" over "Á Sắt", "Silas" over "Tây Lạp Tư", "Ron" over "La Ân", "Hermione" over "Hách Mẫn" or "Mẫn Mẫn", "Dumbledore" over "Đặng Bố Lợi Đa", "Grindelwald" over "Cách Lâm Đức Ốc", "Voldemort" over "Phục Địa Ma", "Snape" over "Tư Nội Phổ", "Alice" over "Ái Lệ Ti", "Bob" over "Ba Bố", "Charlie" over "Tra Lý", "David" over "Đại Vệ", "Edward" over "Ái Đức Hoa", "Frank" over "Pháp Lan Khắc", "Gary" over "Cái Lý", "John" over "Ước Hàn", "Watson" over "Hoa Sinh", "Holmes" over "Phúc Nhĩ Ma Tư", "Renato" over "Lôi Nạp Thác", "Polly" over "Phách Lợi", "Kira" over "Kỳ Lạp", "Dakur" over "Đạt Khố Nhĩ").`,
          `- For Location/Faction names in category [${d}]: Use standard English spelling for Western places/organizations (e.g., "Hogwarts" over "Hoắc Cách Ốc Tỳ/Hoắc Cách 沃茨", "London" over "Luân Đôn", "New York" over "Nữu Ước", "Vatican" over "Phạn Đế Cương", "Gryffindor" over "Gryffindor/Cách Lai Phân Đa", "Slytherin" over "Slytherin/Tát Lai Phân Đa", "Paris" over "Ba Lê", "Washington" over "Hoa Thịnh Đốn", "Breka" over "Bố Lôi Ca", "Fried" over "Phất Lợi Đức").`,
          `- For Artifact/Creature/Skill names in category [${d}]: Keep Western artifact/creature/skill names in Romanized/English form (e.g., "Excalibur" over "Ái Khắc Tư Ca Lý Bá", "Dragon" over "Cự Long", "Elf" over "Tinh Linh", "Dwarf" over "Ảo Nhân", "Goblin" over "Ca Bố Lâm", "Vampire" over "Hút Máu Quỷ", "Werewolf" over "Lang Nhân").`,
          `- Translate Western Syllables aggressively: Translate ALL transliterated foreign names and places to their correct English/Latin spelling (e.g., 罗恩 -> Ron, 亚瑟 -> Arthur, 兰斯 -> Lance, 林恩 -> Lynn/Flynn, 艾伦 -> Alan/Allen, 科林 -> Colin, 马修 -> Matthew, 莫尔 -> Moore, 贝克 -> Baker, 戴维斯 -> Davis, 杰克逊 -> Jackson, 麦克 -> Mike/Mac, 菲利普 -> Philip, 凯文 -> Kevin, 托马斯 -> Thomas, 罗伯特 -> Robert, 詹姆斯 -> James, 玛丽 -> Mary, 杰克 -> Jack, 凯瑟琳 -> Catherine, 莉莉 -> Lily, 维克多 -> Victor, 雷恩 -> Ryan, 修斯 -> Hughes, 修 -> Hugh, 雷纳托 -> Renato, 珀莉 -> Polly, 莱拉丝 -> Lairess, 布雷卡 -> Breka, 弗里德 -> Fried, 琪拉 -> Kira, 达库尔 -> Dakur).`,
          `- For place names with administrative suffixes in Chinese (e.g. 镇 -> town, 城 -> city, 村 -> village, 国 -> kingdom), translate the transliterated name to English and append the translated suffix in Vietnamese (e.g. 布雷卡镇 -> "Breka Town" or "Breka town", 弗里德城 -> "Fried City" or "Fried city", 圣蒂兰帝国 -> "Saint Tilan Empire"). Do not mix them into Hán-Việt (Bad: "Bố Lôi Ca trấn", "Phất Lợi Đức thành").`,
          `- Do NOT output Sino-Vietnamese (Hán Việt) or pinyin with tones for transliterated Western names in [${d}]. Bad: "La An", "Luo En", "Luoxi Fa", "Lôi Nạp Thác", "Phách Lợi", "Kỳ Lạp", "Đạt Khố Nhĩ". Good: "Ron", "Lucifer", "Renato", "Polly", "Kira", "Dakur".`,
          `- IMPORTANT: For Chinese names or Eastern entities in a Western setting that do NOT have a Western name, ALWAYS output full Vietnamese Sino-reading (Hán Việt) WITH FULL DIACRITICS/ACCENTS (e.g. "Tiêu Viêm" over "Xiao Yan"). NEVER drop diacritics / accents for Chinese Hán-Việt names.`,
          `- ALWAYS capitalize the first letter of every word in the "hanviet" display name (e.g. "Harry Potter", "Gryffindor", "Excalibur", "Arthur", "Renato", "Polly", "Breka Town", "Kira", "Dakur").`,
          `- For multi-word foreign names separated by a dot (·) or dash (-), translate each segment to its English/Latin/Romanized equivalent (e.g., 墨丘利 · 安德森 -> "Mercury Anderson"). Do not mix foreign spelling with Sino-Vietnamese reading.`
        );
      }
    }
    
    if (hanvietCats.length > 0) {
      const j = hanvietCats.join(", ");
      typeRules.push(
        `- For category [${j}], set "reading" to "hanviet" and use Vietnamese Sino-reading (Hán Việt) with full diacritics.`,
        `- Do NOT output Latin/English spelling for category [${j}]. These categories should remain in Hán Việt display names.`
      );
    }
  } else {
    typeRules = [
      '- Set "reading" to "hanviet" for every extracted entity.',
      '- This text is Eastern/Chinese fantasy. The "hanviet" field must be Vietnamese Sino-reading with full Vietnamese diacritics, title case with spaces.',
      "- Never output unaccented romanization for Eastern names. Bad: Truong Sinh Benh, Cuc De, Luu Vu. Good: Trường Sinh Bệnh, Cực Đế, Lưu Vũ.",
      "- Use common Vietnamese Sino-Vietnamese readings: 天=Thiên, 算=Toán, 老=Lão, Nhân=Nhân, Vương=Vương, Quốc=Quốc, Sơn=Sơn, Hải=Hải, Thần=Thần, Phong=Phong, Tử=Tử."
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
    "- Extract all character names (e.g., 方见贤), martial arts techniques/skills/gongfa (e.g., 云极拳, 云无穷拳), weapons, sects, creatures (e.g., 黄金鳄王 instead of 十万年黄金鳄王), and places. Strip surrounding book title quotes 《》, “”, or 【】 and age/duration prefixes (e.g., 十万年, 万年, 千年, 百年) from the extracted Chinese entity.",
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
      // Nếu API trả về lỗi 400 do không hỗ trợ tham số thinking -> Tự động thử lại không có tham số thinking
      if (response.status === 400 && requestBody.thinking && (errText.toLowerCase().includes("thinking") || errText.toLowerCase().includes("unrecognized"))) {
        delete requestBody.thinking;
        const retryResp = await fetchWithTimeout(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestBody)
        }, timeoutMs);
        if (!retryResp.ok) {
          const retryErrText = await retryResp.text();
          throw new Error(`DeepSeek API Error ${retryResp.status}: ${retryErrText}`);
        }
        const data = await retryResp.json();
        let names = [];
        if (data.choices && data.choices[0] && data.choices[0].message) {
          const msg = data.choices[0].message;
          const contentText = msg.content || msg.reasoning_content || "";
          const parsed = parseJSONResponse(contentText);
          names = (parsed && Array.isArray(parsed.names)) ? parsed.names : [];
        }
        const usage = data.usage ? {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0
        } : { promptTokens: 0, completionTokens: 0 };
        return { names, usage };
      }
      throw new Error(`DeepSeek API Error ${response.status}: ${errText}`);
    }
    
    const data = await response.json();
    let names = [];
    if (data.choices && data.choices[0] && data.choices[0].message) {
      const msg = data.choices[0].message;
      const contentText = msg.content || msg.reasoning_content || "";
      const parsed = parseJSONResponse(contentText);
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
  if (!rawText) return null;
  // 1. Loại bỏ toàn bộ phần suy luận <think>...</think> của các model DeepSeek R1/V4, Qwen CoT
  let cleanText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  
  // 2. Gọt bỏ khối mã markdown ```json ... ``` nếu AI tự động bọc lại
  cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    return JSON.parse(cleanText);
  } catch (err) {
    const balanced = balanceBraces(cleanText);
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
