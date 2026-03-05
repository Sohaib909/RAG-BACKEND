import openai from '../utils/openai.utils.js';

export const performEmbedding = async (text) => {
    const response = await openai.embeddings.create({
        model: process.env.EMBEDDING_MODEL,
        input: text,
    });

    return response.data[0].embedding;
}