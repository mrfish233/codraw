// CoDraw Interactive User Interface Module

import { state, saveLocalHistory, saveLocalProfile } from './state.js';
import { dom } from './dom.js';
import { redraw, resizeCanvas } from './canvas.js';
import { socket } from './socket.js';
import { updateCollaboratorsList } from './collaborators.js';
import { appendSystemMessage } from './chat.js';

// Show a modern glassmorphic toast alert
export function showToast(message) {
    if (!dom.toastMessage || !dom.toastElement) return;
    dom.toastMessage.textContent = message;
    dom.toastElement.classList.add('show');
    setTimeout(() => {
        dom.toastElement.classList.remove('show');
    }, 3000);
}

// Binds all interface event listeners (Buttons, Dropdowns, sliders, tabs)
export function bindUiEvents() {
    // ----------------------------------------------------
    // TAB NAVIGATION (CHAT vs COLLABORATORS)
    // ----------------------------------------------------
    const tabChat = document.getElementById('tab-chat');
    const tabUsers = document.getElementById('tab-users');
    const chatContent = document.getElementById('chat-content');
    const usersContent = document.getElementById('users-content');
    
    if (tabChat && tabUsers && chatContent && usersContent) {
        tabChat.addEventListener('click', () => {
            tabChat.classList.add('active');
            tabUsers.classList.remove('active');
            chatContent.classList.add('active');
            usersContent.classList.remove('active');
        });
        
        tabUsers.addEventListener('click', () => {
            tabUsers.classList.add('active');
            tabChat.classList.remove('active');
            usersContent.classList.add('active');
            chatContent.classList.remove('active');
        });
    }

    // ----------------------------------------------------
    // LEFT TOOLBAR & BRUSH CONTROLS
    // ----------------------------------------------------
    const toolButtons = {
        'brush': document.getElementById('tool-brush'),
        'line': document.getElementById('tool-line'),
        'rect': document.getElementById('tool-rect'),
        'circle': document.getElementById('tool-circle'),
        'eraser': document.getElementById('tool-eraser'),
        'pan': document.getElementById('tool-pan'),
        'export-area': document.getElementById('tool-export-area')
    };
    
    Object.entries(toolButtons).forEach(([tool, button]) => {
        if (!button) return;
        button.addEventListener('click', () => {
            Object.values(toolButtons).forEach(btn => {
                if (btn) btn.classList.remove('active');
            });
            button.classList.add('active');
            state.currentTool = tool;
            
            // Clear current selection box if user switches tools
            if (tool !== 'export-area' && state.exportSelection) {
                state.exportSelection = null;
                redraw();
            }
            
            // Set contextual pointer cursor
            if (dom.canvas) {
                if (tool === 'pan') {
                    dom.canvas.style.cursor = 'grab';
                } else if (tool === 'export-area') {
                    dom.canvas.style.cursor = 'cell';
                } else {
                    dom.canvas.style.cursor = 'crosshair';
                }
            }
        });
    });

    // Preset color selections
    document.querySelectorAll('.color-picker-container .color-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            document.querySelectorAll('.color-picker-container .color-dot').forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            state.currentColor = dot.dataset.color;
            
            if (dom.customColorInput) {
                dom.customColorInput.value = state.currentColor;
            }
        });
    });

    // Hex Color Input
    if (dom.customColorInput) {
        dom.customColorInput.addEventListener('input', (e) => {
            state.currentColor = e.target.value;
            document.querySelectorAll('.color-picker-container .color-dot').forEach(d => d.classList.remove('active'));
        });
    }

    // Brush Size range slider
    if (dom.brushSizeInput && dom.brushSizeVal) {
        dom.brushSizeInput.addEventListener('input', (e) => {
            state.currentSize = e.target.value;
            dom.brushSizeVal.textContent = `${state.currentSize}px`;
        });
    }

    // Brush Opacity range slider
    if (dom.brushOpacityInput && dom.brushOpacityVal) {
        dom.brushOpacityInput.addEventListener('input', (e) => {
            state.currentOpacity = e.target.value / 100;
            dom.brushOpacityVal.textContent = `${e.target.value}%`;
        });
    }

    // Fill checkbox toggle
    if (dom.fillShapeCheckbox) {
        dom.fillShapeCheckbox.addEventListener('change', (e) => {
            state.fillShape = e.target.checked;
        });
    }

    // ----------------------------------------------------
    // ACTIONS BAR OPERATIONS (UNDO, GRID, DELETE, CLEAR, EXPORT)
    // ----------------------------------------------------
    
    // Undo
    if (dom.undoBtn) {
        dom.undoBtn.addEventListener('click', () => {
            socket.emit('undo-action');
        });
    }

    // Redo
    if (dom.redoBtn) {
        dom.redoBtn.addEventListener('click', () => {
            console.log("Redo button clicked on client!");
            socket.emit('redo-action');
        });
    }

    // Grid overlays
    if (dom.gridBtn && dom.gridOverlay) {
        dom.gridBtn.addEventListener('click', () => {
            const isShowing = dom.gridOverlay.classList.toggle('active');
            if (isShowing) {
                dom.gridBtn.classList.add('active');
                dom.gridOverlay.style.display = 'block';
            } else {
                dom.gridBtn.classList.remove('active');
                dom.gridOverlay.style.display = 'none';
            }
        });
    }

    // Selection Area Deletion
    if (dom.deleteSelectedBtn) {
        dom.deleteSelectedBtn.addEventListener('click', () => {
            if (!state.exportSelection || state.exportSelection.x === undefined) return;
            
            if (confirm("Are you sure you want to delete all drawings inside the selected area?")) {
                const sel = state.exportSelection;
                const newActions = [];
                let deletedAny = false;
                
                state.history.forEach(action => {
                    if (action.tool === 'brush' || action.tool === 'eraser') {
                        // Segment stroke slicing
                        let segments = [];
                        let currentSegment = [];
                        
                        action.points.forEach(p => {
                            const isInside = (p.x >= sel.x && p.x <= sel.x + sel.w && p.y >= sel.y && p.y <= sel.y + sel.h);
                            if (isInside) {
                                if (currentSegment.length >= 2) {
                                    segments.push(currentSegment);
                                }
                                currentSegment = [];
                                deletedAny = true;
                            } else {
                                currentSegment.push(p);
                            }
                        });
                        
                        if (currentSegment.length >= 2) {
                            segments.push(currentSegment);
                        }
                        
                        if (segments.length === 0) {
                            deletedAny = true;
                        } else {
                            segments.forEach((seg, index) => {
                                newActions.push({
                                    ...action,
                                    id: action.id + '-' + index,
                                    points: seg
                                });
                            });
                        }
                    } else {
                        // Shapes intersection checks
                        let shapeX, shapeY, shapeW, shapeH;
                        
                        if (action.tool === 'line') {
                            shapeX = Math.min(action.start.x, action.end.x);
                            shapeY = Math.min(action.start.y, action.end.y);
                            shapeW = Math.abs(action.start.x - action.end.x);
                            shapeH = Math.abs(action.start.y - action.end.y);
                        } else if (action.tool === 'rect') {
                            shapeX = Math.min(action.start.x, action.end.x);
                            shapeY = Math.min(action.start.y, action.end.y);
                            shapeW = Math.abs(action.start.x - action.end.x);
                            shapeH = Math.abs(action.start.y - action.end.y);
                        } else if (action.tool === 'circle') {
                            shapeX = Math.min(action.start.x, action.end.x);
                            shapeY = Math.min(action.start.y, action.end.y);
                            shapeW = Math.abs(action.start.x - action.end.x);
                            shapeH = Math.abs(action.start.y - action.end.y);
                        }
                        
                        const intersects = (shapeX < sel.x + sel.w && shapeX + shapeW > sel.x && shapeY < sel.y + sel.h && shapeY + shapeH > sel.y);
                        if (intersects) {
                            deletedAny = true;
                        } else {
                            newActions.push(action);
                        }
                    }
                });
                
                if (deletedAny) {
                    state.history = newActions;
                    saveLocalHistory();
                    redraw();
                    socket.emit('update-room-history', state.history);
                    showToast("Drawings inside selected area deleted!");
                } else {
                    showToast("No drawings found inside selected area.");
                }
                
                state.exportSelection = null;
                redraw();
            }
        });
    }

    // Clear board
    if (dom.clearBtn) {
        dom.clearBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to clear the entire collaborative canvas for everyone?")) {
                state.history = [];
                saveLocalHistory();
                redraw();
                socket.emit('clear-canvas');
            }
        });
    }

    // Export Canvas PNG
    if (dom.exportBtn) {
        dom.exportBtn.addEventListener('click', () => {
            if (!dom.canvas) return;
            
            const exportCanvas = document.createElement('canvas');
            const exportCtx = exportCanvas.getContext('2d');
            
            let exportW, exportH;
            let translateTranslation = { x: 0, y: 0 };
            
            if (state.exportSelection && state.exportSelection.x !== undefined) {
                exportW = state.exportSelection.w;
                exportH = state.exportSelection.h;
                translateTranslation = { x: -state.exportSelection.x, y: -state.exportSelection.y };
            } else {
                const rect = dom.canvas.getBoundingClientRect();
                exportW = rect.width;
                exportH = rect.height;
                translateTranslation = { x: state.offsetX, y: state.offsetY };
            }
            
            const dpr = window.devicePixelRatio || 1;
            exportCanvas.width = exportW * dpr;
            exportCanvas.height = exportH * dpr;
            
            exportCtx.scale(dpr, dpr);
            
            // Background fill color
            exportCtx.fillStyle = '#070913';
            exportCtx.fillRect(0, 0, exportW, exportH);
            
            exportCtx.save();
            exportCtx.translate(translateTranslation.x, translateTranslation.y);
            
            // Paint paths onto export canvas
            state.history.forEach(action => {
                exportCtx.save();
                exportCtx.lineCap = 'round';
                exportCtx.lineJoin = 'round';
                exportCtx.lineWidth = action.width;
                exportCtx.globalAlpha = action.opacity;
                
                if (action.tool === 'eraser') {
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
                        const x1 = action.start.x;
                        const y1 = action.start.y;
                        const x2 = action.end.x;
                        const y2 = action.end.y;
                        
                        const centerX = (x1 + x2) / 2;
                        const centerY = (y1 + y2) / 2;
                        const radiusX = Math.abs(x1 - x2) / 2;
                        const radiusY = Math.abs(y1 - y2) / 2;
                        
                        if (radiusX > 0 && radiusY > 0) {
                            exportCtx.beginPath();
                            exportCtx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
                            if (action.fill) {
                                exportCtx.fill();
                            }
                            exportCtx.stroke();
                        }
                    }
                }
                exportCtx.restore();
            });
            
            exportCtx.restore();
            
            const link = document.createElement('a');
            const typeLabel = state.exportSelection ? "selection" : "viewport";
            link.download = `codraw-${typeLabel}-${state.roomId}.png`;
            link.href = exportCanvas.toDataURL('image/png');
            link.click();
            
            showToast(`Board ${typeLabel} view exported successfully!`);
            
            if (state.exportSelection) {
                state.exportSelection = null;
                redraw();
            }
        });
    }

    // ----------------------------------------------------
    // INVITATION & COLLABORATOR PROFILES
    // ----------------------------------------------------
    
    // Copy invite link
    if (dom.inviteBtn) {
        dom.inviteBtn.addEventListener('click', () => {
            const inviteLink = `${window.location.origin}/room/${state.roomId}`;
            navigator.clipboard.writeText(inviteLink).then(() => {
                showToast("Invite link copied! Share it with friends.");
            }).catch(err => {
                console.error("Could not copy invite link: ", err);
                showToast("Failed to copy link. Please copy browser URL!");
            });
        });
    }

    // Initial credentials modal submit
    let selectedModalColor = '#6366f1';
    document.querySelectorAll('#username-modal .preset-colors .color-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            document.querySelectorAll('#username-modal .preset-colors .color-dot').forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            selectedModalColor = dot.dataset.color;
        });
    });

    if (dom.modalSubmitBtn) {
        dom.modalSubmitBtn.addEventListener('click', () => {
            if (!dom.modalUsernameInput) return;
            const inputName = dom.modalUsernameInput.value.trim();
            if (!inputName) {
                alert("Please enter a nickname to join the whiteboard!");
                return;
            }
            
            state.myUsername = inputName;
            state.myColor = selectedModalColor;
            saveLocalProfile();
            
            if (dom.settingsUsernameInput) {
                dom.settingsUsernameInput.value = state.myUsername;
            }
            
            document.querySelectorAll('#settings-colors .color-dot').forEach(dot => {
                if (dot.dataset.color === state.myColor) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            });
            
            if (dom.myNameDisplay) dom.myNameDisplay.textContent = state.myUsername;
            if (dom.myAvatarIndicator) dom.myAvatarIndicator.style.backgroundColor = state.myColor;
            
            socket.emit('update-username', state.myUsername);
            socket.emit('update-color', state.myColor);
            
            if (dom.usernameModal) dom.usernameModal.classList.remove('active');
            
            appendSystemMessage(`You have joined the room as "${state.myUsername}"!`);
        });
    }

    // Hide/Show Chat Side Drawer
    if (dom.toggleChatBtn && dom.chatSidebar) {
        dom.toggleChatBtn.addEventListener('click', () => {
            dom.chatSidebar.classList.remove('animate-slide-right');
            
            // Clear any inline styles to allow CSS classes to control layout cleanly
            dom.chatSidebar.style.transform = '';
            dom.chatSidebar.style.opacity = '';
            dom.chatSidebar.style.pointerEvents = '';
            
            if (dom.actionsBar) {
                dom.actionsBar.style.right = '';
            }
            
            const isHidden = dom.chatSidebar.classList.toggle('hidden');
            if (dom.appContainer) {
                dom.appContainer.classList.toggle('chat-hidden', isHidden);
            }
            
            if (isHidden) {
                dom.toggleChatBtn.classList.remove('active');
                dom.toggleChatBtn.querySelector('span').textContent = 'Show Chat';
                dom.toggleChatBtn.setAttribute('title', 'Show Chat Panel');
            } else {
                dom.toggleChatBtn.classList.add('active');
                dom.toggleChatBtn.querySelector('span').textContent = 'Hide Chat';
                dom.toggleChatBtn.setAttribute('title', 'Hide Chat Panel');
            }
            
            setTimeout(resizeCanvas, 460);
        });
    }

    // Settings Profile dropdown click behaviors
    if (dom.profileTrigger && dom.profileDropdown) {
        dom.profileTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = dom.profileDropdown.classList.toggle('active');
            dom.profileTrigger.classList.toggle('active', isActive);
        });
        
        dom.profileDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        document.addEventListener('click', () => {
            dom.profileDropdown.classList.remove('active');
            dom.profileTrigger.classList.remove('active');
        });
    }

    // Dynamic color picker settings panel
    let selectedSettingsColor = '';
    document.querySelectorAll('#settings-colors .color-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            document.querySelectorAll('#settings-colors .color-dot').forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            selectedSettingsColor = dot.dataset.color;
        });
    });

    if (dom.settingsSaveBtn) {
        dom.settingsSaveBtn.addEventListener('click', () => {
            if (!dom.settingsUsernameInput) return;
            const nameVal = dom.settingsUsernameInput.value.trim();
            if (!nameVal) {
                showToast("Please enter a valid nickname.");
                return;
            }
            
            state.myUsername = nameVal;
            if (selectedSettingsColor) {
                state.myColor = selectedSettingsColor;
            }
            saveLocalProfile();
            
            if (dom.myNameDisplay) dom.myNameDisplay.textContent = state.myUsername;
            if (dom.myAvatarIndicator) dom.myAvatarIndicator.style.backgroundColor = state.myColor;
            
            socket.emit('update-username', state.myUsername);
            socket.emit('update-color', state.myColor);
            
            if (dom.profileDropdown && dom.profileTrigger) {
                dom.profileDropdown.classList.remove('active');
                dom.profileTrigger.classList.remove('active');
            }
            showToast("Profile settings updated successfully!");
            
            updateCollaboratorsList();
        });
    }

    // Toggle View/Edit Mode Button Toggler
    if (dom.toggleModeBtn) {
        dom.toggleModeBtn.addEventListener('click', () => {
            state.isViewMode = !state.isViewMode;
            
            // Strip entrance animations to allow custom CSS class transitions to trigger seamlessly
            const toolbarContainer = document.getElementById('drawing-toolbar');
            const actionsBar = document.getElementById('actions-bar');
            if (toolbarContainer) toolbarContainer.classList.remove('animate-slide-left');
            if (actionsBar) actionsBar.classList.remove('animate-slide-up');
            
            // Toggle .view-mode class on app-container
            if (dom.appContainer) {
                dom.appContainer.classList.toggle('view-mode', state.isViewMode);
            }
            
            if (state.isViewMode) {
                // View Mode active
                dom.toggleModeBtn.classList.add('active-view');
                dom.toggleModeBtn.querySelector('span').textContent = 'Edit Mode';
                dom.toggleModeBtn.setAttribute('title', 'Switch to Edit Mode');
                
                // Replace eye icon with pencil icon
                dom.toggleModeBtn.querySelector('svg').innerHTML = '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path>';
                
                showToast("Whiteboard locked in View-Only Mode!");
                
                if (dom.canvas) {
                    dom.canvas.style.cursor = 'grab';
                }
            } else {
                // Edit Mode active
                dom.toggleModeBtn.classList.remove('active-view');
                dom.toggleModeBtn.querySelector('span').textContent = 'View Mode';
                dom.toggleModeBtn.setAttribute('title', 'Switch to View Mode');
                
                // Replace pencil icon back with eye icon
                dom.toggleModeBtn.querySelector('svg').innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
                
                showToast("Whiteboard unlocked! Edit Mode active.");
                
                if (dom.canvas) {
                    dom.canvas.style.cursor = state.currentTool === 'pan' ? 'grab' : 'crosshair';
                }
            }
        });
    }
}
