// CoDraw Websocket Communication & Synchronization Module

import { state, saveLocalHistory, saveLocalProfile } from './state.js';
import { dom } from './dom.js';
import { redraw } from './canvas.js';
import { appendChatMessage, appendSystemMessage } from './chat.js';
import { updateCollaboratorsList, updatePeerCursor, removePeerCursor } from './collaborators.js';
import { showToast } from './ui.js';

// Connect to Socket.io authority
export const socket = io();

// Initialize and parse Room ID to connect
export function initRoomConnection() {
    let pathRoom = window.location.pathname.split('/room/')[1];
    
    // Fallback query parameter parsing
    if (!pathRoom) {
        const urlParams = new URLSearchParams(window.location.search);
        pathRoom = urlParams.get('room');
    }

    // Generate fresh room token if missing
    if (!pathRoom) {
        state.roomId = Math.random().toString(36).substring(2, 10);
        window.history.replaceState(null, '', `/room/${state.roomId}`);
    } else {
        state.roomId = pathRoom;
    }

    if (dom.roomDisplay) {
        dom.roomDisplay.textContent = state.roomId;
    }
    
    // Join WebSockets namespace
    socket.emit('join-room', state.roomId);
}

// Broadcast cursor positions
export function broadcastCursor(x, y, isDrawingState) {
    socket.emit('cursor-move', { x, y, isDrawing: isDrawingState });
}

// Register WebSocket Authority event listeners
export function registerSocketListeners() {
    // Authority connection state init
    socket.on('init-room', (initData) => {
        state.userId = initData.userId;
        state.usersList = initData.users;
        
        // Restore room drawings if server history was cleared (e.g. server restarted) but client has cached drawings
        if ((!initData.history || initData.history.length === 0) && state.history && state.history.length > 0) {
            socket.emit('update-room-history', state.history);
        } else {
            state.history = initData.history || [];
            saveLocalHistory();
        }
        
        // Custom name configuration on initial room entry
        if (!state.myUsername) {
            state.myUsername = initData.assignedName;
            state.myColor = initData.assignedColor;
            
            if (dom.modalUsernameInput) dom.modalUsernameInput.value = state.myUsername;
            if (dom.settingsUsernameInput) dom.settingsUsernameInput.value = state.myUsername;
            
            if (dom.myNameDisplay) dom.myNameDisplay.textContent = state.myUsername;
            if (dom.myAvatarIndicator) dom.myAvatarIndicator.style.backgroundColor = state.myColor;
            
            // Show interactive welcome screen
            if (dom.usernameModal) dom.usernameModal.classList.add('active');
        } else {
            // Tell server about our cached username and color!
            socket.emit('update-username', state.myUsername);
            socket.emit('update-color', state.myColor);
            
            // Sync current state to DOM
            if (dom.modalUsernameInput) dom.modalUsernameInput.value = state.myUsername;
            if (dom.settingsUsernameInput) dom.settingsUsernameInput.value = state.myUsername;
            if (dom.myNameDisplay) dom.myNameDisplay.textContent = state.myUsername;
            if (dom.myAvatarIndicator) dom.myAvatarIndicator.style.backgroundColor = state.myColor;
            
            // Hide welcome screen since we already have credentials
            if (dom.usernameModal) dom.usernameModal.classList.remove('active');
        }
        
        // Build active collaboration list
        if (dom.cursorsContainer) {
            dom.cursorsContainer.innerHTML = '';
            Object.values(state.usersList).forEach(user => {
                if (user.id !== state.userId && user.cursor) {
                    updatePeerCursor({
                        id: user.id,
                        username: user.username,
                        color: user.color,
                        x: user.cursor.x,
                        y: user.cursor.y,
                        isDrawing: user.cursor.isDrawing
                    });
                }
            });
        }
        
        updateCollaboratorsList();
        redraw();
    });

    // Peer joined listener
    socket.on('user-joined', (userData) => {
        state.usersList[userData.id] = {
            id: userData.id,
            username: userData.username,
            color: userData.color,
            cursor: null
        };
        
        appendSystemMessage(`Collaborator "${userData.username}" joined the canvas.`);
        updateCollaboratorsList();
    });

    // Peer updated identity settings
    socket.on('user-updated', (userData) => {
        if (state.usersList[userData.id]) {
            const oldName = state.usersList[userData.id].username;
            state.usersList[userData.id].username = userData.username;
            state.usersList[userData.id].color = userData.color;
            
            if (oldName !== userData.username) {
                appendSystemMessage(`"${oldName}" changed nickname to "${userData.username}".`);
            }
            
            updateCollaboratorsList();
        }
    });

    // Peer disconnected
    socket.on('user-left', (leftUserId) => {
        if (state.usersList[leftUserId]) {
            appendSystemMessage(`Collaborator "${state.usersList[leftUserId].username}" left.`);
            delete state.usersList[leftUserId];
            removePeerCursor(leftUserId);
            delete state.activeDrawings[leftUserId];
            
            updateCollaboratorsList();
            redraw();
        }
    });

    // Action committed broadcast received
    socket.on('receive-action', (action) => {
        state.history.push(action);
        saveLocalHistory();
        
        if (action.userId) {
            delete state.activeDrawings[action.userId];
        }
        redraw();
    });

    // Dynamic stroke preview received
    socket.on('receive-draw-active', (activeData) => {
        if (activeData === null || !activeData.tool) {
            if (activeData && activeData.userId) {
                delete state.activeDrawings[activeData.userId];
            } else {
                // Wipe any that might have expired
                state.activeDrawings = {};
            }
        } else {
            state.activeDrawings[activeData.userId] = activeData;
        }
        redraw();
    });

    // Global clear board command from peer
    socket.on('canvas-cleared', () => {
        state.history = [];
        saveLocalHistory();
        state.activeDrawings = {};
        redraw();
        showToast("The canvas was cleared by a collaborator.");
    });

    //Authoritative history snapshot update (Undo)
    socket.on('history-updated', (updatedHistory) => {
        state.history = updatedHistory;
        saveLocalHistory();
        redraw();
    });

    // User cursor tracker
    socket.on('cursor-update', (cursorData) => {
        updatePeerCursor(cursorData);
    });

    // Live chat packet receiver
    socket.on('receive-chat', (messageObj) => {
        appendChatMessage(messageObj);
    });
}
