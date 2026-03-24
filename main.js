const { app, BrowserWindow, ipcMain, dialog } = require("electron")
const path = require("path")
const fs = require("fs")
const { execFile, exec } = require("child_process")
const os = require("os")
const express = require("express")
const kairu = require("./kairu-sdk")

const configPath = path.join(app.getPath("userData"), "config.json")
const WEB_PORT = 3333

function loadConfig() {
    try {
        if (fs.existsSync(configPath)) return JSON.parse(fs.readFileSync(configPath, "utf-8"))
    } catch (e) { console.error("Erro ao ler config:", e) }
    return {
        nomeEmpresa: "", cnpj: "", logoBase64: "", printerName: "",
        labelSize: "60x60", showTime: true, products: [],
        // Pré-cadastro
        cidade: "", estado: "", tipoCozinha: "", email: "", telefone: "",
        termosAceitos: false,
        // Licença
        licenseKey: "",
    }
}

function saveConfig(config) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
}

// ─── Obter IP local da rede ───
function getLocalIP() {
    const interfaces = os.networkInterfaces()
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) return iface.address
        }
    }
    return "127.0.0.1"
}

// ─── Impressão ZPL ───
function printZPL(zpl, printerName) {
    return new Promise((resolve) => {
        const tmpFile = path.join(os.tmpdir(), `kairu_etiqueta_${Date.now()}.zpl`)
        fs.writeFileSync(tmpFile, zpl)
        const platform = process.platform

        if (platform === "win32") {
            const psCmd = `
                $content = [System.IO.File]::ReadAllBytes("${tmpFile.replace(/\\/g, "\\\\")}")
                $printer = Get-Printer -Name "${printerName}" -ErrorAction SilentlyContinue
                if ($printer) {
                    $port = (Get-PrinterPort -Name $printer.PortName -ErrorAction SilentlyContinue)
                    if ($port -and $port.PrinterHostAddress) {
                        $client = New-Object System.Net.Sockets.TcpClient($port.PrinterHostAddress, 9100)
                        $stream = $client.GetStream()
                        $stream.Write($content, 0, $content.Length)
                        $stream.Close(); $client.Close()
                    } else {
                        Out-File -FilePath "\\\\localhost\\${printerName}" -InputObject ([System.Text.Encoding]::ASCII.GetString($content)) -Encoding ascii -NoNewline
                    }
                    Write-Output "OK"
                } else { Write-Output "PRINTER_NOT_FOUND" }
            `
            exec(`powershell -NoProfile -Command "${psCmd.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, (err) => {
                try { fs.unlinkSync(tmpFile) } catch (e) {}
                if (err) {
                    exec(`lpr -P "${printerName}" "${tmpFile}"`, (err2) => {
                        try { fs.unlinkSync(tmpFile) } catch (e) {}
                        resolve(err2 ? { success: false, error: "Falha ao enviar para impressora" } : { success: true })
                    })
                } else { resolve({ success: true }) }
            })
        } else {
            execFile("lpr", ["-P", printerName, "-o", "raw", tmpFile], (err) => {
                try { fs.unlinkSync(tmpFile) } catch (e) {}
                resolve(err ? { success: false, error: err.message } : { success: true })
            })
        }
    })
}

// ═══ SERVIDOR WEB LOCAL ═══
function startWebServer() {
    const webApp = express()
    webApp.use(express.json({ limit: "10mb" }))

    // Detectar mobile e servir interface otimizada
    webApp.get("/", (req, res, next) => {
        const ua = (req.headers["user-agent"] || "").toLowerCase()
        const isMobile = /mobile|android|iphone|ipad|ipod|tablet/i.test(ua)
        if (isMobile) {
            return res.sendFile(path.join(__dirname, "mobile.html"))
        }
        next()
    })

    webApp.get("/mobile", (req, res) => {
        res.sendFile(path.join(__dirname, "mobile.html"))
    })

    webApp.use(express.static(__dirname))

    webApp.get("/api/config", (req, res) => {
        res.json(loadConfig())
    })

    webApp.get("/api/printers", async (req, res) => {
        try {
            const printers = await mainWindow.webContents.getPrintersAsync()
            res.json(printers.map(p => ({ name: p.name, displayName: p.displayName || p.name, isDefault: p.isDefault })))
        } catch (e) {
            res.json([])
        }
    })

    webApp.post("/api/print", async (req, res) => {
        const { zpl, printerName } = req.body
        if (!zpl || !printerName) return res.status(400).json({ success: false, error: "zpl e printerName obrigatórios" })
        const result = await printZPL(zpl, printerName)
        res.json(result)
    })

    webApp.get("/api/banner", async (req, res) => {
        const config = loadConfig()
        const banner = await kairu.fetchBanner(config, "kairu-etiquetas")
        res.json(banner || { active: false })
    })

    webApp.listen(WEB_PORT, "0.0.0.0", () => {
        const ip = getLocalIP()
        console.log(`🌐 Servidor web rodando em http://${ip}:${WEB_PORT}`)
    })

    return getLocalIP()
}

// ═══ ELECTRON ═══
let mainWindow

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1100, height: 800, minWidth: 900, minHeight: 700,
        title: "Kairu Etiquetas",
        icon: path.join(__dirname, "assets", "icon.png"),
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true, nodeIntegration: false,
        },
    })
    mainWindow.loadFile("index.html")
    if (process.argv.includes("--dev")) mainWindow.webContents.openDevTools()
}

