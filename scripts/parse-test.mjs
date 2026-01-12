// Standalone copy of parseJsonFromText for quick sanity test
const sanitizePlain = (txt) => {
	if (!txt) return "";
	return txt
		.replace(/```[a-zA-Z]*\r?\n([\s\S]*?)```/g, "$1")
		.replace(/`+/g, "")
		.replace(/[\u201C\u201D]/g, '"')
		.replace(/[\u2018\u2019]/g, "'")
		.replace(/\*\*/g, "")
		.replace(/\s+$/g, "")
		.trim();
};

const parseJsonFromText = (raw) => {
	if (!raw) return null;
	const text = sanitizePlain(raw);
	try { return JSON.parse(text); } catch {}
	const start = text.indexOf("{");
	if (start !== -1) {
		let depth = 0, inStr = false, esc = false;
		for (let i = start; i < text.length; i++) {
			const c = text[i];
			if (inStr) {
				if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false;
			} else {
				if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) { const sub = text.slice(start, i + 1); try { return JSON.parse(sub); } catch {} break; } }
			}
		}
	}
	const matchVal = (re) => {
		const m = text.match(re);
		return m ? sanitizePlain(m[2]) : "";
	};
	const strategy = matchVal(/(?:"strategy"|strategy)\s*:\s*(["\u201C\u201D])([\s\S]*?)\1/);
	const email_draft = matchVal(/(?:"email_draft"|email_draft)\s*:\s*(["\u201C\u201D])([\s\S]*?)\1/);
	if (strategy || email_draft) return { strategy, email_draft };
	return null;
};

const sample = `{ "strategy": "The lead is warm and interested. He explicitly stated that you will receive a meeting invite in the new year to present to a core group. The sentiment is very positive. The next best move is to politely follow up in early January to confirm the meeting is still scheduled. Given the existing communication, keep it short, friendly, and professional.", "email_draft": "Subject: Following Up - Velux Presentation Hej Hjørleif, Happy New Year! I hope you had a wonderful holiday season. I'm following up on our conversation from December regarding the presentation to the core group. I'm eager to learn more about the project and discuss how our product can help Velux. Please let me know if the meeting is still scheduled and if there's anything I can prepare beforehand. Best regards, Jesper" }`;

const parsed = parseJsonFromText(sample);
console.log("Parsed keys:", Object.keys(parsed || {}));
console.log("Strategy:", parsed?.strategy?.slice(0, 120) + "...");
console.log("Email draft starts:", parsed?.email_draft?.slice(0, 80) + "...");
