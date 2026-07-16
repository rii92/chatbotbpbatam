const { URL } = require("url");

class MetabaseAPI {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
  }

  _headers() {
    return {
      "Content-Type": "application/json",
      "X-API-KEY": this.apiKey,
    };
  }

  async _fetch(url, options, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  async get(path, params) {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }
    const res = await this._fetch(url.toString(), {
      method: "GET",
      headers: this._headers(),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Metabase GET ${path} failed: ${res.status} ${body}`);
    }
    return res.json();
  }

  async post(path, data) {
    const res = await this._fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this._headers(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Metabase POST ${path} failed: ${res.status} ${body}`);
    }
    return res.json();
  }

  async testConnection() {
    return this.get("/api/user/current");
  }

  async listDashboards() {
    const data = await this.get("/api/dashboard");
    return data.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description || "",
    }));
  }

  async getDashboard(dashboardId) {
    const data = await this.get(`/api/dashboard/${dashboardId}`);
    const cards = (data.ordered_cards || []).map((ordered) => {
      const card = ordered.card || {};
      return {
        card_id: card.id,
        name: card.name,
        description: card.description || "",
        display: card.display || "",
      };
    });
    return {
      id: data.id,
      name: data.name,
      description: data.description || "",
      cards,
    };
  }

  async listCards() {
    const data = await this.get("/api/card");
    return data.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description || "",
      display: c.display || "",
    }));
  }

  async getCard(cardId) {
    const data = await this.get(`/api/card/${cardId}`);
    return {
      id: data.id,
      name: data.name,
      description: data.description || "",
      display: data.display || "",
      query: data.dataset_query || {},
    };
  }

  async executeCard(cardId) {
    const data = await this.post(`/api/card/${cardId}/query/json`);
    if (Array.isArray(data)) {
      return data.slice(0, 50);
    }
    return data;
  }

  async listCollections() {
    const data = await this.get("/api/collection");
    return data.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type || "",
    }));
  }

  async search(query) {
    const data = await this.get("/api/search", { q: query });
    const results = (data.results || []).slice(0, 20);
    return results.map((item) => ({
      id: item.id,
      name: item.name,
      model: item.model,
      description: item.description || "",
    }));
  }
}

const TOOLS = [
  {
    name: "list_dashboards",
    description: "Daftar semua dashboard yang tersedia di Metabase",
    fn: (mb) => mb.listDashboards(),
    args: [],
  },
  {
    name: "get_dashboard",
    description: "Lihat detail dashboard dan card di dalamnya",
    fn: (mb, args) => mb.getDashboard(args.dashboard_id),
    args: [{ name: "dashboard_id", type: "integer", desc: "ID dashboard" }],
  },
  {
    name: "list_cards",
    description: "Daftar semua card/question yang tersedia",
    fn: (mb) => mb.listCards(),
    args: [],
  },
  {
    name: "get_card",
    description: "Lihat detail card beserta query-nya",
    fn: (mb, args) => mb.getCard(args.card_id),
    args: [{ name: "card_id", type: "integer", desc: "ID card" }],
  },
  {
    name: "execute_card",
    description: "Jalankan card dan dapatkan hasil data aktual",
    fn: (mb, args) => mb.executeCard(args.card_id),
    args: [{ name: "card_id", type: "integer", desc: "ID card yang akan dijalankan" }],
  },
  {
    name: "list_collections",
    description: "Daftar semua collection/folder",
    fn: (mb) => mb.listCollections(),
    args: [],
  },
  {
    name: "search",
    description: "Cari card, dashboard, atau collection berdasarkan kata kunci",
    fn: (mb, args) => mb.search(args.query),
    args: [{ name: "query", type: "string", desc: "Kata kunci pencarian" }],
  },
];

function buildOpenAITools() {
  return TOOLS.map((tool) => {
    const props = {};
    const required = [];
    for (const arg of tool.args) {
      props[arg.name] = {
        type: arg.type,
        description: arg.desc,
      };
      required.push(arg.name);
    }
    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "object",
          properties: props,
          required: required.length ? required : undefined,
        },
      },
    };
  });
}

function findTool(name) {
  return TOOLS.find((t) => t.name === name);
}

async function executeTool(name, args, mb) {
  const tool = findTool(name);
  if (!tool) {
    return JSON.stringify({ error: `Tool ${name} tidak ditemukan` });
  }
  try {
    const result = await tool.fn(mb, args);
    return JSON.stringify(result, null, 2);
  } catch (err) {
    return JSON.stringify({ error: err.message });
  }
}

async function callLLM(messages, llmUrl, llmApiKey, llmModel) {
  const url = llmUrl.replace(/\/+$/, "") + "/chat/completions";
  console.log("[LLM] Calling:", url, "model:", llmModel);
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${llmApiKey || "sk-placeholder"}`,
  };
  const payload = {
    model: llmModel || "ornith-1.0-35b-Q6_K.gguf",
    messages,
    tools: buildOpenAITools(),
    tool_choice: "auto",
    temperature: 0.3,
    max_tokens: 4096,
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`LLM API error: ${res.status} ${body}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

const SYSTEM_PROMPT =
  "Anda adalah asisten data BP Batam yang terhubung ke Metabase. Gunakan tool yang tersedia " +
  "untuk menjawab pertanyaan user tentang data BP Batam. Ikuti langkah-langkah:\n" +
  "1. Mulai dengan search atau list untuk menemukan konten relevan.\n" +
  "2. Baca detail dashboard/card jika perlu.\n" +
  "3. Execute card untuk mendapatkan data aktual jika user minta angka.\n" +
  "4. Selalu sebutkan sumber (dashboard/card name + ID) di jawaban.\n" +
  "5. Jawab dalam Bahasa Indonesia, format WhatsApp (tanpa markdown tabel, gunakan teks biasa).\n" +
  "6. Jika data kosong, sampaikan bahwa belum ada data yang tersedia.\n" +
  "7. Jangan eksekusi query yang belum dipahami.";

async function askMetabase(question, llmUrl, llmApiKey, llmModel, mb) {
  console.log("[METABASE] Question:", question);
  console.log("[METABASE] llmUrl:", llmUrl, "model:", llmModel);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: question },
  ];

  for (let iter = 0; iter < 10; iter++) {
    console.log("[METABASE] LLM iteration:", iter + 1);
    const response = await callLLM(messages, llmUrl, llmApiKey, llmModel);
    const choice = response.choices?.[0];
    if (!choice) throw new Error("LLM tidak memberikan respons");

    const msg = choice.message;
    console.log("[METABASE] LLM finish_reason:", choice.finish_reason, "tool_calls:", msg.tool_calls?.length || 0);

    if (msg.tool_calls) {
      messages.push({
        role: "assistant",
        content: msg.content || null,
        tool_calls: msg.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      });

      for (const tc of msg.tool_calls) {
        const fn = tc.function;
        let fnArgs = {};
        try {
          fnArgs = JSON.parse(fn.arguments);
        } catch (_) {}

        console.log("[METABASE] Executing tool:", fn.name, fnArgs);
        const resultStr = await executeTool(fn.name, fnArgs, mb);
        console.log("[METABASE] Tool result length:", resultStr.length);
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: resultStr,
        });
      }
      continue;
    }

    const answer = msg.content || "Maaf, tidak ada jawaban yang tersedia.";
    console.log("[METABASE] Final answer length:", answer.length);
    return answer;
  }

  return "Maaf, proses terlalu panjang. Coba pertanyaan yang lebih spesifik.";
}

module.exports = { MetabaseAPI, askMetabase, SYSTEM_PROMPT };
