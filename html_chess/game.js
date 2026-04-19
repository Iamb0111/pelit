const canvas = document.getElementById('chessCanvas');
const ctx = canvas.getContext('2d');
const chess = new Chess();

// DOM Elements
const menuScreen = document.getElementById('menu');
const gameScreen = document.getElementById('game-ui');
const btnEasy = document.getElementById('btn-easy');
const btnNormal = document.getElementById('btn-normal');
const btnRestart = document.getElementById('btn-restart');
const timerEl = document.getElementById('timer');
const turnIndicator = document.getElementById('turn-indicator');
const gameOverOverlay = document.getElementById('game-over');
const goText = document.getElementById('go-text');

// Constants
const SQ = 100;
const C_LIGHT = '#ebecd0';
const C_DARK = '#739552';
const C_LAST_MOVE = 'rgba(255, 255, 51, 0.47)';
const C_HIGHLIGHT = 'rgba(20, 85, 30, 0.4)';
const C_CHECK = 'rgba(220, 50, 50, 0.8)';
const C_DOT = 'rgba(20, 20, 20, 0.25)';

// State
let difficulty = 2; // 1 = Casual, 2 = Advanced
let botThinking = false;
let selectedSq = null;
let lastMove = null;
let activeAnim = null;
let gameTimer = 0;
let lastTick = 0;
let rafId = null;
let isMenu = true;

// Load Images
const PIECES = ["wp", "wn", "wb", "wr", "wq", "wk", "bp", "bn", "bb", "br", "bq", "bk"];
const PIECE_IMAGES = {};
let imagesLoaded = 0;

PIECES.forEach(p => {
    const img = new Image();
    img.src = `https://images.chesscomfiles.com/chess-themes/pieces/neo/150/${p}.png`;
    img.onload = () => {
        imagesLoaded++;
        PIECE_IMAGES[p] = img;
        if (imagesLoaded === PIECES.length && !isMenu) draw();
    };
});

// --- AI LOGIC ---
const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

const PAWN_PST = [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0
];
const KNIGHT_PST = [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50
];
const BISHOP_PST = [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20
];
const ROOK_PST = [
      0,  0,  0,  0,  0,  0,  0,  0,
      5, 10, 10, 10, 10, 10, 10,  5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
      0,  0,  0,  5,  5,  0,  0,  0
];
const QUEEN_PST = [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20
];
const KING_PST = [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20
];

const PST = {
    p: PAWN_PST, n: KNIGHT_PST, b: BISHOP_PST,
    r: ROOK_PST, q: QUEEN_PST, k: KING_PST
};

function evaluateBoard(ch) {
    if (ch.in_checkmate()) {
        return ch.turn() === 'w' ? -99999 : 99999;
    }
    if (ch.in_draw() || ch.in_stalemate() || ch.in_threefold_repetition()) {
        return 0;
    }

    let score = 0;
    const boardArr = ch.board(); // 8x8 array. row 0 is rank 8, row 7 is rank 1.
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = boardArr[r][c];
            if (piece) {
                const val = PIECE_VALUES[piece.type];
                const pst = PST[piece.type];
                
                // For white, rank 8 is top (r=0), rank 1 is bottom (r=7).
                // Standard PST assumes index 0 is a8 (top-left). So row * 8 + col is fine for White?
                // Wait, PST is top-to-bottom. For White, a pawn on rank 2 (bottom) should have low value, rank 7 (top) high value.
                // Our PAWN_PST has 50s at index 8-15 (rank 7). So index = r * 8 + c is perfect for White.
                // For Black, we mirror it (rank 2 is top for black).
                
                if (piece.color === 'w') {
                    score += val + pst[r * 8 + c];
                } else {
                    score -= (val + pst[(7 - r) * 8 + c]);
                }
            }
        }
    }
    return score;
}

