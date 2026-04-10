const COLS = 20;
const ROWS = 15;
const CELL = 40;

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const mapNameInput = document.getElementById("map-name");
const exportBtn = document.getElementById("export-btn");
const previewBtn = document.getElementById("preview-btn");
const toolButtons = [...document.querySelectorAll("[data-tool]")];

const state = {
  tool: "wall",
  objects: new Map(), // key col,row => type
  spawnPoints: [],
};

function key(col, row) {
  return `${col},${row}`;
}

function setTool(tool) {
  state.tool = tool;
  toolButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.tool === tool));
}

function drawCell(col, row, color) {
  ctx.fillStyle = color;
  ctx.fillRect(col * CELL + 2, row * CELL + 2, CELL - 4, CELL - 4);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#1f2937";
  for (let c = 0; c <= COLS; c += 1) {
    ctx.beginPath();
    ctx.moveTo(c * CELL, 0);
    ctx.lineTo(c * CELL, ROWS * CELL);
    ctx.stroke();
  }
  for (let r = 0; r <= ROWS; r += 1) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(COLS * CELL, r * CELL);
    ctx.stroke();
  }

  for (const [k, type] of state.objects.entries()) {
    const [col, row] = k.split(",").map(Number);
    if (type === "wall") drawCell(col, row, "#475569");
    else if (type === "destructibleWall") drawCell(col, row, "#64748b");
    else if (type === "barrel") drawCell(col, row, "#dc2626");
    else if (type === "box") drawCell(col, row, "#b45309");
  }

  for (const p of state.spawnPoints) {
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.arc(p.col * CELL + CELL / 2, p.row * CELL + CELL / 2, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function exportMap() {
  const name = (mapNameInput.value || "custom-map").trim();
  const objects = [...state.objects.entries()].map(([k, type]) => {
    const [col, row] = k.split(",").map(Number);
    return { type, col, row };
  });
  const spawnPoints = state.spawnPoints.map((p) => ({ x: p.col * CELL + CELL / 2, y: p.row * CELL + CELL / 2 }));
  const data = {
    name,
    width: COLS,
    height: ROWS,
    tiles: [],
    objects,
    spawnPoints,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportPreview() {
  const name = (mapNameInput.value || "custom-map").trim();
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = `${name}.png`;
  a.click();
}

canvas.addEventListener("click", (ev) => {
  const rect = canvas.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  const col = Math.floor(x / CELL);
  const row = Math.floor(y / CELL);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
  const k = key(col, row);

  if (state.tool === "erase") {
    state.objects.delete(k);
    state.spawnPoints = state.spawnPoints.filter((p) => !(p.col === col && p.row === row));
  } else if (state.tool === "spawn") {
    state.spawnPoints = state.spawnPoints.filter((p) => !(p.col === col && p.row === row));
    state.spawnPoints.push({ col, row });
  } else {
    state.objects.set(k, state.tool);
  }
  render();
});

toolButtons.forEach((btn) => btn.addEventListener("click", () => setTool(btn.dataset.tool)));
exportBtn.addEventListener("click", exportMap);
previewBtn.addEventListener("click", exportPreview);

setTool("wall");
render();
