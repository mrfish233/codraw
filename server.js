const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for room routing (e.g. /room/xxxx)
app.get('/room/:roomId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// In-memory database for room drawing history and active users
const rooms = {};

// Helper to push history state to room's undo stack
function pushToUndoStack(roomId, socketId) {
    const room = rooms[roomId];
    if (!room) return;
    
    // Push the current history snapshot
    room.undoStack.push({
        userId: socketId,
        historySnapshot: JSON.parse(JSON.stringify(room.history))
    });
    
    // Restrict stack size to avoid memory bloat
    if (room.undoStack.length > 50) {
        room.undoStack.shift();
    }
    
    // Clear redo stack
    room.redoStack = [];
}

// Helper to generate a unique cool animal name
const coolNames = [
    "Creative Dolphin", "Artistic Tiger", "Crafty Koala", "Sketching Fox",
    "Painting Panda", "Drawing Duck", "Doodling Deer", "Drafting Owl",
    "Designing Owl", "Vibrant Falcon", "Bold Panther", "Abstract Lion"
];
function getRandomUsername() {
    return coolNames[Math.floor(Math.random() * coolNames.length)] + " #" + Math.floor(1000 + Math.random() * 9000);
}

io.on('connection', (socket) => {
    let currentRoom = null;
    let username = getRandomUsername();
    let userColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');

    console.log(`User connected: ${socket.id} with temporary username ${username}`);

    // Join Room
    socket.on('join-room', (roomId) => {
        currentRoom = roomId || 'default';
        socket.join(currentRoom);

        // Initialize room if not exists
        if (!rooms[currentRoom]) {
            rooms[currentRoom] = {
                history: [],
                users: {},
                undoStack: [],
                redoStack: []
            };
        }

        // Add user to room data
        rooms[currentRoom].users[socket.id] = {
            id: socket.id,
            username: username,
            color: userColor,
            cursor: null
        };

        console.log(`Socket ${socket.id} joined room ${currentRoom}`);

        // Send current drawing history to the newly joined user
        socket.emit('init-room', {
            history: rooms[currentRoom].history,
            users: rooms[currentRoom].users,
            userId: socket.id,
            assignedName: username,
            assignedColor: userColor
        });

        // Broadcast to others that a user joined
        socket.to(currentRoom).emit('user-joined', {
            id: socket.id,
            username: username,
            color: userColor
        });
    });

    // Update Username
    socket.on('update-username', (newName) => {
        if (!newName || newName.trim() === '') return;
        username = newName.trim();
        if (currentRoom && rooms[currentRoom]) {
            rooms[currentRoom].users[socket.id].username = username;
            io.to(currentRoom).emit('user-updated', {
                id: socket.id,
                username: username,
                color: userColor
            });
        }
    });

    // Update Color
    socket.on('update-color', (newColor) => {
        if (!newColor) return;
        userColor = newColor;
        if (currentRoom && rooms[currentRoom]) {
            rooms[currentRoom].users[socket.id].color = userColor;
            io.to(currentRoom).emit('user-updated', {
                id: socket.id,
                username: username,
                color: userColor
            });
        }
    });

    // Receive committed drawing action and append to history
    socket.on('commit-action', (action) => {
        if (!currentRoom || !rooms[currentRoom]) return;
        
        // Save state before committing new drawing action
        pushToUndoStack(currentRoom, socket.id);
        
        // Attach socket id as owner
        action.userId = socket.id;
        rooms[currentRoom].history.push(action);

        // Broadcast this committed action to everyone else
        socket.to(currentRoom).emit('receive-action', action);
    });

    // Listen to real-time temporary drawing data (while mouse is dragging)
    socket.on('draw-active', (activeData) => {
        if (!currentRoom) return;
        // Broadcast mouse-drag drawings in real time to others
        socket.to(currentRoom).emit('receive-draw-active', {
            userId: socket.id,
            ...activeData
        });
    });

    // Clear Canvas
    socket.on('clear-canvas', () => {
        if (!currentRoom || !rooms[currentRoom]) return;
        
        // Save state before clearing canvas
        pushToUndoStack(currentRoom, socket.id);
        
        rooms[currentRoom].history = [];
        io.to(currentRoom).emit('canvas-cleared');
    });

    // Undo action (reverts history to the state before this user's last action)
    socket.on('undo-action', () => {
        if (!currentRoom || !rooms[currentRoom]) return;

        const room = rooms[currentRoom];
        const undoStack = room.undoStack;
        
        // Find the index of the last action committed by this socket
        let foundIndex = -1;
        for (let i = undoStack.length - 1; i >= 0; i--) {
            if (undoStack[i].userId === socket.id) {
                foundIndex = i;
                break;
            }
        }

        if (foundIndex !== -1) {
            // Save current state to redo stack
            room.redoStack.push({
                userId: socket.id,
                historySnapshot: JSON.parse(JSON.stringify(room.history))
            });
            
            // Revert history to the snapshot stored BEFORE the action
            const undoEntry = undoStack.splice(foundIndex, 1)[0];
            room.history = undoEntry.historySnapshot;
            
            // Broadcast full history updated event so clients re-render
            io.to(currentRoom).emit('history-updated', room.history);
        }
    });

    // Redo action (reverts history to the snapshot stored in the redo stack)
    socket.on('redo-action', () => {
        console.log(`[REDO] Server received redo-action from client: ${socket.id} in room: ${currentRoom}`);
        if (!currentRoom || !rooms[currentRoom]) {
            console.log("[REDO] Room not found or invalid!");
            return;
        }

        const room = rooms[currentRoom];
        const redoStack = room.redoStack;
        console.log(`[REDO] Current redo stack size: ${redoStack.length}`);
        
        // Find the index of the last action committed by this socket in the redo stack
        let foundIndex = -1;
        for (let i = redoStack.length - 1; i >= 0; i--) {
            console.log(`[REDO] Index ${i}: owner is ${redoStack[i].userId}`);
            if (redoStack[i].userId === socket.id) {
                foundIndex = i;
                break;
            }
        }

        console.log(`[REDO] Search result index: ${foundIndex}`);

        if (foundIndex !== -1) {
            // Save current state to undo stack before applying redo
            room.undoStack.push({
                userId: socket.id,
                historySnapshot: JSON.parse(JSON.stringify(room.history))
            });
            
            // Revert history to the redo snapshot
            const redoEntry = redoStack.splice(foundIndex, 1)[0];
            room.history = redoEntry.historySnapshot;
            console.log(`[REDO] Redo snapshot applied successfully! Restored history items count: ${room.history.length}`);
            
            // Broadcast full history updated event so clients re-render
            io.to(currentRoom).emit('history-updated', room.history);
        } else {
            console.log("[REDO] No matching redo entry found for this user!");
        }
    });

    // Update full history (e.g. for selection delete actions)
    socket.on('update-room-history', (newHistory) => {
        if (!currentRoom || !rooms[currentRoom] || !newHistory) return;
        
        // Save state before updating full history
        pushToUndoStack(currentRoom, socket.id);
        
        rooms[currentRoom].history = newHistory;
        io.to(currentRoom).emit('history-updated', newHistory);
    });

    // Cursor movement real-time tracking
    socket.on('cursor-move', (pos) => {
        if (!currentRoom || !rooms[currentRoom]) return;
        
        if (rooms[currentRoom].users[socket.id]) {
            rooms[currentRoom].users[socket.id].cursor = pos;
        }

        socket.to(currentRoom).emit('cursor-update', {
            id: socket.id,
            username: username,
            color: userColor,
            x: pos.x,
            y: pos.y,
            isDrawing: pos.isDrawing
        });
    });

    // Chat Message
    socket.on('chat-message', (text) => {
        if (!currentRoom || !text || text.trim() === '') return;

        const messageObj = {
            id: Date.now() + Math.random().toString(36).substr(2, 5),
            userId: socket.id,
            username: username,
            color: userColor,
            text: text.trim(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        io.to(currentRoom).emit('receive-chat', messageObj);
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        if (currentRoom && rooms[currentRoom]) {
            delete rooms[currentRoom].users[socket.id];
            
            // Clean up room if empty
            if (Object.keys(rooms[currentRoom].users).length === 0) {
                delete rooms[currentRoom];
            } else {
                socket.to(currentRoom).emit('user-left', socket.id);
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Collaborative Canvas Server running on port ${PORT}`);
});
