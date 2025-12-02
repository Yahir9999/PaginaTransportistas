// ../../js/registro_cedi.js

// Referencias a elementos DOM
const btnStart = document.getElementById('btn-start');
const btnStop  = document.getElementById('btn-stop');
const btnManualExit = document.getElementById('btn-manual-exit');
const lastRecordEl = document.getElementById('last-record');
const messageEl = document.getElementById('message');

let html5QrCode = null;
let currentCameraId = null;

// formatea Date a string legible
function formatDatetime(ts) {
  if (!ts) return '-';
  // ts puede ser Timestamp de Firestore o Date
  let d;
  if (ts.toDate) d = ts.toDate();
  else d = new Date(ts);
  return d.toLocaleString();
}

// Mensajes en UI
function showMessage(text, time = 4000) {
  messageEl.textContent = text;
  setTimeout(() => {
    // limpiar solo si sigue el mismo texto
    if (messageEl.textContent === text) messageEl.textContent = '';
  }, time);
}

// Obtiene el usuario actual; si no hay redirige (o muestra error)
async function getCurrentUserOrRedirect() {
  const user = auth.currentUser;
  if (!user) {
    showMessage('No estás autenticado. Redirigiendo al login...');
    setTimeout(()=> window.location.href = '../../login.html', 1400);
    throw new Error('Usuario no autenticado');
  }
  return user;
}

// Muestra último registro (para este usuario hoy)
async function showLastRecord() {
  try {
    const user = auth.currentUser;
    if (!user) {
      lastRecordEl.innerHTML = '<p>Inicia sesión para ver registros.</p>';
      return;
    }

    // obtener último registro del día (por transportista uid)
    const todayStr = new Date().toISOString().slice(0,10); // 'YYYY-MM-DD'
    const q = await db.collection('registros_cedi')
      .where('transportista_uid', '==', user.uid)
      .where('date', '==', todayStr)
      .orderBy('hora_entrada', 'desc')
      .limit(1)
      .get();

    if (q.empty) {
      lastRecordEl.innerHTML = '<p>No hay registros hoy.</p>';
      return;
    }

    const doc = q.docs[0];
    const data = doc.data();
    lastRecordEl.innerHTML = `
      <p><strong>QR:</strong> ${data.qr_value}</p>
      <p><strong>Entrada:</strong> ${formatDatetime(data.hora_entrada)}</p>
      <p><strong>Salida:</strong> ${data.hora_salida ? formatDatetime(data.hora_salida) : '—'}</p>
      <p style="font-size:12px;color:#444;margin-top:6px">ID: ${doc.id}</p>
    `;
  } catch(err) {
    console.error(err);
    lastRecordEl.innerHTML = '<p>Error al leer registros.</p>';
  }
}

// Maneja el resultado del scan QR
async function handleScanSuccess(qrText) {
  try {
    const user = await getCurrentUserOrRedirect();
    showMessage(`QR detectado: ${qrText}`);

    // fecha YYYY-MM-DD
    const todayStr = new Date().toISOString().slice(0,10);

    // buscar documento abierto (sin hora_salida) del mismo QR y mismo usuario hoy
    const q = await db.collection('registros_cedi')
      .where('transportista_uid', '==', user.uid)
      .where('qr_value', '==', qrText)
      .where('date', '==', todayStr)
      .where('hora_salida', '==', null)
      .limit(1)
      .get();

    const now = firebase.firestore.Timestamp.now();

    if (!q.empty) {
      // existe registro abierto -> marcar salida
      const docRef = q.docs[0].ref;
      await docRef.update({
        hora_salida: now,
        updated_at: now
      });
      showMessage('Salida registrada correctamente ✅');
    } else {
      // crear nuevo registro (entrada)
      const newDoc = {
        transportista_uid: user.uid,
        transportista_email: user.email || null,
        qr_value: qrText,
        hora_entrada: now,
        hora_salida: null,
        date: todayStr,
        month: new Date().toISOString().slice(0,7), // YYYY-MM
        created_at: now,
        updated_at: now
      };
      await db.collection('registros_cedi').add(newDoc);
      showMessage('Entrada registrada correctamente ✅');
    }

    // refrescar último registro en UI
    setTimeout(showLastRecord, 600);
  } catch(err) {
    console.error('handleScanSuccess error', err);
    showMessage('Error al procesar el QR');
  }
}

// Start camera & scanner
async function startScanner() {
  try {
    // pregunta por cámaras disponibles
    const devices = await Html5Qrcode.getCameras();
    if (!devices || devices.length === 0) {
      showMessage('No se encontraron cámaras.');
      return;
    }
    currentCameraId = devices[0].id;

    html5QrCode = new Html5Qrcode("qr-reader");
    await html5QrCode.start(
      { deviceId: { exact: currentCameraId } },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      },
      (decodedText, decodedResult) => {
        // cuando reconoce un QR
        console.log('QR detectado:', decodedText);
        // detener temporalmente para evitar lecturas repetidas
        html5QrCode.pause();
        handleScanSuccess(decodedText)
          .finally(()=> {
            // reanudar lectura después de 1.2s
            setTimeout(()=> {
              if (html5QrCode) html5QrCode.resume();
            }, 1200);
          });
      },
      (errorMessage) => {
        // lectura fallida; silent
      }
    );

    showMessage('Escaneo iniciado — apunte la cámara al QR');
  } catch (err) {
    console.error(err);
    showMessage('No fue posible iniciar la cámara. Revisa permisos.');
  }
}

async function stopScanner() {
  try {
    if (html5QrCode) {
      await html5QrCode.stop();
      html5QrCode.clear();
      html5QrCode = null;
    }
    showMessage('Escaneo detenido');
    const qrBox = document.getElementById('qr-reader');
    qrBox.innerHTML = '<p class="muted">Escaneo detenido.</p>';
  } catch (err) {
    console.error(err);
    showMessage('Error al detener el escáner');
  }
}

// registrar salida manual (busca registro abierto del día y lo cierra)
async function manualExit() {
  try {
    const user = await getCurrentUserOrRedirect();
    const todayStr = new Date().toISOString().slice(0,10);

    const q = await db.collection('registros_cedi')
      .where('transportista_uid', '==', user.uid)
      .where('date', '==', todayStr)
      .where('hora_salida', '==', null)
      .orderBy('hora_entrada', 'desc')
      .limit(1)
      .get();

    if (q.empty) {
      showMessage('No hay registros abiertos para cerrar.');
      return;
    }

    const docRef = q.docs[0].ref;
    await docRef.update({
      hora_salida: firebase.firestore.Timestamp.now(),
      updated_at: firebase.firestore.Timestamp.now()
    });

    showMessage('Salida registrada manualmente ✅');
    setTimeout(showLastRecord, 600);
  } catch (err) {
    console.error(err);
    showMessage('Error al hacer salida manual');
  }
}

// Listeners
btnStart.addEventListener('click', () => {
  startScanner();
});

btnStop.addEventListener('click', () => {
  stopScanner();
});

btnManualExit.addEventListener('click', () => {
  manualExit();
});

// Observador de auth: cuando el usuario cambia, actualizar UI
auth.onAuthStateChanged(user => {
  if (!user) {
    // redirigir al login si no autenticado
    showMessage('Debes iniciar sesión. Redirigiendo...');
    setTimeout(()=> window.location.href='../../login.html', 1200);
  } else {
    // mostrar último registro del día
    showLastRecord();
  }
});

// al cerrar la pestaña, detener cámara
window.addEventListener('beforeunload', async () => {
  if (html5QrCode) {
    try { await html5QrCode.stop(); } catch(e) { /* ignore */ }
  }
});
