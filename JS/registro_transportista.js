// URL del backend (Apps Script Web App)
const URL_BACKEND = "https://script.google.com/macros/s/AKfycbw1cHd63Ss3iaYO3P-JG92mvS2meDx9F7pcF_WrBHg4LoYicxPJfXuUmlFEP8EeJPS8/exec";

document.addEventListener("DOMContentLoaded", () => {

    const inputId = document.getElementById("inputIdTransportista");
    const inputNombreAgencia = document.getElementById("inputNombreAgencia");
    const inputNombreCliente = document.getElementById("inputNombreCliente");
    const inputNombreCedi = document.getElementById("inputNombreCedi");
    const inputHoraEntrega = document.getElementById("inputHoraEntrega");

    const btnEntregaAgencia = document.getElementById("btnEntregaAgencia");
    const btnEntregaCliente = document.getElementById("btnEntregaCliente");

    const bloqueQR = document.getElementById("qr-reader");
    const bloqueCliente = document.getElementById("bloqueCliente");

    const btnAgregarTO = document.getElementById("btnAgregarTO");
    const contenedorTOs = document.getElementById("contenedorTOs");

    const btnIncidenciaSi = document.getElementById("btnIncidenciaSi");
    const btnIncidenciaNo = document.getElementById("btnIncidenciaNo");
    const bloqueIncidencia = document.getElementById("bloqueIncidencia");
    const inputFotos = document.getElementById("inputFotosIncidencia");
    const inputNotas = document.getElementById("inputNotasIncidencia");
    const previewIncidencia = document.getElementById("previewIncidencia");
    const btnGuardar = document.getElementById("btnGuardarEntrega");
    const beep = document.getElementById("beepSound");

    let modoEntrega = "AGENCIA";
    let huboIncidencia = false;

    // ============================
    // MODO ENTREGA
    // ============================
    btnEntregaAgencia.onclick = () => {
        modoEntrega = "AGENCIA";
        bloqueQR.style.display = "block";
        inputNombreAgencia.parentElement.style.display = "block";
        bloqueCliente.style.display = "none";
    };

    btnEntregaCliente.onclick = () => {
        modoEntrega = "CLIENTE";
        bloqueQR.style.display = "none";
        inputNombreAgencia.value = "";
        inputNombreAgencia.parentElement.style.display = "none";
        bloqueCliente.style.display = "block";
    };

    // ============================
    // AGREGAR TO
    // ============================
    btnAgregarTO.onclick = () => {
        const input = document.createElement("input");
        input.className = "form-control mb-2 to-input";
        input.placeholder = "Ingresa otra TO";
        contenedorTOs.appendChild(input);
    };

    // ============================
    // QR
    // ============================
const qr = new Html5Qrcode("qr-reader");

Html5Qrcode.getCameras().then(cameras => {
    if (!cameras || cameras.length === 0) return;

    // Buscar cámara trasera
    let camaraTrasera = cameras.find(cam =>
        cam.label.toLowerCase().includes("back") ||
        cam.label.toLowerCase().includes("rear")
    );

    // Si no encuentra trasera, usa la primera disponible
    let cameraId = camaraTrasera ? camaraTrasera.id : cameras[0].id;

    qr.start(
        cameraId,
        { fps: 10, qrbox: 250 },
        text => {
            if (modoEntrega !== "AGENCIA") return;

            try { beep.play(); } catch {}

            let data;
            try {
                data = JSON.parse(text);
            } catch {
                return mostrarAlerta("QR inválido", "danger");
            }

            inputNombreAgencia.value = data.agencia || "";
            inputNombreCedi.value = data.cedi || "";

            mostrarAlerta("QR leído correctamente", "success");
        }
    );
});


    // ============================
    // INCIDENCIA
    // ============================
    btnIncidenciaSi.onclick = () => {
        huboIncidencia = true;
        bloqueIncidencia.style.display = "block";
    };

    btnIncidenciaNo.onclick = () => {
        huboIncidencia = false;
        bloqueIncidencia.style.display = "none";
    };

    inputFotos.onchange = () => {
    previewIncidencia.innerHTML = "";

    if (inputFotos.files.length > 3) {
        mostrarAlerta("Solo puedes subir máximo 3 fotos", "danger");
        inputFotos.value = ""; // limpia selección
        return;
    }

    [...inputFotos.files].forEach(f => {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(f);
        img.className = "preview";
        previewIncidencia.appendChild(img);
    });
};


    // ============================
    // GUARDAR
    // ============================
btnGuardar.onclick = async () => {
  try {
    btnGuardar.disabled = true;

    const idTransportista = inputId.value.trim();
    if (!idTransportista) throw "ID obligatorio";

    const nombreRegistro = modoEntrega === "AGENCIA"
      ? inputNombreAgencia.value.trim()
      : inputNombreCliente.value.trim();

    if (!nombreRegistro) throw "Nombre requerido";

    const tos = [...document.querySelectorAll(".to-input")]
      .map(i => i.value.trim())
      .filter(Boolean);

    if (!tos.length) throw "Ingresa al menos una TO";

    if (huboIncidencia) {
      if (!inputFotos.files.length) throw "Debes subir fotos";
      if (!inputNotas.value.trim()) throw "Notas obligatorias";
    }

    const hora = new Date().toLocaleTimeString("es-MX", { hour12:false });
    const idEntrega = crypto.randomUUID();

    let fotosBase64 = [];
    if (huboIncidencia) {
      for (const file of inputFotos.files) {
        fotosBase64.push(await fileToBase64(file));
      }
    }

    const response = await fetch(URL_BACKEND, {
      method: "POST",
      body: JSON.stringify({
        action: "registrarEntrega",
        data: {
          id_entrega: idEntrega,
          ID_transportista: idTransportista,
          modo_entrega: modoEntrega,
          nombre_registro: nombreRegistro,
          cedi: inputNombreCedi.value.trim(),
          hora_entrega: hora,
          TOs: tos,
          incidencia: huboIncidencia ? "SI" : "NO",
          notas: inputNotas.value.trim(),
          fotos: fotosBase64
        }
      })
    });

    if (huboIncidencia) {
  for (const foto of fotosBase64) {
    await fetch(URL_BACKEND, {
      method: "POST",
      body: JSON.stringify({
        action: "subirFotoEntrega",
        data: {
          id_entrega: idEntrega,
          foto: foto
        }
      })
    });
  }
}


    const result = await response.json();
    console.log("Respuesta backend:", result);

    if (result.status !== "ok") {
      throw result.message || "Error backend";
    }

    mostrarAlerta("Entrega registrada correctamente", "success");
    limpiarFormulario();

  } catch (err) {
    console.error(err);
    mostrarAlerta(err.toString(), "danger");
  } finally {
    btnGuardar.disabled = false;
  }
};


    function fileToBase64(file) {
        return new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
    }

    function mostrarAlerta(msg, tipo) {
        document.getElementById("alertPlaceholder").innerHTML =
            `<div class="alert alert-${tipo}">${msg}</div>`;
    }

    function limpiarFormulario() {
        inputNombreCliente.value = "";
        inputNombreAgencia.value = "";
        inputNombreCedi.value = "";
        inputNotas.value = "";
        inputFotos.value = "";
        previewIncidencia.innerHTML = "";
        contenedorTOs.innerHTML =
            `<input class="form-control mb-2 to-input" placeholder="Ingresa una TO">`;
    }

});
