// CoDraw Application Bootstrapper & Main Entry Point

import { state, loadLocalProfile, loadLocalHistory } from './state.js';
import { dom } from './dom.js';
import { socket, initRoomConnection, registerSocketListeners } from './socket.js';
import { resizeCanvas, handleStart, handleMove, handleEnd, redraw } from './canvas.js';
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
    
    // 2. Keyboard shortcuts (Spacebar Panning, Undo & Redo)
    window.addEventListener('keydown', (e) => {
        const activeTag = document.activeElement.tagName;
        // Ignore whiteboard shortcuts if typing inside text fields
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
            return;
        }
        
        if (e.code === 'Space') {
            e.preventDefault();
            if (!state.isSpacePressed) {
                state.isSpacePressed = true;
                if (dom.canvas) dom.canvas.style.cursor = 'grab';
            }
        }
        
        // Command key on macOS, Control key on Windows/Linux
        const isCmdOrCtrl = e.ctrlKey || e.metaKey;
        
        if (isCmdOrCtrl) {
            if (e.key === 'z' || e.key === 'Z') {
                e.preventDefault();
                if (e.shiftKey) {
                    // Ctrl+Shift+Z / Cmd+Shift+Z: Redo
                    socket.emit('redo-action');
                } else {
                    // Ctrl+Z / Cmd+Z: Undo
                    socket.emit('undo-action');
                }
            } else if (e.key === 'y' || e.key === 'Y') {
                // Ctrl+Y / Cmd+Y: Redo
                e.preventDefault();
                socket.emit('redo-action');
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
    
    // Load local cached profile and whiteboard history instantly to prevent flickering
    loadLocalProfile();
    if (loadLocalHistory()) {
        redraw();
    }
    
    // 6. Set initial viewport sizes
    resizeCanvas();
}

// Initialise application on DOM Content loaded
document.addEventListener('DOMContentLoaded', bootstrapApplication);
export { bootstrapApplication };
