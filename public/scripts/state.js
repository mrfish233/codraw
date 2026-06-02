// CoDraw Shared Application State

export const state = {
    // Session credentials
    roomId: '',
    userId: '',
    myUsername: '',
    myColor: '#6366f1',
    
    // Tools & brush settings
    isDrawing: false,
    currentTool: 'brush', // brush, line, rect, circle, eraser, pan, export-area
    currentColor: '#6366f1',
    currentSize: 5,
    currentOpacity: 1,
    fillShape: false,
    
    // Local drawing paths/coordinates
    startPoint: { x: 0, y: 0 },
    currentPoint: { x: 0, y: 0 },
    points: [], // Freehand brush points
    
    // Authoritative collaborative collections
    history: [], // Committed drawings list
    activeDrawings: {}, // Real-time previews { userId: action }
    usersList: {}, // Active room users { socketId: userInfo }
    
    // Infinite panning offset states
    offsetX: 0,
    offsetY: 0,
    isPanning: false,
    panStart: { x: 0, y: 0 },
    isSpacePressed: false,
    
    // Target crop selection area
    exportSelection: null, // Stores { x, y, w, h } in world space
    isSelectingArea: false,
    
    // Canvas config constants
    BOARD_WIDTH: 4000,
    BOARD_HEIGHT: 4000
};

// Caching helper: Save current whiteboard history snapshot to localStorage
export function saveLocalHistory() {
    if (state.roomId && state.history) {
        localStorage.setItem(`codraw_history_${state.roomId}`, JSON.stringify(state.history));
    }
}

// Caching helper: Load whiteboard history from localStorage
export function loadLocalHistory() {
    if (state.roomId) {
        const cached = localStorage.getItem(`codraw_history_${state.roomId}`);
        if (cached) {
            try {
                state.history = JSON.parse(cached);
                return true;
            } catch (e) {
                console.error("Error parsing cached history:", e);
            }
        }
    }
    return false;
}

// Caching helper: Save user profile nickname and avatar color to localStorage
export function saveLocalProfile() {
    if (state.myUsername) {
        localStorage.setItem('codraw_username', state.myUsername);
    }
    if (state.myColor) {
        localStorage.setItem('codraw_color', state.myColor);
    }
}

// Caching helper: Load user profile credentials from localStorage
export function loadLocalProfile() {
    const username = localStorage.getItem('codraw_username');
    const color = localStorage.getItem('codraw_color');
    if (username) {
        state.myUsername = username;
    }
    if (color) {
        state.myColor = color;
    }
    return !!username;
}
