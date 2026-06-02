// Connect to Socket.io Server
const socket = io();

// Application State
let roomId = '';
let userId = '';
let myUsername = '';
let myColor = '#6366f1';
let isDrawing = false;
let currentTool = 'brush'; // brush, line, rect, circle, eraser
let currentColor = '#6366f1';
let currentSize = 5;
let currentOpacity = 1;
let fillShape = false;

// Drawing paths/coordinates
let startPoint = { x: 0, y: 0 };
let currentPoint = { x: 0, y: 0 };
let points = []; // Array of points for freehand brush/eraser

// Collaborative collections
let history = []; // Array of committed drawing actions
let activeDrawings = {}; // Live preview drawing actions from other users { userId: action }
let usersList = {}; // Tracking active users in the room { socketId: userInfo }

// UI Elements
const canvas = document.getElementById('paint-canvas');
const ctx = canvas.getContext('2d');
const gridOverlay = document.getElementById('grid-overlay');
const cursorsContainer = document.getElementById('cursors-container');
const roomDisplay = document.getElementById('room-id-display');
const userCountDisplay = document.getElementById('user-count');
const collaboratorsList = document.getElementById('collaborators-list');
const myNameDisplay = document.getElementById('my-name-display');
const myAvatarIndicator = document.getElementById('my-avatar-indicator');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const brushSizeVal = document.getElementById('brush-size-val');
const brushOpacityVal = document.getElementById('brush-opacity-val');

// Popups & Dropdowns
const usernameModal = document.getElementById('username-modal');
const profileTrigger = document.getElementById('profile-trigger');
const profileDropdown = document.getElementById('profile-dropdown');
const toastElement = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

// Initialize Room ID from URL Path or Query parameter
function initRoomConnection() {
    // Parse '/room/xxxx' path
    let pathRoom = window.location.pathname.split('/room/')[1];
    
    // Fallback: Parse query parameter '?room=xxxx'
    if (!pathRoom) {
        const urlParams = new URLSearchParams(window.location.search);
        pathRoom = urlParams.get('room');
    }

    // Generate room if not found
    if (!pathRoom) {
        roomId = Math.random().toString(36).substring(2, 10);
        // Update URL path without page refresh
        window.history.replaceState(null, '', `/room/${roomId}`);
    } else {
        roomId = pathRoom;
    }

    roomDisplay.textContent = roomId;
    
    // Join the websocket room
    socket.emit('join-room', roomId);
}

// ----------------------------------------------------
// CANVAS RETINA RESOLUTION & RENDERING LOGIC
// ----------------------------------------------------
function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    ctx.scale(dpr, dpr);
    redraw();
}

// Redraw all elements
function redraw() {
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    
    // 1. Draw committed drawing history
    history.forEach(action => {
        drawAction(action);
    });
    
    // 2. Draw live active previews of drawing actions by other users
    Object.values(activeDrawings).forEach(activeAction => {
        if (activeAction) {
            drawAction(activeAction);
        }
    });
    
    // 3. Draw current active local path/preview
    if (isDrawing && ['brush', 'eraser', 'line', 'rect', 'circle'].includes(currentTool)) {
        const localActiveAction = {
            tool: currentTool,
            points: points,
            start: startPoint,
            end: currentPoint,
            color: currentTool === 'eraser' ? 'rgba(0,0,0,1)' : currentColor,
            width: currentSize,
            opacity: currentOpacity,
            fill: fillShape
        };
        drawAction(localActiveAction);
    }
}

