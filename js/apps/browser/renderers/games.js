/**
 * halo://snake, halo://2048, halo://tetris — three retro games.
 * All games register their cleanup via the browser instance's cleanup hook so
 * intervals/listeners die when the tab navigates away or window closes.
 */
export async function render(viewport, browser, tab, { params }) {
  const url = tab.url;
  const game = url.includes('2048') ? '2048' : url.includes('tetris') ? 'tetris' : 'snake';
  browser.setTabTitle(tab, `${game.toUpperCase()} — Halo Games`);

  viewport.innerHTML = `
    <div class="games-root">
      <header class="games-header">
        <h1>Halo Games</h1>
        <nav class="games-nav">
          <button class="${game === 'snake' ? 'active' : ''}" data-game="snake">🐍 Snake</button>
          <button class="${game === '2048' ? 'active' : ''}" data-game="2048">🔢 2048</button>
          <button class="${game === 'tetris' ? 'active' : ''}" data-game="tetris">🧱 Tetris</button>
        </nav>
      </header>
      <div class="games-stage" id="games-stage"></div>
    </div>
  `;
  viewport.querySelectorAll('.games-nav button').forEach(b => {
    b.addEventListener('click', () => browser.navigate(`halo://${b.dataset.game}`));
  });

  const stage = viewport.querySelector('#games-stage');
  if (game === 'snake') mountSnake(stage, browser, tab);
  else if (game === '2048') mountG2048(stage, browser, tab);
  else mountTetris(stage, browser, tab);
}

function mountSnake(stage, browser, tab) {
  stage.innerHTML = `
    <div class="snake-game">
      <div class="snake-meta"><span id="snake-score">Score: 0</span><button id="snake-restart">Restart</button></div>
      <canvas id="snake-canvas" width="360" height="360"></canvas>
      <p class="games-hint">Arrow keys or WASD to navigate.</p>
    </div>
  `;
  const canvas = stage.querySelector('#snake-canvas');
  const ctx = canvas.getContext('2d');
  const N = 18;
  const C = canvas.width / N;
  let snake, dx, dy, food, score, interval;

  const start = () => {
    snake = [{ x: 9, y: 9 }];
    dx = 1; dy = 0; score = 0;
    spawnFood();
    stage.querySelector('#snake-score').textContent = 'Score: 0';
    if (interval) clearInterval(interval);
    interval = setInterval(tick, 110);
  };
  const spawnFood = () => { food = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) }; };

  const tick = () => {
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };
    if (head.x < 0 || head.y < 0 || head.x >= N || head.y >= N || snake.some(s => s.x === head.x && s.y === head.y)) {
      clearInterval(interval); interval = null;
      ctx.fillStyle = '#ff3b30'; ctx.font = '24px sans-serif';
      ctx.fillText('GAME OVER', canvas.width / 2 - 70, canvas.height / 2);
      return;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      stage.querySelector('#snake-score').textContent = `Score: ${score}`;
      spawnFood();
    } else snake.pop();

    ctx.fillStyle = '#0c0f13'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#39ff14';
    snake.forEach(s => ctx.fillRect(s.x * C + 1, s.y * C + 1, C - 2, C - 2));
    ctx.fillStyle = '#ff007f';
    ctx.fillRect(food.x * C + 2, food.y * C + 2, C - 4, C - 4);
  };

  const onKey = (e) => {
    const k = e.key.toLowerCase();
    if ((k === 'arrowup' || k === 'w') && dy === 0) { dx = 0; dy = -1; e.preventDefault(); }
    else if ((k === 'arrowdown' || k === 's') && dy === 0) { dx = 0; dy = 1; e.preventDefault(); }
    else if ((k === 'arrowleft' || k === 'a') && dx === 0) { dx = -1; dy = 0; e.preventDefault(); }
    else if ((k === 'arrowright' || k === 'd') && dx === 0) { dx = 1; dy = 0; e.preventDefault(); }
  };
  canvas.tabIndex = 0; canvas.addEventListener('keydown', onKey); canvas.focus();
  stage.querySelector('#snake-restart').addEventListener('click', () => { start(); canvas.focus(); });
  start();

  browser.registerTabCleanup(tab.id, () => { if (interval) clearInterval(interval); });
}

function mountG2048(stage, browser, tab) {
  stage.innerHTML = `
    <div class="g2048-game">
      <div class="g2048-meta"><span id="g2048-score">Score: 0</span><button id="g2048-restart">Restart</button></div>
      <div class="g2048-grid" id="g2048-grid"></div>
      <p class="games-hint">Arrow keys to combine tiles. Reach 2048.</p>
    </div>
  `;
  const grid = stage.querySelector('#g2048-grid');
  let board, score;

  const reset = () => {
    board = Array.from({ length: 4 }, () => Array(4).fill(0));
    score = 0;
    addRandom(); addRandom(); paint();
  };
  const addRandom = () => {
    const empties = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (!board[r][c]) empties.push([r, c]);
    if (!empties.length) return;
    const [r, c] = empties[Math.floor(Math.random() * empties.length)];
    board[r][c] = Math.random() < 0.9 ? 2 : 4;
  };
  const paint = () => {
    grid.innerHTML = '';
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const v = board[r][c];
      const t = document.createElement('div');
      t.className = `g2048-tile val-${v}`;
      t.textContent = v || '';
      grid.appendChild(t);
    }
    stage.querySelector('#g2048-score').textContent = `Score: ${score}`;
  };
  const slide = (row) => {
    const arr = row.filter(v => v);
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] === arr[i + 1]) { arr[i] *= 2; score += arr[i]; arr.splice(i + 1, 1); }
    }
    while (arr.length < 4) arr.push(0);
    return arr;
  };
  const move = (dir) => {
    const before = JSON.stringify(board);
    if (dir === 'left') board = board.map(slide);
    if (dir === 'right') board = board.map(r => slide([...r].reverse()).reverse());
    if (dir === 'up') {
      for (let c = 0; c < 4; c++) { const col = slide([board[0][c], board[1][c], board[2][c], board[3][c]]); col.forEach((v, r) => board[r][c] = v); }
    }
    if (dir === 'down') {
      for (let c = 0; c < 4; c++) { const col = slide([board[3][c], board[2][c], board[1][c], board[0][c]]); col.forEach((v, r) => board[3 - r][c] = v); }
    }
    if (JSON.stringify(board) !== before) addRandom();
    paint();
  };
  const onKey = (e) => {
    const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    const dir = map[e.key];
    if (dir) { e.preventDefault(); move(dir); }
  };
  grid.tabIndex = 0; grid.addEventListener('keydown', onKey); grid.focus();
  stage.querySelector('#g2048-restart').addEventListener('click', () => { reset(); grid.focus(); });
  reset();

  browser.registerTabCleanup(tab.id, () => {/* nothing persistent */});
}

