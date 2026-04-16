interface MockResponse {
  written: string[];
  throwOnWrite: boolean;
  write(chunk: string): boolean;
  on(event: string, handler: (...args: unknown[]) => void): void;
  trigger(event: string): void;
}

function createMockResponse(): MockResponse {
  const handlers = new Map<string, ((...args: unknown[]) => void)[]>();

  const mock: MockResponse = {
    written: [],
    throwOnWrite: false,

    write(chunk: string): boolean {
      if (mock.throwOnWrite) {
        throw new Error("write failed");
      }
      mock.written.push(chunk);
      return true;
    },

    on(event: string, handler: (...args: unknown[]) => void): void {
      if (!handlers.has(event)) {
        handlers.set(event, []);
      }
      handlers.get(event)!.push(handler);
    },

    trigger(event: string): void {
      const list = handlers.get(event);
      if (list) {
        for (const handler of list) {
          handler();
        }
      }
    },
  };

  return mock;
}

export { createMockResponse };
export type { MockResponse };