// Core drawing primitive
function drawAction(action) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = action.width;
    ctx.globalAlpha = action.opacity;
    
    if (action.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
    } else {
        ctx.globalCompositeOperation = 'source-over';
    }
    
    ctx.strokeStyle = action.color;
    ctx.fillStyle = action.color;
    
    if (action.tool === 'brush' || action.tool === 'eraser') {
        if (action.points && action.points.length > 0) {
            ctx.beginPath();
            ctx.moveTo(action.points[0].x, action.points[0].y);
            for (let i = 1; i < action.points.length; i++) {
                ctx.lineTo(action.points[i].x, action.points[i].y);
            }
            ctx.stroke();
        }
    } else if (action.tool === 'line') {
        if (action.start && action.end) {
            ctx.beginPath();
            ctx.moveTo(action.start.x, action.start.y);
            ctx.lineTo(action.end.x, action.end.y);
            ctx.stroke();
        }
    } else if (action.tool === 'rect') {
        if (action.start && action.end) {
            const x = Math.min(action.start.x, action.end.x);
            const y = Math.min(action.start.y, action.end.y);
            const w = Math.abs(action.start.x - action.end.x);
            const h = Math.abs(action.start.y - action.end.y);
            
            ctx.beginPath();
            ctx.rect(x, y, w, h);
            if (action.fill) {
                ctx.fill();
            }
            ctx.stroke();
        }
    } else if (action.tool === 'circle') {
        if (action.start && action.end) {
            const dx = action.end.x - action.start.x;
            const dy = action.end.y - action.start.y;
            const radius = Math.sqrt(dx * dx + dy * dy);
            
            ctx.beginPath();
            ctx.arc(action.start.x, action.start.y, radius, 0, 2 * Math.PI);
            if (action.fill) {
                ctx.fill();
            }
            ctx.stroke();
        }
    }
    ctx.restore();
}

// ----------------------------------------------------
// LOCAL USER DRAWING INTERACTIONS (MOUSE/TOUCH)
// ----------------------------------------------------
function getCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    
    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}

function handleStart(e) {
    if (e.button && e.button !== 0) return; // Only trigger on main mouse click
    
    isDrawing = true;
    const coord = getCoordinates(e);
    startPoint = coord;
    currentPoint = coord;
    points = [coord];
    
    // Broadcast cursor position including active drawing status
    broadcastCursor(coord.x, coord.y, true);
    
    // Broadcast active temporary drawing update for freehand
    if (currentTool === 'brush' || currentTool === 'eraser') {
        socket.emit('draw-active', {
            tool: currentTool,
            points: points,
            color: currentTool === 'eraser' ? 'rgba(0,0,0,1)' : currentColor,
            width: currentSize,
            opacity: currentOpacity
        });
    }
    
    redraw();
}

function handleMove(e) {
    const coord = getCoordinates(e);
    currentPoint = coord;
    
    // Track cursor positioning
    broadcastCursor(coord.x, coord.y, isDrawing);
    
    if (!isDrawing) return;
    
    if (currentTool === 'brush' || currentTool === 'eraser') {
        points.push(coord);
        
        // Emit dragging brush data in real time to others
        socket.emit('draw-active', {
            tool: currentTool,
            points: points,
            color: currentTool === 'eraser' ? 'rgba(0,0,0,1)' : currentColor,
            width: currentSize,
            opacity: currentOpacity
        });
    } else {
        // Shapes line, rect, circle temporary drawing live preview
        socket.emit('draw-active', {
            tool: currentTool,
            start: startPoint,
            end: currentPoint,
            color: currentColor,
            width: currentSize,
            opacity: currentOpacity,
            fill: fillShape
        });
    }
    
    redraw();
}

function handleEnd() {
    if (!isDrawing) return;
    isDrawing = false;
    
    // Save current cursor position as idle
    broadcastCursor(currentPoint.x, currentPoint.y, false);
    
    // Remove our active temporary path locally and tell others to wipe it
    socket.emit('draw-active', null);
    
    // Construct the committed action object
    const finalizedAction = {
        id: Date.now() + Math.random().toString(36).substring(2, 6),
        tool: currentTool,
        color: currentTool === 'eraser' ? 'rgba(0,0,0,1)' : currentColor,
        width: currentSize,
        opacity: currentOpacity,
        fill: fillShape
    };
    
    if (currentTool === 'brush' || currentTool === 'eraser') {
        // Must contain at least 2 points to be a line
        if (points.length < 2) {
            redraw();
            return;
        }
        finalizedAction.points = points;
    } else {
        // Ignore single dot shape triggers
        if (Math.abs(startPoint.x - currentPoint.x) < 2 && Math.abs(startPoint.y - currentPoint.y) < 2) {
            redraw();
            return;
        }
        finalizedAction.start = startPoint;
        finalizedAction.end = currentPoint;
    }
    
    // Push locally and send to server
    history.push(finalizedAction);
    socket.emit('commit-action', finalizedAction);
    
    points = [];
    redraw();
}

// ----------------------------------------------------
// PEER CURSORS MANAGEMENT
// ----------------------------------------------------
function broadcastCursor(x, y, isDrawingState) {
    socket.emit('cursor-move', { x, y, isDrawing: isDrawingState });
}

