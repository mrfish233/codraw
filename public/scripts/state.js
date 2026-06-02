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
