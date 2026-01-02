// Mock for @pact-foundation/pact
class Pact {
  constructor() {}
  setup() { return Promise.resolve(); }
  verify() { return Promise.resolve(); }
  finalize() { return Promise.resolve(); }
  addInteraction() { return Promise.resolve(); }
}

class Verifier {
  constructor() {}
  verifyProvider() { return Promise.resolve(); }
}

class Matchers {
  static like(value) { return value; }
  static eachLike(value) { return [value]; }
  static regex() { return ''; }
  static term() { return ''; }
  static somethingLike(value) { return value; }
  static iso8601Date() { return '2026-01-01'; }
  static iso8601DateTime() { return '2026-01-01T00:00:00Z'; }
  static integer() { return 1; }
  static decimal() { return 1.0; }
  static boolean() { return true; }
  static string() { return 'string'; }
  static uuid() { return '12345678-1234-1234-1234-123456789012'; }
}

module.exports = { Pact, Verifier, Matchers };
