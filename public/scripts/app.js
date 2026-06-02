// CoDraw Application Bootstrapper & Main Entry Point

import { state, loadLocalProfile, loadLocalHistory } from './state.js';
import { dom } from './dom.js';
import { socket, initRoomConnection, registerSocketListeners } from './socket.js';
import { resizeCanvas, handleStart, handleMove, handleEnd, redraw, handleShiftChange } from './canvas.js';
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
    
    // 2. Keyboard shortcuts (Spacebar Panning, Undo, Redo & Tools)
    window.addEventListener('keydown', (e) => {
        const activeTag = document.activeElement.tagName;
        // Ignore whiteboard shortcuts if typing inside text fields
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
            return;
        }
        
        if (e.key === 'Shift') {
            if (!state.isShiftPressed) {
                handleShiftChange(true);
            }
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
        } else if (!e.altKey && !state.isViewMode) {
            // Numeric keys 1-7 for switching drawing tools (Edit Mode only, no modifiers)
            const toolKeys = {
                '1': 'tool-brush',
                '2': 'tool-line',
                '3': 'tool-rect',
                '4': 'tool-circle',
                '5': 'tool-eraser',
                '6': 'tool-pan',
                '7': 'tool-export-area'
            };
            
            const btnId = toolKeys[e.key];
            if (btnId) {
                const btn = document.getElementById(btnId);
                if (btn) {
                    e.preventDefault();
                    btn.click();
                }
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') {
            handleShiftChange(false);
        }
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

    // 7. Prevent iOS / iPadOS Safari rubber-band scrolling and viewport drag bounce
    document.addEventListener('touchmove', (e) => {
        // Allow vertical touch scrolling inside designated scrollable containers
        const isScrollable = e.target.closest('.chat-messages-container') || e.target.closest('.users-list-container');
        if (!isScrollable) {
            e.preventDefault();
        }
    }, { passive: false });
}

// Initialise application on DOM Content loaded
document.addEventListener('DOMContentLoaded', bootstrapApplication);
export { bootstrapApplication };