function updatePeerCursor(cursorData) {
    let cursorEl = document.getElementById(`cursor-${cursorData.id}`);
    
    // Create cursor elements if it does not exist
    if (!cursorEl) {
        cursorEl = document.createElement('div');
        cursorEl.id = `cursor-${cursorData.id}`;
        cursorEl.className = 'peer-cursor';
        
        const pointer = document.createElement('div');
        pointer.className = 'peer-cursor-pointer';
        
        const label = document.createElement('div');
        label.className = 'peer-cursor-label';
        
        cursorEl.appendChild(pointer);
        cursorEl.appendChild(label);
        cursorsContainer.appendChild(cursorEl);
    }
    
    // Set custom HSL or hexadecimal user color variable
    cursorEl.style.setProperty('--cursor-color', cursorData.color);
    
    // Toggle active drawing micro-indicator
    if (cursorData.isDrawing) {
        cursorEl.classList.add('drawing');
    } else {
        cursorEl.classList.remove('drawing');
    }
    
    // Position the element
    cursorEl.style.transform = `translate(${cursorData.x}px, ${cursorData.y}px)`;
    
    // Update Username tag text
    const labelEl = cursorEl.querySelector('.peer-cursor-label');
    labelEl.textContent = cursorData.username;
}

function removePeerCursor(userId) {
    const cursorEl = document.getElementById(`cursor-${userId}`);
    if (cursorEl) {
        cursorEl.remove();
    }
}

