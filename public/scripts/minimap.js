// CoDraw Minimap Board Map View Module

import { state } from './state.js';
import { dom } from './dom.js';
import { redraw } from './canvas.js';

let isNavigatingMinimap = false;

// Render current committed canvas elements inside the minimap scaled coordinate system
export function drawMinimap() {
    if (!dom.minimapCanvas || !dom.minimapCtx) return;
    
    const width = dom.minimapCanvas.parentElement.clientWidth;
    const height = dom.minimapCanvas.parentElement.clientHeight;
    
    // Set actual canvas size matching displayed bounds
    dom.minimapCanvas.width = width;
    dom.minimapCanvas.height = height;
    
    // Clear and draw background
    dom.minimapCtx.clearRect(0, 0, width, height);
    dom.minimapCtx.fillStyle = 'rgba(7, 9, 19, 0.4)';
    dom.minimapCtx.fillRect(0, 0, width, height);
    
    dom.minimapCtx.save();
    
    // Scale virtual coordinate system (-BOARD_WIDTH/2 to BOARD_WIDTH/2) into minimap space
    dom.minimapCtx.scale(width / state.BOARD_WIDTH, height / state.BOARD_HEIGHT);
    dom.minimapCtx.translate(state.BOARD_WIDTH / 2, state.BOARD_HEIGHT / 2);
    
    // Draw committed paths
    state.history.forEach(action => {
        dom.minimapCtx.save();
        dom.minimapCtx.lineCap = 'round';
        dom.minimapCtx.lineJoin = 'round';
        
        dom.minimapCtx.lineWidth = Math.max(10, action.width * 1.5);
        dom.minimapCtx.strokeStyle = action.tool === 'eraser' ? '#070913' : action.color;
        dom.minimapCtx.fillStyle = action.tool === 'eraser' ? '#070913' : action.color;
        
        if (action.tool === 'brush' || action.tool === 'eraser') {
            if (action.points && action.points.length > 0) {
                dom.minimapCtx.beginPath();
                dom.minimapCtx.moveTo(action.points[0].x, action.points[0].y);
                for (let i = 1; i < action.points.length; i++) {
                    dom.minimapCtx.lineTo(action.points[i].x, action.points[i].y);
                }
                dom.minimapCtx.stroke();
            }
        } else if (action.tool === 'line') {
            if (action.start && action.end) {
                dom.minimapCtx.beginPath();
                dom.minimapCtx.moveTo(action.start.x, action.start.y);
                dom.minimapCtx.lineTo(action.end.x, action.end.y);
                dom.minimapCtx.stroke();
            }
        } else if (action.tool === 'rect') {
            if (action.start && action.end) {
                const x = Math.min(action.start.x, action.end.x);
                const y = Math.min(action.start.y, action.end.y);
                const w = Math.abs(action.start.x - action.end.x);
                const h = Math.abs(action.start.y - action.end.y);
                dom.minimapCtx.beginPath();
                dom.minimapCtx.rect(x, y, w, h);
                if (action.fill) dom.minimapCtx.fill();
                dom.minimapCtx.stroke();
            }
        } else if (action.tool === 'circle') {
            if (action.start && action.end) {
                const x1 = action.start.x;
                const y1 = action.start.y;
                const x2 = action.end.x;
                const y2 = action.end.y;
                
                const centerX = (x1 + x2) / 2;
                const centerY = (y1 + y2) / 2;
                const radiusX = Math.abs(x1 - x2) / 2;
                const radiusY = Math.abs(y1 - y2) / 2;
                
                if (radiusX > 0 && radiusY > 0) {
                    dom.minimapCtx.beginPath();
                    dom.minimapCtx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
                    if (action.fill) dom.minimapCtx.fill();
                    dom.minimapCtx.stroke();
                }
            }
        }
        dom.minimapCtx.restore();
    });
    
    // Draw current active viewport bounding box
    if (dom.canvas) {
        const rect = dom.canvas.getBoundingClientRect();
        const viewportWidth = rect.width;
        const viewportHeight = rect.height;
        
        dom.minimapCtx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
        dom.minimapCtx.lineWidth = 20; // thick enough to be visible in scaled space
        dom.minimapCtx.fillStyle = 'rgba(99, 102, 241, 0.1)';
        
        dom.minimapCtx.fillRect(-state.offsetX, -state.offsetY, viewportWidth, viewportHeight);
        dom.minimapCtx.strokeRect(-state.offsetX, -state.offsetY, viewportWidth, viewportHeight);
    }
    
    dom.minimapCtx.restore();
}

// Center viewport when user clicks or drags inside minimap
export function handleMinimapNavigation(e) {
    if (!dom.minimapCanvas) return;
    
    const rect = dom.minimapCanvas.getBoundingClientRect();
    let clientX = e.clientX;
    let clientY = e.clientY;
    
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    }
    
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    
    // Translate click ratios to world coordinates
    const worldX = (mx / rect.width) * state.BOARD_WIDTH - state.BOARD_WIDTH / 2;
    const worldY = (my / rect.height) * state.BOARD_HEIGHT - state.BOARD_HEIGHT / 2;
    
    // Center the board screen view
    if (dom.canvas) {
        const canvasRect = dom.canvas.getBoundingClientRect();
        state.offsetX = canvasRect.width / 2 - worldX;
        state.offsetY = canvasRect.height / 2 - worldY;
    }
    
    redraw();
}

// Bind Minimap events
export function bindMinimapEvents() {
    if (!dom.minimapCanvas) return;
    
    dom.minimapCanvas.addEventListener('mousedown', (e) => {
        isNavigatingMinimap = true;
        handleMinimapNavigation(e);
    });

    window.addEventListener('mousemove', (e) => {
        if (isNavigatingMinimap) {
            handleMinimapNavigation(e);
        }
    });

    window.addEventListener('mouseup', () => {
        isNavigatingMinimap = false;
    });

    // Mobile touch events
    dom.minimapCanvas.addEventListener('touchstart', (e) => {
        isNavigatingMinimap = true;
        handleMinimapNavigation(e);
    });

    dom.minimapCanvas.addEventListener('touchmove', (e) => {
        if (isNavigatingMinimap) {
            handleMinimapNavigation(e);
        }
    });

    dom.minimapCanvas.addEventListener('touchend', () => {
        isNavigatingMinimap = false;
    });
}
