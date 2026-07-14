// State
let state = {
  modalidad: 'BOLSILLO',
  items: []
};

// Elements
const dom = {
  // Login DOM
  loginOverlay: document.getElementById('login-overlay'),
  appContainer: document.getElementById('app-container'),
  loginUser: document.getElementById('loginUser'),
  loginPass: document.getElementById('loginPass'),
  btnLogin: document.getElementById('btnLogin'),
  loginError: document.getElementById('loginError'),
  
  sede: document.getElementById('sede'),
  direccion: document.getElementById('direccion'),
  telefono: document.getElementById('telefono'),
  fechaEmision: document.getElementById('fechaEmision'),
  fechaValidez: document.getElementById('fechaValidez'),
  paciente: document.getElementById('paciente'),
  medico: document.getElementById('medico'),
  modalidadPago: document.getElementById('modalidadPago'),

  buscarMed: document.getElementById('buscarMed'),
  ordenMed: document.getElementById('ordenMed'),
  selMedicamento: document.getElementById('selMedicamento'),
  cantMed: document.getElementById('cantMed'),
  addMed: document.getElementById('addMed'),

  buscarServ: document.getElementById('buscarServ'),
  selServicio: document.getElementById('selServicio'),
  cantServ: document.getElementById('cantServ'),
  precioServ: document.getElementById('precioServ'),
  descServ: document.getElementById('descServ'),
  addServ: document.getElementById('addServ'),

  addHonorarios: document.getElementById('addHonorarios'),
  montoHonorarios: document.getElementById('montoHonorarios'),

  tbodyInnovador: document.querySelector('#table-innovador tbody'),
  subtotalInnovador: document.getElementById('subtotal-innovador'),
  serviciosInnovador: document.getElementById('servicios-innovador'),
  ivaInnovador: document.getElementById('iva-innovador'),
  totalInnovador: document.getElementById('total-innovador'),

  tbodyBio: document.querySelector('#table-bio tbody'),
  subtotalBio: document.getElementById('subtotal-bio'),
  serviciosBio: document.getElementById('servicios-bio'),
  ivaBio: document.getElementById('iva-bio'),
  totalBio: document.getElementById('total-bio'),

  btnPdfAll: document.getElementById('btn-pdf-all'),
  pdfContainer: document.getElementById('pdf-container')
};

// --- INIT ---
const today = new Date();
dom.fechaEmision.value = today.toISOString().split('T')[0];
const in15Days = new Date(today);
in15Days.setDate(in15Days.getDate() + 15);
dom.fechaValidez.value = in15Days.toISOString().split('T')[0];

dom.sede.addEventListener('change', () => {
  const val = dom.sede.value;
  const info = SANARE_DATA.sedes[val];
  if (info) {
    dom.telefono.textContent = 'Tel: ' + info.telefono;
    dom.direccion.textContent = info.direccion;
  }
});

dom.modalidadPago.addEventListener('change', (e) => {
  state.modalidad = e.target.value;
  filterMeds();
  filterServs();
  renderCart();
});

// Price Helper
function getPrice(itemObj) {
  if (!itemObj) return 0;
  const key = state.modalidad;
  let val = itemObj[key];
  let num = parseFloat(val);
  if (isNaN(num) || num === 0) num = parseFloat(itemObj['PMP'] || itemObj['PRECIO PUB'] || 0);
  return isNaN(num) ? 0 : num;
}

