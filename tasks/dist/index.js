import { CloudTasksClient } from "@google-cloud/tasks";
import Router from "@koa/router";
import Koa from "koa";
import bodyParser from "koa-bodyparser";
import z from "zod";
import { createTraceMiddleware } from "./lib/middleware.js";
import { logger } from "./logger/index.js";
const port = process.env.PORT || 8080;
// In-memory idempotency store (use Redis/DB in production)
const processedTasks = new Set();
const app = new Koa();
const router = new Router();
app.use(bodyParser());
app.use(createTraceMiddleware({
    projectId: "verdant-inquiry-476916-k6",
}));
logger.info("Server initializing...");
const TaskBody = z.object({
    id: z.number(),
    username: z.string(),
    message: z.string(),
    url: z.url({ protocol: /^https$/ }),
});
// https://docs.cloud.google.com/tasks/docs/creating-http-target-tasks
router.post("/handleTask", async (ctx) => {
    const project = "verdant-inquiry-476916-k6";
    const queue = "test-queue";
    const location = "southamerica-east1";
    logger.info({
        trace_id: ctx.trace.gcpTrace,
        span_id: ctx.trace.spanId,
        action: "handleTask",
    }, "Handling new task request");
    const tasksClient = new CloudTasksClient();
    // queue must be created first
    // can be created via api to
    const parent = tasksClient.queuePath(project, location, queue);
    const body = ctx.request.body;
    let eventData;
    const result = TaskBody.safeParse(body);
    if (!result.success) {
        logger.warn({
            trace_id: ctx.trace.gcpTrace,
            span_id: ctx.trace.spanId,
            error: result.error,
        }, "Invalid task body received");
        ctx.status = 400;
        ctx.body = {
            status: "ERROR",
            message: result.error,
        };
        return;
    }
    else {
        eventData = result.data;
    }
    // Generate unique task name for deduplication
    // Tasks with same name won't be created twice within 1 hour
    const taskName = `${parent}/tasks/task-${eventData.id}`;
    const task = {
        name: taskName,
        httpRequest: {
            headers: {
                "Content-Type": "application/json",
            },
            httpMethod: "POST",
            url: eventData.url,
            body: Buffer.from(JSON.stringify(eventData)).toString("base64"),
        },
        // double check this configs i think they dont work
        retryConfig: {
            maxAttempts: 5, // Maximum number of retry attempts
            minBackoff: {
                seconds: 10, // Start with 10 seconds
            },
            maxBackoff: {
                seconds: 300, // Max backoff of 5 minutes
            },
            maxDoublings: 4, // Exponential backoff: 10s, 20s, 40s, 80s, 160s
        },
    };
    logger.debug({ trace_id: ctx.trace.gcpTrace, span_id: ctx.trace.spanId, task }, "Sending task to Cloud Tasks");
    const [response] = await tasksClient.createTask({ parent, task });
    logger.info({
        trace_id: ctx.trace.gcpTrace,
        span_id: ctx.trace.spanId,
        taskName: response.name,
    }, "Task created successfully");
    ctx.body = {
        status: "OK",
        message: response,
    };
});
router.post("/receivedTask", async (ctx) => {
    const body = ctx.request.body;
    logger.info({
        trace_id: ctx.trace.gcpTrace,
        span_id: ctx.trace.spanId,
        action: "receivedTask",
    }, "Received task from Cloud Tasks");
    const result = TaskBody.safeParse(body);
    if (!result.success) {
        logger.warn({
            trace_id: ctx.trace.gcpTrace,
            span_id: ctx.trace.spanId,
            error: result.error,
        }, "Invalid task payload");
        ctx.status = 400;
        ctx.body = {
            status: "ERROR",
            message: result.error,
        };
        return;
    }
    const taskData = result.data;
    // Create idempotency key from task ID
    const idempotencyKey = `task-${taskData.id}`;
    // Check if task was already processed (idempotency)
    if (processedTasks.has(idempotencyKey)) {
        logger.info({
            trace_id: ctx.trace.gcpTrace,
            span_id: ctx.trace.spanId,
            idempotencyKey,
        }, "Task already processed, skipping duplicate");
        ctx.status = 200;
        ctx.body = {
            status: "OK",
            message: "Task already processed (duplicate)",
            duplicate: true,
        };
        return;
    }
    logger.debug({ trace_id: ctx.trace.gcpTrace, span_id: ctx.trace.spanId, taskData }, "Processing task");
    // Process the task here
    try {
        logger.info({
            trace_id: ctx.trace.gcpTrace,
            span_id: ctx.trace.spanId,
            username: taskData.username,
            message: taskData.message,
        }, "Processing task for user");
        // Mark task as processed AFTER successful processing
        processedTasks.add(idempotencyKey);
        logger.info({
            trace_id: ctx.trace.gcpTrace,
            span_id: ctx.trace.spanId,
            idempotencyKey,
        }, "Task processed successfully");
        ctx.body = {
            status: "OK",
            message: `Successfully processed task for user ${taskData.username}`,
            data: taskData,
        };
    }
    catch (error) {
        // Don't mark as processed if there's an error
        // This allows Cloud Tasks to retry
        logger.error({ trace_id: ctx.trace.gcpTrace, span_id: ctx.trace.spanId, error }, "Error processing task, will retry");
        ctx.status = 500;
        ctx.body = {
            status: "ERROR",
            message: "Failed to process task, will retry",
        };
    }
});
router.post("/test", async (ctx) => {
    logger.info({ trace_id: ctx.trace.gcpTrace, span_id: ctx.trace.spanId, action: "test" }, "Test endpoint called");
    logger.debug({ trace_id: ctx.trace.gcpTrace, span_id: ctx.trace.spanId }, "Debug info with trace context");
    logger.warn({ trace_id: ctx.trace.gcpTrace, span_id: ctx.trace.spanId }, "This is a warning log for testing");
    try {
        logger.info({
            trace_id: ctx.trace.gcpTrace,
            span_id: ctx.trace.spanId,
            testData: { foo: "bar", count: 42 },
        }, "Processing test request");
        ctx.body = {
            status: "OK",
            message: "Test endpoint working!",
            trace: {
                traceId: ctx.trace.traceId,
                spanId: ctx.trace.spanId,
                gcpTrace: ctx.trace.gcpTrace,
            },
        };
    }
    catch (error) {
        logger.error({ trace_id: ctx.trace.gcpTrace, span_id: ctx.trace.spanId, error }, "Error in test endpoint");
        ctx.status = 500;
        ctx.body = {
            status: "ERROR",
            message: "Test endpoint failed",
        };
    }
});
router.get("/health", async (ctx) => {
    logger.debug({ trace_id: ctx.trace.gcpTrace, span_id: ctx.trace.spanId }, "Health check called");
    ctx.body = { status: "healthy" };
});
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
router.get("/single", async (ctx) => {
    const sleepMs = randInt(50, 150);
    logger.info({ sleepMs }, "Handling /single request");
    await sleep(sleepMs);
    ctx.body = { status: "ok", slept: sleepMs };
});
router.get("/multi", async (ctx) => {
    const subRequests = randInt(3, 8);
    logger.info({ subRequests }, "Handling /multi request");
    for (let i = 0; i < subRequests; i++) {
        await fetch(`http://localhost:${port}/single`);
    }
    ctx.body = { status: "ok", subRequests };
});
// testing to see if we can just use the logger and trust the header
// like in this example: https://docs.cloud.google.com/trace/docs/setup/nodejs-ot
// Update: it doesnt work
router.get("/singleNoTrace", async (ctx) => {
    const sleepMs = randInt(50, 150);
    logger.info({ sleepMs }, "Handling /single request");
    await sleep(sleepMs);
    ctx.body = { status: "ok", slept: sleepMs };
});
router.get("/multiNo", async (ctx) => {
    const subRequests = randInt(3, 8);
    logger.info({ subRequests }, "Handling /multi request");
    for (let i = 0; i < subRequests; i++) {
        await fetch(`http://localhost:${port}/singleNoTrace`);
    }
    ctx.body = { status: "ok", subRequests };
});
app.use(router.routes());
app.use(router.allowedMethods());
app.listen(port, () => {
    logger.info({ port }, "Server running");
});
