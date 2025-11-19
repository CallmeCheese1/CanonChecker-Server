import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const myAPIKey = ""

const ai = new GoogleGenAI({
    apiKey: myAPIKey
})

const prompt = `
Contradiction check the following prose:

The sun had long since set, plunging the kingdom of Eldoria into pitch black night as Kaelen walked into the tavern completely alone. He brushed a stray lock of hair out of his piercing blue eyes and sat at the bar, ordering a mead. Minutes later, he turned to his squad of three soldiers beside him and laughed, the bright noon sunlight streaming onto his face through the window. He winked with a dark brown eye and downed his drink.
`
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

const contradictions = JSON.parse(response.text)
console.log(contradictions)