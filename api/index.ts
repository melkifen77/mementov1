import { type Server } from "node:http";

import express, {
  type Express,
  type Request,
  Response,
  NextFunction,
} from "express";

import { app, setupApp } from "../server/app";

await setupApp(app);

export default app;
