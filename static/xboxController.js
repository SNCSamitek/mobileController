class User {
    static numberOfPlayers = 0;

    Lshoulder = false; Rshoulder = false;
    Ltrigger = false; Rtrigger = false;
    leftPos = [0.0, 0.0];
    rightPos = [0.0, 0.0];
    faceButtons = new Set();
    DPadButtons = new Set();
    playerID = 0;

    constructor() {
        User.numberOfPlayers++;
        this.playerID = User.numberOfPlayers;
    }

    updatePosX(stick, x) {
        if (stick === "left") this.leftPos[0] = Math.max(-1, Math.min(1, x));
        else this.rightPos[0] = Math.max(-1, Math.min(1, x));
    }

    updatePosY(stick, y) {
        if (stick === "left") this.leftPos[1] = Math.max(-1, Math.min(1, y));
        else this.rightPos[1] = Math.max(-1, Math.min(1, y));
    }

    updateFaceButtons(key, action) {
        action === "pressed" ? this.faceButtons.add(key) : this.faceButtons.delete(key);
    }

    updateDPadButtons(key, action) {
        action === "pressed" ? this.DPadButtons.add(key) : this.DPadButtons.delete(key);
    }

    updateDigitalButtons(buttonName, state) {
        switch (buttonName) {
            case "L1": this.Lshoulder = state; break;
            case "R1": this.Rshoulder = state; break;
            case "L2": this.Ltrigger = state; break;
            case "R2": this.Rtrigger = state; break;
        }
    }

    getStateForServer() {
        return {
            playerID: this.playerID,
            leftStick: { x: this.leftPos[0], y: this.leftPos[1] },
            rightStick: { x: this.rightPos[0], y: this.rightPos[1] },
            L1: this.Lshoulder,
            R1: this.Rshoulder,
            L2: this.Ltrigger,
            R2: this.Rtrigger,
            faceButtons: Array.from(this.faceButtons),
            DPadButtons: Array.from(this.DPadButtons)
        };
    }
}

const user = new User();

// ============ WebSocket Setup ============
let ws = null;
let reconnectAttempts = 0;
let sendInterval = null;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 3000;
const SEND_RATE = 16; // ~60Hz

function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log(`Connecting to WebSocket: ${wsUrl}`);
    
    try {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log("✓ WebSocket connected!");
            reconnectAttempts = 0;
            startSendingState();
        };
        
        ws.onclose = (event) => {
            console.log(`✗ WebSocket disconnected: ${event.code}`);
            stopSendingState();
            attemptReconnect();
        };
        
        ws.onerror = (error) => {
            console.error("✗ WebSocket error:", error);
        };
        
    } catch (error) {
        console.error("Failed to create WebSocket:", error);
        attemptReconnect();
    }
}

function startSendingState() {
    if (sendInterval) clearInterval(sendInterval);
    
    sendInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            try {
                const state = user.getStateForServer();
                ws.send(JSON.stringify(state));
            } catch (error) {
                console.error("Error sending state:", error);
            }
        }
    }, SEND_RATE);
}

function stopSendingState() {
    if (sendInterval) {
        clearInterval(sendInterval);
        sendInterval = null;
    }
}

function attemptReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error(`Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts`);
        return;
    }
    
    reconnectAttempts++;
    const delay = RECONNECT_DELAY * Math.min(reconnectAttempts, 3);
    
    console.log(`Reconnecting in ${delay/1000}s... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
    
    setTimeout(connectWebSocket, delay);
}

// Start WebSocket connection when page loads
connectWebSocket();

// ============ Touch Controls ============
let activeTouches = {};

const sticks = {
    left: { cap: null, container: null, center: {x:0,y:0}, maxRadius:0 },
    right: { cap: null, container: null, center: {x:0,y:0}, maxRadius:0 }
};

document.querySelectorAll(".joystick-cap").forEach(cap => {
    const stickName = cap.dataset.type;
    const container = cap.parentElement;
    sticks[stickName].cap = cap;
    sticks[stickName].container = container;

    cap.addEventListener("touchstart", e => {
        for (let touch of e.changedTouches) {
            activeTouches[touch.identifier] = { type: "stick", stick: stickName };
            startDrag(stickName, touch);
        }
        e.preventDefault();
    }, {passive:false});
});

// Buttons
document.querySelectorAll("button").forEach(btn => {
    const type = btn.dataset.type;
    const key = btn.dataset.key;

    btn.addEventListener("touchstart", e => {
        for (let touch of e.changedTouches) {
            activeTouches[touch.identifier] = { type: "button", typeName:type, key:key };
            handlePress(type, key);
        }
        e.preventDefault();
    }, {passive:false});

    btn.addEventListener("touchend", e => {
        for (let touch of e.changedTouches) {
            const info = activeTouches[touch.identifier];
            if(info && info.type === "button"){
                handleRelease(info.typeName, info.key);
                delete activeTouches[touch.identifier];
            }
        }
        e.preventDefault();
    }, {passive:false});
});

// Handle joystick movement
document.addEventListener("touchmove", e => {
    for (let touch of e.touches) {
        const info = activeTouches[touch.identifier];
        if(info && info.type === "stick") updateStick(info.stick, touch);
    }
    e.preventDefault();
}, {passive:false});

// End touches - ONLY handle joysticks, buttons handle themselves
document.addEventListener("touchend", e => {
    for (let touch of e.changedTouches) {
        const info = activeTouches[touch.identifier];
        if(info && info.type === "stick") {
            resetStick(info.stick);
            delete activeTouches[touch.identifier];
        }
    }
});

// Joystick functions
function startDrag(stickName, touch){
    const stick = sticks[stickName];
    const rect = stick.container.getBoundingClientRect();
    stick.center.x = rect.left + rect.width/2;
    stick.center.y = rect.top + rect.height/2;
    stick.maxRadius = rect.width/2 - stick.cap.offsetWidth/2;
    updateStick(stickName, touch);
}

function updateStick(stickName, touch){
    const stick = sticks[stickName];
    let dx = touch.clientX - stick.center.x;
    let dy = touch.clientY - stick.center.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if(dist > stick.maxRadius){
        const ratio = stick.maxRadius / dist;
        dx *= ratio;
        dy *= ratio;
    }
    const normX = dx / stick.maxRadius;
    const normY = -dy / stick.maxRadius;

    user.updatePosX(stickName, normX);
    user.updatePosY(stickName, normY);

    stick.cap.style.transform = `translate(${dx}px, ${dy}px)`;
}

function resetStick(stickName){
    const stick = sticks[stickName];
    stick.cap.style.transform = "translate(0px,0px)";
    user.updatePosX(stickName, 0);
    user.updatePosY(stickName, 0);
}

// Button helpers
function handlePress(type, key){
    switch(type){
        case "dpad": user.updateDPadButtons(key,"pressed"); break;
        case "face": user.updateFaceButtons(key,"pressed"); break;
        case "digital": user.updateDigitalButtons(key,true); break;
    }
}

function handleRelease(type, key){
    switch(type){
        case "dpad": user.updateDPadButtons(key,"released"); break;
        case "face": user.updateFaceButtons(key,"released"); break;
        case "digital": user.updateDigitalButtons(key,false); break;
    }
}