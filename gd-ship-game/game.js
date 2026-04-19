const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const msg = document.getElementById("msg");

canvas.width = 960;
canvas.height = 540;

const state = {
    running: false,
    gameOver: false,
    distance: 0,
    best: 0,
    speed: 12, // Impossible base speed
    time: 0,
    particles: [],
    obstacles: [],
    shake: 0
};

const ship = {
    x: 150,
    y: 270,
    width: 30,
    height: 22,
    vy: 0,
    thrust: -1.2,
    gravity: 0.7,
    rotation: 0,
    color: "#ff00ff"
};

const keys = {};
window.addEventListener("keydown", e => {
    keys[e.code] = true;
    if (e.code === "Space" && !state.running) startGame();
});
window.addEventListener("keyup", e => keys[e.code] = false);
canvas.addEventListener("mousedown", () => {
    keys["Space"] = true;
    if (!state.running) startGame();
});
canvas.addEventListener("mouseup", () => keys["Space"] = false);

function startGame() {
    if (state.gameOver) resetGame();
    state.running = true;
    overlay.style.display = "none";
}

function resetGame() {
    state.gameOver = false;
    state.distance = 0;
    state.speed = 12;
    state.time = 0;
    ship.y = 270;
    ship.vy = 0;
    state.obstacles = [];
    state.particles = [];
}

function createParticle(x, y, color, size = 5) {
    state.particles.push({
        x, y,
        vx: -state.speed - Math.random() * 5,
        vy: (Math.random() - 0.5) * 4,
        size: Math.random() * size + 2,
        life: 1.0,
        color
    });
}

function spawnObstacle() {
    const gap = 130 - Math.min(state.distance / 50, 65); // Tiny, shrinking gap
    const minHeight = 80;
    const maxHeight = canvas.height - gap - 80;
    const topHeight = Math.random() * (maxHeight - minHeight) + minHeight;

    state.obstacles.push({
        x: canvas.width + 100,
        topHeight: topHeight,
        bottomY: topHeight + gap,
        width: 50,
        passed: false,
        moveDir: Math.random() > 0.5 ? 1 : -1,
        moveSpeed: Math.random() * 5 + 2 // Very fast moving pillars
    });
}

function update() {
    if (!state.running) return;

    state.time++;
    state.distance += state.speed / 10;
    state.speed += 0.005; // Constant aggressive acceleration
    
    state.shake = Math.max(state.shake, 3); // Continuous shake

    if (keys["Space"]) {
        ship.vy += ship.thrust;
        createParticle(ship.x, ship.y + ship.height/2, "#00ffff", 5);
    }
    ship.vy += ship.gravity;
    ship.vy *= 0.99;
    ship.y += ship.vy;

    if (ship.y < 0 || ship.y + ship.height > canvas.height) die();

    ship.rotation = Math.max(-0.7, Math.min(0.7, ship.vy * 0.08));

    if (state.time % 45 === 0) spawnObstacle(); // Fast obstacle frequency

    for (let i = state.obstacles.length - 1; i >= 0; i--) {
        const o = state.obstacles[i];
        o.x -= state.speed;
        
        o.topHeight += o.moveDir * o.moveSpeed;
        o.bottomY += o.moveDir * o.moveSpeed;
        if (o.topHeight < 20 || o.bottomY > canvas.height - 20) o.moveDir *= -1;

        if (ship.x + ship.width > o.x && ship.x < o.x + o.width) {
            if (ship.y < o.topHeight || ship.y + ship.height > o.bottomY) {
                die();
            }
        }

        if (o.x + o.width < -100) state.obstacles.splice(i, 1);
    }

    for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        if (p.life <= 0) state.particles.splice(i, 1);
    }

    scoreEl.innerText = `DISTANCE: ${Math.floor(state.distance)}m`;
}

function die() {
    state.gameOver = true;
    state.running = false;
    state.shake = 30;
    if (state.distance > state.best) {
        state.best = Math.floor(state.distance);
        bestEl.innerText = `BEST: ${state.best}m`;
    }
    
    for(let i=0; i<40; i++) createParticle(ship.x + 15, ship.y + 11, "#ff00ff", 12);
    
    msg.innerText = "YOU CRASHED!";
    overlay.style.display = "block";
}

function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    if (state.shake > 0) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
        state.shake *= 0.9;
    }

    ctx.strokeStyle = "#111";
    const offset = (state.time * state.speed) % 100;
    for (let x = -offset; x < canvas.width; x += 100) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }

    state.particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;

    state.obstacles.forEach(o => {
        const grad = ctx.createLinearGradient(o.x, 0, o.x + o.width, 0);
        grad.addColorStop(0, "#330033");
        grad.addColorStop(0.5, "#ff00ff");
        grad.addColorStop(1, "#330033");
        
        ctx.fillStyle = grad;
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#ff00ff";
        
        ctx.fillRect(o.x, 0, o.width, o.topHeight);
        ctx.fillRect(o.x, o.bottomY, o.width, canvas.height - o.bottomY);
        
        ctx.shadowBlur = 0;
    });

    if (!state.gameOver) {
        ctx.save();
        ctx.translate(ship.x + ship.width/2, ship.y + ship.height/2);
        ctx.rotate(ship.rotation);
        
        ctx.fillStyle = ship.color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = ship.color;
        
        ctx.beginPath();
        ctx.moveTo(-ship.width/2, -ship.height/2);
        ctx.lineTo(ship.width/2, 0);
        ctx.lineTo(-ship.width/2, ship.height/2);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = "#00ffff";
        ctx.fillRect(0, -5, 10, 10);
        
        ctx.restore();
    }

    ctx.restore();

    requestAnimationFrame(() => {
        update();
        draw();
    });
}

draw();