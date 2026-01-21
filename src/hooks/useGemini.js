/* src/hooks/useGemini.js */
import { GoogleGenAI, Type } from "@google/genai";
import { useState } from "react";

export const useGemini = (apiKey) => {
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState(null);

  const buildContents = (prompt) => ([
    {
      role: "user",
      parts: [{ text: prompt }],
    },
  ]);

  const readResponseText = async (response) => {
    try {
      // SDK v1 style
      if (response?.response?.text) {
        return await response.response.text();
      }
      // Some builds expose text() directly
      if (typeof response?.text === "function") {
        return await response.text();
      }
      // Fallback to candidates
      const t = response?.candidates?.[0]?.content?.parts?.[0]?.text;
      return t || "";
    } catch {
      return "";
    }
  };

  const formatDateLong = (iso) => {
    try {
      const d = new Date(iso);
      const day = d.toLocaleString("en-GB", { day: "numeric" });
      const month = d.toLocaleString("en-GB", { month: "long" });
      const year = d.toLocaleString("en-GB", { year: "numeric" });
      const time = d.toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
      return `${day}. ${month} ${year} ${time}`; // e.g., 5. January 2025 14:35
    } catch {
      return iso;
    }
  };

  const sanitizePlain = (txt) => {
    if (txt == null) return "";
    const s = typeof txt === "string"
      ? txt
      : (typeof txt === "number" || typeof txt === "boolean")
        ? String(txt)
        : "";
    if (!s) return "";
    return s
      .replace(/```[a-zA-Z]*\r?\n([\s\S]*?)```/g, "$1") // strip fenced code blocks (handle \r?\n)
      .replace(/`+/g, "") // strip inline backticks
      .replace(/[\u201C\u201D]/g, '"') // smart double quotes → ASCII
      .replace(/[\u2018\u2019]/g, "'") // smart single quotes → ASCII
      .replace(/\*\*/g, "") // strip bold markers
      .replace(/\s+$/g, "")
      .trim();
  };

  const parseJsonFromText = (raw) => {
    if (!raw) return null;
    const text = sanitizePlain(raw);

    // 1) Direct JSON parse
    try {
      return JSON.parse(text);
    } catch (e) {
      void e;
    }

    // 2) Balanced brace extraction (ignore braces inside quoted strings)
    const start = text.indexOf("{");
    if (start !== -1) {
      let depth = 0;
      let inStr = false;
      let esc = false;
      for (let i = start; i < text.length; i++) {
        const c = text[i];
        if (inStr) {
          if (esc) {
            esc = false;
          } else if (c === "\\") {
            esc = true;
          } else if (c === '"') {
            inStr = false;
          }
        } else {
          if (c === '"') {
            inStr = true;
          } else if (c === '{') {
            depth++;
          } else if (c === '}') {
            depth--;
            if (depth === 0) {
              const sub = text.slice(start, i + 1);
              try {
                return JSON.parse(sub);
              } catch (e) {
                void e;
              }
              break;
            }
          }
        }
      }
    }

    // 3) Key-based fallback: extract "strategy" and "email_draft" values even if not valid JSON
    const matchVal = (re) => {
      const m = text.match(re);
      return m ? sanitizePlain(m[2]) : "";
    };
    const strategy = matchVal(/(?:"strategy"|strategy)\s*:\s*(["\u201C\u201D])([\s\S]*?)\1/);
    const email_draft = matchVal(/(?:"email_draft"|email_draft)\s*:\s*(["\u201C\u201D])([\s\S]*?)\1/);
    if (strategy || email_draft) {
      return { strategy, email_draft };
    }

    return null;
  };

  // 1. Sales Coach
  const askGemini = async (lead, company, history = []) => {
    if (!apiKey) return alert("Please set your Gemini API Key.");
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      const historyText = history.length > 0 
        ? history.map(h => `[${formatDateLong(h.date)}] ${h.type.toUpperCase()}: ${h.content}`).join("\n") 
        : "No previous history.";

      const prompt = `
    Act as a senior sales mentor. Analyze this lead context and history.

    LEAD: ${lead.Name} (${lead.Title || "Unknown"}) @ ${lead.Company}
    TECH STACK: ${company?.Software || "Unknown"}

    INTERACTION HISTORY (dates are written long-form like "5. January 2025 14:35"):
    ${historyText}

    TASK:
    1. Analyze the history for sentiment (interested, stalling, ghosting?).
    2. Suggest the NEXT BEST MOVE.
    3. Draft the response email.

    OUTPUT FORMAT:
    Return JSON ONLY with keys "strategy" and "email_draft".
    - Use plain text (no Markdown, no **, no lists).
    - "email_draft" must be non-empty and ready to send.
    `;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: buildContents(prompt),
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              strategy: { type: Type.STRING },
              email_draft: { type: Type.STRING },
            },
          },
        },
      });

      const text = await readResponseText(response);
      let parsed = parseJsonFromText(text) || { strategy: text || "", email_draft: "" };
      const cleanStrategy = sanitizePlain(parsed.strategy || "");
      let cleanDraft = sanitizePlain(parsed.email_draft || "");
      if (!cleanDraft) {
        // Fallback email draft
        cleanDraft = `Hi ${lead.Name},\n\nFollowing up on our recent conversation. Based on your context at ${lead.Company}, I suggest ${cleanStrategy.slice(0, 180)}...\n\nWould you be open to a quick call to discuss next steps?\n\nBest,\n`;
      }
      setAdvice({ strategy: cleanStrategy, email_draft: cleanDraft });
    } catch (error) {
      console.error(error);
      alert("AI Error. Check console.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Company Researcher
  const researchCompany = async (companyName, city) => {
    if (!apiKey) return alert("Please set your Gemini API Key.");
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey });

      // UPDATED PROMPT: Explicitly requests JSON to prevent search text override
      const prompt = `
        Research the company "${companyName}" ${city ? `in ${city}` : ""}.
        
        Return a strict JSON object with these specific keys:
        - Category: Specific industry.
        - Software: Tech stack/Software used (e.g. KeyShot, Rhino).
        - Employees: Specific number as a string (e.g. "14000").
        - Url: Official website URL.
        - City: HQ City.
        - Country: HQ Country.
        - Reasoning: Brief summary of sources.

        Output ONLY JSON. No introductory text.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: buildContents(prompt),
        tools: [{ googleSearch: {} }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              Category: { type: Type.STRING },
              Software: { type: Type.STRING },
              Employees: { type: Type.STRING },
              Url: { type: Type.STRING },
              City: { type: Type.STRING },
              Country: { type: Type.STRING },
              SourceUrl: { type: Type.STRING },
              Reasoning: { type: Type.STRING },
            },
          },
        },
      });

      const text = await readResponseText(response);
      const parsed = parseJsonFromText(text);
      return parsed || {};
    } catch (error) {
      console.error(error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // 3. Lead Researcher
  const researchLead = async (name, company) => {
    if (!apiKey) return alert("Please set your Gemini API Key.");
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey });

      // UPDATED PROMPT: Explicitly requests JSON
      const prompt = `
        Find public professional info for "${name}" who works at "${company}".
        
        Return a strict JSON object with these keys:
        - Title: Current Job Title.
        - LinkedIn: Public profile URL.
        - City: Current City.
        - Country: Current Country.

        Output ONLY JSON. No introductory text.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: buildContents(prompt),
        tools: [{ googleSearch: {} }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              Title: { type: Type.STRING },
              LinkedIn: { type: Type.STRING },
              City: { type: Type.STRING },
              Country: { type: Type.STRING },
            },
          },
        },
      });

      const text = await readResponseText(response);
      const parsed = parseJsonFromText(text);
      return parsed || {};
    } catch (error) {
      console.error(error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { askGemini, researchCompany, researchLead, advice, loading, setAdvice };
};