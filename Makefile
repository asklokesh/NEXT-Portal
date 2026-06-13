# NEXT Portal — local CI/dev entrypoints (wave-1)
SHELL := /bin/bash
.PHONY: help install deps lint typecheck test test-ci build build-fast audit format-check ci validate-scripts smoke-check

NODE ?= node
NPM ?= npm
export NODE_OPTIONS ?= --max_old_space_size=8192

help:
	@echo "NEXT Portal Makefile"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  help           Show this message"
	@echo "  install deps   npm ci --ignore-scripts"
	@echo "  lint           ESLint (build config)"
	@echo "  typecheck      TypeScript (tsconfig.build.json)"
	@echo "  test           Jest unit tests"
	@echo "  test-ci        Jest CI profile (matches GitHub Actions)"
	@echo "  build          Production build"
	@echo "  build-fast     next build (skip performance wrapper)"
	@echo "  audit          npm audit (high+, non-fatal)"
	@echo "  format-check   Prettier check"
	@echo "  validate-scripts  Verify CI-referenced scripts exist"
	@echo "  smoke-check    Syntax-check scripts/ci helpers"
	@echo "  ci             lint + typecheck + test-ci + build"

install deps:
	$(NPM) ci --ignore-scripts

lint:
	$(NPM) run lint:build

typecheck:
	$(NPM) run typecheck:build

test:
	$(NPM) run test

test-ci:
	$(NPM) run test:ci

build:
	$(NPM) run build

build-fast:
	NODE_OPTIONS="$(NODE_OPTIONS)" $(NPM) run build:legacy

audit:
	$(NPM) audit --audit-level=high || true

format-check:
	$(NPM) run format:check

validate-scripts:
	@./scripts/ci/validate-referenced-scripts.sh

smoke-check:
	@for f in scripts/ci/*.sh scripts/aggregate-test-results.js scripts/generate-test-report.js scripts/performance-regression-check.js scripts/update-status-checks.js scripts/build-performance.js; do \
		$(NODE) --check "$$f" || exit 1; \
	done

ci: lint typecheck test-ci build
