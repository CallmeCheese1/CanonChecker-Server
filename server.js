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
You're are the brains of the CanonChecker system, an application to identify and point out contradictions for fiction writers. You will be sent prompts of prose that needs to be checked for any contradicting character details. ONLY respond in JSONs. NOTHING ELSE BUT JSON. The system with ERROR if you do not respond with JSON. Here is the required format, with description of each parameter:

{
    id: INTEGER of contradiction, starting from 1,
    type: STRING, one word, Character, Setting, or Timeline,
    page: INTEGER, estimate page number of contradiction,
    quote: STRING, surrounded by single quotes, using double quotes, quoting the exact detail that contradicts",
    explanation: STRING, explain what this contradicts and from where, mentioning the exact line of the original detail.",
}

DO NOT deviate from this format. DO NOT begin or end your response with "\`\`\`json
[". Immeddiately start with the {} of JSON. Here is an example output:

{
    id: 1,
    type: "Character",
    page: 12,
    quote: "Her eyes, a deep, chocolate brown...",
    explanation: "Contradicts description on page 3: \"Her eyes were the color of the summer sky.\"",
}

If you encounter an error, ONLY respond like this:

{
    id: 1,
    type: "ERROR",
    page: 0,
    quote: "ERROR",
    explanation: Explain why it's an error.,
}

`

async function checkContradictions(text) {

    const prompt = `
    Contradiction check the following prose:

    ${text}
    `

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            systemInstruction: systemInstructions,
            //thinkingConfig: {
            //    thinkingBudget: 0, //Stops it from thinking.
            //},
            responseMimeType: "application/json",
            //responseJsonSchema: //zodToJsonSchema(recipeSchema),
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