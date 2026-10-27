#!/usr/bin/env node

import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  resolveRuntimePorts,
  withRuntimePortEnv,
  resolveMaxOldSpaceMb,
  warnConflictingHeapLimits,
  buildStandaloneNodeOptions,
} from "../build/runtime-env.mjs";
import { bootstrapEnv } from "../build/bootstrap-env.mjs";

const env = bootstrapEnv();
const runtimePorts = resolveRuntimePorts(env);
const childEnv = withRuntimePortEnv(env, runtimePorts);

const maxOldSpaceMb = resolveMaxOldSpaceMb(childEnv.OMNIROUTE_MEMORY_MB);
warnConflictingHeapLimits(childEnv, maxOldSpaceMb);
childEnv.NODE_OPTIONS = buildStandaloneNodeOptions(childEnv, maxOldSpaceMb);
Object.assign(process.env, childEnv);

const entry = existsSync("server-ws.mjs") ? "server-ws.mjs" : "server.js";
await import(pathToFileURL(path.resolve(entry)).href);
