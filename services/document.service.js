import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import mammoth from 'mammoth';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 600,
    chunkOverlap: 120,
});

export async function processDocument(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    let docs;

    if (ext === '.pdf') {
        const loader = new PDFLoader(filePath);
        docs = await loader.load();
    } else if (ext === '.docx') {
        // For .docx files, use mammoth to extract text
        const buffer = await fs.readFile(filePath);
        const result = await mammoth.extractRawText({ buffer });
        docs = [new Document({
            pageContent: result.value,
            metadata: { source: filePath }
        })];
    } else {
        // For text files, read directly
        const content = await fs.readFile(filePath, 'utf-8');
        docs = [new Document({
            pageContent: content,
            metadata: { source: filePath }
        })];
    }

    return splitter.splitDocuments(docs);
}

export async function processDocumentFromBuffer(buffer, fileName) {
    // Create temporary file
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, fileName);

    try {
        // Write buffer to temporary file
        await fs.writeFile(tempFilePath, buffer);
        const chunks = await processDocument(tempFilePath);
        return chunks;
    } finally {
        // Clean up temporary file
        try {
            await fs.unlink(tempFilePath);
        } catch (error) {
            // Ignore cleanup errors
        }
    }
}
