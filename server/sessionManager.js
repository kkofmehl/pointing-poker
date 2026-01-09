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

  submitVote(sessionId, userId, cardValue) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    if (!session.users.has(userId)) {
      return null;
    }

    session.votes.set(userId, cardValue);
    
    // Check if all users have voted
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
}

export const sessionManager = new SessionManager();

