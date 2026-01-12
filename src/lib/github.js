/* src/lib/github.js */
import Papa from "papaparse";

const BASE_URL = "https://api.github.com/repos";

const getHeaders = (token) => ({
  Authorization: `token ${token}`,
  Accept: "application/vnd.github.v3+json",
});

// Helper for Safe Base64 Encoding
const toBase64 = (str) => {
  return btoa(
    new TextEncoder()
      .encode(str)
      .reduce((data, byte) => data + String.fromCharCode(byte), '')
  );
};

// Helper for Safe Base64 Decoding
const fromBase64 = (str) => {
  return new TextDecoder().decode(
    Uint8Array.from(atob(str), (c) => c.charCodeAt(0))
  );
};

export const fetchCSV = async (token, owner, repo, path) => {
  const url = `${BASE_URL}/${owner}/${repo}/contents/${path}`;
  
  const response = await fetch(url, { 
    headers: getHeaders(token),
    cache: "no-store" 
  });
  
  const data = await response.json();
  
  if (!data.content) throw new Error("File not found or empty");

  const decoded = fromBase64(data.content);
  
  return {
    sha: data.sha,
    data: Papa.parse(decoded, { 
      header: true, 
      skipEmptyLines: true,
      delimiter: "",
      // FIX: Trim whitespace from headers to match your JS property names
      transformHeader: (header) => header.trim() 
    }).data
  };
};

// Simple per-file save queue to serialize PUTs and reduce 409 conflicts
const saveQueues = new Map(); // key: `${owner}/${repo}/${path}` -> Promise

export const saveCSV = async (token, owner, repo, path, data, sha) => {
  const key = `${owner}/${repo}/${path}`;
  const url = `${BASE_URL}/${owner}/${repo}/contents/${path}`;

  // FIX: Collect ALL unique headers from the entire dataset, not just the first row.
  // This ensures new fields like "City" or "Country" are added as new columns automatically.
  const allHeaders = new Set();
  data.forEach(row => {
    Object.keys(row).forEach(k => allHeaders.add(k));
  });
  
  // Convert Set to Array and use it in unparse config
  const columns = Array.from(allHeaders);
  const csvString = Papa.unparse(data, { columns });
  
  const encoded = toBase64(csvString);

  const putWithSha = async (currentSha) => {
    return fetch(url, {
      method: "PUT",
      headers: getHeaders(token),
      body: JSON.stringify({
        message: `Update ${path} from CRM App`,
        content: encoded,
        sha: currentSha,
      }),
    });
  };

  const run = async () => {
    let currentSha = sha;
    let response = await putWithSha(currentSha);
    let attempts = 0;

    while (response.status === 409 && attempts < 3) {
      // Refetch latest sha and retry
      const latestResp = await fetch(url, { headers: getHeaders(token), cache: "no-store" });
      if (!latestResp.ok) break;
      const latest = await latestResp.json();
      currentSha = latest.sha;
      // small backoff to let concurrent saves settle
      await new Promise((r) => setTimeout(r, 200 * (attempts + 1)));
      response = await putWithSha(currentSha);
      attempts += 1;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.message || "Unknown error";
      throw new Error(`GitHub Error: ${message}`);
    }

    return response.json();
  };

  const previous = saveQueues.get(key) || Promise.resolve();
  const next = previous.then(run, run);
  saveQueues.set(key, next.catch(() => {}));
  return next;
};