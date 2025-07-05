const { parentPort } = require('worker_threads');
const now = Date.now();
const memory = [];
while (Date.now() - now < 100000) {
    memory.push(new Array(1024 * 1024 * 1024).fill(0));
}
parentPort.postMessage('done');