const crypto = require('crypto');
const { EventEmitter } = require('events');

const jobs = new Map();
const TTL = 10 * 60 * 1000;

const snap = (j) => ({ status: j.status, percent: j.percent, message: j.message, error: j.error });

exports.create = (owner) => {
  const job = {
    id: crypto.randomUUID(), owner, status: 'running', percent: 0,
    message: 'Memulai...', error: null, result: null,
    emitter: new EventEmitter(), createdAt: Date.now(),
  };
  jobs.set(job.id, job);
  return job;
};

// owner = hash token, supaya user lain tidak bisa mengintip job/file orang lain
exports.get = (id, owner) => {
  const j = jobs.get(id);
  return j && j.owner === owner ? j : null;
};

exports.update = (job, percent, message) => {
  job.percent = Math.max(job.percent, Math.min(100, Math.round(percent))); // tidak pernah mundur
  job.message = message;
  job.emitter.emit('progress', snap(job));
};
exports.done = (job, result) => {
  job.result = result; job.status = 'done'; job.percent = 100; job.message = 'Selesai';
  job.emitter.emit('progress', snap(job));
};
exports.fail = (job, err) => {
  job.status = 'error'; job.error = err.message;
  job.emitter.emit('progress', snap(job));
};
exports.snap = snap;

setInterval(() => {
  const now = Date.now();
  for (const [id, j] of jobs) if (now - j.createdAt > TTL) jobs.delete(id);
}, 60 * 1000).unref();