app.whenReady().then(async () => {
    createWindow()
    const localIP = startWebServer()

    // Kairu SDK: telemetria + heartbeat
    const config = loadConfig()
    kairu.getInstallId(config)
    saveConfig(config)
    kairu.sendTelemetry(config, "kairu-etiquetas")
    kairu.startHeartbeat(config, "kairu-etiquetas")

    // Buscar banner remoto
    const banner = await kairu.fetchBanner(config, "kairu-etiquetas")

    // Verificar se é Pro (chave validada)
    const configDir = app.getPath("userData")
    const proStatus = kairu.isPro(config, configDir)

    // Verificar primeiro uso
    const firstRun = kairu.isFirstRun(config)

    mainWindow.webContents.on("did-finish-load", () => {
        mainWindow.webContents.executeJavaScript(`
            window.__localIP = "${localIP}";
            window.__webPort = ${WEB_PORT};
            window.__installId = "${config.installId || ''}";
            window.__isPro = ${proStatus};
            window.__isFirstRun = ${firstRun};
            ${banner ? `window.__kairuBanner = ${JSON.stringify(banner)};` : ''}
            if (typeof updateNetworkInfo === "function") updateNetworkInfo();
            if (typeof showKairuBanner === "function" && !${proStatus}) showKairuBanner();
            if (${firstRun} && typeof showRegistrationModal === "function") showRegistrationModal();
        `)
    })
})

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit() })
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// ─── IPC Handlers ───
ipcMain.handle("load-config", () => loadConfig())
ipcMain.handle("save-config", (_event, config) => { saveConfig(config); return true })

ipcMain.handle("select-logo", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: "Selecionar Logo",
        filters: [{ name: "Imagens", extensions: ["png", "jpg", "jpeg", "bmp", "svg"] }],
        properties: ["openFile"],
    })
    if (result.canceled || !result.filePaths[0]) return null
    const filePath = result.filePaths[0]
    const ext = path.extname(filePath).toLowerCase().replace(".", "")
    const mimeMap = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", bmp: "image/bmp", svg: "image/svg+xml" }
    const base64 = fs.readFileSync(filePath).toString("base64")
    return `data:${mimeMap[ext] || "image/png"};base64,${base64}`
})

ipcMain.handle("list-printers", async () => {
    try {
        const printers = await mainWindow.webContents.getPrintersAsync()
        return printers.map(p => ({ name: p.name, displayName: p.displayName || p.name, isDefault: p.isDefault, status: p.status }))
    } catch (e) { return [] }
})

ipcMain.handle("print-zpl", async (_event, zpl, printerName) => {
    return printZPL(zpl, printerName)
})

ipcMain.handle("save-zpl-file", async (_event, zpl, filename) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        title: "Salvar arquivo ZPL",
        defaultPath: filename,
        filters: [{ name: "Arquivo ZPL", extensions: ["zpl"] }],
    })
    if (result.canceled || !result.filePath) return false
    fs.writeFileSync(result.filePath, zpl)
    return true
})

ipcMain.handle("get-network-info", () => {
    return { ip: getLocalIP(), port: WEB_PORT }
})

// ─── Novos IPC Handlers (Licença + Registro) ───

ipcMain.handle("validate-license", async (_event, key) => {
    const config = loadConfig()
    config.licenseKey = key
    saveConfig(config)
    const configDir = app.getPath("userData")
    return kairu.validateLicense(config, "kairu-etiquetas", configDir)
})

ipcMain.handle("check-pro-status", () => {
    const config = loadConfig()
    const configDir = app.getPath("userData")
    return kairu.isPro(config, configDir)
})

ipcMain.handle("save-registration", async (_event, regData) => {
    const config = loadConfig()
    // Salvar dados no config local
    config.nomeResponsavel = regData.nomeResponsavel || config.nomeResponsavel
    config.cargo = regData.cargo || config.cargo
    config.nomeEmpresa = regData.nomeEmpresa || config.nomeEmpresa
    config.cnpj = regData.cnpj || config.cnpj
    config.cidade = regData.cidade || config.cidade
    config.estado = regData.estado || config.estado
    config.tipoCozinha = regData.tipoCozinha || config.tipoCozinha
    config.email = regData.email || config.email
    config.telefone = regData.telefone || config.telefone
    config.unidades = regData.unidades || config.unidades
    config.funcionarios = regData.funcionarios || config.funcionarios
    config.faturamento = regData.faturamento || config.faturamento
    config.sistemaAtual = regData.sistemaAtual || config.sistemaAtual
    config.delivery = regData.delivery || config.delivery
    config.canalAquisicao = regData.canalAquisicao || config.canalAquisicao
    config.termosAceitos = true
    saveConfig(config)
    // Enviar pro portal
    await kairu.sendRegistration(config, "kairu-etiquetas")
    return true
})

ipcMain.handle("track-banner", async (_event, bannerId, type) => {
    const config = loadConfig()
    await kairu.trackBanner(config, bannerId, type)
    return true
})
