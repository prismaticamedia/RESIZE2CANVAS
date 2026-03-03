# Photoshop Resize To Canvas UXP Plugin
A lightweight Adobe UXP panel plugin that adds quick resizing and formatting shortcuts for layers.

## Features
* **Fit (No Crop):** Resizes the layer to gracefully fit entirely inside the document bounds constraints.
* **Fill (Crop):** Scales the layer perfectly edge-to-edge ignoring standard aspect borders, acting as a fill crop. 
* **Auto-Rotate:** An option that triggers the layer to rotate by 90° natively if its AspectRatio formatting orientation (Portrait -> Landscape) conflicts with the canvas orientation prior to scaling.
* **Send to New Document:** Duplicates the current layer out and exports it straight to a fresh artboard with multiple predefined streaming presets `(720p, 1080p, 4k)` and variable Custom Size injection.
* **Quick Exports:** One-click shortcuts to rapidly export the active layer or doc as a transparent PNG.

## Usage
Add to Photoshop using the UXP Developer Tool.
