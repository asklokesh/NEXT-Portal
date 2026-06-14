export type Logger = {
  info: (msg: string, meta?: any) => void;
  warn: (msg: string, meta?: any) => void;
  error: (msg: string, meta?: any) => void;
  debug: (msg: string, meta?: any) => void;
  child: (meta: any) => Logger;
};

export function getRootLogger(): Logger {
  return {
    info: (msg, meta) => console.info(msg, meta),
    warn: (msg, meta) => console.warn(msg, meta),
    error: (msg, meta) => console.error(msg, meta),
    debug: (msg, meta) => console.debug(msg, meta),
    child: (_meta) => getRootLogger(),
  };
}

export function getVoidLogger(): Logger {
  const noop = () => {};
  const logger: Logger = {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    child: () => logger,
  };
  return logger;
}
