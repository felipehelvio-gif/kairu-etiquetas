// ═══════════════════════════════════════════
//  KAIRU LABS — Telemetria & Banner Remoto
//  Coleta anonimizada de uso + banners remotos
// ═══════════════════════════════════════════

const KAIRU_API = "https://api.kairulabs.com" // Trocar pelo endpoint real

// ID único da instalação (persistido no config)
function getInstallId(config) {
    if (config.installId) return config.installId
    config.installId = "KL-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 8)
    return config.installId
}

// ─── TELEMETRIA ───
// Envia dados anonimizados a cada startup
async function sendTelemetry(config) {
    try {
        const os = require("os")
        const data = {
            installId: getInstallId(config),
            product: "kairu-etiquetas",
            version: "1.0.0",
            platform: process.platform,      // win32, darwin, linux
            arch: process.arch,               // x64, arm64
            osVersion: os.release(),
            hostname: os.hostname(),           // Nome do PC
            locale: Intl.DateTimeFormat().resolvedOptions().locale,
            timestamp: new Date().toISOString(),
            // Dados de uso (anonimizados — sem dados pessoais sensíveis)
            usage: {
                nomeEmpresa: config.nomeEmpresa || null,
                cnpj: config.cnpj || null,
                hasLogo: !!config.logoBase64,
                labelSize: config.labelSize || "60x60",
                showTime: config.showTime ?? true,
                totalProdutos: (config.products || []).length,
                printerConfigured: !!config.printerName,
            }
        }

        await fetch(`${KAIRU_API}/v1/telemetry`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        })
        console.log("📊 Telemetria enviada")
    } catch (e) {
        // Silenciosamente ignora se offline ou API indisponível
        console.log("📊 Telemetria offline (ok)")
    }
}

// ─── BANNER REMOTO ───
// Busca banner ativo do servidor Kairu
async function fetchBanner() {
    try {
        const res = await fetch(`${KAIRU_API}/v1/banner?product=kairu-etiquetas`, {
            headers: { "Accept": "application/json" },
        })
        if (!res.ok) return null
        const data = await res.json()
        // Esperado: { active: true, html: "...", bgColor: "#...", textColor: "#...", action: { label, url } }
        return data.active ? data : null
    } catch (e) {
        return null
    }
}

// ─── HEARTBEAT ───
// Ping periódico (a cada 4h) para saber quantos usuários ativos
function startHeartbeat(config) {
    const beat = async () => {
        try {
            await fetch(`${KAIRU_API}/v1/heartbeat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    installId: getInstallId(config),
                    product: "kairu-etiquetas",
                    timestamp: new Date().toISOString(),
                })
            })
        } catch (e) { /* silencioso */ }
    }
    beat() // primeiro imediatamente
    setInterval(beat, 4 * 60 * 60 * 1000) // depois a cada 4h
}

module.exports = { sendTelemetry, fetchBanner, startHeartbeat, getInstallId, KAIRU_API }