function orderMoves(ch) {
    const moves = ch.moves({ verbose: true });
    // Sort captures/promotions first
    moves.sort((a, b) => {
        const aVal = (a.flags.includes('c') || a.flags.includes('p')) ? 1 : 0;
        const bVal = (b.flags.includes('c') || b.flags.includes('p')) ? 1 : 0;
        return bVal - aVal;
    });
    return moves;
}

function minimax(ch, depth, alpha, beta, maximizing) {
    if (depth === 0) return evaluateBoard(ch);
    
    const moves = orderMoves(ch);
    if (moves.length === 0) {
        if (ch.in_check()) return ch.turn() === 'w' ? -99999 : 99999;
        return 0;
    }

    if (maximizing) {
        let maxE = -Infinity;
        for (const move of moves) {
            ch.move(move);
            const evalS = minimax(ch, depth - 1, alpha, beta, false);
            ch.undo();
            maxE = Math.max(maxE, evalS);
            alpha = Math.max(alpha, evalS);
            if (beta <= alpha) break;
        }
        return maxE;
    } else {
        let minE = Infinity;
        for (const move of moves) {
            ch.move(move);
            const evalS = minimax(ch, depth - 1, alpha, beta, true);
            ch.undo();
            minE = Math.min(minE, evalS);
            beta = Math.min(beta, evalS);
            if (beta <= alpha) break;
        }
        return minE;
    }
}

function getBestMove(ch, depth) {
    const moves = orderMoves(ch);
    if (moves.length === 0) return null;
    
    let bestMove = moves[0];
    
    if (ch.turn() === 'w') {
        let bestEval = -Infinity;
        for (const move of moves) {
            ch.move(move);
            const e = minimax(ch, depth - 1, -Infinity, Infinity, false);
            ch.undo();
            if (e > bestEval) {
                bestEval = e;
                bestMove = move;
            }
        }
    } else {
        let bestEval = Infinity;
        for (const move of moves) {
            ch.move(move);
            const e = minimax(ch, depth - 1, -Infinity, Infinity, true);
            ch.undo();
            if (e < bestEval) {
                bestEval = e;
                bestMove = move;
            }
        }
    }
    return bestMove;
}

function thinkBotMove() {
    botThinking = true;
    turnIndicator.innerText = "AI is thinking...";
    turnIndicator.style.color = "#aaaaaa";
    
    // Use setTimeout to yield frame to UI so "AI is thinking" renders
    setTimeout(() => {
        let move;
        if (difficulty === 1 && Math.random() < 0.4) {
            const moves = chess.moves({verbose: true});
            move = moves[Math.floor(Math.random() * moves.length)];
        } else {
            move = getBestMove(chess, difficulty);
        }
        
        if (move) {
            // Setup animation
            const fromSq = move.from;
            const toSq = move.to;
            const p = chess.get(fromSq);
            const pKey = p.color + p.type;
            
            // Calc coords
            const files = "abcdefgh";
            const startX = files.indexOf(fromSq[0]) * SQ;
            const startY = (8 - parseInt(fromSq[1])) * SQ;
            const endX = files.indexOf(toSq[0]) * SQ;
            const endY = (8 - parseInt(toSq[1])) * SQ;
            
            activeAnim = {
                pKey,
                startX, startY, endX, endY,
                progress: 0,
                speed: 0.15,
                done: false
            };
            
            chess.move(move);
            lastMove = move;
        }
        
        botThinking = false;
        turnIndicator.innerText = "Your Turn";
        turnIndicator.style.color = "#50ff50";
        checkGameOver();
    }, 50);
}

