import { performEmbedding } from "../services/embedding.service.js";
import { processDocumentFromBuffer } from "../services/document.service.js";
import { upsertVectors, searchSimilar, resetCollection } from "../services/qdrant.service.js";
import { sessionExists, getSessionHistory, addMessageToSession } from "../services/session.service.js";
import { generateChatResponse } from "../services/chat.service.js";
import { catchAsync } from "../utils/catchAsync.js";
import { v4 as uuidv4 } from 'uuid';

export const handleIngestion = catchAsync(async (req, res) => {
    const fileName = req.file.originalname;
    const fileType = req.file.mimetype;

    // Process and chunk the document
    const chunks = await processDocumentFromBuffer(req.file.buffer, fileName);

    // Create embeddings for each chunk
    const embeddedChunks = await Promise.all(
        chunks.map(async (chunk) => {
            const embedding = await performEmbedding(chunk.pageContent);
            return {
                content: chunk.pageContent,
                embedding: embedding,
                metadata: chunk.metadata
            };
        })
    );

    // Transform embedded chunks to match Qdrant service format
    const vectorData = embeddedChunks.map((chunk) => ({
        vector: chunk.embedding,
        payload: {
            text: chunk.content,
            source: chunk.metadata.source || fileName,
            page: chunk.metadata.page || chunk.metadata.loc?.pageNumber,
            type: fileType
        }
    }));

    // Upsert the vectors into Qdrant
    await upsertVectors(vectorData);

    res.json({
        message: 'File processed and embeddings created successfully',
        file: {
            name: fileName,
            type: fileType,
            size: req.file.size,
            chunksCount: chunks.length,
            embeddingsCount: embeddedChunks.length,
            sampleChunk: embeddedChunks[0]?.content.substring(0, 200)
        }
    });
});

export const handleChat = catchAsync(async (req, res) => {
    const { question, sessionId } = req.body;

    let currentSessionId = sessionId;
    let isNewSession = false;

    if (sessionId) {
        // Check if session exists
        if (!sessionExists(sessionId)) {
            return res.status(404).json({ error: 'Session not found' });
        }
    } else {
        // Create new session
        currentSessionId = uuidv4();
        isNewSession = true;
    }

    // Perform RAG: embed question, search Qdrant, generate response
    const embedding = await performEmbedding(question);
    const retrievedChunks = await searchSimilar(embedding);

    // Get conversation history before adding current question
    const conversationHistory = getSessionHistory(currentSessionId);

    // Add user question to history
    addMessageToSession(currentSessionId, {
        role: 'user',
        content: question,
        timestamp: new Date().toISOString()
    });

    // Generate AI response using retrieved context and conversation history
    const assistantResponse = await generateChatResponse(
        question,
        retrievedChunks,
        conversationHistory
    );

    // Add assistant response to history
    addMessageToSession(currentSessionId, {
        role: 'assistant',
        content: assistantResponse,
        timestamp: new Date().toISOString()
    });

    res.json({
        sessionId: currentSessionId,
        isNewSession,
        question,
        answer: assistantResponse,
        sources: retrievedChunks.map(chunk => ({
            text: chunk.text.substring(0, 200) + '...',
            source: chunk.source,
            page: chunk.page,
            score: chunk.score
        }))
    });
});

export const getSession = catchAsync(async (req, res) => {
    const { sessionId } = req.params;

    if (!sessionExists(sessionId)) {
        return res.status(404).json({ error: 'Session not found' });
    }

    const history = getSessionHistory(sessionId);

    res.json({
        sessionId,
        messageCount: history.length,
        conversation: history
    });
});

export const clearKnowledgeBase = catchAsync(async (req, res) => {
    await resetCollection();

    res.json({
        success: true,
        message: 'Knowledge base cleared successfully. Collection has been reset.'
    });
});