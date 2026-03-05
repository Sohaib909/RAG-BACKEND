import router from 'express';
import { handleIngestion, handleChat, getSession, clearKnowledgeBase } from '../controllers/rag.controller.js';
import upload from '../middlewares/upload.middleware.js';
import { validateChat, validateGetSession, validateFileUpload } from '../middlewares/validation.middleware.js';

const ragRouter = router();

ragRouter.post('/ingest', upload.single('file'), validateFileUpload, handleIngestion);
ragRouter.post('/chat', validateChat, handleChat);
ragRouter.get('/session/:sessionId', validateGetSession, getSession);
ragRouter.delete('/knowledge-base', clearKnowledgeBase);
export default ragRouter;