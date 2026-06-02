// CoDraw DOM References Manager

export const dom = {
    // Canvas & overlays
    canvas: document.getElementById('paint-canvas'),
    ctx: document.getElementById('paint-canvas').getContext('2d'),
    minimapCanvas: document.getElementById('minimap-canvas'),
    minimapCtx: document.getElementById('minimap-canvas') ? document.getElementById('minimap-canvas').getContext('2d') : null,
    gridOverlay: document.getElementById('grid-overlay'),
    cursorsContainer: document.getElementById('cursors-container'),
    
    // Header & room identifiers
    roomDisplay: document.getElementById('room-id-display'),
    userCountDisplay: document.getElementById('user-count'),
    collaboratorsList: document.getElementById('collaborators-list'),
    myNameDisplay: document.getElementById('my-name-display'),
    myAvatarIndicator: document.getElementById('my-avatar-indicator'),
    inviteBtn: document.getElementById('invite-btn'),
    toggleChatBtn: document.getElementById('toggle-chat-btn'),
    toggleModeBtn: document.getElementById('toggle-mode-btn'),
    
    // Sidebar drawer elements
    chatSidebar: document.getElementById('chat-sidebar'),
    appContainer: document.querySelector('.app-container'),
    chatMessages: document.getElementById('chat-messages'),
    chatForm: document.getElementById('chat-form'),
    chatInput: document.getElementById('chat-input'),
    
    // Left Toolbar controls
    brushSizeVal: document.getElementById('brush-size-val'),
    brushOpacityVal: document.getElementById('brush-opacity-val'),
    brushSizeInput: document.getElementById('brush-size'),
    brushOpacityInput: document.getElementById('brush-opacity'),
    fillShapeCheckbox: document.getElementById('fill-shape'),
    customColorInput: document.getElementById('custom-color'),
    
    // Bottom actions bar
    actionsBar: document.getElementById('actions-bar'),
    undoBtn: document.getElementById('action-undo'),
    redoBtn: document.getElementById('action-redo'),
    gridBtn: document.getElementById('action-grid'),
    deleteSelectedBtn: document.getElementById('action-delete-selected'),
    clearBtn: document.getElementById('action-clear'),
    exportBtn: document.getElementById('action-export'),
    
    // Modals, Dropdowns & Popups
    usernameModal: document.getElementById('username-modal'),
    modalUsernameInput: document.getElementById('modal-username'),
    modalSubmitBtn: document.getElementById('modal-submit'),
    profileTrigger: document.getElementById('profile-trigger'),
    profileDropdown: document.getElementById('profile-dropdown'),
    settingsUsernameInput: document.getElementById('settings-username'),
    settingsSaveBtn: document.getElementById('settings-save'),
    toastElement: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message')
};