function formatCurrency(num) {
  return '$' + num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// --- MEDICINES LOGIC ---
let currentMeds = [];

function filterMeds() {
  const q = dom.buscarMed.value.toLowerCase().trim();
  const sort = dom.ordenMed.value;

  let results = SANARE_DATA.medicamentos;
  if (q.length > 0) {
    results = results.filter(m => {
      return (m.EAN && String(m.EAN).toLowerCase().includes(q)) ||
             (m.DESCRIPCION && m.DESCRIPCION.toLowerCase().includes(q)) ||
             (m['NOMBRE COMERCIAL'] && m['NOMBRE COMERCIAL'].toLowerCase().includes(q)) ||
             (m.PA && m.PA.toLowerCase().includes(q));
    });
  }

  if (sort === 'nombre') {
    results.sort((a,b) => (a['NOMBRE COMERCIAL'] || '').localeCompare(b['NOMBRE COMERCIAL'] || ''));
  } else {
    results.sort((a,b) => getPrice(b) - getPrice(a));
  }

  currentMeds = results;

  dom.selMedicamento.innerHTML = '';
  results.slice(0, 100).forEach((m, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    const priceStr = formatCurrency(getPrice(m));
    opt.textContent = `${m.EAN || 'S/C'} — ${m['NOMBRE COMERCIAL'] || 'Sin Marca'} (${m.DESCRIPCION}) — ${priceStr}`;
    dom.selMedicamento.appendChild(opt);
  });
}

dom.buscarMed.addEventListener('input', filterMeds);
dom.ordenMed.addEventListener('change', filterMeds);

dom.addMed.addEventListener('click', () => {
  if (dom.selMedicamento.selectedIndex < 0) return;
  const idx = dom.selMedicamento.value;
  const med = currentMeds[idx];
  const cant = parseInt(dom.cantMed.value) || 1;

  const pa = med.PA;
  let innovador = null;
  let bio = null;

  const isInnovador = med.CLASIFICACION && med.CLASIFICACION.toUpperCase().includes('INNOVADOR');
  const isBio = med.CLASIFICACION && (
    med.CLASIFICACION.toUpperCase().includes('BIO') ||
    med.CLASIFICACION.toUpperCase().includes('GENERICO') ||
    med.CLASIFICACION.toUpperCase().includes('BIOEQUIVALENTE') ||
    med.CLASIFICACION.toUpperCase().includes('BIOCOMPARABLE')
  );

  if (isInnovador) {
    // El usuario seleccionó el innovador; usarlo directamente
    innovador = med;
    // Buscar bio con misma descripción primero, luego cualquiera del mismo PA
    if (pa) {
      const alternatives = SANARE_DATA.medicamentos.filter(m =>
        m.PA === pa &&
        m.CLASIFICACION && (
          m.CLASIFICACION.toUpperCase().includes('BIO') ||
          m.CLASIFICACION.toUpperCase().includes('GENERICO') ||
          m.CLASIFICACION.toUpperCase().includes('BIOEQUIVALENTE') ||
          m.CLASIFICACION.toUpperCase().includes('BIOCOMPARABLE')
        )
      );
      // Preferir bio con misma descripción (misma presentación)
      bio = alternatives.find(m => m.DESCRIPCION === med.DESCRIPCION) || alternatives[0] || null;
    }
  } else if (isBio) {
    // El usuario seleccionó el bio; usarlo directamente
    bio = med;
    // Buscar innovador con misma descripción primero, luego cualquiera del mismo PA
    if (pa) {
      const alternatives = SANARE_DATA.medicamentos.filter(m =>
        m.PA === pa &&
        m.CLASIFICACION && m.CLASIFICACION.toUpperCase().includes('INNOVADOR')
      );
      // Preferir innovador con misma descripción (misma presentación)
      innovador = alternatives.find(m => m.DESCRIPCION === med.DESCRIPCION) || alternatives[0] || null;
    }
  } else {
    // Sin clasificación clara: usar como innovador por defecto
    innovador = med;
  }

  state.items.push({
    id: Date.now(),
    type: 'med',
    pa: pa || med.DESCRIPCION,
    innovador: innovador || null,
    bio: bio || null,
    cant: cant,
    desc: 0
  });

  dom.buscarMed.value = '';
  dom.cantMed.value = '1';
  filterMeds();
  renderCart();
});


// --- SERVICIOS LOGIC ---
let currentServs = [];

function filterServs() {
  const q = dom.buscarServ.value.toLowerCase().trim();
  let results = SANARE_DATA.servicios;
  if (q.length > 0) {
    results = results.filter(s => {
      return (s.CODIGO && String(s.CODIGO).toLowerCase().includes(q)) ||
             (s.DESCRIPCION && s.DESCRIPCION.toLowerCase().includes(q));
    });
  }

  currentServs = results;
  dom.selServicio.innerHTML = '';
  results.slice(0, 100).forEach((s, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = `${s.DESCRIPCION} — ${formatCurrency(getPrice(s))}`;
    dom.selServicio.appendChild(opt);
  });
  updatePrecioServ();
}

function updatePrecioServ() {
  if (dom.selServicio.selectedIndex < 0) return;
  const idx = dom.selServicio.value;
  const serv = currentServs[idx];
  dom.precioServ.value = getPrice(serv);

  if (serv.CODIGO === 'HONORARIOS' || serv.DESCRIPCION.includes('HONORARIOS')) {
    dom.precioServ.readOnly = false;
    dom.precioServ.style.backgroundColor = 'white';
    dom.precioServ.style.cursor = 'text';
  } else {
    dom.precioServ.readOnly = true;
    dom.precioServ.style.backgroundColor = '#f3f4f6';
    dom.precioServ.style.cursor = 'not-allowed';
  }
}

dom.buscarServ.addEventListener('input', filterServs);
dom.selServicio.addEventListener('change', updatePrecioServ);

dom.addServ.addEventListener('click', () => {
  if (dom.selServicio.selectedIndex < 0) return;
  const idx = dom.selServicio.value;
  const serv = currentServs[idx];
  const cant = parseInt(dom.cantServ.value) || 1;
  const desc = parseFloat(dom.descServ.value) || 0;
  const manualPrice = parseFloat(dom.precioServ.value) || 0;

  state.items.push({
    id: Date.now(),
    type: 'serv',
    serv: serv,
    customPrice: manualPrice,
    cant: cant,
    desc: desc
  });

  dom.buscarServ.value = '';
  dom.cantServ.value = '1';
  dom.descServ.value = '0';
  filterServs();
  renderCart();
});

// --- CART RENDER ---
function removeItem(id) {
  state.items = state.items.filter(i => i.id !== id);
  renderCart();
}

function renderCart() {
  dom.tbodyInnovador.innerHTML = '';
  dom.tbodyBio.innerHTML = '';

  let subInno = 0, servInno = 0;
  let subBio = 0, servBio = 0;

  state.items.forEach(item => {
    // ---- Medicamento from catalog (old type) ----
    if (item.type === 'med') {
      const targetI = item.innovador || item.bio;
      const trI = document.createElement('tr');
      if (targetI) {
        const p = getPrice(targetI);
        const sub = p * item.cant;
        subInno += sub;
        const fallbackBadge = !item.innovador ? ' <span style="font-size:10.5px; color:#c0392b; font-weight:bold;">(Usa Genérico)</span>' : '';
        trI.innerHTML = `
          <td><strong>${targetI['NOMBRE COMERCIAL'] || 'Sin Marca'}</strong>${fallbackBadge}<br><small>${targetI.DESCRIPCION}</small></td>
          <td>${item.cant}</td>
          <td>${formatCurrency(p)}</td>
          <td>-</td>
          <td>${formatCurrency(sub)}</td>
          <td><button class="btn-remove" onclick="removeItem(${item.id})">X</button></td>
        `;
      }
      dom.tbodyInnovador.appendChild(trI);

      const targetB = item.bio || item.innovador;
      const trB = document.createElement('tr');
      if (targetB) {
        const p = getPrice(targetB);
        const sub = p * item.cant;
        subBio += sub;
        const fallbackBadge = !item.bio ? ' <span style="font-size:10.5px; color:#0A497B; font-weight:bold;">(Usa Patente)</span>' : '';
        trB.innerHTML = `
          <td><strong>${targetB['NOMBRE COMERCIAL'] || 'Sin Marca'}</strong>${fallbackBadge}<br><small>${targetB.DESCRIPCION}</small></td>
          <td>${item.cant}</td>
          <td>${formatCurrency(p)}</td>
          <td>-</td>
          <td>${formatCurrency(sub)}</td>
          <td><button class="btn-remove" onclick="removeItem(${item.id})">X</button></td>
        `;
      }
      dom.tbodyBio.appendChild(trB);

    // ---- Medicamento from ESQUEMA (precios por modalidad) ----
    } else if (item.type === 'esq_med') {
      const premed_icon = (d) => d && d.premed ? ' <span title="Premedicación" style="color:#F59E0B; font-size:10px;">⚕ Premed</span>' : '';

      // PATENTE column — usa precio según modalidad activa
      const trI = document.createElement('tr');
      if (item.patente) {
        const { precio_vial: pv, precio_total: pt } = getPrecioEsqItem(item.patente);
        const p = pt * item.cant;
        subInno += p;
        trI.innerHTML = `
          <td><strong>${item.descripcion}</strong>${premed_icon(item.patente)}<br><small style="color:#64748b;">${item.patente.marca} · ${item.patente.viales} vial(es)</small></td>
          <td>${item.cant}</td>
          <td>${formatCurrency(pv)}</td>
          <td>-</td>
          <td>${formatCurrency(p)}</td>
          <td><button class="btn-remove" onclick="removeItem(${item.id})">X</button></td>
        `;
      } else {
        trI.innerHTML = `<td colspan="6" style="color:#94a3b8; font-style:italic; font-size:0.85rem; text-align:left; padding:8px 16px;">
          ${item.descripcion} <span style="font-size:10px;">(sin versión patente)</span>
          <button class="btn-remove" style="float:right;" onclick="removeItem(${item.id})">X</button></td>`;
      }
      dom.tbodyInnovador.appendChild(trI);

      // BIO column — usa precio según modalidad activa
      const trB = document.createElement('tr');
      if (item.bio) {
        const { precio_vial: pv, precio_total: pt } = getPrecioEsqItem(item.bio);
        const p = pt * item.cant;
        subBio += p;
        trB.innerHTML = `
          <td><strong>${item.descripcion}</strong>${premed_icon(item.bio)}<br><small style="color:#64748b;">${item.bio.marca} · ${item.bio.viales} vial(es)</small></td>
          <td>${item.cant}</td>
          <td>${formatCurrency(pv)}</td>
          <td>-</td>
          <td>${formatCurrency(p)}</td>
          <td><button class="btn-remove" onclick="removeItem(${item.id})">X</button></td>
        `;
      } else if (item.patente) {
        // Fallback: show patente price in bio column
        const { precio_vial: pv, precio_total: pt } = getPrecioEsqItem(item.patente);
        const p = pt * item.cant;
        subBio += p;
        trB.innerHTML = `
          <td><strong>${item.descripcion}</strong> <span style="font-size:10px;color:#0A497B;">(Usa Patente)</span><br><small style="color:#64748b;">${item.patente.marca} · ${item.patente.viales} vial(es)</small></td>
          <td>${item.cant}</td>
          <td>${formatCurrency(pv)}</td>
          <td>-</td>
          <td>${formatCurrency(p)}</td>
          <td><button class="btn-remove" onclick="removeItem(${item.id})">X</button></td>
        `;
      }
      dom.tbodyBio.appendChild(trB);

    // ---- Servicio standard ----
    } else if (item.type === 'serv') {
      const p = item.customPrice !== undefined ? item.customPrice : getPrice(item.serv);
      const discountMult = 1 - (item.desc / 100);
      const sub = p * item.cant * discountMult;
      servInno += sub;
      servBio += sub;

      const htmlRow = `
        <td><strong>${item.serv.DESCRIPCION}</strong></td>
        <td>${item.cant}</td>
        <td>${formatCurrency(p)}</td>
        <td>${item.desc}%</td>
        <td>${formatCurrency(sub)}</td>
        <td><button class="btn-remove" onclick="removeItem(${item.id})">X</button></td>
      `;

      const trI = document.createElement('tr');
      trI.innerHTML = htmlRow;
      dom.tbodyInnovador.appendChild(trI);

      const trB = document.createElement('tr');
      trB.innerHTML = htmlRow;
      dom.tbodyBio.appendChild(trB);

    // ---- Servicio from ESQUEMA (price varies by aseguradora) ----
    } else if (item.type === 'esq_serv') {
      const p = item.customPrice || 0;
      const sub = p * item.cant;
      servInno += sub;
      servBio += sub;

      const htmlRow = `
        <td><strong>${item.descripcion}</strong><br><small style="color:#64748b;">${item.codigo}</small></td>
        <td>${item.cant}</td>
        <td>${formatCurrency(p)}</td>
        <td>-</td>
        <td>${formatCurrency(sub)}</td>
        <td><button class="btn-remove" onclick="removeItem(${item.id})">X</button></td>
      `;
      const trI = document.createElement('tr'); trI.innerHTML = htmlRow;
      const trB = document.createElement('tr'); trB.innerHTML = htmlRow;
      dom.tbodyInnovador.appendChild(trI);
      dom.tbodyBio.appendChild(trB);
    }
  });

  const ivaInno = servInno * 0.16;
  const ivaBi = servBio * 0.16;

  dom.subtotalInnovador.textContent = formatCurrency(subInno);
  dom.serviciosInnovador.textContent = formatCurrency(servInno);
  dom.ivaInnovador.textContent = formatCurrency(ivaInno);
  dom.totalInnovador.textContent = formatCurrency(subInno + servInno + ivaInno);

  dom.subtotalBio.textContent = formatCurrency(subBio);
  dom.serviciosBio.textContent = formatCurrency(servBio);
  dom.ivaBio.textContent = formatCurrency(ivaBi);
  dom.totalBio.textContent = formatCurrency(subBio + servBio + ivaBi);
}

// --- PDF GENERATION ---
function generatePDF(type) {
  let isInnovador = type === 'innovador' || type === 'esquema'; // Esquema defaults to Innovador prices
  
  let tipoLabel = '';
  let tipoColor = '';
  let filenameSufix = '';

  if (type === 'innovador') {
    tipoLabel = 'Patente';
    tipoColor = '#0A497B';
    filenameSufix = 'Patente';
  } else if (type === 'bio') {
    tipoLabel = 'Biocomparable';
    tipoColor = '#27ae60';
    filenameSufix = 'Biocomparable';
  } else if (type === 'esquema') {
    tipoLabel = 'Esquema de Tratamiento';
    tipoColor = '#8e44ad';
    filenameSufix = 'Esquema';
  }

  const sedeKey = dom.sede.value;
  const sedeInfo = SANARE_DATA.sedes[sedeKey] || {};
  const modSelect = document.getElementById('modalidadPago');

  const vals = {
    sedeText: sedeKey,
    sedeDireccion: sedeInfo.direccion || '',
    sedeTelefono: sedeInfo.telefono || '',
    fechaEmision: dom.fechaEmision.value,
    fechaValidez: dom.fechaValidez.value,
    paciente: dom.paciente.value || '---',
    medico: dom.medico.value || '---',
    modalidad: modSelect.options[modSelect.selectedIndex].text,
    dx: document.getElementById('dx').value || '',
    esquema: document.getElementById('esquema').value || '',
    kam: document.getElementById('kam').value || '',
    fechaProg: document.getElementById('fechaProg').value || '',
  };

  // Build Medicamentos rows
  let medRowsHtml = '';
  let subTotalMed = 0;
  let hasMeds = false;

  state.items.forEach(item => {
    if (item.type === 'med') {
      const target = (type === 'bio') ? (item.bio || item.innovador) : (item.innovador || item.bio);
      if (!target) return;
      hasMeds = true;
      const p = getPrice(target);
      const sub = p * item.cant;
      subTotalMed += sub;
      
      const isFallback = (type === 'bio' && !item.bio) || (type !== 'bio' && !item.innovador);
      const fallbackStr = isFallback ? (type === 'bio' ? ' <span style="color:#0A497B; font-weight:bold; font-size:9px;">[Usa Patente]</span>' : ' <span style="color:#c0392b; font-weight:bold; font-size:9px;">[Usa Genérico]</span>') : '';
      
      let medName = `<strong>${target['NOMBRE COMERCIAL'] || ''}</strong>${fallbackStr} ${target.DESCRIPCION}`;
      if (target.ESQUEMA_CATALOGO || target.DOSIS_USUAL) {
        const parts = [];
        if (target.ESQUEMA_CATALOGO) parts.push(`Eq: ${target.ESQUEMA_CATALOGO}`);
        if (target.DOSIS_USUAL) parts.push(`Dosis: ${target.DOSIS_USUAL}`);
        medName += `<br><span style="color:#666; font-size:8.5px;"><i>${parts.join(' | ')}</i></span>`;
      }
      
      medRowsHtml += `
        <tr>
          <td style="text-align:left; padding:5px 8px; border:1px solid #ddd; font-size:10px;">${medName}</td>
          <td style="text-align:center; padding:5px 8px; border:1px solid #ddd; font-size:10px;">${target.EAN || ''}</td>
          <td style="text-align:center; padding:5px 8px; border:1px solid #ddd; font-size:10px;">${item.cant}</td>
          <td style="text-align:right; padding:5px 8px; border:1px solid #ddd; font-size:10px;">${formatCurrency(p)}</td>
          <td style="text-align:right; padding:5px 8px; border:1px solid #ddd; font-size:10px;">${formatCurrency(sub)}</td>
        </tr>`;
    } else if (item.type === 'esq_med') {
      const target = (type === 'bio') ? (item.bio || item.patente) : (item.patente || item.bio);
      if (!target) return;
      hasMeds = true;

      // Usar precios por modalidad activa también en PDF
      const { precio_vial: p_vial, precio_total: pt } = getPrecioEsqItem(target);
      const sub = pt * item.cant;
      subTotalMed += sub;

      const isFallback = (type === 'bio' && !item.bio) || (type !== 'bio' && !item.patente);
      const fallbackStr = isFallback ? (type === 'bio' ? ' <span style="color:#0A497B; font-weight:bold; font-size:9px;">[Usa Patente]</span>' : ' <span style="color:#c0392b; font-weight:bold; font-size:9px;">[Usa Genérico]</span>') : '';
      
      const premed_icon = target.premed ? ' <span style="color:#F59E0B; font-size:9px;">[⚕ Premed]</span>' : '';
      let medName = `<strong>${item.descripcion}</strong>${fallbackStr}${premed_icon}`;
      medName += `<br><span style="color:#666; font-size:8.5px;"><i>${target.marca} · ${target.viales} vial(es)</i></span>`;
      
      medRowsHtml += `
        <tr>
          <td style="text-align:left; padding:5px 8px; border:1px solid #ddd; font-size:10px;">${medName}</td>
          <td style="text-align:center; padding:5px 8px; border:1px solid #ddd; font-size:10px;">-</td>
          <td style="text-align:center; padding:5px 8px; border:1px solid #ddd; font-size:10px;">${item.cant}</td>
          <td style="text-align:right; padding:5px 8px; border:1px solid #ddd; font-size:10px;">${formatCurrency(p_vial)}</td>
          <td style="text-align:right; padding:5px 8px; border:1px solid #ddd; font-size:10px;">${formatCurrency(sub)}</td>
        </tr>`;
    }
  });

  // Build Servicios rows
  let servRowsHtml = '';
  let subTotalServ = 0;
  let hasServs = false;

  state.items.forEach(item => {
    if (item.type === 'serv') {
      hasServs = true;
      const p = item.customPrice !== undefined ? item.customPrice : getPrice(item.serv);
      const discountMult = 1 - (item.desc / 100);
      const sub = p * item.cant * discountMult;
      subTotalServ += sub;
      servRowsHtml += `
        <tr>
          <td style="text-align:left; padding:5px 8px; border:1px solid #ddd; font-size:10px;">${item.serv.DESCRIPCION}</td>
          <td style="text-align:center; padding:5px 8px; border:1px solid #ddd; font-size:10px;">${item.cant}</td>
          <td style="text-align:right; padding:5px 8px; border:1px solid #ddd; font-size:10px;">${formatCurrency(p)}</td>
          <td style="text-align:center; padding:5px 8px; border:1px solid #ddd; font-size:10px;">${item.desc > 0 ? item.desc + '%' : '—'}</td>
          <td style="text-align:right; padding:5px 8px; border:1px solid #ddd; font-size:10px;">${formatCurrency(sub)}</td>
        </tr>`;
    } else if (item.type === 'esq_serv') {
      hasServs = true;
      const p = item.customPrice || 0;
      const sub = p * item.cant;
      subTotalServ += sub;
      servRowsHtml += `
        <tr>
          <td style="text-align:left; padding:5px 8px; border:1px solid #ddd; font-size:10px;">${item.descripcion}<br><span style="color:#666; font-size:8px;">${item.codigo}</span></td>
          <td style="text-align:center; padding:5px 8px; border:1px solid #ddd; font-size:10px;">${item.cant}</td>
          <td style="text-align:right; padding:5px 8px; border:1px solid #ddd; font-size:10px;">${formatCurrency(p)}</td>
          <td style="text-align:center; padding:5px 8px; border:1px solid #ddd; font-size:10px;">—</td>
          <td style="text-align:right; padding:5px 8px; border:1px solid #ddd; font-size:10px;">${formatCurrency(sub)}</td>
        </tr>`;
    }
  });

  const ivaServ = subTotalServ * 0.16;
  const grandTotal = subTotalMed + subTotalServ + ivaServ;

  const thBase = `background:#f2f2f2; border:1px solid #ddd; padding:6px 8px; font-size:10px; font-weight:bold; color:#333;`;

  const html = `
  <div style="font-family: Arial, sans-serif; color:#333; padding:28px 32px; background:white; max-width:780px; margin:0 auto;">

    <!-- HEADER: Logo right, title left -->
    <table style="width:100%; border-collapse:collapse; margin-bottom:10px;">
      <tr>
        <td style="vertical-align:top;">
          <h2 style="color:#0A497B; font-size:22px; margin:0 0 3px 0; font-weight:bold;">Cotización</h2>
          <p style="font-size:10px; color:#666; margin:1px 0;">${vals.sedeDireccion}</p>
          <p style="font-size:10px; color:#666; margin:1px 0;">Tel: ${vals.sedeTelefono}</p>
        </td>
        <td style="text-align:right; vertical-align:top; width:160px;">
          <img src="${LOGO_B64}" style="height:38px;" alt="Sanare">
        </td>
      </tr>
    </table>

    <hr style="border:none; border-top:2px solid #0A497B; margin-bottom:10px;">

    <!-- TIPO BADGE -->
    <div style="display:inline-block; background:${tipoColor}; color:white; font-size:9px; font-weight:bold; padding:3px 12px; border-radius:3px; margin-bottom:10px; letter-spacing:0.5px; text-transform:uppercase;">${tipoLabel}</div>

    <!-- PATIENT INFO grid -->
    <table style="width:100%; border-collapse:collapse; margin-bottom:6px; font-size:11px;">
      <tr>
        <td style="width:50%; padding:2px 0;"><strong>Paciente:</strong> ${vals.paciente}</td>
        <td style="text-align:right; padding:2px 0;"><strong>Fecha de emisión:</strong> ${vals.fechaEmision || '—'}</td>
      </tr>
      <tr>
        <td style="padding:2px 0;"><strong>Médico:</strong> ${vals.medico}</td>
        <td style="text-align:right; padding:2px 0;"><strong>Presupuesto válido hasta:</strong> ${vals.fechaValidez || '—'}</td>
      </tr>
      <tr>
        <td style="padding:2px 0;" colspan="2"><strong>Aseguradora / Modalidad:</strong> ${vals.modalidad}</td>
      </tr>
    </table>

    ${vals.dx ? `<div style="border:1px solid #ddd; border-radius:3px; padding:5px 9px; font-size:10px; margin-bottom:7px;"><strong>DX / Comentarios:</strong> ${vals.dx}</div>` : ''}

    <table style="width:100%; border-collapse:collapse; margin-bottom:10px; font-size:11px;">
      <tr>
        <td style="padding:2px 0;"><strong>Esquema / Tratamiento:</strong> ${vals.esquema || '---'}</td>
        <td style="padding:2px 0; text-align:center;"><strong>KAM:</strong> ${vals.kam || '---'}</td>
        <td style="padding:2px 0; text-align:right;"><strong>Fecha programación:</strong> ${vals.fechaProg || '---'}</td>
      </tr>
    </table>

    <!-- MEDICAMENTOS TABLE -->
    ${hasMeds ? `
    <hr style="border:none; border-top:1px solid #ddd; margin:15px 0 10px 0;">
    <h3 style="color:#8C6A5A; font-size:14px; margin:8px 0 5px 0; font-weight:bold;">Medicamentos</h3>
    <table style="width:100%; border-collapse:collapse; margin-bottom:12px;">
      <thead>
        <tr>
          <th style="${thBase} text-align:left; width:44%;">Medicamento</th>
          <th style="${thBase} text-align:center;">Código</th>
          <th style="${thBase} text-align:center;">Cantidad</th>
          <th style="${thBase} text-align:right;">P. unitario</th>
          <th style="${thBase} text-align:right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${medRowsHtml}</tbody>
    </table>` : ''}

    <!-- SERVICIOS TABLE -->
    ${hasServs ? `
    <hr style="border:none; border-top:1px solid #ddd; margin:15px 0 10px 0;">
    <h3 style="color:#8C6A5A; font-size:14px; margin:8px 0 5px 0; font-weight:bold;">Servicios</h3>
    <table style="width:100%; border-collapse:collapse; margin-bottom:12px;">
      <thead>
        <tr>
          <th style="${thBase} text-align:left; width:44%;">Servicio</th>
          <th style="${thBase} text-align:center;">Cantidad</th>
          <th style="${thBase} text-align:right;">P. unitario</th>
          <th style="${thBase} text-align:center;">Descuento (%)</th>
          <th style="${thBase} text-align:right;">Total c/desc.</th>
        </tr>
      </thead>
      <tbody>${servRowsHtml}</tbody>
    </table>` : ''}

    <!-- TOTALS -->
    <div style="border: 1px solid #cbd5e1; border-top: 3px solid #0A497B; border-radius: 6px; padding: 10px 15px; margin-top: 20px; background-color: #f8fafc; page-break-inside: avoid;">
      <table style="width:100%; border-collapse:collapse; font-size:11px; color:#333;">
        <tr>
          <td style="padding:4px 0; font-weight:bold;">Subtotal<br>Medicamentos</td>
          <td style="text-align:left; padding:4px 10px; width:100px;">${formatCurrency(subTotalMed)}</td>
          <td style="text-align:center; padding:4px 10px; width:160px; font-weight:bold;">IVA sobre Servicios (16%)</td>
          <td style="text-align:left; padding:4px 10px; width:90px;">${formatCurrency(ivaServ)}</td>
          <td style="text-align:center; font-weight:bold; width:60px; font-size:13px; color:#0A497B;">TOTAL</td>
          <td style="text-align:right; font-weight:bold; font-size:16px; color:#0A497B; width:110px;">${formatCurrency(grandTotal)}</td>
        </tr>
        <tr>
          <td style="padding:2px 0; font-weight:bold;">Subtotal<br>Servicios</td>
          <td style="text-align:left; padding:2px 10px; color:#555;">${formatCurrency(subTotalServ)}</td>
          <td colspan="4"></td>
        </tr>
      </table>
    </div>

    <!-- FOOTER -->
    <div style="margin-top:18px; border-top:1px solid #ccc; padding-top:8px; overflow:hidden;">
      <img src="${QR_B64}" style="float:right; width:75px; margin-left:12px;" alt="QR">
      <p style="font-size:8px; color:#666; text-align:justify; line-height:1.55; margin:0;">
        La presente cotización es válida por 15 días naturales e incluye únicamente los conceptos señalados; cualquier servicio adicional será cotizado por separado.
        Para pacientes que no cuenten con aseguradora, se requiere un anticipo del 50% del importe total del tratamiento para su programación, y el pago restante
        deberá realizarse al momento del ingreso. En pacientes con aseguradora, será indispensable presentar su carta de autorización vigente.
        En caso de cancelación o reprogramación, se solicita avisar con al menos 24 horas de anticipación previas a la aplicación del tratamiento,
        de lo contrario, podrían generarse cargos correspondientes al medicamento y a los servicios asociados.
        La presente cotización está sujeta a cambios si el médico tratante así lo indica.
      </p>
    </div>

  </div>`;

  dom.pdfContainer.innerHTML = html;
  dom.pdfContainer.style.display = 'block';

  // Filename: Sede_Paciente_Fecha_Tipo.pdf
  const fechaStr = (vals.fechaEmision || new Date().toISOString().split('T')[0]).replace(/-/g, '');
  const pacienteStr = (vals.paciente === '---' ? 'Paciente' : vals.paciente)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '').replace(/ +/g, '_').substring(0, 30);
  const filename = `${sedeKey}_${pacienteStr}_${fechaStr}_${filenameSufix}.pdf`;

  const opt = {
    margin: [16, 10, 16, 10],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: 0 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  // Return a promise for sequential generation
  return new Promise((resolve) => {
    html2pdf().set(opt).from(dom.pdfContainer).save().then(() => {
      dom.pdfContainer.style.display = 'none';
      resolve();
    });
  });
}

dom.btnPdfAll.addEventListener('click', async () => {
  // Download 2 sequentially
  dom.btnPdfAll.disabled = true;
  dom.btnPdfAll.textContent = 'Generando Patente...';
  await generatePDF('innovador');
  
  setTimeout(async () => {
    dom.btnPdfAll.textContent = 'Generando Biocomparable...';
    await generatePDF('bio');
    
    setTimeout(() => {
      dom.btnPdfAll.textContent = 'Descargar PDFs (Patente y Biocomparable)';
      dom.btnPdfAll.disabled = false;
    }, 1500);
  }, 1500);
});

// Initial load
// Ensure Honorarios is in services
const hasHonorarios = SANARE_DATA.servicios.some(s => s.CODIGO === 'HONORARIOS' || s.DESCRIPCION.includes('HONORARIOS MÉDICOS'));
if (!hasHonorarios) {
  SANARE_DATA.servicios.push({
    CODIGO: 'HONORARIOS',
    DESCRIPCION: 'HONORARIOS MÉDICOS',
    BOLSILLO: 0, BUPA: 0, AXA: 0, METLIFE: 0, INBURSA: 0, 'PLAN SEGURO': 0, PMP: 0, 'PRECIO PUB': 0
  });
}

filterMeds();
filterServs();
renderCart();

// ---- ESQUEMA ONCOLÓGICO LOADER ----
const esquemaSearch = document.getElementById('esquemaSearch');
const listaEsquemas = document.getElementById('listaEsquemas');
const btnCargarEsquema = document.getElementById('btnCargarEsquema');
const esquemaBadge = document.getElementById('esquema-badge');

// Populate scheme selector from data
function initEsquemaSelector() {
  if (!SANARE_DATA.esquemas || !SANARE_DATA.esquemas.length) return;
  listaEsquemas.innerHTML = '';
  SANARE_DATA.esquemas.forEach((esq, idx) => {
    const opt = document.createElement('option');
    opt.value = esq.name;
    listaEsquemas.appendChild(opt);
  });
}

// Get servicio price based on current modalidad
function getPrecioServicioEsq(serv) {
  const mod = state.modalidad; // BOLSILLO, BUPA, AXA, METLIFE, INBURSA, PLAN SEGURO
  const priceMap = {
    'BOLSILLO': serv.BOLSILLO,
    'PMP':      serv.PMP,
    'BUPA':     serv.BUPA,
    'AXA':      serv.AXA,
    'METLIFE':  serv.METLIFE,
    'INBURSA':  serv.INBURSA,
    'PLAN SEGURO': serv['PLAN SEGURO'],
  };
  return parseFloat(priceMap[mod]) || parseFloat(serv.BOLSILLO) || 0;
}

/**
 * Busca en el catálogo de medicamentos por nombre comercial (marca)
 * y devuelve un mapa de precios por vial para cada modalidad.
 * Si no se encuentra, devuelve el precio_vial del esquema como fallback.
 */
function buildPreciosFromCatalog(marca, precio_vial_fallback) {
  const mods = ['BOLSILLO', 'BUPA', 'AXA', 'METLIFE', 'INBURSA', 'PLAN SEGURO', 'PMP'];
  const empty = {};
  mods.forEach(m => empty[m] = precio_vial_fallback);

  if (!marca) return empty;
  const marcaLower = marca.trim().toLowerCase();

  // Buscar por nombre comercial exacto (insensible a mayúsculas)
  const found = (SANARE_DATA.medicamentos || []).find(med => {
    const nc = (med['NOMBRE COMERCIAL'] || '').trim().toLowerCase();
    return nc === marcaLower;
  });

  if (!found) return empty;

  // Construir mapa de precio POR VIAL desde el catálogo
  const result = {};
  mods.forEach(m => {
    const val = parseFloat(found[m]);
    result[m] = (!isNaN(val) && val > 0) ? val : precio_vial_fallback;
  });
  return result;
}

/**
 * Dado un objeto {marca, precio_vial, precio_total, viales, premed, precios_por_vial},
 * retorna {precio_vial, precio_total} según la modalidad activa.
 */
function getPrecioEsqItem(part) {
  if (!part) return { precio_vial: 0, precio_total: 0 };
  const mod = state.modalidad;
  if (part.precios_por_vial && part.precios_por_vial[mod] !== undefined) {
    const pv = part.precios_por_vial[mod];
    const viales = part.viales || 1;
    return { precio_vial: pv, precio_total: pv * viales };
  }
  // Fallback al precio fijo del esquema
  return { precio_vial: part.precio_vial || 0, precio_total: part.precio_total || 0 };
}

function cargarEsquema() {
  const searchVal = esquemaSearch.value;
  if (!searchVal) return;
  const esq = SANARE_DATA.esquemas.find(e => e.name === searchVal);
  if (!esq) return;

  console.log("Cargando esquema:", esq.name);

  // Remove any previously loaded esquema items
  state.items = state.items.filter(i => !i.fromEsquema);

  let loaded = 0;

  // --- Load PATENTE items (innovador column) ---
  const patItems = esq.items_patente || [];
  const bioItems  = esq.items_bio    || [];

  console.log("patItems:", patItems.length, "bioItems:", bioItems.length);

  // Build a lookup of bio items by descripcion for quick pairing
  const bioByName = {};
  bioItems.forEach(b => {
    const key = b.descripcion.toLowerCase();
    bioByName[key] = b;
  });

  let _idCounter = Date.now();
  const nextId = () => ++_idCounter;

  // For each patente item, find its bio counterpart
  patItems.forEach(pat => {
    const bioMatch = bioByName[pat.descripcion.toLowerCase()];

    state.items.push({
      id: nextId(),
      type: 'esq_med',             // new type: esquema medicine (has direct prices)
      descripcion: pat.descripcion,
      patente: {
        marca: pat.marca,
        precio_vial: pat.precio_vial,
        precio_total: pat.precio_total,
        viales: pat.viales,
        premed: pat.premed,
        // Lookup de precios por modalidad desde el catálogo
        precios_por_vial: buildPreciosFromCatalog(pat.marca, pat.precio_vial),
      },
      bio: bioMatch ? {
        marca: bioMatch.marca,
        precio_vial: bioMatch.precio_vial,
        precio_total: bioMatch.precio_total,
        viales: bioMatch.viales,
        premed: bioMatch.premed,
        precios_por_vial: buildPreciosFromCatalog(bioMatch.marca, bioMatch.precio_vial),
      } : null,
      cant: 1,          // cycles (multiplier on top of viales)
      desc: 0,
      fromEsquema: true,
    });
    loaded++;
  });

  // Add bio-only items (in bio list but not in patente)
  const patNames = new Set(patItems.map(p => p.descripcion.toLowerCase()));
  bioItems.forEach(bio => {
    if (!patNames.has(bio.descripcion.toLowerCase())) {
      state.items.push({
        id: nextId(),
        type: 'esq_med',
        descripcion: bio.descripcion,
        patente: null,
        bio: {
          marca: bio.marca,
          precio_vial: bio.precio_vial,
          precio_total: bio.precio_total,
          viales: bio.viales,
          premed: bio.premed,
          precios_por_vial: buildPreciosFromCatalog(bio.marca, bio.precio_vial),
        },
        cant: 1,
        desc: 0,
        fromEsquema: true,
      });
      loaded++;
    }
  });

  // --- Load SERVICIOS from servicios_esq ---
  const servicios = SANARE_DATA.servicios_esq || [];
  servicios.forEach(serv => {
    const precio = getPrecioServicioEsq(serv);
    state.items.push({
      id: nextId(),
      type: 'esq_serv',
      descripcion: serv.descripcion,
      codigo: serv.codigo,
      servData: serv,       // keep full data for price switching
      customPrice: precio,
      cant: 1,
      desc: 0,
      fromEsquema: true,
    });
    loaded++;
  });

  // Auto-fill the "Esquema o tratamiento" field
  const esquemaInput = document.getElementById('esquema');
  if (esquemaInput) esquemaInput.value = esq.name;

  renderCart();
  flashEsquemaRows();

  // Show badge
  esquemaBadge.style.display = 'inline-flex';
  const clearBtn = `<span class="badge-clear" onclick="clearEsquema()" title="Limpiar esquema cargado">✕ Limpiar</span>`;
  esquemaBadge.innerHTML = `🧬 ${esq.name} &nbsp;·&nbsp; ${loaded} ítems cargados ${clearBtn}`;
}

function clearEsquema() {
  state.items = state.items.filter(i => !i.fromEsquema);
  esquemaSearch.value = '';
  esquemaBadge.style.display = 'none';
  esquemaBadge.innerHTML = '';
  const esquemaInput = document.getElementById('esquema');
  if (esquemaInput) esquemaInput.value = '';
  renderCart();
}

function flashEsquemaRows() {
  requestAnimationFrame(() => {
    const allRows = document.querySelectorAll('#table-innovador tbody tr, #table-bio tbody tr');
    allRows.forEach(tr => {
      tr.classList.remove('row-esquema-flash');
      void tr.offsetWidth;
      tr.classList.add('row-esquema-flash');
    });
  });
}

// When modalidad changes, update prices of loaded servicios
const origModalidadChange = dom.modalidadPago.onchange;
dom.modalidadPago.addEventListener('change', () => {
  // Update esq_serv and serv prices based on new modalidad
  state.items.forEach(item => {
    if (item.type === 'esq_serv' && item.servData) {
      item.customPrice = getPrecioServicioEsq(item.servData);
    } else if (item.type === 'serv' && item.serv) {
      const isHonorarios = item.serv.CODIGO === 'HONORARIOS' || item.serv.DESCRIPCION.includes('HONORARIOS');
      if (!isHonorarios) {
        item.customPrice = getPrice(item.serv);
      }
    }
  });
  renderCart();
});

btnCargarEsquema.addEventListener('click', cargarEsquema);

// Auto-load scheme when selecting from dropdown
esquemaSearch.addEventListener('change', () => {
  if (esquemaSearch.value !== '') {
    cargarEsquema();
  }
});

initEsquemaSelector();

// ---- OCR INTEGRATION ----
const btnAnalizarOcr = document.getElementById('btnAnalizarOcr');
const ocrFile = document.getElementById('ocrFile');
const ocrBadge = document.getElementById('ocr-badge');

async function fileToBase64Image(file) {
  return new Promise(async (resolve, reject) => {
    try {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          // Extraer solo la parte base64 sin el prefijo "data:image/jpeg;base64,"
          const base64Data = reader.result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      } else if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        // Solo leer la primera página por simplicidad
        const page = await pdf.getPage(1);
        
        // Renderizar a 2x de escala para mejor calidad OCR
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const base64Data = dataUrl.split(',')[1];
        resolve(base64Data);
      } else {
        reject(new Error("Formato de archivo no soportado. Sube PDF o Imagen."));
      }
    } catch (e) {
      reject(e);
    }
  });
}

