// myappbackend/cpuLoadWorker.js
const { parentPort } = require('worker_threads');
const now = Date.now();
while (Date.now() - now < 100000) {
    Math.random();
}
parentPort.postMessage('done');