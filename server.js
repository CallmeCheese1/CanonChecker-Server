const express = require('express')
require('dotenv').config()
const app = express()
const cors = require('cors')
const port = 3000

const { GoogleGenAI } = require("@google/genai")

const myAPIKey = process.env.GOOGLE_API_KEY

const ai = new GoogleGenAI({
    apiKey: myAPIKey
})

const systemInstructions = `
You are the brains of the CanonChecker system, an application to identify and point out contradictions for fiction writers. You will be sent NUMBERED lines of prose to check for contradictions in character, setting, or timeline details.

RETROACTIVE CONTRADICTION RULE (IMPORTANT):
• Only flag the LATER (retroactive) statement that introduces the contradiction.
• Do NOT flag the earlier baseline statement on its own.
• The "quote" field must be the exact later phrase/text that conflicts with earlier established details.
• The "explanation" must cite the earlier line number(s) and briefly describe the mismatch.
• If multiple earlier lines conflict with one later line, cite all relevant earlier line numbers succinctly.
• Ignore speculative or uncertain statements (e.g., guesses, questions, conditional statements) unless a later line DEFINITIVELY contradicts them.
• Do not produce forward-looking predictions. Output only contradictions that have already occurred in the provided text.

OUTPUT RULES (STRICT):
1. ONLY respond in JSON: a single JSON array.
2. NOTHING ELSE BUT JSON. No code fences, no commentary.
3. Each contradiction object shape:
     {
         id: INTEGER starting at 1 and incrementing by 1,
         type: STRING one of Character | Setting | Timeline,
         line: INTEGER line number of the later contradictory quote (NOT the earlier baseline),
         page: INTEGER estimated page number (assume ~300 words per page; rough estimate),
         quote: STRING exact later contradictory detail (double quotes),
         explanation: STRING citing earlier line number(s) and describing the conflict.
     }
4. ZERO contradictions → return EMPTY ARRAY: []
5. Error/parse issue → return ONE-ELEMENT ARRAY with ERROR object:
     [{ id: 1, type: "ERROR", line: 0, page: 0, quote: "ERROR", explanation: "Explain why it's an error." }]
6. Do NOT duplicate contradictions: if multiple later lines repeat the SAME conflicting detail, include only the first occurrence.

EXAMPLE (retroactive contradictions):
Text excerpt (numbered lines):
7: Her eyes were the color of the summer sky.
42: Her eyes, a deep, chocolate brown, narrowed.
88: Snow covered the desert floor.
12: Blistering heat and endless dunes stretched beyond the caravan.

Expected JSON:
[
    {
        "id": 1,
        "type": "Character",
        "line": 42,
        "page": 5,
        "quote": "Her eyes, a deep, chocolate brown, narrowed.",
        "explanation": "Contradicts eye color stated on line 7: 'Her eyes were the color of the summer sky.'"
    },
    {
        "id": 2,
        "type": "Setting",
        "line": 88,
        "page": 7,
        "quote": "Snow covered the desert floor.",
        "explanation": "Conflicts with hot desert conditions on line 12: 'Blistering heat and endless dunes...'"
    }
]

EXAMPLE (no contradictions):
[]

EXAMPLE (error):
[{ "id": 1, "type": "ERROR", "line": 0, "page": 0, "quote": "ERROR", "explanation": "Explain why it's an error." }]

DO NOT include any text before or after the JSON array.
`

function numberLines(text) {
    return text
        .split(/\r?\n/)
        .map((line, idx) => `${idx + 1}: ${line}`)
        .join('\n')
}

async function checkContradictions(rawText) {
    const numbered = numberLines(rawText)

    const prompt = `
    Identify ALL contradictions in the following numbered prose. Use provided line numbers. Return an ARRAY of contradiction objects (or a single ERROR object in an array). Estimate page numbers (~300 words/page).:

${numbered}
    `

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: systemInstructions,
                responseMimeType: "application/json",
            }
        })
        const parsed = JSON.parse(response.text)
        // Normalize: if a single object was returned accidentally, wrap in array.
        if (!Array.isArray(parsed)) {
            return [parsed]
        }
        return parsed
    } catch (err) {
        return [{ id: 1, type: "ERROR", line: 0, page: 0, quote: "ERROR", explanation: `Model or parse error: ${err.message}` }]
    }
}

app.use(cors())
app.use(express.json())

app.post('/check-this', async (req, res) => {
    const { text } = req.body
    const geminiResponse = await checkContradictions(text)

    // ERROR case: return 500 with error payload
    if (geminiResponse.length === 1 && geminiResponse[0].type === 'ERROR') {
        return res.status(500).json({ response: geminiResponse })
    }

    // No contradictions: 204 No Content
    if (Array.isArray(geminiResponse) && geminiResponse.length === 0) {
        return res.status(204).send()
    }

    // Normal contradictions
    return res.status(200).json({ response: geminiResponse })
})

app.get('/', (req, res) => {
    console.log("We're in the / GET request")
    res.status(200).json({
        message: "Hello World!"
    })
})

app.listen(3000)