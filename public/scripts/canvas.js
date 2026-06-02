// CoDraw Canvas Rendering & Event Handling Module

import { state, saveLocalHistory } from './state.js';
import { dom } from './dom.js';
import { drawMinimap } from './minimap.js';
import { repositionAllPeerCursors } from './collaborators.js';
import { socket, broadcastCursor } from './socket.js';

// Setup canvas high-DPI scaling matching standard client dimensions
export function resizeCanvas() {
    if (!dom.canvas || !dom.ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = dom.canvas.getBoundingClientRect();
    
    dom.canvas.width = rect.width * dpr;
    dom.canvas.height = rect.height * dpr;
    
    dom.ctx.scale(dpr, dpr);
    redraw();
}

// Clear and render entire canvas history/previews
export function redraw() {
    if (!dom.canvas || !dom.ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    dom.ctx.clearRect(0, 0, dom.canvas.width / dpr, dom.canvas.height / dpr);
    
    // Adjust visual states in sync
    if (dom.deleteSelectedBtn) {
        dom.deleteSelectedBtn.style.display = (state.exportSelection && state.exportSelection.x !== undefined) ? 'flex' : 'none';
    }
    
    if (dom.gridOverlay) {
        dom.gridOverlay.style.backgroundPosition = `${state.offsetX}px ${state.offsetY}px`;
    }
    
    dom.ctx.save();
    dom.ctx.translate(state.offsetX, state.offsetY);
    
    // 1. Draw committed drawing history
    state.history.forEach(action => {
        drawAction(action);
    });
    
    // 2. Draw live active previews of drawing actions by other users
    Object.values(state.activeDrawings).forEach(activeAction => {
        if (activeAction) {
            drawAction(activeAction);
        }
    });
    
    // 3. Draw current active local path/preview
    if (state.isDrawing && ['brush', 'eraser', 'line', 'rect', 'circle'].includes(state.currentTool)) {
        const localActiveAction = {
            tool: state.currentTool,
            points: state.points,
            start: state.startPoint,
            end: state.currentPoint,
            color: state.currentTool === 'eraser' ? 'rgba(0,0,0,1)' : state.currentColor,
            width: state.currentSize,
            opacity: state.currentOpacity,
            fill: state.fillShape
        };
        drawAction(localActiveAction);
    }
    
    // Draw export area selection box if active (inside translated context)
    if (state.exportSelection) {
        dom.ctx.save();
        dom.ctx.strokeStyle = '#a855f7'; // Neon purple
        dom.ctx.lineWidth = 1.5;
        dom.ctx.setLineDash([5, 5]);
        dom.ctx.fillStyle = 'rgba(168, 85, 247, 0.1)';
        
        const selX = state.exportSelection.x !== undefined ? state.exportSelection.x : Math.min(state.exportSelection.startX, state.exportSelection.endX);
        const selY = state.exportSelection.y !== undefined ? state.exportSelection.y : Math.min(state.exportSelection.startY, state.exportSelection.endY);
        const selW = state.exportSelection.w !== undefined ? state.exportSelection.w : Math.abs(state.exportSelection.startX - state.exportSelection.endX);
        const selH = state.exportSelection.h !== undefined ? state.exportSelection.h : Math.abs(state.exportSelection.startY - state.exportSelection.endY);
        
        dom.ctx.fillRect(selX, selY, selW, selH);
        dom.ctx.strokeRect(selX, selY, selW, selH);
        
        // Draw selection corner handles
        dom.ctx.fillStyle = '#ffffff';
        const hs = 6; // Handle size
        dom.ctx.fillRect(selX - hs/2, selY - hs/2, hs, hs);
        dom.ctx.fillRect(selX + selW - hs/2, selY - hs/2, hs, hs);
        dom.ctx.fillRect(selX - hs/2, selY + selH - hs/2, hs, hs);
        dom.ctx.fillRect(selX + selW - hs/2, selY + selH - hs/2, hs, hs);
        dom.ctx.restore();
    }
    
    dom.ctx.restore();
    
    // 4. Update the overall board map view
    drawMinimap();
    
    // 5. Shift other users' live HTML cursors relative to viewport movement
    repositionAllPeerCursors();
}

// Core drawing primitive
export function drawAction(action) {
    if (!dom.ctx) return;
    
    dom.ctx.save();
    dom.ctx.lineCap = 'round';
    dom.ctx.lineJoin = 'round';
    dom.ctx.lineWidth = action.width;
    dom.ctx.globalAlpha = action.opacity;
    
    if (action.tool === 'eraser') {
        dom.ctx.globalCompositeOperation = 'destination-out';
    } else {
        dom.ctx.globalCompositeOperation = 'source-over';
    }
    
    dom.ctx.strokeStyle = action.color;
    dom.ctx.fillStyle = action.color;
    
    if (action.tool === 'brush' || action.tool === 'eraser') {
        if (action.points && action.points.length > 0) {
            dom.ctx.beginPath();
            dom.ctx.moveTo(action.points[0].x, action.points[0].y);
            for (let i = 1; i < action.points.length; i++) {
                dom.ctx.lineTo(action.points[i].x, action.points[i].y);
            }
            dom.ctx.stroke();
        }
    } else if (action.tool === 'line') {
        if (action.start && action.end) {
            dom.ctx.beginPath();
            dom.ctx.moveTo(action.start.x, action.start.y);
            dom.ctx.lineTo(action.end.x, action.end.y);
            dom.ctx.stroke();
        }
    } else if (action.tool === 'rect') {
        if (action.start && action.end) {
            const x = Math.min(action.start.x, action.end.x);
            const y = Math.min(action.start.y, action.end.y);
            const w = Math.abs(action.start.x - action.end.x);
            const h = Math.abs(action.start.y - action.end.y);
            
            dom.ctx.beginPath();
            dom.ctx.rect(x, y, w, h);
            if (action.fill) {
                dom.ctx.fill();
            }
            dom.ctx.stroke();
        }
    } else if (action.tool === 'circle') {
        if (action.start && action.end) {
            const dx = action.end.x - action.start.x;
            const dy = action.end.y - action.start.y;
            const radius = Math.sqrt(dx * dx + dy * dy);
            
            dom.ctx.beginPath();
            dom.ctx.arc(action.start.x, action.start.y, radius, 0, 2 * Math.PI);
            if (action.fill) {
                dom.ctx.fill();
            }
            dom.ctx.stroke();
        }
    }
    dom.ctx.restore();
}

// Convert touch/mouse screen offsets to canvas-local coordinates
export function getCoordinates(e) {
    if (!dom.canvas) return { x: 0, y: 0 };
    
    const rect = dom.canvas.getBoundingClientRect();
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

// Click / Touch Start event handler
export function handleStart(e) {
    const isMiddleClick = e.button === 1;
    const isPanTool = state.currentTool === 'pan';
    const isExportAreaTool = state.currentTool === 'export-area';
    
    // Selection tool init
    if (isExportAreaTool) {
        state.isSelectingArea = true;
        const screenCoord = getCoordinates(e);
        const worldCoord = {
            x: screenCoord.x - state.offsetX,
            y: screenCoord.y - state.offsetY
        };
        state.exportSelection = {
            startX: worldCoord.x,
            startY: worldCoord.y,
            endX: worldCoord.x,
            endY: worldCoord.y
        };
        redraw();
        return;
    }
    
    // Pan tool initialization
    if (state.isSpacePressed || isMiddleClick || isPanTool) {
        state.isPanning = true;
        const screenCoord = getCoordinates(e);
        state.panStart = screenCoord;
        if (dom.canvas) dom.canvas.style.cursor = 'grabbing';
        return;
    }
    
    if (e.button !== undefined && e.button !== 0) return;
    
    state.isDrawing = true;
    const screenCoord = getCoordinates(e);
    const worldCoord = {
        x: screenCoord.x - state.offsetX,
        y: screenCoord.y - state.offsetY
    };
    
    state.startPoint = worldCoord;
    state.currentPoint = worldCoord;
    state.points = [worldCoord];
    
    broadcastCursor(worldCoord.x, worldCoord.y, true);
    
    if (state.currentTool === 'brush' || state.currentTool === 'eraser') {
        socket.emit('draw-active', {
            tool: state.currentTool,
            points: state.points,
            color: state.currentTool === 'eraser' ? 'rgba(0,0,0,1)' : state.currentColor,
            width: state.currentSize,
            opacity: state.currentOpacity
        });
    }
    
    redraw();
}

// Drag / Move event handler
export function handleMove(e) {
    const screenCoord = getCoordinates(e);
    const worldCoord = {
        x: screenCoord.x - state.offsetX,
        y: screenCoord.y - state.offsetY
    };
    
    // Selection resizing
    if (state.isSelectingArea) {
        state.exportSelection.endX = worldCoord.x;
        state.exportSelection.endY = worldCoord.y;
        redraw();
        return;
    }
    
    // Canvas panning
    if (state.isPanning) {
        const dx = screenCoord.x - state.panStart.x;
        const dy = screenCoord.y - state.panStart.y;
        
        state.offsetX += dx;
        state.offsetY += dy;
        state.panStart = screenCoord;
        
        broadcastCursor(worldCoord.x, worldCoord.y, false);
        redraw();
        return;
    }
    
    broadcastCursor(worldCoord.x, worldCoord.y, state.isDrawing);
    
    if (!state.isDrawing) return;
    
    state.currentPoint = worldCoord;
    
    if (state.currentTool === 'brush' || state.currentTool === 'eraser') {
        state.points.push(worldCoord);
        
        socket.emit('draw-active', {
            tool: state.currentTool,
            points: state.points,
            color: state.currentTool === 'eraser' ? 'rgba(0,0,0,1)' : state.currentColor,
            width: state.currentSize,
            opacity: state.currentOpacity
        });
    } else {
        socket.emit('draw-active', {
            tool: state.currentTool,
            start: state.startPoint,
            end: state.currentPoint,
            color: state.currentColor,
            width: state.currentSize,
            opacity: state.currentOpacity,
            fill: state.fillShape
        });
    }
    
    redraw();
}

// Release Mouse / Touch End event handler
export function handleEnd() {
    if (state.isSelectingArea) {
        state.isSelectingArea = false;
        
        const x = Math.min(state.exportSelection.startX, state.exportSelection.endX);
        const y = Math.min(state.exportSelection.startY, state.exportSelection.endY);
        const w = Math.abs(state.exportSelection.startX - state.exportSelection.endX);
        const h = Math.abs(state.exportSelection.startY - state.exportSelection.endY);
        
        if (w < 5 || h < 5) {
            state.exportSelection = null;
        } else {
            state.exportSelection = { x, y, w, h };
        }
        redraw();
        return;
    }
    
    if (state.isPanning) {
        state.isPanning = false;
        if (dom.canvas) {
            dom.canvas.style.cursor = state.isSpacePressed || state.currentTool === 'pan' ? 'grab' : 'crosshair';
        }
        return;
    }
    
    if (!state.isDrawing) return;
    state.isDrawing = false;
    
    broadcastCursor(state.currentPoint.x, state.currentPoint.y, false);
    
    socket.emit('draw-active', null);
    
    const finalizedAction = {
        id: Date.now() + Math.random().toString(36).substring(2, 6),
        tool: state.currentTool,
        color: state.currentTool === 'eraser' ? 'rgba(0,0,0,1)' : state.currentColor,
        width: state.currentSize,
        opacity: state.currentOpacity,
        fill: state.fillShape
    };
    
    if (state.currentTool === 'brush' || state.currentTool === 'eraser') {
        if (state.points.length < 2) {
            redraw();
            return;
        }
        finalizedAction.points = state.points;
    } else {
        if (Math.abs(state.startPoint.x - state.currentPoint.x) < 2 && Math.abs(state.startPoint.y - state.currentPoint.y) < 2) {
            redraw();
            return;
        }
        finalizedAction.start = state.startPoint;
        finalizedAction.end = state.currentPoint;
    }
    
    state.history.push(finalizedAction);
    saveLocalHistory();
    socket.emit('commit-action', finalizedAction);
    
    state.points = [];
    redraw();
}