if (btnAnalizarOcr && ocrFile) {
  btnAnalizarOcr.addEventListener('click', async () => {
    if (!ocrFile.files || ocrFile.files.length === 0) {
      alert("Por favor selecciona un archivo PDF o Imagen primero.");
      return;
    }

    const file = ocrFile.files[0];
    
    // Show loading state
    btnAnalizarOcr.disabled = true;
    btnAnalizarOcr.textContent = 'Convirtiendo...';
    ocrBadge.style.display = 'none';

    try {
      // 1. Convert to base64 image
      const imageBase64 = await fileToBase64Image(file);
      
      btnAnalizarOcr.textContent = 'Analizando con IA...';

      const token = currentAuthToken;
      // 2. Send to backend
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ imageBase64 })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Error al procesar el documento');
      }

      const data = await response.json();
      console.log("OCR Data extraída:", data);

      // 3. Auto-fill fields
      if (data.paciente) dom.paciente.value = data.paciente;
      if (data.medico) dom.medico.value = data.medico;
      if (data.diagnostico) document.getElementById('dx').value = data.diagnostico;

      // 4. Fuzzy match medicamentos and add them
      let encontrados = 0;
      if (data.medicamentos && Array.isArray(data.medicamentos)) {
        data.medicamentos.forEach(medAI => {
          if (!medAI.nombre) return;
          const searchStr = medAI.nombre.toLowerCase().trim();
          
          // Buscar en SANARE_DATA.medicamentos
          const match = SANARE_DATA.medicamentos.find(m => 
            (m.PA && m.PA.toLowerCase().includes(searchStr)) || 
            (m.DESCRIPCION && m.DESCRIPCION.toLowerCase().includes(searchStr)) ||
            (m['NOMBRE COMERCIAL'] && m['NOMBRE COMERCIAL'].toLowerCase().includes(searchStr))
          );

          if (match) {
            const pa = match.PA;
            let innovador = null;
            let bio = null;

            if (pa) {
              const alternatives = SANARE_DATA.medicamentos.filter(m => m.PA === pa);
              innovador = alternatives.find(m => m.CLASIFICACION && m.CLASIFICACION.toUpperCase().includes('INNOVADOR'));
              bio = alternatives.find(m => m.CLASIFICACION && (m.CLASIFICACION.toUpperCase().includes('BIO') || m.CLASIFICACION.toUpperCase().includes('GENERICO')));
            }

            if (!innovador && match.CLASIFICACION && match.CLASIFICACION.toUpperCase().includes('INNOVADOR')) innovador = match;
            if (!bio && match.CLASIFICACION && !match.CLASIFICACION.toUpperCase().includes('INNOVADOR')) bio = match;

            state.items.push({
              id: Date.now() + Math.random(),
              type: 'med',
              pa: pa || match.DESCRIPCION,
              innovador: innovador || null,
              bio: bio || null,
              cant: parseInt(medAI.cantidad) || 1,
              desc: 0
            });
            encontrados++;
          } else {
             console.warn("IA medicamento no encontrado en catálogo:", medAI.nombre);
          }
        });
      }

      renderCart();

      ocrBadge.style.display = 'inline-flex';
      ocrBadge.innerHTML = `✅ IA: Extraído y ${encontrados} meds emparejados. Por favor revisa la precisión.`;

    } catch (error) {
      console.error(error);
      alert("Hubo un error con la IA: " + error.message);
    } finally {
      btnAnalizarOcr.disabled = false;
      btnAnalizarOcr.textContent = 'Analizar';
      ocrFile.value = ''; // clear
    }
  });
}

