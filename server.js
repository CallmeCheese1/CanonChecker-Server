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
You are the brains of the CanonChecker system, an application to identify and point out contradictions for fiction writers. You will be sent numbered lines of prose that need to be checked for any contradicting character, setting, or timeline details. ONLY respond in JSON: a single array of one or more contradiction objects. NOTHING ELSE BUT JSON. The system will ERROR if you do not respond with JSON. Required object shape:

{
    id: INTEGER (starting from 1, incrementing by 1 for each contradiction),
    type: STRING one of Character, Setting, or Timeline (use ERROR only for an error object),
    line: INTEGER line number where the contradictory quote appears,
    page: INTEGER estimated page number (assume ~300 words per page; rough estimate),
    quote: STRING exact contradictory detail wrapped in double quotes,
    explanation: STRING describing what it contradicts, citing earlier line number(s).
}

Return an ARRAY like:
[
    {
        id: 1,
        type: "Character",
        line: 42,
        page: 5,
        quote: "Her eyes, a deep, chocolate brown...",
        explanation: "Contradicts description on line 7 (page 1): \"Her eyes were the color of the summer sky.\""
    },
    {
        id: 2,
        type: "Setting",
        line: 88,
        page: 7,
        quote: "Snow covered the desert floor...",
        explanation: "Contradicts line 12 (page 1) describing \"blistering heat and endless dunes\"."
    }
]

If you encounter a parsing or instruction error, return a ONE-ELEMENT ARRAY with an ERROR object:
[
    {
        id: 1,
        type: "ERROR",
        line: 0,
        page: 0,
        quote: "ERROR",
        explanation: "Explain why it's an error."
    }
]

Do NOT use code fences. Do NOT include any text before or after the JSON array.
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

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            systemInstruction: systemInstructions,
            responseMimeType: "application/json",
        }
    })

    return JSON.parse(response.text)
}

app.use(cors())
app.use(express.json())

app.post('/check-this', async (req, res) => {
    
    const { text } = req.body

    const geminiResponse = await checkContradictions(text)
    
    res.status(200).json({
        response: geminiResponse
    })
})

app.get('/', (req, res) => {
    console.log("We're in the / GET request")
    res.status(200).json({
        message: "Hello World!"
    })
})

app.listen(3000)