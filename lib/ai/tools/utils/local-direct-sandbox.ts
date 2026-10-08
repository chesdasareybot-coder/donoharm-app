import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";

/**
 * LocalDirectSandbox executes commands directly on the host operating system
 * when running in local development / Ollama mode without requiring an external Centrifugo relay.
 */
export class LocalDirectSandbox {
  readonly sandboxKind = "centrifugo" as const;
  private readonly connectionId = "desktop-local";
  private readonly connectionName = "This computer";

  getConnectionId(): string {
    return this.connectionId;
  }

  getConnectionName(): string {
    return this.connectionName;
  }

  isWindows(): boolean {
    return process.platform === "win32";
  }

  getWorkingDirectory(): string {
    return process.cwd();
  }

  supportsNativeFileRelay(): boolean {
    return true;
  }

  async close(): Promise<void> {
    // No external connections to close
  }

  commands = {
    run: async (
      command: string,
      opts?: {
        envVars?: Record<string, string>;
        cwd?: string;
        timeoutMs?: number;
        background?: boolean;
        onStdout?: (data: string) => void;
        onStderr?: (data: string) => void;
        displayName?: string;
        stdin?: string | Buffer;
        signal?: AbortSignal;
      },
    ): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
      return new Promise((resolve, reject) => {
        const isWin = process.platform === "win32";
        const shell = isWin ? "powershell.exe" : "bash";
        const shellArgs = isWin
          ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command]
          : ["-c", command];

        const child = spawn(shell, shellArgs, {
          cwd: opts?.cwd || process.cwd(),
          env: { ...process.env, ...(opts?.envVars || {}) },
          windowsHide: true,
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (chunk: Buffer) => {
          const str = chunk.toString();
          stdout += str;
          opts?.onStdout?.(str);
        });

        child.stderr?.on("data", (chunk: Buffer) => {
          const str = chunk.toString();
          stderr += str;
          opts?.onStderr?.(str);
        });

        if (opts?.signal) {
          opts.signal.addEventListener("abort", () => {
            child.kill();
          });
        }

        let timer: NodeJS.Timeout | undefined;
        if (opts?.timeoutMs && opts.timeoutMs > 0) {
          timer = setTimeout(() => {
            child.kill();
            resolve({
              stdout,
              stderr: stderr + "\n[Command timed out]",
              exitCode: 124,
            });
          }, opts.timeoutMs);
        }

        child.on("close", (code) => {
          if (timer) clearTimeout(timer);
          resolve({ stdout, stderr, exitCode: code ?? 0 });
        });

        child.on("error", (err) => {
          if (timer) clearTimeout(timer);
          reject(err);
        });
      });
    },
  };

  files = {
    write: async (
      filePath: string,
      content: string | Buffer,
    ): Promise<void> => {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content);
    },
    read: async (filePath: string): Promise<string> => {
      return await fs.readFile(filePath, "utf-8");
    },
    remove: async (filePath: string): Promise<void> => {
      await fs.rm(filePath, { force: true, recursive: true });
    },
    list: async (dirPath: string): Promise<{ name: string }[]> => {
      const items = await fs.readdir(dirPath);
      return items.map((name) => ({ name }));
    },
  };

  getHost(port: number): string {
    return `http://localhost:${port}`;
  }
}
