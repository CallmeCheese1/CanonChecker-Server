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
You are the brains of the CanonChecker system, an application to identify contradictions for fiction writers.

RETROACTIVE CONTRADICTION RULE (IMPORTANT):
• Only flag the LATER statement that introduces a contradiction with an earlier established detail.
• Do NOT flag the earlier baseline statement by itself.
• "quote" must be the exact later contradictory text (double quotes).
• "explanation" briefly states what earlier detail it contradicts (use natural language; earlier quote may be paraphrased or quoted).
• Ignore speculative/conditional statements unless later text definitively contradicts them.
• Do not predict future contradictions. Only use information present in the given prose.
• If the same contradictory detail repeats, include only the first occurrence.

OUTPUT RULES (STRICT):
1. Respond ONLY with a single JSON array.
2. No code fences, no surrounding commentary.
3. Each contradiction object must have exactly these fields:
     {
         id: INTEGER starting at 1 and incrementing,
         type: STRING one of Character | Setting | Timeline,
         quote: STRING exact later contradictory detail (double quotes),
         explanation: STRING describing conflict with earlier text.
     }
4. If there are ZERO contradictions, return []
5. On error, return: [{ id: 1, type: "ERROR", quote: "ERROR", explanation: "Explain why it's an error." }]

EXAMPLE (multiple contradictions):
[
    {
        "id": 1,
        "type": "Character",
        "quote": "Her eyes, a deep, chocolate brown, narrowed.",
        "explanation": "Later eye color conflicts with earlier blue description."
    },
    {
        "id": 2,
        "type": "Setting",
        "quote": "Snow covered the desert floor.",
        "explanation": "Snowy desert conflicts with earlier blistering heat description."
    }
]

EXAMPLE (no contradictions): []
EXAMPLE (error): [{ "id": 1, "type": "ERROR", "quote": "ERROR", "explanation": "Explain why it's an error." }]

Return ONLY the JSON array.
`

// (Line numbering removed – contradictions rely solely on quote text now.)

async function checkContradictions(rawText) {
    const prompt = `
Identify ALL retroactive contradictions in the following prose. Follow the JSON schema exactly:

${rawText}
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
        let parsed = JSON.parse(response.text)
        if (!Array.isArray(parsed)) parsed = [parsed]
        // Sanitize: keep only allowed fields
        return parsed.map((obj, idx) => {
            return {
                id: typeof obj.id === 'number' ? obj.id : idx + 1,
                type: typeof obj.type === 'string' ? obj.type : 'ERROR',
                quote: typeof obj.quote === 'string' ? obj.quote : 'ERROR',
                explanation: typeof obj.explanation === 'string' ? obj.explanation : 'Missing explanation'
            }
        })
    } catch (err) {
        return [{ id: 1, type: "ERROR", quote: "ERROR", explanation: `Model or parse error: ${err.message}` }]
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