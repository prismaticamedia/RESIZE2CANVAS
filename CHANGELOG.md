# Changelog

## [1.0.3] - 2026-03-03
### Added
- **Smart Object Auto-Conversion**: The plugin now automatically converts Text, Shape, and Group layers into Smart Objects before resizing. This prevents "Error -4" and ensures 100% quality retention when scaling.
- Updated UI text for clarity (e.g., changed "Llenar Lienzo (Recortar)" to "Rellenar").

### Fixed
- Fixed critical bug where `layer.convertToSmartObject()` caused plugin errors. Replaced with native `batchPlay` command.
- Fixed incorrect theme syntax in `manifest.json` for plugin icons.