// ---- LOGIN LOGIC ----
let currentAuthToken = null;

function checkAuth() {
  if (currentAuthToken) {
    dom.loginOverlay.style.display = 'none';
    dom.appContainer.style.display = 'block';
  } else {
    dom.loginOverlay.style.display = 'flex';
    dom.appContainer.style.display = 'none';
  }
}

if (dom.btnLogin) {
  dom.btnLogin.addEventListener('click', async () => {
    const username = dom.loginUser.value.trim();
    const password = dom.loginPass.value.trim();
    
    if (!username || !password) {
      dom.loginError.textContent = 'Por favor ingresa usuario y contraseña';
      dom.loginError.style.display = 'block';
      return;
    }
    
    dom.btnLogin.textContent = 'Verificando...';
    dom.btnLogin.disabled = true;
    
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();
      if (res.ok && data.token) {
        currentAuthToken = data.token;
        dom.loginError.style.display = 'none';
        checkAuth();
      } else {
        dom.loginError.textContent = data.error || 'Credenciales inválidas';
        dom.loginError.style.display = 'block';
      }
    } catch (err) {
      dom.loginError.textContent = 'Error de red. Intenta de nuevo.';
      dom.loginError.style.display = 'block';
    } finally {
      dom.btnLogin.textContent = 'Ingresar Seguramento';
      dom.btnLogin.disabled = false;
    }
  });
}

