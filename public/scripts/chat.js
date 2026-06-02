// CoDraw Chat Panel Module

import { state } from './state.js';
import { dom } from './dom.js';
import { socket } from './socket.js';

// Format and append chat messages
export function appendChatMessage(msg) {
    if (!dom.chatMessages) return;
    
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
    
    dom.chatMessages.appendChild(bubble);
    
    // Auto-scroll to bottom
    dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
}

// Append system alerts inside chat container
export function appendSystemMessage(text) {
    if (!dom.chatMessages) return;
    
    const system = document.createElement('div');
    system.className = 'system-message';
    system.textContent = text;
    dom.chatMessages.appendChild(system);
    dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
}

// Bind chat submission events
export function bindChatEvents() {
    if (!dom.chatForm) return;
    
    dom.chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!dom.chatInput) return;
        
        const text = dom.chatInput.value.trim();
        if (!text) return;
        
        socket.emit('chat-message', text);
        dom.chatInput.value = '';
    });
}
