// ═══════════════════════════════════════════
//  GERADOR ZPL — Kairu Etiquetas (Standalone)
//  Zebra ZD220 — ALL BLACK — 60x40 e 60x60
// ═══════════════════════════════════════════

function sanitizeZPL(text) {
    return text
        .replace(/\^/g, "").replace(/~/g, "")
        .replace(/[àáâãä]/g, "a").replace(/[éêèë]/g, "e")
        .replace(/[íìïî]/g, "i").replace(/[óôõòö]/g, "o")
        .replace(/[úùüû]/g, "u").replace(/[ç]/g, "c")
        .replace(/[ÀÁÂÃÄ]/g, "A").replace(/[ÉÊÈË]/g, "E")
        .replace(/[ÍÌÏÎ]/g, "I").replace(/[ÓÔÕÒÖ]/g, "O")
        .replace(/[ÚÙÜÛ]/g, "U").replace(/[Ç]/g, "C")
}

function generateZPL(data, size) {
    if (size === "60x40") return generateZPL_60x40(data)
    return generateZPL_60x60(data)
}

function generateZPL_60x60(data) {
    const nome = sanitizeZPL(data.nomeProduto).toUpperCase()
    const conservacao = sanitizeZPL(data.conservacao)
    const responsavel = sanitizeZPL(data.responsavel).toUpperCase()
    let n1 = nome, n2 = ""
    if (nome.length > 22) {
        const palavras = nome.split(" ")
        n1 = ""
        for (const p of palavras) {
            if ((n1 + " " + p).trim().length <= 22) { n1 = (n1 + " " + p).trim() }
            else { n2 = palavras.slice(palavras.indexOf(p)).join(" "); break }
        }
        if (n2.length > 24) n2 = n2.substring(0, 22) + ".."
    }
    let z = "^XA\n^PR3,3,3\n~SD25\n^PW480\n^LL480\n^LH8,6\n"
    if (data.nomeRede) { z += "^CF0,18\n"; z += `^FO0,6^FD${sanitizeZPL(data.nomeRede).toUpperCase()}^FS\n` }
    z += "^FO0,28^GB460,3,3^FS\n"
    z += "^CF0,42\n"
    z += `^FO0,38^FD${n1}^FS\n`
    if (n2) z += `^FO0,82^FD${n2}^FS\n`
    const yAN = n2 ? 120 : 88
    z += `^FO0,${yAN}^GB460,2,2^FS\n`
    const yC = yAN + 12
    z += "^CF0,28\n"
    z += `^FO0,${yC}^FD${conservacao}^FS\n`
    if (data.quantidade) z += `^FO260,${yC}^FDQTD: ${sanitizeZPL(data.quantidade)}^FS\n`
    const yL2 = yC + 38
    z += `^FO0,${yL2}^GB460,1,1^FS\n`
    const yM = yL2 + 18
    z += "^CF0,30\n"
    z += `^FO0,${yM}^FDMANIPULACAO:^FS\n`
    z += `^FO230,${yM}^FD${data.dataManipulacao}^FS\n`
    const yV = yM + 42
    z += `^FO0,${yV}^FDVALIDADE:^FS\n`
    z += `^FO230,${yV}^FD${data.dataValidade}^FS\n`
    const yL3 = yV + 42
    z += `^FO0,${yL3}^GB460,1,1^FS\n`
    const yR = yL3 + 16
    z += "^CF0,36\n"
    z += `^FO0,${yR}^FDRESP.: ${responsavel}^FS\n`
    const yLo = yR + 44
    if (data.lote) { z += "^CF0,24\n"; z += `^FO0,${yLo}^FDLOTE: ${sanitizeZPL(data.lote)}^FS\n` }
    const yFL = data.lote ? yLo + 35 : yR + 50
    z += `^FO0,${yFL}^GB460,3,3^FS\n`
    z += "^CF0,20\n"
    let fY = yFL + 14
    if (data.cnpj) { z += `^FO0,${fY}^FDCNPJ: ${data.cnpj}^FS\n`; fY += 24 }
    if (data.nomeRede) { z += `^FO0,${fY}^FD${sanitizeZPL(data.nomeRede).toUpperCase()}^FS\n`; fY += 24 }
    // Branding FREE — remove quando PRO/BUSINESS
    if (!data.isPaid) {
        z += "^CF0,18\n"
        z += `^FO290,${fY+2}^FDKAIRU LABS^FS\n`
    }
    z += "^XZ\n"
    return z
}

function generateZPL_60x40(data) {
    const nome = sanitizeZPL(data.nomeProduto.length > 28 ? data.nomeProduto.substring(0, 26) + ".." : data.nomeProduto).toUpperCase()
    const conservacao = sanitizeZPL(data.conservacao)
    const responsavel = sanitizeZPL(data.responsavel).toUpperCase()
    let z = "^XA\n^PR3,3,3\n~SD25\n^PW480\n^LL320\n^LH8,4\n"
    if (data.nomeRede) { z += "^CF0,16\n"; z += `^FO0,4^FD${sanitizeZPL(data.nomeRede).toUpperCase()}^FS\n` }
    z += "^FO0,24^GB460,3,3^FS\n"
    z += `^CF0,36\n^FO0,32^FD${nome}^FS\n^FO0,72^GB460,2,2^FS\n`
    z += "^CF0,22\n"
    z += `^FO0,80^FD${conservacao}^FS\n`
    if (data.quantidade) z += `^FO280,80^FDQTD: ${sanitizeZPL(data.quantidade)}^FS\n`
    z += "^FO0,106^GB460,1,1^FS\n"
    z += "^CF0,24\n"
    z += `^FO0,116^FDMANIPULACAO:^FS\n^FO240,116^FD${data.dataManipulacao}^FS\n`
    z += `^FO0,148^FDVALIDADE:^FS\n^FO240,148^FD${data.dataValidade}^FS\n`
    z += "^FO0,178^GB460,1,1^FS\n"
    z += `^CF0,28\n^FO0,188^FDRESP.: ${responsavel}^FS\n`
    if (data.lote) { z += "^CF0,20\n"; z += `^FO0,222^FDLOTE: ${sanitizeZPL(data.lote)}^FS\n` }
    z += "^FO0,250^GB460,3,3^FS\n"
    z += "^CF0,16\n"
    let fY = 260
    if (data.cnpj) { z += `^FO0,${fY}^FDCNPJ: ${data.cnpj}^FS\n`; fY += 20 }
    // Branding FREE — remove quando PRO/BUSINESS
    if (!data.isPaid) {
        z += "^CF0,16\n"
        z += `^FO310,${fY+2}^FDKAIRU LABS^FS\n`
    }
    z += "^XZ\n"
    return z
}

function generateZPLMultiple(data, copies, size) {
    let zpl = ""
    for (let i = 0; i < copies; i++) zpl += generateZPL(data, size)
    return zpl
}

function formatDateTime(date) {
    const d = String(date.getDate()).padStart(2, "0")
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const y = String(date.getFullYear()).slice(-2)
    const h = String(date.getHours()).padStart(2, "0")
    const min = String(date.getMinutes()).padStart(2, "0")
    return `${d}/${m}/${y} - ${h}H${min}`
}

function formatDateOnly(date) {
    const d = String(date.getDate()).padStart(2, "0")
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const y = String(date.getFullYear()).slice(-2)
    return `${d}/${m}/${y}`
}
