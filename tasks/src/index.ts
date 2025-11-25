import { CloudTasksClient } from "@google-cloud/tasks";
import Router from "@koa/router";
import crypto from "crypto";

import Koa from "koa";
import bodyParser from "koa-bodyparser";
import z from "zod";

const port = process.env.PORT || 8080;

// In-memory idempotency store (use Redis/DB in production)
const processedTasks = new Set<string>();

const app = new Koa();
const router = new Router();

app.use(bodyParser());

const TaskBody = z.object({
  id: z.number(),
  username: z.string(),
  message: z.string(),
  url: z.url({ protocol: /^https$/ }),
});

type Task = z.infer<typeof TaskBody>;

// https://docs.cloud.google.com/tasks/docs/creating-http-target-tasks
router.post("/handleTask", async (ctx) => {
  const project = "verdant-inquiry-476916-k6";
  const queue = "test-queue";
  const location = "southamerica-east1";

  const tasksClient = new CloudTasksClient();
  // queue must be created first
  // can be created via api to
  const parent = tasksClient.queuePath(project, location, queue);

  const body = ctx.request.body;

  let eventData: Task | undefined;
  const result = TaskBody.safeParse(body);
  if (!result.success) {
    ctx.status = 400;
    ctx.body = {
      status: "ERROR",
      message: result.error,
    };
    return;
  } else {
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
      httpMethod: "POST" as const,
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

  console.log("Sending task:");
  console.log(task);

  const [response] = await tasksClient.createTask({ parent, task });

  console.log("Sending task Response:", response);

  ctx.body = {
    status: "OK",
    message: response,
  };
});

router.post("/receivedTask", async (ctx) => {
  const body = ctx.request.body;

  const result = TaskBody.safeParse(body);
  if (!result.success) {
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
    console.log(`Task ${idempotencyKey} already processed, skipping...`);
    ctx.status = 200;
    ctx.body = {
      status: "OK",
      message: "Task already processed (duplicate)",
      duplicate: true,
    };
    return;
  }

  console.log("Received task:");
  console.log(taskData);

  // Process the task here
  // Example: You can use taskData.id, taskData.username, taskData.message, taskData.url
  try {
    // Your business logic here
    // e.g., save to database, send notification, etc.
    console.log(
      `Processing task for user ${taskData.username}: ${taskData.message}`,
    );

    // Mark task as processed AFTER successful processing
    processedTasks.add(idempotencyKey);

    ctx.body = {
      status: "OK",
      message: `Successfully processed task for user ${taskData.username}`,
      data: taskData,
    };
  } catch (error) {
    // Don't mark as processed if there's an error
    // This allows Cloud Tasks to retry
    console.error("Error processing task:", error);
    ctx.status = 500;
    ctx.body = {
      status: "ERROR",
      message: "Failed to process task, will retry",
    };
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
