/* =================================================
   ANALISTA - VISUALIZACIÓN Y DESCARGA DE EVIDENCIAS
====================================================*/

const auth = firebase.auth();
const db = firebase.firestore();

const listContainer = document.getElementById("evidencias-list");

const modal = document.getElementById("imgModal");
const modalImg = document.getElementById("modalImg");
const closeModal = document.getElementById("closeModal");

/* ============================================
   1. Cargar evidencias desde Firestore
============================================ */
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        listContainer.innerHTML = "<p>No autorizado.</p>";
        return;
    }

    const snapshot = await db.collection("evidencias")
        .orderBy("timestamp", "desc")
        .get();

    if (snapshot.empty) {
        listContainer.innerHTML = "<p class='muted'>No hay evidencias registradas.</p>";
        return;
    }

    listContainer.innerHTML = "";

    snapshot.forEach((doc) => {
        const data = doc.data();

        const item = document.createElement("div");
        item.className = "evidencia-item";

        item.innerHTML = `
            <div class="evidencia-header">
                <strong>${data.fecha} - ${data.hora}</strong>
                <span>ID Usuario: ${data.uid}</span>
            </div>

            <div class="fotos-container">
                ${data.urls.map(url => `<img src="${url}" class="foto-prev">`).join("")}
            </div>

            <button class="btn-download">Descargar</button>
        `;

        listContainer.appendChild(item);

        /* Abrir imagen grande */
        item.querySelectorAll(".foto-prev").forEach(img => {
            img.addEventListener("click", () => {
                modal.style.display = "block";
                modalImg.src = img.src;
            });
        });

        /* Botón descargar */
        item.querySelector(".btn-download").addEventListener("click", () => {
            downloadEvidence(data);
        });
    });
});

/* Cerrar modal */
closeModal.addEventListener("click", () => {
    modal.style.display = "none";
});


/* ============================================
   2. Descargar y registrar auditoría
============================================ */
async function downloadEvidence(data) {
    const user = auth.currentUser;
    if (!user) return;

    // Guardar registro de auditoría
    await db.collection("descargas").add({
        analista: user.uid,
        uid_transportista: data.uid,
        fecha: new Date().toLocaleDateString(),
        hora: new Date().toLocaleTimeString(),
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Descargar ZIP
    data.urls.forEach(url => {
        const a = document.createElement("a");
        a.href = url;
        a.download = "evidencia.jpg";
        a.click();
    });
}
