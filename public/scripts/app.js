// CoDraw Application Bootstrapper & Main Entry Point

import { state } from './state.js';
import { dom } from './dom.js';
import { initRoomConnection, registerSocketListeners } from './socket.js';
import { resizeCanvas, handleStart, handleMove, handleEnd } from './canvas.js';
import { bindChatEvents } from './chat.js';
import { bindMinimapEvents } from './minimap.js';
import { bindUiEvents } from './ui.js';

function bootstrapApplication() {
    // 1. Setup Canvas events (mouse & touch)
    if (dom.canvas) {
        dom.canvas.addEventListener('mousedown', handleStart);
        dom.canvas.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);
        
        // Touch support (Mobile compatibility)
        dom.canvas.addEventListener('touchstart', handleStart);
        dom.canvas.addEventListener('touchmove', handleMove);
        window.addEventListener('touchend', handleEnd);
    }
    
    // 2. Keyboard spacebar panning shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            const activeTag = document.activeElement.tagName;
            if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
                e.preventDefault();
                if (!state.isSpacePressed) {
                    state.isSpacePressed = true;
                    if (dom.canvas) dom.canvas.style.cursor = 'grab';
                }
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            state.isSpacePressed = false;
            if (dom.canvas) {
                dom.canvas.style.cursor = state.currentTool === 'pan' ? 'grab' : 'crosshair';
            }
        }
    });

    // 3. Window resize listener
    window.addEventListener('resize', resizeCanvas);
    
    // 4. Bind sub-module layout events
    bindUiEvents();
    bindChatEvents();
    bindMinimapEvents();
    
    // 5. Connect and register WebSockets synchronization
    registerSocketListeners();
    initRoomConnection();
    
    // 6. Set initial viewport sizes
    resizeCanvas();
}

// Initialise application on DOM Content loaded
document.addEventListener('DOMContentLoaded', bootstrapApplication);
export { bootstrapApplication };
