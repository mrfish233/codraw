// CoDraw Collaborators Management Module

import { state } from './state.js';
import { dom } from './dom.js';
import { socket } from './socket.js';

// Render and position peer cursor indicators
export function updatePeerCursor(cursorData) {
    if (!dom.cursorsContainer) return;
    
    let cursorEl = document.getElementById(`cursor-${cursorData.id}`);
    
    // Create cursor overlay if missing
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
        dom.cursorsContainer.appendChild(cursorEl);
    }
    
    // Assign custom styling variables
    cursorEl.style.setProperty('--cursor-color', cursorData.color);
    
    if (cursorData.isDrawing) {
        cursorEl.classList.add('drawing');
    } else {
        cursorEl.classList.remove('drawing');
    }
    
    // Position using local panning offsets
    const screenX = cursorData.x + state.offsetX;
    const screenY = cursorData.y + state.offsetY;
    cursorEl.style.transform = `translate(${screenX}px, ${screenY}px)`;
    
    const labelEl = cursorEl.querySelector('.peer-cursor-label');
    if (labelEl) labelEl.textContent = cursorData.username;
}

// Remove cursor indicator when peer exits
export function removePeerCursor(userId) {
    const cursorEl = document.getElementById(`cursor-${userId}`);
    if (cursorEl) {
        cursorEl.remove();
    }
}

// Synchronize sidebar collaborators directory list
export function updateCollaboratorsList() {
    if (!dom.collaboratorsList || !dom.userCountDisplay) return;
    
    dom.collaboratorsList.innerHTML = '';
    
    // Append local user first
    const meItem = document.createElement('div');
    meItem.className = 'collaborator-item';
    meItem.innerHTML = `
        <div class="collaborator-info">
            <span class="collaborator-dot" style="background-color: ${state.myColor}"></span>
            <span class="collaborator-name">${state.myUsername}</span>
            <span class="you-tag">You</span>
        </div>
    `;
    dom.collaboratorsList.appendChild(meItem);
    
    // Append online peers
    let count = 1;
    Object.values(state.usersList).forEach(user => {
        if (user.id === state.userId) return;
        count++;
        
        const peerItem = document.createElement('div');
        peerItem.className = 'collaborator-item';
        peerItem.innerHTML = `
            <div class="collaborator-info">
                <span class="collaborator-dot" style="background-color: ${user.color}"></span>
                <span class="collaborator-name">${user.username}</span>
            </div>
        `;
        dom.collaboratorsList.appendChild(peerItem);
    });
    
    dom.userCountDisplay.textContent = count;
}

// Translate cursor coordinate bounds dynamically on canvas panning
export function repositionAllPeerCursors() {
    Object.values(state.usersList).forEach(user => {
        if (user.id !== state.userId && user.cursor) {
            const cursorEl = document.getElementById(`cursor-${user.id}`);
            if (cursorEl) {
                const screenX = user.cursor.x + state.offsetX;
                const screenY = user.cursor.y + state.offsetY;
                cursorEl.style.transform = `translate(${screenX}px, ${screenY}px)`;
            }
        }
    });
}
