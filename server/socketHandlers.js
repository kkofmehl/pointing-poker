import { sessionManager } from './sessionManager.js';

export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_session', ({ sessionId, userName }) => {
      try {
        // Create or join session
        let session = sessionManager.getSession(sessionId);
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
        socket.emit('session_state', {
          sessionId: updatedSession.sessionId,
          users: Array.from(updatedSession.users.values()),
          votes: updatedSession.allVoted 
            ? Object.fromEntries(updatedSession.votes) 
            : {},
          allVoted: updatedSession.allVoted,
          hasVoted: updatedSession.votes.has(socket.id)
        });

        // Notify other users in the session
        socket.to(sessionId).emit('user_joined', {
          users: Array.from(updatedSession.users.values())
        });
      } catch (error) {
        console.error('Error joining session:', error);
        socket.emit('error', { message: 'Error joining session' });
      }
    });

    socket.on('submit_vote', ({ sessionId, cardValue }) => {
      try {
        const session = sessionManager.submitVote(sessionId, socket.id, cardValue);
        if (!session) {
          socket.emit('error', { message: 'Failed to submit vote' });
          return;
        }

        // Broadcast updated state to all users in the session
        const sessionState = {
          sessionId: session.sessionId,
          users: Array.from(session.users.values()),
          votes: session.allVoted 
            ? Object.fromEntries(session.votes) 
            : {},
          allVoted: session.allVoted,
          hasVoted: session.votes.has(socket.id)
        };

        io.to(sessionId).emit('session_state', sessionState);
      } catch (error) {
        console.error('Error submitting vote:', error);
        socket.emit('error', { message: 'Error submitting vote' });
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
        const sessionState = {
          sessionId: session.sessionId,
          users: Array.from(session.users.values()),
          votes: {},
          allVoted: false,
          hasVoted: false
        };

        io.to(sessionId).emit('session_state', sessionState);
      } catch (error) {
        console.error('Error resetting session:', error);
        socket.emit('error', { message: 'Error resetting session' });
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      
      // Find and remove user from their session
      for (const [sessionId, session] of sessionManager.sessions.entries()) {
        if (session.users.has(socket.id)) {
          const updatedSession = sessionManager.removeUser(sessionId, socket.id);
          
          if (updatedSession) {
            // Notify remaining users
            io.to(sessionId).emit('user_left', {
              users: Array.from(updatedSession.users.values()),
              votes: updatedSession.allVoted 
                ? Object.fromEntries(updatedSession.votes) 
                : {},
              allVoted: updatedSession.allVoted
            });
          }
          break;
        }
      }
    });
  });
}

