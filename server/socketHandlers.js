import { sessionManager } from './sessionManager.js';
import { generateSessionBackground } from './geminiBackgroundService.js';

// Helper function to broadcast active sessions to all clients
function broadcastActiveSessions(io) {
  const activeSessions = sessionManager.getAllActiveSessions();
  io.emit('active_sessions_updated', { sessions: activeSessions });
}

// Helper function to build session state object
function buildSessionState(session) {
  // Ensure votes and confidences are always objects, even if the Maps are empty
  const votesObj = session.votes && session.votes.size > 0 
    ? Object.fromEntries(session.votes) 
    : {};
  const confidencesObj = session.confidences && session.confidences.size > 0
    ? Object.fromEntries(session.confidences)
    : {};
  
  return {
    sessionId: session.sessionId,
    users: Array.from(session.users.values()),
    // Always include votes for participant status tracking, but only reveal in results when allVoted is true
    votes: votesObj,
    confidences: confidencesObj,
    selectedCards: Array.from(session.selectedCards.keys()),
    allVoted: session.allVoted
  };
}

async function generateAndBroadcastSessionBackground(io, sessionId) {
  try {
    await generateSessionBackground(sessionId);
    io.to(sessionId).emit('session_background_ready', { sessionId });
  } catch (error) {
    console.error('Error generating shared session background', {
      sessionId,
      errorCode: error?.code || 'UNKNOWN',
      errorMessage: error?.message || 'Unknown error',
      errorDetails: error?.details || null
    });
  }
}

