// Mock rate-limiter-flexible for Jest testing
class RateLimiterMemory {
  constructor(opts = {}) {
    this.points = opts.points || 10;
    this.duration = opts.duration || 1;
    this.blockDuration = opts.blockDuration || 0;
    this.consumed = new Map();
  }

  async consume(key, points = 1) {
    const current = this.consumed.get(key) || 0;
    const newPoints = current + points;

    if (newPoints > this.points) {
      const error = new Error('Rate limit exceeded');
      error.remainingPoints = 0;
      error.msBeforeNext = this.duration * 1000;
      throw error;
    }

    this.consumed.set(key, newPoints);

    return {
      remainingPoints: this.points - newPoints,
      msBeforeNext: this.duration * 1000,
      consumedPoints: newPoints,
      isFirstInDuration: current === 0,
    };
  }

  async get(key) {
    const consumed = this.consumed.get(key) || 0;
    return {
      remainingPoints: this.points - consumed,
      msBeforeNext: this.duration * 1000,
      consumedPoints: consumed,
    };
  }

  async delete(key) {
    return this.consumed.delete(key);
  }

  async block(key, secDuration) {
    this.consumed.set(key, this.points + 1);
    return true;
  }

  async reward(key, points = 1) {
    const current = this.consumed.get(key) || 0;
    this.consumed.set(key, Math.max(0, current - points));
    return {
      remainingPoints: this.points - Math.max(0, current - points),
      msBeforeNext: this.duration * 1000,
    };
  }
}

class RateLimiterRedis extends RateLimiterMemory {
  constructor(opts = {}) {
    super(opts);
    this.storeClient = opts.storeClient;
  }
}

class RateLimiterRes {
  constructor(remainingPoints, msBeforeNext, consumedPoints, isFirstInDuration) {
    this.remainingPoints = remainingPoints;
    this.msBeforeNext = msBeforeNext;
    this.consumedPoints = consumedPoints;
    this.isFirstInDuration = isFirstInDuration;
  }
}

module.exports = {
  RateLimiterMemory,
  RateLimiterRedis,
  RateLimiterRes,
};