function mountTetris(stage, browser, tab) {
  stage.innerHTML = `
    <div class="tetris-game">
      <div class="tetris-meta"><span id="tetris-score">Lines: 0</span><button id="tetris-restart">Restart</button></div>
      <canvas id="tetris-canvas" width="240" height="480"></canvas>
      <p class="games-hint">←/→ move · ↓ soft drop · ↑ rotate · space hard drop.</p>
    </div>
  `;
  const canvas = stage.querySelector('#tetris-canvas');
  const ctx = canvas.getContext('2d');
  const W = 10, H = 20, S = 24;
  const SHAPES = [
    [[1, 1, 1, 1]],
    [[1, 1], [1, 1]],
    [[0, 1, 0], [1, 1, 1]],
    [[1, 0, 0], [1, 1, 1]],
    [[0, 0, 1], [1, 1, 1]],
    [[1, 1, 0], [0, 1, 1]],
    [[0, 1, 1], [1, 1, 0]],
  ];
  const COLORS = ['#00e5ff', '#ffeb3b', '#9c27b0', '#2196f3', '#ff9800', '#4caf50', '#f44336'];
  let board, piece, lines, interval;

  const newPiece = () => {
    const i = Math.floor(Math.random() * SHAPES.length);
    piece = { shape: SHAPES[i], color: COLORS[i], x: Math.floor(W / 2) - 1, y: 0 };
    if (collides(0, 0, piece.shape)) { clearInterval(interval); interval = null; }
  };
  const collides = (dx, dy, shape) => {
    for (let r = 0; r < shape.length; r++) for (let c = 0; c < shape[0].length; c++) {
      if (!shape[r][c]) continue;
      const nx = piece.x + c + dx, ny = piece.y + r + dy;
      if (nx < 0 || nx >= W || ny >= H) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
    return false;
  };
  const merge = () => {
    piece.shape.forEach((row, r) => row.forEach((v, c) => {
      if (v && piece.y + r >= 0) board[piece.y + r][piece.x + c] = piece.color;
    }));
    let cleared = 0;
    for (let r = H - 1; r >= 0; r--) {
      if (board[r].every(v => v)) { board.splice(r, 1); board.unshift(Array(W).fill(0)); cleared++; r++; }
    }
    if (cleared) { lines += cleared; stage.querySelector('#tetris-score').textContent = `Lines: ${lines}`; }
    newPiece();
  };
  const rotate = () => {
    const shape = piece.shape;
    const rotated = shape[0].map((_, i) => shape.map(r => r[i]).reverse());
    if (!collides(0, 0, rotated)) piece.shape = rotated;
  };
  const tick = () => {
    if (!collides(0, 1, piece.shape)) piece.y++;
    else merge();
    paint();
  };
  const paint = () => {
    ctx.fillStyle = '#0c0f13'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      if (board[r][c]) {
        ctx.fillStyle = board[r][c];
        ctx.fillRect(c * S + 1, r * S + 1, S - 2, S - 2);
      }
    }
    if (piece) piece.shape.forEach((row, r) => row.forEach((v, c) => {
      if (v) { ctx.fillStyle = piece.color; ctx.fillRect((piece.x + c) * S + 1, (piece.y + r) * S + 1, S - 2, S - 2); }
    }));
  };
  const onKey = (e) => {
    if (!interval) return;
    if (e.key === 'ArrowLeft' && !collides(-1, 0, piece.shape)) { piece.x--; e.preventDefault(); }
    else if (e.key === 'ArrowRight' && !collides(1, 0, piece.shape)) { piece.x++; e.preventDefault(); }
    else if (e.key === 'ArrowDown' && !collides(0, 1, piece.shape)) { piece.y++; e.preventDefault(); }
    else if (e.key === 'ArrowUp') { rotate(); e.preventDefault(); }
    else if (e.key === ' ') { while (!collides(0, 1, piece.shape)) piece.y++; e.preventDefault(); }
    paint();
  };
  const reset = () => {
    board = Array.from({ length: H }, () => Array(W).fill(0));
    lines = 0;
    stage.querySelector('#tetris-score').textContent = 'Lines: 0';
    newPiece();
    if (interval) clearInterval(interval);
    interval = setInterval(tick, 500);
    paint();
  };
  canvas.tabIndex = 0; canvas.addEventListener('keydown', onKey); canvas.focus();
  stage.querySelector('#tetris-restart').addEventListener('click', () => { reset(); canvas.focus(); });
  reset();

  browser.registerTabCleanup(tab.id, () => { if (interval) clearInterval(interval); });
}
