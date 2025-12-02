/* ============================
   ENTREGA DE EVIDENCIAS
   registro_evidencias.js
   ============================ */

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

const fileInput = document.getElementById("file-input");
const preview = document.getElementById("preview");
const btnUpload = document.getElementById("btn-upload");
const messageBox = document.getElementById("message");

let selectedFiles = [];

/* =========================================
   1. Vista previa de imágenes
========================================= */
fileInput.addEventListener("change", (e) => {
    preview.innerHTML = "";
    selectedFiles = Array.from(e.target.files);

    if (selectedFiles.length > 4) {
        showMessage("Solo puedes subir un máximo de 4 imágenes.", "error");
        fileInput.value = "";
        selectedFiles = [];
        return;
    }

    selectedFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = document.createElement("img");
            img.src = ev.target.result;
            preview.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
});

/* =========================================
   2. Subida de evidencias
========================================= */
btnUpload.addEventListener("click", async () => {
    if (selectedFiles.length === 0) {
        showMessage("Selecciona o toma al menos 1 fotografía.", "error");
        return;
    }

    const user = auth.currentUser;
    if (!user) {
        showMessage("Error: usuario no autenticado.", "error");
        return;
    }

    btnUpload.disabled = true;
    showMessage("Subiendo evidencias, por favor espera...", "info");

    try {
        const timestamp = new Date();
        const folderPath = `evidencias/${user.uid}/${timestamp.getTime()}/`;

        const uploadPromises = selectedFiles.map((file, index) => {
            const fileRef = storage.ref().child(folderPath + `foto_${index + 1}.jpg`);
            return fileRef.put(file).then(() => fileRef.getDownloadURL());
        });

        const urls = await Promise.all(uploadPromises);

        await db.collection("evidencias").add({
            uid: user.uid,
            urls: urls,
            fecha: timestamp.toLocaleDateString(),
            hora: timestamp.toLocaleTimeString(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        showMessage("¡Evidencias subidas correctamente!", "success");
        resetForm();

    } catch (error) {
        console.error(error);
        showMessage("Error al subir las evidencias. Intenta nuevamente.", "error");
    } finally {
        btnUpload.disabled = false;
    }
});

/* =========================================
   3. Función para mensajes
========================================= */
function showMessage(text, type) {
    messageBox.textContent = text;
    messageBox.className = "message " + type;

    if (type === "success") {
        setTimeout(() => {
            messageBox.textContent = "";
            messageBox.className = "message";
        }, 2500);
    }
}

/* =========================================
   4. Limpiar todo al terminar
========================================= */
function resetForm() {
    fileInput.value = "";
    selectedFiles = [];
    preview.innerHTML = "";
}
