import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4 } from 'uuid';

const COLLECTION_NAME = process.env.QDRANT_COLLECTION ?? 'knowledge_base';
const EMBEDDING_DIMENSION = 1536;

const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL ?? 'http://localhost:6333',
});

export async function ensureCollection() {
    const { collections } = await qdrant.getCollections();
    const exists = collections.some((c) => c.name === COLLECTION_NAME);

    if (!exists) {
        await qdrant.createCollection(COLLECTION_NAME, {
            vectors: {
                size: EMBEDDING_DIMENSION,
                distance: 'Cosine',
            },
        });
        console.log(`Collection "${COLLECTION_NAME}" created.`);
    } else {
        console.log(`Collection "${COLLECTION_NAME}" ready.`);
    }
}


export async function resetCollection() {
    const { collections } = await qdrant.getCollections();
    const exists = collections.some((c) => c.name === COLLECTION_NAME);

    if (exists) {
        await qdrant.deleteCollection(COLLECTION_NAME);
        console.log(`Collection "${COLLECTION_NAME}" deleted.`);
    }

    await ensureCollection();
}

export async function upsertVectors(items = []) {
    if (items.length === 0) return { stored: 0 };

    const points = items.map((item) => ({
        id: uuidv4(),
        vector: item.vector,
        payload: item.payload,
    }));

    await qdrant.upsert(COLLECTION_NAME, {
        wait: true, // blocks until Qdrant confirms write is complete
        points,
    });

    console.log(`Upserted ${points.length} vectors.`);
    return { stored: points.length };
}

export async function searchSimilar(queryVector, topN = 5, filter = undefined) {
    const results = await qdrant.search(COLLECTION_NAME, {
        vector: queryVector,
        limit: topN,
        with_payload: true,
        ...(filter ? { filter } : {}),
    });

    return results.map((result) => ({
        text: result.payload.text,
        score: parseFloat(result.score.toFixed(4)),
        source: result.payload.source,
        page: result.payload.page ?? null,
        type: result.payload.type,
    }));
}