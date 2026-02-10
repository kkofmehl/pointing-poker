class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  createSession(sessionId) {
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId);
    }

    const session = {
      sessionId,
      users: new Map(),
      votes: new Map(),
      // Track users who have selected a card but not submitted
      selectedCards: new Map(),
      // Track confidence (1–10) per user, parallel to votes
      confidences: new Map(),
      allVoted: false,
      createdAt: Date.now()
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  joinSession(sessionId, userId, userName) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    if (!session.users.has(userId)) {
      session.users.set(userId, {
        id: userId,
        name: userName,
        joinedAt: Date.now()
      });
    }

    return session;
  }

  selectCard(sessionId, userId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    if (!session.users.has(userId)) {
      return null;
    }

    // Track that user has selected a card (but not submitted yet)
    session.selectedCards.set(userId, true);

    return session;
  }

  clearSelection(sessionId, userId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    session.selectedCards.delete(userId);

    return session;
  }

  submitVote(sessionId, userId, cardValue, confidence = 10) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    if (!session.users.has(userId)) {
      return null;
    }

    session.votes.set(userId, cardValue);
    // Store confidence as integer between 1 and 10, defaulting to 10
    const normalizedConfidence = Number.isFinite(confidence)
      ? Math.min(10, Math.max(1, Math.round(confidence)))
      : 10;
    session.confidences.set(userId, normalizedConfidence);
    
    // Clear selection when vote is submitted
    session.selectedCards.delete(userId);
    
    // Check if all users have voted
    const allVoted = session.users.size === session.votes.size && 
                     session.users.size > 0;
    session.allVoted = allVoted;

    return session;
  }

  removeVote(sessionId, userId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    if (!session.users.has(userId)) {
      return null;
    }

    // Remove the vote and associated confidence
    session.votes.delete(userId);
    session.confidences.delete(userId);
    
    // Clear selection when vote is retracted
    session.selectedCards.delete(userId);
    
    // Recalculate allVoted status - should be false if any user doesn't have a vote
    const allVoted = session.users.size === session.votes.size && 
                     session.users.size > 0;
    session.allVoted = allVoted;

    return session;
  }

  resetSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    session.votes.clear();
    session.confidences.clear();
    session.selectedCards.clear();
    session.allVoted = false;

    return session;
  }

  removeUser(sessionId, userId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    session.users.delete(userId);
    session.votes.delete(userId);
    session.confidences.delete(userId);
    session.selectedCards.delete(userId);

    // Update allVoted status
    const allVoted = session.users.size === session.votes.size && 
                     session.users.size > 0;
    session.allVoted = allVoted;

    // Clean up empty sessions
    if (session.users.size === 0) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  getAllActiveSessions() {
    const sessions = [];
    for (const [sessionId, session] of this.sessions.entries()) {
      sessions.push({
        sessionId,
        participantCount: session.users.size
      });
    }
    return sessions;
  }
}

export const sessionManager = new SessionManager();

