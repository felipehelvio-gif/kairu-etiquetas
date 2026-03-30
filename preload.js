const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("api", {
    // Config
    loadConfig: () => ipcRenderer.invoke("load-config"),
    saveConfig: (config) => ipcRenderer.invoke("save-config", config),

    // Arquivo
    selectLogo: () => ipcRenderer.invoke("select-logo"),
    saveZPLFile: (zpl, filename) => ipcRenderer.invoke("save-zpl-file", zpl, filename),

    // Impressão
    listPrinters: () => ipcRenderer.invoke("list-printers"),
    printZPL: (zpl, printerName) => ipcRenderer.invoke("print-zpl", zpl, printerName),

    // Rede
    getNetworkInfo: () => ipcRenderer.invoke("get-network-info"),

    // Pré-cadastro
    saveRegistration: (data) => ipcRenderer.invoke("save-registration", data),

    // Banner tracking
    trackBanner: (bannerId, type) => ipcRenderer.invoke("track-banner", bannerId, type),

    // Abrir link externo
    openExternal: (url) => ipcRenderer.invoke("open-external", url),
})
