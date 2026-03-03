const app = require("photoshop").app;
const core = require("photoshop").core;
const { executeAsModal } = require("photoshop").core;
const fs = require("uxp").storage.localFileSystem;

function initUI() {
    try {
        const btnFit = document.getElementById("btnFit");
        const btnFill = document.getElementById("btnFill");
        const btnNewDoc = document.getElementById("btnNewDoc");

        if (btnFit) {
            btnFit.onclick = () => handleResize(false);
        }
        if (btnFill) {
            btnFill.onclick = () => handleResize(true);
        }
        if (btnNewDoc) {
            btnNewDoc.onclick = () => {
                const dlg = document.getElementById("dlgNewDoc");
                if (dlg) dlg.showModal();
            };
        }

        const btnCancel = document.getElementById("btnCancel");
        if (btnCancel) {
            btnCancel.onclick = () => {
                const dlg = document.getElementById("dlgNewDoc");
                if (dlg) dlg.close();
            };
        }

        const drpDialogSize = document.getElementById("drpDialogSize");
        const divCustomSize = document.getElementById("divCustomSize");
        if (drpDialogSize) {
            drpDialogSize.addEventListener("change", (e) => {
                if (e.target.value === "custom") {
                    divCustomSize.style.display = "flex";
                } else {
                    divCustomSize.style.display = "none";
                }
            });
        }

        const btnCreate = document.getElementById("btnCreate");
        if (btnCreate) {
            btnCreate.onclick = () => {
                const dlg = document.getElementById("dlgNewDoc");
                if (dlg) dlg.close();
                handleNewDoc();
            };
        }

        const btnExportLayer = document.getElementById("btnExportLayer");
        if (btnExportLayer) {
            btnExportLayer.onclick = () => handleExport(false);
        }

        const btnExportDoc = document.getElementById("btnExportDoc");
        if (btnExportDoc) {
            btnExportDoc.onclick = () => handleExport(true);
        }
    } catch (err) {
        app.showAlert("Setup Error: " + err.message);
    }
}

const { entrypoints } = require("uxp");
entrypoints.setup({
    panels: {
        resizePanel: {
            show(event) {
                initUI();
            }
        }
    },
    commands: {
        cmdFitCanvas: {
            run: () => handleResize(false)
        },
        cmdFillCanvas: {
            run: () => handleResize(true)
        }
    }
});

function getAutoRotate() {
    return document.getElementById("chkAutoRotate").checked;
}

function getTargetSize() {
    const el = document.getElementById("drpDialogSize");
    const val = el ? el.value : "1080";
    if (val === "custom") {
        const w = parseInt(document.getElementById("txtWidth").value, 10) || 1920;
        const h = parseInt(document.getElementById("txtHeight").value, 10) || 1080;
        return { w: w, h: h };
    }
    switch (val) {
        case "720": return { w: 1280, h: 720 };
        case "1440": return { w: 2560, h: 1440 };
        case "2160": return { w: 3840, h: 2160 };
        case "1080":
        default: return { w: 1920, h: 1080 };
    }
}

async function handleExport(isEntireDoc) {
    if (app.documents.length === 0) {
        await app.showAlert("Please open a document first.");
        return;
    }

    const sourceDoc = app.activeDocument;

    if (!isEntireDoc) {
        const layer = sourceDoc.activeLayers[0];
        if (!layer || layer.isBackgroundLayer || (layer.kind !== "pixel" && layer.kind !== "smartObject")) {
            await app.showAlert("Please select a normal pixel layer or a smart object.");
            return;
        }
    }

    try {
        const defaultName = isEntireDoc ? sourceDoc.name.replace(/\.[^/.]+$/, "") + ".png" : sourceDoc.activeLayers[0].name + ".png";

        // Wait for user to select file target
        const file = await fs.getFileForSaving(defaultName, { types: ["png"] });
        if (!file) return; // User cancelled

        await executeAsModal(async () => {
            if (isEntireDoc) {
                await sourceDoc.saveAs.png(file, { compression: 6 });
            } else {
                // To safely export layer without external dependencies, we isolate it in a new doc.
                const layer = sourceDoc.activeLayers[0];
                const newDoc = await app.createDocument();
                await layer.duplicate(newDoc);
                // Trim standard blank doc bg if present
                const bg = newDoc.layers.find(l => l.isBackgroundLayer);
                if (bg) await bg.delete();

                await newDoc.saveAs.png(file, { compression: 6 });
                await newDoc.close();
            }
        }, { commandName: isEntireDoc ? "Export Doc PNG" : "Export Layer PNG" });

    } catch (e) {
        await app.showAlert("Export Error: " + (e.stack || e.toString() || "Unknown"));
    }
}