// Ejecutar verificación de auth al cargar
checkAuth();

// ---- INITIALIZATION ----
// ---- HISTORIAL LOGIC ----
let currentQuoteId = null;

const btnSaveQuote = document.getElementById('btn-save-quote');
const btnVerHistorico = document.getElementById('btnVerHistorico');
const modalHistorial = document.getElementById('modalHistorial');
const btnCloseHistorial = document.getElementById('btnCloseHistorial');
const historialList = document.getElementById('historialList');

function getFormValues() {
  return {
    sede: dom.sede.value,
    fechaEmision: dom.fechaEmision.value,
    fechaValidez: dom.fechaValidez.value,
    paciente: dom.paciente.value,
    medico: dom.medico.value,
    modalidadPago: dom.modalidadPago.value,
    dx: document.getElementById('dx').value,
    esquema: document.getElementById('esquema').value,
    kam: document.getElementById('kam').value,
    fechaProg: document.getElementById('fechaProg').value,
  };
}

function setFormValues(data) {
  if(data.sede) dom.sede.value = data.sede;
  if(data.fechaEmision) dom.fechaEmision.value = data.fechaEmision;
  if(data.fechaValidez) dom.fechaValidez.value = data.fechaValidez;
  if(data.paciente) dom.paciente.value = data.paciente;
  if(data.medico) dom.medico.value = data.medico;
  if(data.modalidadPago) dom.modalidadPago.value = data.modalidadPago;
  if(data.dx) document.getElementById('dx').value = data.dx;
  if(data.esquema) document.getElementById('esquema').value = data.esquema;
  if(data.kam) document.getElementById('kam').value = data.kam;
  if(data.fechaProg) document.getElementById('fechaProg').value = data.fechaProg;
  
  // trigger change events
  dom.sede.dispatchEvent(new Event('change'));
  dom.modalidadPago.dispatchEvent(new Event('change'));
}

