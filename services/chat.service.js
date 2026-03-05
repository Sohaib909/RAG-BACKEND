import openai from '../utils/openai.utils.js';
import { SYSTEM_PROMPT } from '../constants/prompts.js';

export async function generateChatResponse(question, retrievedChunks, conversationHistory = []) {
    // Format retrieved context
    const contextText = retrievedChunks
        .map((chunk, index) => {
            const source = chunk.source ? `Source: ${chunk.source}` : '';
            const page = chunk.page ? `, Page: ${chunk.page}` : '';
            return `[${index + 1}] ${source}${page}\n${chunk.text}`;
        })
        .join('\n\n---\n\n');

    // Build messages array for OpenAI
    const messages = [
        {
            role: 'system',
            content: SYSTEM_PROMPT
        }
    ];

    // Add conversation history (excluding the current question)
    conversationHistory.forEach(msg => {
        if (msg.role === 'user' || msg.role === 'assistant') {
            messages.push({
                role: msg.role,
                content: msg.content
            });
        }
    });

    const userPrompt = `Context from knowledge base:\n\n${contextText}\n\n---\n\nQuestion: ${question}`;
    messages.push({
        role: 'user',
        content: userPrompt
    });

    // Call OpenAI
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000
    });

    return response.choices[0].message.content;
}