async function handleResize(isCrop) {
    if (app.documents.length === 0) {
        await app.showAlert("Please open a document first.");
        return;
    }

    // Quick validate layer before triggering modal
    const layer = app.activeDocument.activeLayers[0];
    if (!layer || layer.isBackgroundLayer || (layer.kind !== "pixel" && layer.kind !== "smartObject")) {
        await app.showAlert("Please select a normal pixel layer or a smart object before using this feature.");
        return;
    }

    const autoRotate = getAutoRotate();
    const historyName = isCrop ? "Fill Canvas (Crop)" : "Fit to Canvas (No Crop)";

    try {
        await executeAsModal(async () => {
            await fitLayerToCanvas(app.activeDocument, isCrop, autoRotate);
        }, { commandName: historyName });
    } catch (e) {
        await app.showAlert("Error during resize: " + (e.stack || e.toString() || "Unknown Error"));
    }
}

async function handleNewDoc() {
    if (app.documents.length === 0) {
        await app.showAlert("Please open a document first.");
        return;
    }

    // Quick validate layer before triggering modal
    const layer = app.activeDocument.activeLayers[0];
    if (!layer || layer.isBackgroundLayer || (layer.kind !== "pixel" && layer.kind !== "smartObject")) {
        await app.showAlert("Please select a normal pixel layer or a smart object before using this feature.");
        return;
    }

    const autoRotate = getAutoRotate();
    const targetSize = getTargetSize();

    try {
        await executeAsModal(async () => {
            await sendToNewDoc(autoRotate, targetSize);
        }, { commandName: "Send to New Document" });
    } catch (e) {
        await app.showAlert("Error creating new document: " + (e.stack || e.toString() || "Unknown Error"));
    }
}

async function sendToNewDoc(autoRotate, targetSize) {
    const sourceDoc = app.activeDocument;
    const layer = sourceDoc.activeLayers[0];

    if (!layer || layer.isBackgroundLayer || (layer.kind !== "pixel" && layer.kind !== "smartObject")) {
        throw new Error("Please select a normal pixel layer or a smart object.");
    }

    // Create a new document (Defaults to 7x5 in at 300ppi if params are failing)
    const newDoc = await app.createDocument();

    // Duplicate layer to the new document
    const duplicatedLayer = await layer.duplicate(newDoc);

    // Set active document and layer
    app.activeDocument = newDoc;
    duplicatedLayer.selected = true;

    // Manually force resize the document canvas
    await newDoc.resizeCanvas(targetSize.w, targetSize.h);

    // Perform fit without crop
    await fitLayerToCanvas(newDoc, false, autoRotate);
}

async function fitLayerToCanvas(doc, crop, autoRotate) {
    try {
        const layer = doc.activeLayers[0];

        if (!layer || layer.isBackgroundLayer || (layer.kind !== "pixel" && layer.kind !== "smartObject")) {
            throw new Error("Please select a normal pixel layer or a smart object.");
        }

        const docWidth = doc.width;
        const docHeight = doc.height;

        let bounds = layer.boundsNoEffects ? layer.boundsNoEffects : layer.bounds;
        let left = bounds.left;
        let top = bounds.top;
        let right = bounds.right;
        let bottom = bounds.bottom;

        let layerWidth = right - left;
        let layerHeight = bottom - top;

        if (layerWidth === 0 || layerHeight === 0) {
            throw new Error("Empty layer selected.");
        }

        if (autoRotate) {
            const docIsLandscape = docWidth > docHeight;
            const layerIsLandscape = layerWidth > layerHeight;

            if (docIsLandscape !== layerIsLandscape) {
                // Translate to center first to avoid rotating out of bounds
                const preRotateTx = (docWidth / 2) - (left + layerWidth / 2);
                const preRotateTy = (docHeight / 2) - (top + layerHeight / 2);
                await layer.translate(preRotateTx, preRotateTy);

                await layer.rotate(90);

                // Refresh bounds
                bounds = layer.boundsNoEffects ? layer.boundsNoEffects : layer.bounds;
                left = bounds.left;
                top = bounds.top;
                right = bounds.right;
                bottom = bounds.bottom;

                layerWidth = right - left;
                layerHeight = bottom - top;
            }
        }

        const scaleX = (docWidth / layerWidth) * 100;
        const scaleY = (docHeight / layerHeight) * 100;

        let scale = 100;
        if (crop) {
            scale = Math.max(scaleX, scaleY);
        } else {
            scale = Math.min(scaleX, scaleY);
        }

        // Center the layer before scaling
        const docCenterX = docWidth / 2;
        const docCenterY = docHeight / 2;
        const layerCenterX = left + (layerWidth / 2);
        const layerCenterY = top + (layerHeight / 2);

        const deltaX = docCenterX - layerCenterX;
        const deltaY = docCenterY - layerCenterY;

        await layer.translate(deltaX, deltaY);

        // Modern UXP rotate/scale applies around the transformation center
        await layer.scale(scale, scale);
    } catch (err) {
        throw new Error("fitLayerToCanvas Error: " + err.message + " " + err.stack);
    }
}