export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Send initial active sessions list when client connects
    const activeSessions = sessionManager.getAllActiveSessions();
    socket.emit('active_sessions_updated', { sessions: activeSessions });

    // Handle request for active sessions
    socket.on('get_active_sessions', () => {
      const activeSessions = sessionManager.getAllActiveSessions();
      socket.emit('active_sessions_updated', { sessions: activeSessions });
    });

    socket.on('join_session', ({ sessionId, userName }) => {
      try {
        // Create or join session
        let session = sessionManager.getSession(sessionId);
        const wasNewSession = !session;
        if (!session) {
          session = sessionManager.createSession(sessionId);
        }

        // Join the user to the session
        const updatedSession = sessionManager.joinSession(sessionId, socket.id, userName);
        if (!updatedSession) {
          socket.emit('error', { message: 'Failed to join session' });
          return;
        }

        // Join socket room for this session
        socket.join(sessionId);

        // Send current session state to the user
        socket.emit('session_state', buildSessionState(updatedSession));

        // Notify other users in the session
        socket.to(sessionId).emit('user_joined', {
          users: Array.from(updatedSession.users.values())
        });

        // If this was a new session, broadcast updated active sessions list
        if (wasNewSession) {
          broadcastActiveSessions(io);
        }

        // Ensure all participants can apply the same generated background.
        void generateAndBroadcastSessionBackground(io, sessionId);
      } catch (error) {
        console.error('Error joining session:', error);
        socket.emit('error', { message: 'Error joining session' });
      }
    });

    socket.on('submit_vote', ({ sessionId, cardValue, confidence }) => {
      try {
        const session = sessionManager.getSession(sessionId);
        if (!session) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        // Prevent voting after votes have been revealed
        if (session.allVoted) {
          socket.emit('error', { message: 'Voting has ended. Votes have already been revealed.' });
          return;
        }

        const updatedSession = sessionManager.submitVote(sessionId, socket.id, cardValue, confidence);
        if (!updatedSession) {
          socket.emit('error', { message: 'Failed to submit vote' });
          return;
        }

        // Broadcast updated state to all users in the session
        io.to(sessionId).emit('session_state', buildSessionState(updatedSession));
      } catch (error) {
        console.error('Error submitting vote:', error);
        socket.emit('error', { message: 'Error submitting vote' });
      }
    });

    socket.on('retract_vote', ({ sessionId }) => {
      try {
        const session = sessionManager.removeVote(sessionId, socket.id);
        if (!session) {
          socket.emit('error', { message: 'Failed to retract vote' });
          return;
        }

        // Broadcast updated state to all users in the session
        io.to(sessionId).emit('session_state', buildSessionState(session));
      } catch (error) {
        console.error('Error retracting vote:', error);
        socket.emit('error', { message: 'Error retracting vote' });
      }
    });

    socket.on('card_selected', ({ sessionId }) => {
      try {
        const session = sessionManager.selectCard(sessionId, socket.id);
        if (!session) {
          socket.emit('error', { message: 'Failed to track card selection' });
          return;
        }

        // Broadcast updated selection state to all users in the session
        io.to(sessionId).emit('session_state', buildSessionState(session));
      } catch (error) {
        console.error('Error tracking card selection:', error);
        socket.emit('error', { message: 'Error tracking card selection' });
      }
    });

    socket.on('card_cleared', ({ sessionId }) => {
      try {
        const session = sessionManager.clearSelection(sessionId, socket.id);
        if (!session) {
          // It's okay if session doesn't exist or user wasn't tracking selection
          return;
        }

        // Broadcast updated selection state to all users in the session
        io.to(sessionId).emit('session_state', buildSessionState(session));
      } catch (error) {
        console.error('Error clearing card selection:', error);
        // Don't emit error for this, it's not critical
      }
    });

    socket.on('force_reveal', ({ sessionId }) => {
      try {
        const session = sessionManager.getSession(sessionId);
        if (!session) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        // Force reveal votes regardless of vote count
        session.allVoted = true;

        // Broadcast updated state to all users in the session
        io.to(sessionId).emit('session_state', buildSessionState(session));
      } catch (error) {
        console.error('Error forcing reveal:', error);
        socket.emit('error', { message: 'Error forcing reveal' });
      }
    });

    socket.on('reset_session', ({ sessionId }) => {
      try {
        const session = sessionManager.resetSession(sessionId);
        if (!session) {
          socket.emit('error', { message: 'Failed to reset session' });
          return;
        }

        // Broadcast reset state to all users
        io.to(sessionId).emit('session_state', buildSessionState(session));
      } catch (error) {
        console.error('Error resetting session:', error);
        socket.emit('error', { message: 'Error resetting session' });
      }
    });

    socket.on('close_session', ({ sessionId }) => {
      try {
        const session = sessionManager.getSession(sessionId);
        if (!session) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        io.to(sessionId).emit('session_closed', {
          sessionId
        });
        io.in(sessionId).socketsLeave(sessionId);
        sessionManager.closeSession(sessionId);
        broadcastActiveSessions(io);
      } catch (error) {
        console.error('Error closing session:', error);
        socket.emit('error', { message: 'Error closing session' });
      }
    });

    socket.on('leave_session', ({ sessionId }) => {
      try {
        // Leave the socket room
        socket.leave(sessionId);
        
        // Find and remove user from their session
        const session = sessionManager.getSession(sessionId);
        if (session && session.users.has(socket.id)) {
          const wasLastUser = session.users.size === 1;
          const updatedSession = sessionManager.removeUser(sessionId, socket.id);
          
          if (updatedSession) {
            // Notify remaining users
            io.to(sessionId).emit('user_left', {
              users: Array.from(updatedSession.users.values()),
              votes: Object.fromEntries(updatedSession.votes),
              confidences: Object.fromEntries(updatedSession.confidences),
              selectedCards: Array.from(updatedSession.selectedCards.keys()),
              allVoted: updatedSession.allVoted
            });
          } else if (wasLastUser) {
            // Session was deleted (last user left), broadcast updated active sessions
            broadcastActiveSessions(io);
          }
        }
      } catch (error) {
        console.error('Error leaving session:', error);
        socket.emit('error', { message: 'Error leaving session' });
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      
      // Find and remove user from their session
      for (const [sessionId, session] of sessionManager.sessions.entries()) {
        if (session.users.has(socket.id)) {
          const wasLastUser = session.users.size === 1;
          const updatedSession = sessionManager.removeUser(sessionId, socket.id);
          
          if (updatedSession) {
            // Notify remaining users
            io.to(sessionId).emit('user_left', {
              users: Array.from(updatedSession.users.values()),
              votes: Object.fromEntries(updatedSession.votes),
              confidences: Object.fromEntries(updatedSession.confidences),
              selectedCards: Array.from(updatedSession.selectedCards.keys()),
              allVoted: updatedSession.allVoted
            });
          } else if (wasLastUser) {
            // Session was deleted (last user left), broadcast updated active sessions
            broadcastActiveSessions(io);
          }
          break;
        }
      }
    });
  });
}

