// In-memory storage for chat session histories
const sessionStore = new Map();

export function sessionExists(sessionId) {
    return sessionStore.has(sessionId);
}

export function getSessionHistory(sessionId) {
    if (!sessionStore.has(sessionId)) {
        sessionStore.set(sessionId, []);
    }
    return sessionStore.get(sessionId);
}

export function addMessageToSession(sessionId, message) {
    const history = getSessionHistory(sessionId);
    history.push(message);
    return history;
}

export function clearSessionHistory(sessionId) {
    sessionStore.delete(sessionId);
}

export function getAllSessions() {
    return Array.from(sessionStore.keys());
}

export function getSessionCount() {
    return sessionStore.size;
}
