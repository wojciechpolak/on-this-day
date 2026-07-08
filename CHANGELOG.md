# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2026-07-08

### Added

- New theme system and refreshed application UI.
- Playwright end-to-end test coverage, with optional visual regression testing (VRT).
- GitHub attestations for container image publishing.

### Changed

- Upgrade to Nuxt 4.
- Upgrade to Node.js 24.
- Migrate from ESLint to oxlint, and add oxfmt for formatting.
- Optimize Docker image build and runtime.
- Harden TypeScript types.

### Fixed

- Improve error handling.
- Fix ICS description HTML cleanup.
- Fix caching behavior.

## [2.0.0] - 2025-01-22

### Changed

- Rewrite in Vue.js, Nuxt, and TypeScript.

## [1.1.0] - 2025-01-14

### Added

- ARIA accessibility support.

### Changed

- Move calendar parsing to the server side.

## [1.0.0] - 2024-11-01

### Added

- Initial release of On This Day... (OTD), a web application that lets you see
  events from your calendars that occurred on this day, during this week, or
  throughout this month in previous years.