// ----------------------------------------------------
// INSTANT LIVE CHAT DRAW PANEL
// ----------------------------------------------------
function appendChatMessage(msg) {
    const isMe = msg.userId === socket.id;
    
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isMe ? 'me' : 'peer'}`;
    
    const header = document.createElement('div');
    header.className = 'bubble-header';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'bubble-name';
    nameSpan.style.color = msg.color;
    nameSpan.textContent = isMe ? 'You' : msg.username;
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'bubble-time';
    timeSpan.textContent = msg.time;
    
    header.appendChild(nameSpan);
    header.appendChild(timeSpan);
    
    const textDiv = document.createElement('div');
    textDiv.className = 'bubble-text';
    textDiv.textContent = msg.text;
    
    bubble.appendChild(header);
    bubble.appendChild(textDiv);
    
    chatMessages.appendChild(bubble);
    
    // Auto-scroll to latest
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendSystemMessage(text) {
    const system = document.createElement('div');
    system.className = 'system-message';
    system.textContent = text;
    chatMessages.appendChild(system);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    
    socket.emit('chat-message', text);
    chatInput.value = '';
});

// ----------------------------------------------------
// COLLABORATOR DIRECTORY LIST
// ----------------------------------------------------
function updateCollaboratorsList() {
    collaboratorsList.innerHTML = '';
    
    // Add current user first
    const meItem = document.createElement('div');
    meItem.className = 'collaborator-item';
    meItem.innerHTML = `
        <div class="collaborator-info">
            <span class="collaborator-dot" style="background-color: ${myColor}"></span>
            <span class="collaborator-name">${myUsername}</span>
            <span class="you-tag">You</span>
        </div>
    `;
    collaboratorsList.appendChild(meItem);
    
    // Add peers
    let count = 1;
    Object.values(usersList).forEach(user => {
        if (user.id === socket.id) return;
        count++;
        
        const peerItem = document.createElement('div');
        peerItem.className = 'collaborator-item';
        peerItem.innerHTML = `
            <div class="collaborator-info">
                <span class="collaborator-dot" style="background-color: ${user.color}"></span>
                <span class="collaborator-name">${user.username}</span>
            </div>
        `;
        collaboratorsList.appendChild(peerItem);
    });
    
    userCountDisplay.textContent = count;
}

// ----------------------------------------------------
// UI TRIGGERS AND SETTINGS PANEL HANDLERS
// ----------------------------------------------------

// Handle dynamic tabs between Chat and Collaborators list
document.getElementById('tab-chat').addEventListener('click', (e) => {
    document.getElementById('tab-chat').classList.add('active');
    document.getElementById('tab-users').classList.remove('active');
    document.getElementById('chat-content').classList.add('active');
    document.getElementById('users-content').classList.remove('active');
});

document.getElementById('tab-users').addEventListener('click', (e) => {
    document.getElementById('tab-users').classList.add('active');
    document.getElementById('tab-chat').classList.remove('active');
    document.getElementById('users-content').classList.add('active');
    document.getElementById('chat-content').classList.remove('active');
});

// Custom Toolbar Controls Click Triggers
const toolButtons = {
    'brush': document.getElementById('tool-brush'),
    'line': document.getElementById('tool-line'),
    'rect': document.getElementById('tool-rect'),
    'circle': document.getElementById('tool-circle'),
    'eraser': document.getElementById('tool-eraser')
};

Object.entries(toolButtons).forEach(([tool, button]) => {
    button.addEventListener('click', () => {
        // Toggle Active toolbar item styling
        Object.values(toolButtons).forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        currentTool = tool;
    });
});

// Preset Color Circle Selection
document.querySelectorAll('.color-picker-container .color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
        document.querySelectorAll('.color-picker-container .color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        currentColor = dot.dataset.color;
        
        // Match settings color selectors if active
        document.getElementById('custom-color').value = currentColor;
    });
});

// Custom Hex Color Picker Trigger
document.getElementById('custom-color').addEventListener('input', (e) => {
    currentColor = e.target.value;
    document.querySelectorAll('.color-picker-container .color-dot').forEach(d => d.classList.remove('active'));
});

// Range Brush Size Adjuster
const sizeInput = document.getElementById('brush-size');
sizeInput.addEventListener('input', (e) => {
    currentSize = e.target.value;
    brushSizeVal.textContent = `${currentSize}px`;
});

// Range Brush Opacity Adjuster
const opacityInput = document.getElementById('brush-opacity');
opacityInput.addEventListener('input', (e) => {
    currentOpacity = e.target.value / 100;
    brushOpacityVal.textContent = `${e.target.value}%`;
});

// Custom Fill Shape Toggle
document.getElementById('fill-shape').addEventListener('change', (e) => {
    fillShape = e.target.checked;
});

// ----------------------------------------------------
// ACTION BUTTONS (UNDO, REDO, GRID, CLEAR, EXPORT)
// ----------------------------------------------------

// Undo button
document.getElementById('action-undo').addEventListener('click', () => {
    // Search backward to remove our own last path locally
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].userId === socket.id) {
            history.splice(i, 1);
            break;
        }
    }
    redraw();
    
    // Request undo synchronizer on server
    socket.emit('undo-action');
});

// Grid Overlay Toggle
const gridActionBtn = document.getElementById('action-grid');
gridActionBtn.addEventListener('click', () => {
    const isShowing = gridOverlay.classList.toggle('active');
    if (isShowing) {
        gridActionBtn.classList.add('active');
    } else {
        gridActionBtn.classList.remove('active');
    }
});

// Clear canvas trigger
document.getElementById('action-clear').addEventListener('click', () => {
    if (confirm("Are you sure you want to clear the entire collaborative canvas for everyone?")) {
        history = [];
        redraw();
        socket.emit('clear-canvas');
    }
});

// Export Drawing PNG Trigger
document.getElementById('action-export').addEventListener('click', () => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext('2d');
    
    // Paint drawing workspace background base color (so elements drawn transparent display properly)
    exportCtx.fillStyle = '#070913';
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    
    // Scale matching current display ratio
    const dpr = window.devicePixelRatio || 1;
    exportCtx.scale(dpr, dpr);
    
    // Redraw committed history to export canvas
    history.forEach(action => {
        exportCtx.save();
        exportCtx.lineCap = 'round';
        exportCtx.lineJoin = 'round';
        exportCtx.lineWidth = action.width;
        exportCtx.globalAlpha = action.opacity;
        
        if (action.tool === 'eraser') {
            // Eraser acts as clearing to background dark color on solid exports
            exportCtx.strokeStyle = '#070913';
            exportCtx.fillStyle = '#070913';
        } else {
            exportCtx.strokeStyle = action.color;
            exportCtx.fillStyle = action.color;
        }
        
        if (action.tool === 'brush' || action.tool === 'eraser') {
            if (action.points && action.points.length > 0) {
                exportCtx.beginPath();
                exportCtx.moveTo(action.points[0].x, action.points[0].y);
                for (let i = 1; i < action.points.length; i++) {
                    exportCtx.lineTo(action.points[i].x, action.points[i].y);
                }
                exportCtx.stroke();
            }
        } else if (action.tool === 'line') {
            if (action.start && action.end) {
                exportCtx.beginPath();
                exportCtx.moveTo(action.start.x, action.start.y);
                exportCtx.lineTo(action.end.x, action.end.y);
                exportCtx.stroke();
            }
        } else if (action.tool === 'rect') {
            if (action.start && action.end) {
                const x = Math.min(action.start.x, action.end.x);
                const y = Math.min(action.start.y, action.end.y);
                const w = Math.abs(action.start.x - action.end.x);
                const h = Math.abs(action.start.y - action.end.y);
                exportCtx.beginPath();
                exportCtx.rect(x, y, w, h);
                if (action.fill) {
                    exportCtx.fill();
                }
                exportCtx.stroke();
            }
        } else if (action.tool === 'circle') {
            if (action.start && action.end) {
                const dx = action.end.x - action.start.x;
                const dy = action.end.y - action.start.y;
                const radius = Math.sqrt(dx * dx + dy * dy);
                exportCtx.beginPath();
                exportCtx.arc(action.start.x, action.start.y, radius, 0, 2 * Math.PI);
                if (action.fill) {
                    exportCtx.fill();
                }
                exportCtx.stroke();
            }
        }
        exportCtx.restore();
    });
    
    // Download image trigger
    const link = document.createElement('a');
    link.download = `codraw-artwork-${roomId}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
    showToast("Canvas artwork downloaded successfully!");
});