// --- DRAWING ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Board
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            ctx.fillStyle = (r + c) % 2 === 0 ? C_LIGHT : C_DARK;
            ctx.fillRect(c * SQ, r * SQ, SQ, SQ);
            
            // Coords
            ctx.fillStyle = (r + c) % 2 === 0 ? C_DARK : C_LIGHT;
            ctx.font = "bold 14px Segoe UI";
            if (c === 0) ctx.fillText(8 - r, 5, r * SQ + 15);
            if (r === 7) ctx.fillText("abcdefgh"[c], c * SQ + 85, r * SQ + 95);
        }
    }
    
    // Highlights
    if (lastMove) {
        ctx.fillStyle = C_LAST_MOVE;
        const files = "abcdefgh";
        const c1 = files.indexOf(lastMove.from[0]);
        const r1 = 8 - parseInt(lastMove.from[1]);
        const c2 = files.indexOf(lastMove.to[0]);
        const r2 = 8 - parseInt(lastMove.to[1]);
        ctx.fillRect(c1 * SQ, r1 * SQ, SQ, SQ);
        ctx.fillRect(c2 * SQ, r2 * SQ, SQ, SQ);
    }
    
    if (chess.in_check()) {
        // Find king
        const b = chess.board();
        let kR = -1, kC = -1;
        const turn = chess.turn();
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (b[r][c] && b[r][c].type === 'k' && b[r][c].color === turn) {
                    kR = r; kC = c;
                }
            }
        }
        if (kR !== -1) {
            const rad = ctx.createRadialGradient(kC*SQ + 50, kR*SQ + 50, 0, kC*SQ + 50, kR*SQ + 50, 50);
            rad.addColorStop(0, 'rgba(255, 50, 50, 0.9)');
            rad.addColorStop(1, 'rgba(255, 50, 50, 0)');
            ctx.fillStyle = rad;
            ctx.fillRect(kC*SQ, kR*SQ, SQ, SQ);
        }
    }
    
    if (selectedSq) {
        const files = "abcdefgh";
        const c = files.indexOf(selectedSq[0]);
        const r = 8 - parseInt(selectedSq[1]);
        ctx.fillStyle = C_HIGHLIGHT;
        ctx.fillRect(c * SQ, r * SQ, SQ, SQ);
        
        // Valid moves
        const moves = chess.moves({square: selectedSq, verbose: true});
        for (const m of moves) {
            const tc = files.indexOf(m.to[0]);
            const tr = 8 - parseInt(m.to[1]);
            
            ctx.beginPath();
            if (chess.get(m.to)) { // Capture
                ctx.arc(tc*SQ + 50, tr*SQ + 50, 45, 0, Math.PI*2);
                ctx.lineWidth = 6;
                ctx.strokeStyle = C_DOT;
                ctx.stroke();
            } else {
                ctx.arc(tc*SQ + 50, tr*SQ + 50, 15, 0, Math.PI*2);
                ctx.fillStyle = C_DOT;
                ctx.fill();
            }
        }
    }
    
    // Draw Pieces
    const boardArr = chess.board();
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = boardArr[r][c];
            if (p) {
                // Skip if animating this end square
                if (activeAnim && !activeAnim.done && c*SQ === activeAnim.endX && r*SQ === activeAnim.endY) {
                    continue;
                }
                const pKey = p.color + p.type;
                if (PIECE_IMAGES[pKey]) {
                    ctx.drawImage(PIECE_IMAGES[pKey], c * SQ, r * SQ, SQ, SQ);
                }
            }
        }
    }
    
    // Draw Animation
    if (activeAnim && !activeAnim.done) {
        let t = activeAnim.progress - 1;
        let eased = t * t * t + 1; // Cubic ease out
        
        let cx = activeAnim.startX + (activeAnim.endX - activeAnim.startX) * eased;
        let cy = activeAnim.startY + (activeAnim.endY - activeAnim.startY) * eased;
        
        if (PIECE_IMAGES[activeAnim.pKey]) {
            // Shadow
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = "black";
            // A simple circular shadow
            ctx.beginPath();
            ctx.ellipse(cx + 50, cy + 85, 25, 10, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
            
            ctx.drawImage(PIECE_IMAGES[activeAnim.pKey], cx, cy, SQ, SQ);
        }
        
        activeAnim.progress += activeAnim.speed;
        if (activeAnim.progress >= 1.0) activeAnim.done = true;
    }
}

