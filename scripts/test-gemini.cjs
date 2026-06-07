const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const key = process.env.VITE_GEMINI_API_KEY;
const prompt = `You are a BI AI. Perform a Multi-Criteria Decision Analysis (MCDA).

Data: {"topProducts":[],"categories":[],"health":{}}

Rules:
- Create exactly 3 options and 3 criteria
- Weights must sum to 1.0
- Scores must be 0-100
- Return ONLY valid JSON — no markdown, no code fences, no explanations, no natural language
- Every string value must be properly quoted and closed
- The response must be a single, complete JSON object

Expected JSON structure:
{
  "title": "string — analysis title",
  "context": "string — 1-2 sentence context",
  "options": [
    { "id": "o1", "label": "string", "description": "string" },
    { "id": "o2", "label": "string", "description": "string" },
    { "id": "o3", "label": "string", "description": "string" }
  ],
  "criteria": [
    { "id": "c1", "name": "string", "weight": 0.4 },
    { "id": "c2", "name": "string", "weight": 0.3 },
    { "id": "c3", "name": "string", "weight": 0.3 }
  ],
  "recommendation": "string — explain which option is best and why",
  "scores": [
    { "optionId": "o1", "c1": 80, "c2": 90, "c3": 70, "total": 80 },
    { "optionId": "o2", "c1": 70, "c2": 60, "c3": 80, "total": 70 },
    { "optionId": "o3", "c1": 60, "c2": 70, "c3": 60, "total": 63 }
  ]
}`;

const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 2000, temperature: 0.2, responseMimeType: 'application/json' }
  })
}).then(r => r.json()).then(d => {
  console.log(JSON.stringify(d, null, 2));
}).catch(console.error);