// ----------------------------------------------------
// PROFILE MODAL AND POPUP CONFIGURATIONS
// ----------------------------------------------------

function showToast(message) {
    toastMessage.textContent = message;
    toastElement.classList.add('show');
    setTimeout(() => {
        toastElement.classList.remove('show');
    }, 3000);
}

// Copy invite link clipboard triggers
document.getElementById('invite-btn').addEventListener('click', () => {
    // Generate clean link format
    const inviteLink = `${window.location.origin}/room/${roomId}`;
    
    navigator.clipboard.writeText(inviteLink).then(() => {
        showToast("Invite link copied to your clipboard! Share it with friends.");
    }).catch(err => {
        console.error("Could not copy invite link: ", err);
        showToast("Failed to copy link. Please manually copy the URL!");
    });
});

// Profile Editing Modal Configs
let selectedModalColor = '#6366f1';
document.querySelectorAll('#username-modal .preset-colors .color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
        document.querySelectorAll('#username-modal .preset-colors .color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        selectedModalColor = dot.dataset.color;
    });
});

// Submit username modal
document.getElementById('modal-submit').addEventListener('click', () => {
    const inputName = document.getElementById('modal-username').value.trim();
    if (!inputName) {
        alert("Please enter a username nickname to join!");
        return;
    }
    
    myUsername = inputName;
    myColor = selectedModalColor;
    
    // Save to settings inputs as synchronization
    document.getElementById('settings-username').value = myUsername;
    
    // Set active dot inside dropdown menu colors list
    document.querySelectorAll('#settings-colors .color-dot').forEach(dot => {
        if (dot.dataset.color === myColor) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
    
    // Update local indicators
    myNameDisplay.textContent = myUsername;
    myAvatarIndicator.style.backgroundColor = myColor;
    
    // Push updates to websocket server
    socket.emit('update-username', myUsername);
    socket.emit('update-color', myColor);
    
    // Hide modal panel
    usernameModal.classList.remove('active');
    
    // Initial welcome chat trigger
    appendSystemMessage(`You have joined the room as "${myUsername}"!`);
});

// Settings profile click popup toggler
profileTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isActive = profileDropdown.classList.toggle('active');
    profileTrigger.classList.toggle('active', isActive);
});

profileDropdown.addEventListener('click', (e) => {
    e.stopPropagation(); // Avoid closing dropdown when interacting inside
});

document.addEventListener('click', () => {
    profileDropdown.classList.remove('active');
    profileTrigger.classList.remove('active');
});

// Setup Settings profile editing
let selectedSettingsColor = '';
document.querySelectorAll('#settings-colors .color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
        document.querySelectorAll('#settings-colors .color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        selectedSettingsColor = dot.dataset.color;
    });
});

