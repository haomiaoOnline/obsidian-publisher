import { spawn } from "node:child_process";
import path from "node:path";
import { setTimeout as nodeSetTimeout, clearTimeout as nodeClearTimeout } from "node:timers";

export interface ProcessRequest {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

export interface ProcessResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface ProcessRunner {
  run(request: ProcessRequest): Promise<ProcessResult>;
}

export function buildProcessEnvironment(
  command: string,
  requestEnv: Record<string, string> = {},
  baseEnv: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform
): NodeJS.ProcessEnv {
  const currentPath = baseEnv.PATH ?? "";
  const pathEntries = currentPath
    .split(path.delimiter)
    .filter(Boolean);

  if (command.includes("/") || command.includes("\\")) {
    pathEntries.unshift(path.dirname(command));
  }

  if (platform === "darwin") {
    pathEntries.push(
      "/opt/homebrew/bin",
      "/usr/local/bin",
      "/usr/bin",
      "/bin",
      "/usr/sbin",
      "/sbin"
    );
  }

  return {
    ...baseEnv,
    ...requestEnv,
    PATH: [...new Set(pathEntries)].join(path.delimiter)
  };
}

export class NodeProcessRunner implements ProcessRunner {
  run(request: ProcessRequest): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(request.command, request.args, {
        cwd: request.cwd,
        env: buildProcessEnvironment(
          request.command,
          request.env
        ),
        shell: false,
        windowsHide: true
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const timeoutMs = request.timeoutMs ?? 90000;
      const timer = nodeSetTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        nodeSetTimeout(() => child.kill("SIGKILL"), 3000).unref();
      }, timeoutMs);
      timer.unref();

      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");

      child.stdout?.on("data", (chunk: string) => {
        stdout = (stdout + chunk).slice(-32768);
      });
      child.stderr?.on("data", (chunk: string) => {
        stderr = (stderr + chunk).slice(-32768);
      });

      child.once("error", (error) => {
        nodeClearTimeout(timer);
        reject(error);
      });
      child.once("close", (code) => {
        nodeClearTimeout(timer);
        resolve({
          code: timedOut ? 124 : code ?? -1,
          stdout,
          stderr: timedOut
            ? stderr + "\nProcess timed out after " + timeoutMs + "ms."
            : stderr
        });
      });
    });
  }
}
