

let qrScanner = null;
let lastRecordId = null;

// Referencias al DOM
const qrReader = document.getElementById("qr-reader");
const controlsAgencia = document.getElementById("controls-agencia");
const controlsCliente = document.getElementById("controls-cliente");
const lastRecordDiv = document.getElementById("last-record");
const messageDiv = document.getElementById("message");

const btnStart = document.getElementById("btn-start");
const btnStop = document.getElementById("btn-stop");
const btnSalida = document.getElementById("btn-salida");

const btnAgencia = document.getElementById("btn-agencia");
const btnCliente = document.getElementById("btn-cliente");
const btnRegistrarCliente = document.getElementById("btn-registrar-cliente");

// Firebase
const db = firebase.firestore();


// ---------------------------------------------------------
//  FUNCIÓN PARA MOSTRAR MENSAJES
// ---------------------------------------------------------
function showMessage(text, type = "info") {
    messageDiv.textContent = text;
    messageDiv.style.color = type === "error" ? "#ff4e4e" : "#4eff8c";
}


// ---------------------------------------------------------
//  LIMPIAR ÚLTIMO REGISTRO DE LA TARJETA
// ---------------------------------------------------------
function updateLastRecord(info) {
    lastRecordDiv.innerHTML = `
      <p><strong>ID:</strong> ${info.id}</p>
      <p><strong>Tipo:</strong> ${info.tipo}</p>
      <p><strong>Entrada:</strong> ${info.entrada}</p>
      <p><strong>Salida:</strong> ${info.salida || "—"}</p>
      <p><strong>Evidencia:</strong> ${info.evidencia}</p>
    `;
}


// ---------------------------------------------------------
//  REGISTRO PARA ENTREGA A AGENCIA (CON QR)
// ---------------------------------------------------------
async function registrarAgenciaEntrada(qrData) {
    try {
        const id = "AGENCIA-" + Date.now();

        const data = {
            id,
            tipo: "AGENCIA",
            qr: qrData,
            entrada: new Date().toISOString(),
            salida: "",
            evidencia: "QR ESCANEADO"
        };

        await db.collection("registros_agencia").doc(id).set(data);

        lastRecordId = id;
        updateLastRecord(data);
        showMessage("Entrada registrada correctamente.");

        btnSalida.classList.remove("hidden");
        btnSalida.dataset.id = id;

    } catch (e) {
        showMessage("Error al registrar entrada.", "error");
        console.error(e);
    }
}


async function registrarAgenciaSalida(id) {
    try {
        await db.collection("registros_agencia").doc(id).update({
            salida: new Date().toISOString()
        });

        showMessage("Salida registrada correctamente.");

        lastRecordDiv.innerHTML += `<p><strong>Salida:</strong> ${new Date().toISOString()}</p>`;

    } catch (e) {
        showMessage("Error al registrar salida.", "error");
        console.error(e);
    }
}


// ---------------------------------------------------------
//  REGISTRO PARA ENTREGA A CLIENTE (SIN QR)
// ---------------------------------------------------------
async function registrarEntregaCliente() {
    try {
        const id = "CLIENTE-" + Date.now();

        const data = {
            id,
            tipo: "CLIENTE",
            entrada: new Date().toISOString(),
            salida: "",
            evidencia: "ENTREGA A CLIENTE"
        };

        await db.collection("registros_agencia").doc(id).set(data);

        lastRecordId = id;
        updateLastRecord(data);
        showMessage("Entrega al cliente registrada exitosamente.");

    } catch (e) {
        showMessage("Error registrando entrega.", "error");
        console.error(e);
    }
}


// ---------------------------------------------------------
//  EVENTOS DE BOTONES PRINCIPALES
// ---------------------------------------------------------

// Selección AGENCIA
btnAgencia.addEventListener("click", () => {
    qrReader.classList.remove("hidden");
    controlsAgencia.classList.remove("hidden");

    controlsCliente.classList.add("hidden");
    showMessage("Modo AGENCIA seleccionado.");
});

// Selección CLIENTE
btnCliente.addEventListener("click", () => {
    controlsCliente.classList.remove("hidden");

    qrReader.classList.add("hidden");
    controlsAgencia.classList.add("hidden");

    showMessage("Modo CLIENTE seleccionado.");
});


// ---------------------------------------------------------
//  SCANNER QR
// ---------------------------------------------------------
btnStart.addEventListener("click", async () => {
    try {
        if (qrScanner) {
            await qrScanner.stop();
        }

        qrScanner = new Html5Qrcode("qr-reader");

        await qrScanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: 250 },
            message => {
                registrarAgenciaEntrada(message);

                // Detener para evitar múltiples lecturas
                qrScanner.stop();
            }
        );

        showMessage("Escaneo iniciado…");

    } catch (e) {
        showMessage("No se pudo iniciar la cámara.", "error");
    }
});

btnStop.addEventListener("click", () => {
    if (qrScanner) {
        qrScanner.stop();
        showMessage("Escaneo detenido.");
    }
});


// ---------------------------------------------------------
//  BOTÓN SALIDA AGENCIA
// ---------------------------------------------------------
btnSalida.addEventListener("click", () => {
    if (btnSalida.dataset.id) {
        registrarAgenciaSalida(btnSalida.dataset.id);
    }
});


// ---------------------------------------------------------
//  BOTÓN REGISTRO CLIENTE
// ---------------------------------------------------------
btnRegistrarCliente.addEventListener("click", () => {
    registrarEntregaCliente();
});
