const URL_BACKEND = "";

let datosTransportista = {};
let salidaConfirmada = false;
let qrSalida = null;
let html5QrCode = null;
let toRegistradas = false;


document.addEventListener("DOMContentLoaded", () => {

    // =======================================================
    // LECTOR QR → LLEGADA
    // =======================================================
html5QrCode = new Html5Qrcode("qr-reader");

html5QrCode.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 250 },
    qr => {

        document.getElementById("beepSound").play();

        try {
            const data = JSON.parse(qr);

            document.getElementById("id_transportista").value = data.id_transportista || "";
            document.getElementById("nombre").value = data.nombre || "";
            document.getElementById("linea").value = data.linea_transporte || "";
            document.getElementById("placas").value = data.placas || "";
            document.getElementById("unidad").value = data.unidad || "";

            datosTransportista = {
                id_transportista: data.id_transportista,
                nombre: data.nombre,
                linea_transporte: data.linea_transporte,
                placas: data.placas,
                unidad: data.unidad
            };

            toRegistradas = false;
            document.getElementById("btnRegistrarTO").disabled = false;

        } catch {
            alert("QR inválido");
        }
    }
);


    // =======================================================
    // REGISTRAR LLEGADA
    // =======================================================
    document.getElementById("btnRegistrarLlegada").addEventListener("click", () => {

        if (!datosTransportista.id_transportista) {
            alert("Primero escanee la credencial.");
            return;
        }

        fetch(URL_BACKEND, {
    method: "POST",
    body: JSON.stringify({
        action: "registrarEntradaCEDI",
        data: datosTransportista
    })
});

alert("Llegada registrada correctamente.");

    });

    // =======================================================
    // GENERAR CAMPOS DE TO
    // =======================================================
    document.getElementById("btnGenerarInputs").addEventListener("click", () => {
        const cantidad = parseInt(document.getElementById("cantidadTO").value);
        const contenedor = document.getElementById("contenedorTO");

        contenedor.innerHTML = "";

        if (!cantidad || cantidad <= 0) {
            alert("Ingrese una cantidad válida.");
            return;
        }

        for (let i = 1; i <= cantidad; i++) {
            contenedor.innerHTML += `
                <label class="form-label mt-2">TO #${i}</label>
                <input type="text" class="form-control to-input" placeholder="TO ${i}">
            `;
        }
    });

    // =======================================================
    // REGISTRAR TO + MOSTRAR SALIDA
    // =======================================================
    document.getElementById("btnRegistrarTO").addEventListener("click", async () => {

    if (toRegistradas) {
        alert("Las TO ya fueron registradas. Inicie un nuevo registro.");
        return;
    }

    const btn = document.getElementById("btnRegistrarTO");
    btn.disabled = true;
    toRegistradas = true;


    const inputs = document.querySelectorAll(".to-input");

    if (inputs.length === 0) {
        alert("Primero genere los campos.");
        btn.disabled = false;
        return;
    }

    for (const input of inputs) {

        const to = input.value.trim();
        if (!to) continue;

        try {
            await fetch(URL_BACKEND, {
                method: "POST",
                body: JSON.stringify({
                    action: "registrarTO",
                    data: {
                        ...datosTransportista,
                        to: to
                    }
                })
            });

            // pequeña pausa para Apps Script
            await new Promise(r => setTimeout(r, 200));

        } catch (err) {
            console.error("Error registrando TO:", to);
        }
    }

    alert("TO registradas correctamente.");

    document.getElementById("cardSalida").style.display = "block";
    iniciarQrSalida();

    
});

// =======================================================
// INICIAR QR SALIDA
// =======================================================
function iniciarQrSalida() {

    if (qrSalida) return;

    // 👇 Asegurar que el contenedor sea visible al iniciar
    const contenedorQr = document.getElementById("qr-reader-salida");
    contenedorQr.style.display = "block";

    qrSalida = new Html5Qrcode("qr-reader-salida");

    qrSalida.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        async qr => {

            document.getElementById("beepSound").play();

            try {
                const dataSalida = JSON.parse(qr);

                if (dataSalida.id_transportista !== datosTransportista.id_transportista) {
                    alert("⚠ QR incorrecto.");
                    return;
                }

                // ✅ Confirmación correcta
                salidaConfirmada = true;
                document.getElementById("btnConfirmarSalida").disabled = false;

                // 🛑 DETENER Y LIMPIAR COMPLETAMENTE EL LECTOR
                await qrSalida.stop();
                await qrSalida.clear();
                qrSalida = null;

                // 👇 CLAVE: ocultar lector para liberar la pantalla (Safari iOS)
                contenedorQr.style.display = "none";

                alert("QR validado. Confirme salida.");

            } catch (e) {

                if (qrSalida) {
                    await qrSalida.stop();
                    await qrSalida.clear();
                    qrSalida = null;
                }

                contenedorQr.style.display = "none";
                alert("QR inválido");
            }
        }
    );
}




    // =======================================================
    // CONFIRMAR SALIDA FINAL
    // =======================================================
document.getElementById("btnConfirmarSalida").addEventListener("click", async () => {

    if (enviandoSalida) return; // 👈 BLOQUEO TOTAL
    enviandoSalida = true;

    if (!salidaConfirmada) {
        alert("Debe escanear el QR para confirmar salida.");
        enviandoSalida = false;
        return;
    }

    const btn = document.getElementById("btnConfirmarSalida");
    btn.disabled = true;

    try {
        const response = await fetch(URL_BACKEND, {
            method: "POST",
            body: JSON.stringify({
                action: "registrarSalidaCEDI",
                data: datosTransportista
            })
        });

        if (!response.ok) throw new Error("Error backend");

        alert("Salida del CEDI registrada correctamente.");
        limpiarPantalla();

    } catch (error) {
        console.error(error);
        alert("Error al registrar la salida.");
        btn.disabled = false;

    } finally {
        enviandoSalida = false; // 👈 libera solo al final
    }
});




});

// =======================================================
// LIMPIAR PANTALLA
// =======================================================
function limpiarPantalla() {

    document.querySelectorAll("input, textarea").forEach(el => {
        if (el.type !== "button" && el.type !== "submit") {
            el.value = "";
        }
    });

    const contenedorTO = document.getElementById("contenedorTO");
    if (contenedorTO) contenedorTO.innerHTML = "";

    const cardSalida = document.getElementById("cardSalida");
    if (cardSalida) cardSalida.style.display = "none";

    const btnConfirmar = document.getElementById("btnConfirmarSalida");
    if (btnConfirmar) btnConfirmar.disabled = true;

    datosTransportista = {};
    salidaConfirmada = false;

    if (html5QrCode) html5QrCode.stop().catch(() => {});
    if (qrSalida) {
    qrSalida.stop().catch(() => {});
    qrSalida.clear().catch(() => {});
    qrSalida = null;
}


    mostrarMensajeListo();
    toRegistradas = false;
    document.getElementById("btnRegistrarTO").disabled = true;

}

function mostrarMensajeListo() {
    let msg = document.getElementById("mensajeListo");

    if (!msg) {
        msg = document.createElement("div");
        msg.id = "mensajeListo";
        msg.className = "alert alert-success text-center mt-3";
        msg.innerText = "Listo para nuevo registro";
        document.querySelector(".container").appendChild(msg);
    }

    msg.style.display = "block";

    setTimeout(() => {
        msg.style.display = "none";
    }, 3000);
}
