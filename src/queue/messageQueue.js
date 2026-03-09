const { v4: uuidv4 } = require("uuid");
const logger = require("../config/logger");
const whatsappService = require("../services/whatsappService");

// ─────────────────────────────────────────────
//  Simple in-memory queue (no Redis needed)
//  For production scale → replace with Bull + Redis
// ─────────────────────────────────────────────

const QUEUE_CONCURRENCY = parseInt(process.env.QUEUE_CONCURRENCY) || 5;
const MESSAGE_DELAY = parseInt(process.env.MESSAGE_DELAY) || 1000;

let activeWorkers = 0;
const queue = []; // Array of pending jobs
const jobStore = new Map(); // jobId → job status

// ─────────────────────────────────────────────
//  Add a job to the queue
// ─────────────────────────────────────────────
const addToQueue = (phone, message) => {
  const jobId = uuidv4();

  const job = {
    jobId,
    phone,
    message,
    status: "pending",
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    result: null,
    error: null,
  };

  queue.push(job);
  jobStore.set(jobId, job);

  logger.info("Job added to queue", {
    jobId,
    to: phone,
    queueLength: queue.length,
  });

  // Try to process next job
  processQueue();

  return jobId;
};

// ─────────────────────────────────────────────
//  Process jobs from the queue
// ─────────────────────────────────────────────
const processQueue = async () => {
  // If at max concurrency or queue is empty, do nothing
  if (activeWorkers >= QUEUE_CONCURRENCY || queue.length === 0) return;

  // Find next pending job
  const pendingIndex = queue.findIndex((j) => j.status === "pending");
  if (pendingIndex === -1) return;

  const job = queue[pendingIndex];
  job.status = "processing";
  job.startedAt = new Date().toISOString();
  activeWorkers++;

  logger.info("Processing job", {
    jobId: job.jobId,
    to: job.phone,
    activeWorkers,
  });

  try {
    // Send the message
    const result = await whatsappService.sendMessage(job.phone, job.message);

    job.status = "completed";
    job.completedAt = new Date().toISOString();
    job.result = result;

    logger.info("Job completed", { jobId: job.jobId, to: job.phone });
  } catch (err) {
    job.status = "failed";
    job.completedAt = new Date().toISOString();
    job.error = err.message;

    logger.error("Job failed", { jobId: job.jobId, error: err.message });
  } finally {
    // Remove completed/failed job from active queue
    queue.splice(pendingIndex, 1);
    activeWorkers--;

    // Wait before processing next (avoid WhatsApp spam detection)
    setTimeout(() => {
      processQueue();
    }, MESSAGE_DELAY);
  }
};

// ─────────────────────────────────────────────
//  Get job status by ID
// ─────────────────────────────────────────────
const getJobStatus = (jobId) => {
  const job = jobStore.get(jobId);
  if (!job) return null;
  return job;
};

// ─────────────────────────────────────────────
//  Get queue stats
// ─────────────────────────────────────────────
const getQueueStats = () => {
  return {
    pendingJobs: queue.filter((j) => j.status === "pending").length,
    processingJobs: queue.filter((j) => j.status === "processing").length,
    activeWorkers,
    totalTrackedJobs: jobStore.size,
  };
};

module.exports = {
  addToQueue,
  getJobStatus,
  getQueueStats,
};
