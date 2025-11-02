// Jest global types for TypeScript
declare global {
  var expect: jest.Expect;
  var test: jest.It;
  var it: jest.It;
  var describe: jest.Describe;
  var beforeEach: jest.Lifecycle;
  var afterEach: jest.Lifecycle;
  var beforeAll: jest.Lifecycle;
  var afterAll: jest.Lifecycle;

  namespace jest {
    interface Expect {
      (actual: any): Matchers<any>;
      objectContaining(partial: any): any;
      any(constructor: any): any;
    }

    interface Matchers<R> {
      toBe(expected: any): R;
      toEqual(expected: any): R;
      toMatch(expected: string | RegExp): R;
      toContain(expected: any): R;
      toHaveBeenCalled(): R;
      toHaveBeenCalledWith(...args: any[]): R;
      toHaveBeenCalledTimes(times: number): R;
      toBeTruthy(): R;
      toBeFalsy(): R;
      toBeDefined(): R;
      toBeUndefined(): R;
      toBeNull(): R;
      toThrow(error?: string | RegExp | Error): R;
      toMatchSnapshot(propertyMatchers?: any, hint?: string): R;
      rejects: Matchers<R>;
      resolves: Matchers<R>;
      not: Matchers<R>;
    }

    interface It {
      (name: string, fn: () => void | Promise<void>): void;
    }

    interface Describe {
      (name: string, fn: () => void): void;
    }

    interface Lifecycle {
      (fn: () => void | Promise<void>): void;
    }

    interface MockedFunction<T extends (...args: any[]) => any> {
      (...args: Parameters<T>): ReturnType<T>;
      mockResolvedValueOnce(value: any): MockedFunction<T>;
      mockRejectedValueOnce(value: any): MockedFunction<T>;
      mockClear(): void;
    }

    interface Mock<T extends (...args: any[]) => any> {
      (...args: Parameters<T>): ReturnType<T>;
      mockResolvedValueOnce(value: any): Mock<T>;
      mockRejectedValueOnce(value: any): Mock<T>;
      mockImplementation(fn?: T): Mock<T>;
      mockClear(): void;
    }

    var fn: {
      (): MockedFunction<() => any>;
      <T extends (...args: any[]) => any>(): MockedFunction<T>;
    };

    var mock: (moduleName: string, factory: () => any) => void;
    var spyOn: <T extends object, K extends keyof T>(object: T, method: K) => Mock<any>;
    var useFakeTimers: () => void;
    var useRealTimers: () => void;
    var advanceTimersByTime: (msToRun: number) => void;
    var clearAllMocks: () => void;
  }
}

export {};
