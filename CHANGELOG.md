# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-11-19

### Added

- Imbalance prices of Belgium (Elia Open Data, no account) and the Netherlands
  (TenneT API, free personal key), read every minute: one device per zone with
  the price of the running quarter-hour (€/MWh and €/kWh), the previous one,
  the system imbalance (MW), its direction and the running quarter-hour.
- Scene triggers: the price turns negative, the price rises above a threshold
  (100 to 1,000 €/MWh), at most once per quarter-hour.
- Dashboard widget: price per zone, previous quarter-hour, imbalance and the
  curve of the day (can be hidden).
- Action "Read the prices now", to check both sources and a TenneT key.
- Texts in English, French, German and Spanish; documentation also in Dutch.

[Unreleased]: https://github.com/guim31/gladys-imbalance-prices/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-imbalance-prices/releases/tag/v1.0.0