// --- GAME LOOP ---
function updateTimer() {
    if (isMenu || chess.game_over() || activeAnim) return;
    
    const now = performance.now();
    const dt = (now - lastTick) / 1000.0;
    lastTick = now;
    gameTimer += dt;
    
    const m = Math.floor(gameTimer / 60).toString().padStart(2, '0');
    const s = Math.floor(gameTimer % 60).toString().padStart(2, '0');
    timerEl.innerText = `${m}:${s}`;
}

function checkGameOver() {
    if (chess.game_over()) {
        gameOverOverlay.classList.remove('hidden');
        if (chess.in_checkmate()) {
            goText.innerText = chess.turn() === 'w' ? "Black Wins!" : "White Wins!";
        } else {
            goText.innerText = "Draw!";
        }
    }
}

function loop() {
    if (!isMenu) {
        updateTimer();
        draw();
        
        // Auto trigger bot if needed and not animating
        if (chess.turn() === 'b' && !botThinking && !chess.game_over() && (!activeAnim || activeAnim.done)) {
            thinkBotMove();
        }
    }
    rafId = requestAnimationFrame(loop);
}

// --- INPUT ---
canvas.addEventListener('mousedown', (e) => {
    if (botThinking || activeAnim && !activeAnim.done || chess.game_over() || chess.turn() !== 'w') return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const c = Math.floor(x / SQ);
    const r = Math.floor(y / SQ);
    const files = "abcdefgh";
    const sq = files[c] + (8 - r);
    
    if (selectedSq === sq) {
        selectedSq = null;
    } else if (selectedSq) {
        // Try move
        const moves = chess.moves({verbose: true});
        let moveObj = null;
        for (const m of moves) {
            if (m.from === selectedSq && m.to === sq) {
                // Auto promote to Queen if possible
                if (m.flags.includes('n') || m.flags.includes('c') || m.flags.includes('p')) {
                    if ((m.piece === 'p') && (m.to[1] === '8' || m.to[1] === '1')) {
                        if(m.promotion === 'q') moveObj = m; // Select queen promotion
                    } else {
                        moveObj = m;
                    }
                } else {
                    moveObj = m;
                }
            }
        }
        
        if (moveObj) {
            // Animate
            const pKey = moveObj.color + moveObj.piece;
            activeAnim = {
                pKey,
                startX: files.indexOf(moveObj.from[0])*SQ, startY: (8-parseInt(moveObj.from[1]))*SQ,
                endX: files.indexOf(moveObj.to[0])*SQ, endY: (8-parseInt(moveObj.to[1]))*SQ,
                progress: 0, speed: 0.15, done: false
            };
            
            chess.move(moveObj);
            lastMove = moveObj;
            selectedSq = null;
            checkGameOver();
        } else {
            const p = chess.get(sq);
            selectedSq = (p && p.color === 'w') ? sq : null;
        }
    } else {
        const p = chess.get(sq);
        selectedSq = (p && p.color === 'w') ? sq : null;
    }
});

// --- MENU CONTROLS ---
function startGame(diff) {
    difficulty = diff;
    isMenu = false;
    chess.reset();
    gameTimer = 0;
    selectedSq = null;
    lastMove = null;
    activeAnim = null;
    botThinking = false;
    lastTick = performance.now();
    
    menuScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    gameOverOverlay.classList.add('hidden');
    
    turnIndicator.innerText = "Your Turn";
    turnIndicator.style.color = "#50ff50";
    
    if(!rafId) loop();
}

btnEasy.addEventListener('click', () => startGame(1));
btnNormal.addEventListener('click', () => startGame(2));

btnRestart.addEventListener('click', () => {
    isMenu = true;
    gameScreen.classList.add('hidden');
    menuScreen.classList.remove('hidden');
});
