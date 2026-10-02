// Injects assets/hvs/tickets.json and board.json into assets/hvs/data.src.js -> assets/hvs/data.js
// Usage: node tools/build-data.js   (run from the project root)
const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '..', 'assets', 'hvs');
const src = fs.readFileSync(path.join(dir, 'data.src.js'), 'utf8');
const tickets = fs.readFileSync(path.join(dir, 'tickets.json'), 'utf8');
const board = fs.readFileSync(path.join(dir, 'board.json'), 'utf8');
fs.writeFileSync(path.join(dir, 'data.js'), src.replace('/*TICKETS*/[]', tickets).replace('/*BOARD*/[]', board));
console.log('wrote assets/hvs/data.js');
