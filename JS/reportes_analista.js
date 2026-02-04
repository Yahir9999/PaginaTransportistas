// Reemplaza por la URL de tu Apps Script Web App
const URL_BACKEND = "https://script.google.com/macros/s/AKfycbw1cHd63Ss3iaYO3P-JG92mvS2meDx9F7pcF_WrBHg4LoYicxPJfXuUmlFEP8EeJPS8/exec";

document.addEventListener("DOMContentLoaded", () => {
  // Elementos
  const tableBody = document.getElementById("tableBody");
  const searchBox = document.getElementById("searchBox");
  const selectPageSize = document.getElementById("selectPageSize");
  const pagination = document.getElementById("pagination");
  const paginationInfo = document.getElementById("paginationInfo");
  const btnRefresh = document.getElementById("btnRefresh");
  const alertHolder = document.getElementById("alertPlaceholder");
  const inputAnalista = document.getElementById("inputAnalista");

  // Modal elements
  const modalPreview = new bootstrap.Modal(document.getElementById("modalPreview"));
  const modalImage = document.getElementById("modalImage");
  const modalMeta = document.getElementById("modalMeta");
  const btnDownloadSingle = document.getElementById("btnDownloadSingle");
  const btnDownloadZipFromModal = document.getElementById("btnDownloadZipFromModal");

  // Estado
  let evidencias = []; // array de objetos obtenidos del backend
  let filtered = [];
  let currentPage = 1;
  let pageSize = parseInt(selectPageSize.value, 10);

  // Fetch inicial
  async function fetchEvidencias() {
    try {
      showLoading("Cargando evidencias...");
      const res = await fetch(URL_BACKEND + "?accion=listar_evidencias");
      if (!res.ok) throw new Error("Fallo al obtener datos");
      const data = await res.json();
      evidencias = data; // espera array de objetos
      filtered = evidencias.slice();
      currentPage = 1;
      renderTable();
      hideLoading();
    } catch (e) {
      console.error(e);
      hideLoading();
      showAlert("No fue posible cargar las evidencias. Revisa el backend.", "danger");
    }
  }

  // Render tabla con paginación
  function renderTable() {
    pageSize = parseInt(selectPageSize.value, 10);
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageItems = filtered.slice(start, end);

    tableBody.innerHTML = pageItems.map(item => {
      // item: { id_registro, ID_transportista, TOs (array), nombre_registro, hora_entrega, notas, fotos(array URLs) }
      const fotosHtml = (item.fotos || []).slice(0,3).map((url, idx) =>
        `<img src="${encodeURI(url)}" data-reg="${item.id_registro}" data-idx="${idx}" class="thumb me-1" title="Ver foto">`
      ).join("");

      const tosDisplay = Array.isArray(item.TOs) ? item.TOs.join(", ") : (item.TO || "");

      return `<tr data-id="${item.id_registro}">
        <td>${item.id_registro}</td>
        <td>${item.ID_transportista || ""}</td>
        <td>${tosDisplay}</td>
        <td>${item.nombre_registro || ""}</td>
        <td>${item.hora_entrega || item.hora_evidencia || ""}</td>
        <td>${(item.notas||"").slice(0,80)}</td>
        <td>${fotosHtml}</td>
        <td>
          <button class="btn btn-sm btn-zip" data-id="${item.id_registro}">Descargar ZIP</button>
        </td>
      </tr>`;
    }).join("");

    // attach listeners: thumbs and zip buttons
    attachRowListeners();

    // pagination
    renderPagination();
  }

  function attachRowListeners() {
    // thumbnails -> preview
    document.querySelectorAll(".thumb").forEach(img => {
      img.addEventListener("click", (ev) => {
        const regId = ev.target.dataset.reg;
        const idx = parseInt(ev.target.dataset.idx, 10);
        openPreview(regId, idx);
      });
    });

    // zip buttons
    document.querySelectorAll(".btn-zip").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        const id = ev.currentTarget.dataset.id;
        await handleDownloadZip(id);
      });
    });
  }

  // Preview modal
  function openPreview(regId, idx) {
    const item = evidencias.find(e => String(e.id_registro) === String(regId));
    if (!item) return;
    const url = item.fotos && item.fotos[idx];
    if (!url) return;

    modalImage.src = url;
    modalMeta.innerHTML = `<strong>Registro:</strong> ${item.id_registro}<br>
      <strong>ID:</strong> ${item.ID_transportista || ""}<br>
      <strong>TO(s):</strong> ${Array.isArray(item.TOs) ? item.TOs.join(", ") : (item.TO||"")}`;

    // set download single link
    btnDownloadSingle.onclick = () => downloadFileFromUrl(url, `evidencia_${item.id_registro}_img${idx+1}.jpg`);

    // set download zip from modal -> same as zip button
    btnDownloadZipFromModal.onclick = () => handleDownloadZip(item.id_registro);

    modalPreview.show();
  }

  // Descargar un archivo desde URL
  async function downloadFileFromUrl(url, filename) {
    try {
      const r = await fetch(url);
      const blob = await r.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error(e);
      showAlert("Error al descargar la imagen.", "danger");
    }
  }

  // Descargar ZIP (backend debe responder con blob de zip)
  async function handleDownloadZip(id_registro) {
    // Validar nombre del analista
    const nombreAnalista = (inputAnalista.value || "").trim();
    if (!nombreAnalista) return showAlert("Escribe tu nombre antes de descargar.", "warning");

    try {
      showLoading("Preparando descarga...");
      const resp = await fetch(URL_BACKEND, {
        method: "POST",
        headers: { "Accept": "application/zip" },
        body: JSON.stringify({ accion: "descargar_zip", id_registro })
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(()=>"");
        hideLoading();
        return showAlert("Error al solicitar ZIP. " + txt, "danger");
      }

      const blob = await resp.blob();
      // crear link de descarga
      const filename = `evidencia_${id_registro}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // registrar descarga en backend (REGISTROS ANALISTAS)
      await registrarDescarga(nombreAnalista, `evidencia_${id_registro}.zip`, id_registro);

      hideLoading();
      showAlert("Descarga completada y registrada.", "success");

    } catch (e) {
      console.error(e);
      hideLoading();
      showAlert("Fallo en la descarga del ZIP.", "danger");
    }
  }

  // Llamada para registrar la descarga en la hoja REGISTROS ANALISTAS
  async function registrarDescarga(nombreAnalista, evidenciaArchivo, id_registro) {
    try {
      await fetch(URL_BACKEND, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "registro_descarga",
          nombre_analista: nombreAnalista,
          evidencia_descargada: evidenciaArchivo,
          id_registro: id_registro,
          fecha_hora: new Date().toISOString()
        })
      });
    } catch (e) {
      console.error("No se pudo registrar la descarga:", e);
      // no bloquear al usuario si falla el registro; pero informar
      showAlert("No se pudo registrar la descarga en el servidor.", "warning");
    }
  }

  // Buscador
  searchBox.addEventListener("input", () => {
    const q = searchBox.value.trim().toLowerCase();
    filtered = evidencias.filter(item => {
      const hay = [
        item.id_registro,
        item.ID_transportista,
        (Array.isArray(item.TOs) ? item.TOs.join(" ") : (item.TO||"")),
        item.nombre_registro,
        item.notas
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
    currentPage = 1;
    renderTable();
  });

  // paginación helpers
  function renderPagination() {
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const visible = 7;
    pagination.innerHTML = "";

    // info
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(filtered.length, currentPage * pageSize);
    paginationInfo.textContent = `${start}-${end} de ${filtered.length}`;

    // prev
    const prevLi = document.createElement("li");
    prevLi.className = "page-item" + (currentPage === 1 ? " disabled" : "");
    prevLi.innerHTML = `<a class="page-link" href="#">«</a>`;
    prevLi.onclick = (e) => { e.preventDefault(); if (currentPage>1){currentPage--; renderTable();} };
    pagination.appendChild(prevLi);

    // pages (simple range)
    const startPage = Math.max(1, currentPage - Math.floor(visible/2));
    const endPage = Math.min(pages, startPage + visible - 1);
    for (let p = startPage; p <= endPage; p++) {
      const li = document.createElement("li");
      li.className = "page-item" + (p === currentPage ? " active" : "");
      li.innerHTML = `<a class="page-link" href="#">${p}</a>`;
      li.onclick = (e) => { e.preventDefault(); currentPage = p; renderTable(); };
      pagination.appendChild(li);
    }

    // next
    const nextLi = document.createElement("li");
    nextLi.className = "page-item" + (currentPage === pages ? " disabled" : "");
    nextLi.innerHTML = `<a class="page-link" href="#">»</a>`;
    nextLi.onclick = (e) => { e.preventDefault(); if (currentPage<pages){currentPage++; renderTable();} };
    pagination.appendChild(nextLi);
  }

  // UI helpers
  function showAlert(msg, tipo = "info", timeout = 4000) {
    alertHolder.innerHTML = `
      <div class="alert alert-${tipo} alert-dismissible fade show mt-2" role="alert">
        ${msg}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      </div>`;
    if (timeout) setTimeout(()=> { alertHolder.innerHTML = ""; }, timeout);
  }

  function showLoading(msg = "Cargando...") {
    showAlert(msg, "info");
  }
  function hideLoading() {
    // remove alerts of info type quickly
    // no-op here; other alerts will override
  }

  // Refresh button
  btnRefresh.addEventListener("click", fetchEvidencias);
  selectPageSize.addEventListener("change", () => { currentPage = 1; renderTable(); });

  // Inicializar
  fetchEvidencias();
});