if (btnSaveQuote) {
  btnSaveQuote.addEventListener('click', async () => {
    btnSaveQuote.disabled = true;
    btnSaveQuote.textContent = 'Guardando...';
    
    const payload = {
      id: currentQuoteId,
      form: getFormValues(),
      state: state,
      total: dom.totalInnovador.textContent
    };

    try {
      const token = currentAuthToken;
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if(data.success) {
        currentQuoteId = data.id;
        alert("Cotización guardada exitosamente en el historial.");
      } else {
        alert("Error al guardar.");
      }
    } catch (err) {
      alert("Error de conexión al guardar.");
    } finally {
      btnSaveQuote.disabled = false;
      btnSaveQuote.textContent = '💾 Guardar Cotización';
    }
  });
}

if (btnVerHistorico) {
  btnVerHistorico.addEventListener('click', async () => {
    modalHistorial.style.display = 'flex';
    historialList.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">Cargando historial...</div>';
    
    try {
      const token = currentAuthToken;
      const res = await fetch('/api/quotes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const quotes = await res.json();
      
      if (quotes.length === 0) {
        historialList.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No hay cotizaciones guardadas aún.</div>';
        return;
      }

      historialList.innerHTML = '';
      quotes.forEach(q => {
        const div = document.createElement('div');
        div.style.border = '1px solid #e2e8f0';
        div.style.padding = '15px';
        div.style.borderRadius = '8px';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.background = '#f8fafc';
        
        const dateStr = new Date(q.updatedAt).toLocaleString();
        const patient = q.form?.paciente || 'Sin nombre';
        const total = q.total || '$0.00';

        div.innerHTML = `
          <div>
            <strong style="color: #0f172a; font-size: 1.1rem;">${patient}</strong><br>
            <small style="color: #64748b;">Actualizado: ${dateStr}</small>
          </div>
          <div style="text-align: right;">
            <strong style="color: #27ae60; font-size: 1.1rem; display: block;">${total}</strong>
            <button class="btn btn-esquema" style="padding: 5px 15px; font-size: 0.9rem; margin-top: 5px;">Cargar</button>
          </div>
        `;

        div.querySelector('button').addEventListener('click', () => {
          currentQuoteId = q.id;
          state = q.state;
          setFormValues(q.form);
          renderCart();
          modalHistorial.style.display = 'none';
        });

        historialList.appendChild(div);
      });
    } catch (err) {
      historialList.innerHTML = '<div style="color: red; padding: 20px;">Error al cargar el historial. Asegúrate de que el backend esté encendido.</div>';
    }
  });
}

if (btnCloseHistorial) {
  btnCloseHistorial.addEventListener('click', () => {
    modalHistorial.style.display = 'none';
  });
}