document.getElementById('settings-save').addEventListener('click', () => {
    const nameVal = document.getElementById('settings-username').value.trim();
    if (!nameVal) {
        showToast("Please enter a valid nickname.");
        return;
    }
    
    myUsername = nameVal;
    if (selectedSettingsColor) {
        myColor = selectedSettingsColor;
    }
    
    // Update UI elements
    myNameDisplay.textContent = myUsername;
    myAvatarIndicator.style.backgroundColor = myColor;
    
    // Tell socket server
    socket.emit('update-username', myUsername);
    socket.emit('update-color', myColor);
    
    // Hide dropdown panel
    profileDropdown.classList.remove('active');
    profileTrigger.classList.remove('active');
    showToast("Profile settings updated successfully!");
    
    // Update collaborator lists
    updateCollaboratorsList();
});

// ----------------------------------------------------
// WEBSOCKET INCOMING EVENTS LISTENERS
// ----------------------------------------------------

socket.on('init-room', (initData) => {
    userId = initData.userId;
    history = initData.history;
    usersList = initData.users;
    
    // Apply temporary random credentials if first connect
    if (!myUsername) {
        myUsername = initData.assignedName;
        myColor = initData.assignedColor;
        
        // Pre-fill profile modals/drawers
        document.getElementById('modal-username').value = myUsername;
        document.getElementById('settings-username').value = myUsername;
        
        myNameDisplay.textContent = myUsername;
        myAvatarIndicator.style.backgroundColor = myColor;
        
        // Show join modal for customizable names on startup
        usernameModal.classList.add('active');
    }
    
    // Build peers Cursors elements list
    cursorsContainer.innerHTML = '';
    Object.values(usersList).forEach(user => {
        if (user.id !== userId && user.cursor) {
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
    
    updateCollaboratorsList();
    redraw();
});

// Peer connected listener
socket.on('user-joined', (userData) => {
    usersList[userData.id] = {
        id: userData.id,
        username: userData.username,
        color: userData.color,
        cursor: null
    };
    
    appendSystemMessage(`Collaborator "${userData.username}" joined the canvas.`);
    updateCollaboratorsList();
});

// Peer credentials modified listener
socket.on('user-updated', (userData) => {
    if (usersList[userData.id]) {
        const oldName = usersList[userData.id].username;
        usersList[userData.id].username = userData.username;
        usersList[userData.id].color = userData.color;
        
        if (oldName !== userData.username) {
            appendSystemMessage(`"${oldName}" changed nickname to "${userData.username}".`);
        }
        
        updateCollaboratorsList();
    }
});

// Peer disconnected listener
socket.on('user-left', (leftUserId) => {
    if (usersList[leftUserId]) {
        appendSystemMessage(`Collaborator "${usersList[leftUserId].username}" left.`);
        delete usersList[leftUserId];
        removePeerCursor(leftUserId);
        
        // Wipe active drag drawings caches
        delete activeDrawings[leftUserId];
        
        updateCollaboratorsList();
        redraw();
    }
});

// Committed action synchronization
socket.on('receive-action', (action) => {
    history.push(action);
    
    // Clean up temporary live active drawings when peer commits it
    if (action.userId) {
        delete activeDrawings[action.userId];
    }
    
    redraw();
});

// Real-time temporary path preview updates
socket.on('receive-draw-active', (activeData) => {
    if (activeData === null || !activeData.tool) {
        delete activeDrawings[activeData.userId];
    } else {
        activeDrawings[activeData.userId] = activeData;
    }
    redraw();
});

// Canvas clear canvas request from peers
socket.on('canvas-cleared', () => {
    history = [];
    activeDrawings = {};
    redraw();
    showToast("The canvas was cleared by a collaborator.");
});

// Action history updated listener (e.g. peer undo trigger)
socket.on('history-updated', (updatedHistory) => {
    history = updatedHistory;
    redraw();
});

// Dynamic live peer cursor tracking updates
socket.on('cursor-update', (cursorData) => {
    updatePeerCursor(cursorData);
});

// Received peer chat messages listener
socket.on('receive-chat', (messageObj) => {
    appendChatMessage(messageObj);
});

// ----------------------------------------------------
// SYSTEM BOOTSTRAP INITIALIZATION
// ----------------------------------------------------

// Canvas interactions mouse events
canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);

// Canvas interactions touch events (Mobile compatibility)
canvas.addEventListener('touchstart', handleStart);
canvas.addEventListener('touchmove', handleMove);
window.addEventListener('touchend', handleEnd);

// Window resize listeners
window.addEventListener('resize', resizeCanvas);

// Kick off connections
initRoomConnection();
resizeCanvas();
