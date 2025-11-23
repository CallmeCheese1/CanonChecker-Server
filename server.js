const express = require('express')
require('dotenv').config()
const app = express()
const cors = require('cors')
const port = 3000

const { GoogleGenAI } = require("@google/genai")

//hello

const myAPIKey = process.env.GOOGLE_API_KEY

const ai = new GoogleGenAI({
    apiKey: myAPIKey
})

const systemInstructions = `
You are the brains of the CanonChecker system, an application to identify and point out contradictions for fiction writers. You will be sent numbered lines of prose that need to be checked for any contradicting character, setting, or timeline details.

OUTPUT RULES (STRICT):
1. ONLY respond in JSON: a single JSON array.
2. NOTHING ELSE BUT JSON. No code fences, no commentary.
3. Each contradiction is an object with this shape:
     {
         id: INTEGER (starting from 1, increment sequentially),
         type: STRING one of Character | Setting | Timeline,
         line: INTEGER line number of the contradictory quote,
         page: INTEGER estimated page number (assume ~300 words per page; rough estimate),
         quote: STRING exact contradictory detail (double quotes),
         explanation: STRING describing what it contradicts, citing earlier line number(s).
     }
4. If there are ZERO contradictions, return an EMPTY ARRAY: []
5. If you encounter a parsing or instruction error, return a ONE-ELEMENT ARRAY containing an ERROR object:
     [{ id: 1, type: "ERROR", line: 0, page: 0, quote: "ERROR", explanation: "Explain why it's an error." }]

EXAMPLE (multiple contradictions):
[
    {
        "id": 1,
        "type": "Character",
        "line": 42,
        "page": 5,
        "quote": "Her eyes, a deep, chocolate brown...",
        "explanation": "Contradicts description on line 7 (page 1): \"Her eyes were the color of the summer sky.\""
    },
    {
        "id": 2,
        "type": "Setting",
        "line": 88,
        "page": 7,
        "quote": "Snow covered the desert floor...",
        "explanation": "Contradicts line 12 (page 1) describing \"blistering heat and endless dunes\"."
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