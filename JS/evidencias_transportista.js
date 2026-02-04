// URL del backend (Apps Script Web App)
const URL_BACKEND = "https://script.google.com/macros/s/AKfycbw1cHd63Ss3iaYO3P-JG92mvS2meDx9F7pcF_WrBHg4LoYicxPJfXuUmlFEP8EeJPS8/exec";

document.addEventListener("DOMContentLoaded", () => {

  const inputId = document.getElementById("inputIdTransportista");
  const contenedorTOs = document.getElementById("contenedorTOs");
  const btnAgregarTO = document.getElementById("btnAgregarTO");

  const inputFotos = document.getElementById("inputFotosEvidencia");
  const previewFotos = document.getElementById("previewEvidencias");

  const inputNotas = document.getElementById("inputNotas");
  const inputHoraCarga = document.getElementById("inputHoraCarga");
  const btnGuardar = document.getElementById("btnGuardarEvidencia");

  const alertHolder = document.getElementById("alertPlaceholder");

  const MAX_FOTOS = 3;

  // ================= TOs =================
  btnAgregarTO.onclick = () => {
    const input = document.createElement("input");
    input.className = "form-control mb-2 to-input";
    input.placeholder = "Ingresa otra TO";
    contenedorTOs.appendChild(input);
  };

  // ================= FOTOS =================
  inputFotos.onchange = () => {
    previewFotos.innerHTML = "";

    if (inputFotos.files.length > MAX_FOTOS) {
      mostrarAlerta(`Máximo ${MAX_FOTOS} fotos`, "danger");
      inputFotos.value = "";
      return;
    }

    [...inputFotos.files].forEach(file => {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);
      img.className = "preview";
      previewFotos.appendChild(img);
    });
  };

  // ================= GUARDAR =================
  btnGuardar.onclick = async () => {
    try {
      btnGuardar.disabled = true;

      const ID_transportista = inputId.value.trim();
      if (!ID_transportista) throw "ID obligatorio";

      const TOs = [...document.querySelectorAll(".to-input")]
        .map(i => i.value.trim())
        .filter(Boolean);

      if (!TOs.length) throw "Ingresa al menos una TO";
      if (!inputFotos.files.length) throw "Debes subir al menos una foto";

      const hora = new Date().toLocaleTimeString("es-MX", { hour12: false });
      inputHoraCarga.value = hora;

      // convertir fotos a base64
      const fotosBase64 = [];
      for (const file of inputFotos.files) {
        fotosBase64.push(await fileToBase64(file));
      }

      // 1️⃣ Registrar evidencias (HOJA)
      const response = await fetch(URL_BACKEND, {
        method: "POST",
        body: JSON.stringify({
          action: "registrarEvidenciasEntrega",
          data: {
            ID_transportista,
            TOs,
            hora_carga: hora,
            notas: inputNotas.value.trim()
          }
        })
      });

      const result = await response.json();
      console.log("Registrar evidencias:", result);

      if (result.status !== "ok") {
        throw result.message || "Error registrando evidencias";
      }

      // 2️⃣ Subir fotos (DRIVE + LINKS)
      for (const TO of TOs) {
        for (const foto of fotosBase64) {
          const resFoto = await fetch(URL_BACKEND, {
            method: "POST",
            body: JSON.stringify({
              action: "subirFotoEvidencia",
              data: {
                ID_transportista,
                TO,
                foto
              }
            })
          });

          const jsonFoto = await resFoto.json();
          if (jsonFoto.status !== "ok") {
            throw jsonFoto.message || "Error subiendo foto";
          }
        }
      }

      mostrarAlerta("Evidencias registradas correctamente", "success");
      limpiarFormulario();

    } catch (err) {
      console.error(err);
      mostrarAlerta(err.toString(), "danger");
    } finally {
      btnGuardar.disabled = false;
    }
  };

  // ================= HELPERS =================
  function fileToBase64(file) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  function mostrarAlerta(msg, tipo) {
    alertHolder.innerHTML =
      `<div class="alert alert-${tipo} mt-2">${msg}</div>`;
  }

  function limpiarFormulario() {
    inputId.value = "";
    contenedorTOs.innerHTML =
      `<input class="form-control mb-2 to-input" placeholder="Ingresa una TO">`;
    inputFotos.value = "";
    previewFotos.innerHTML = "";
    inputNotas.value = "";
    inputHoraCarga.value = "";
  }

});


