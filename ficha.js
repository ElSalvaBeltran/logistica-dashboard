/* ══════════════════════════════════════════════════════════════
   ficha.js — LA ficha de tarea de SOON

   Un solo lugar define cómo se ve una tarea. La arquitectura y el
   Gantt cargan este archivo, de modo que abrir F0-14 desde cualquiera
   de las dos vistas muestra EXACTAMENTE la misma información.

   Antes cada vista tenía su propia ficha: la arquitectura mostraba
   7 bloques y el Gantt 3. La misma tarea decía cosas distintas
   según por dónde entraras.

   Requiere que exista el objeto global DATOS.
   ══════════════════════════════════════════════════════════════ */

var FICHA = (function () {

  // ── Motor de estado, compartido ────────────────────────────
  var HOY = new Date(DATOS.meta.hoy + 'T00:00:00');
  var FACTOR = 1.4, FINDE = 1.4;

  function fecha(s) { return new Date(s + 'T00:00:00'); }
  function dias(a, b) { return Math.round((b - a) / 86400000); }

  function esfuerzoFase(f) {
    var total = 0, hecho = 0;
    for (var id in DATOS.tareas) {
      var t = DATOS.tareas[id];
      if (t.fase !== f) continue;
      total += (t.dias || 0);
      if (t.estado === 'hecho') hecho += (t.dias || 0);
    }
    return { total: total, hecho: hecho, resta: total - hecho };
  }

  function veredictoFase(f) {
    var e = esfuerzoFase(f);
    var queda = dias(HOY, fecha(DATOS.meta.fases[f].fin));
    var necesita = Math.ceil(e.resta * FACTOR * FINDE);
    return {
      esfuerzo: e, queda: queda, necesita: necesita,
      holgura: queda - necesita,
      pct: e.total ? Math.round(e.hecho / e.total * 100) : 0
    };
  }

  function desbloqueada(id) {
    var t = DATOS.tareas[id];
    if (!t || t.estado === 'hecho') return false;
    if (!t.depende || !t.depende.length) return true;
    for (var i = 0; i < t.depende.length; i++) {
      var dt = DATOS.tareas[t.depende[i]];
      if (dt && dt.estado !== 'hecho') return false;
    }
    return true;
  }

  function clasificar(id) {
    var t = DATOS.tareas[id];
    if (!t) return null;
    if (t.estado === 'hecho') return 'hecho';
    if (t.estado === 'user') return 'user';
    if (!desbloqueada(id)) return 'bloqueada';
    return veredictoFase(t.fase).holgura < 0 ? 'retraso' : 'activo';
  }

  // Qué tareas se desbloquean cuando esta termine
  function desbloqueaA(id) {
    var r = [];
    for (var k in DATOS.tareas) {
      var t = DATOS.tareas[k];
      if (t.depende && t.depende.indexOf(id) >= 0) r.push(k);
    }
    return r;
  }

  // En qué nodos de la arquitectura vive esta tarea
  function nodosDe(id) {
    var r = [];
    for (var i = 0; i < DATOS.nodos.length; i++) {
      if (DATOS.nodos[i].tareas.indexOf(id) >= 0) r.push(DATOS.nodos[i]);
    }
    return r;
  }

  // Fases que dependen de que esta tarea esté hecha (vía otras tareas)
  function fasesAfectadas(id) {
    if (DATOS.tareas[id].estado === 'hecho') return [];
    var vistas = {}, r = [];
    desbloqueaA(id).forEach(function (sig) {
      var f = DATOS.tareas[sig].fase;
      if (f !== DATOS.tareas[id].fase && !vistas[f]) { vistas[f] = 1; r.push(f); }
    });
    return r;
  }

  var ETIQUETA = {
    hecho: 'COMPLETADA', activo: 'SE PUEDE TRABAJAR', retraso: 'URGENTE',
    bloqueada: 'BLOQUEADA', user: 'ESPERA TU ACCION'
  };
  var COLOR_EST = {
    hecho: '#059669', activo: '#0284c7', retraso: '#dc2626',
    bloqueada: '#334155', user: '#b91c1c'
  };

  // ══════════════════════════════════════════════════════════
  //  LA FICHA
  //  opciones: { volver: texto del boton, onVolver: funcion }
  // ══════════════════════════════════════════════════════════
  function html(id, opciones) {
    opciones = opciones || {};
    var t = DATOS.tareas[id];
    if (!t) return '';

    var c = clasificar(id);
    var v = veredictoFase(t.fase);
    var nodos = nodosDe(id);
    var sig = desbloqueaA(id);
    var fases = fasesAfectadas(id);

    var h = '';

    // ── Encabezado ──
    h += '<div class="fh">';
    if (opciones.onVolver)
      h += '<button class="fh-volver" onclick="' + opciones.onVolver + '">← ' +
           (opciones.volver || 'Volver') + '</button>';
    h += '<div class="fh-cod">' + id + '</div>';
    h += '<h2>' + t.nombre + '</h2>';
    h += '<div class="fh-meta">';
    h += '<span class="fh-tag est-' + c + '">' + ETIQUETA[c] + '</span>';
    h += '<span class="fh-tag">Fase ' + t.fase + ' · ' + DATOS.meta.fases[t.fase].nombre + '</span>';
    if (t.dias) h += '<span class="fh-tag">' + t.dias + ' día' + (t.dias === 1 ? '' : 's') + ' de trabajo</span>';
    if (t.fecha) h += '<span class="fh-tag ok">Completada el ' + t.fecha + '</span>';
    h += '</div></div>';

    h += '<div class="fb">';

    // ── Para qué sirve ──
    h += '<div class="fbloque azul"><h3>Para qué sirve</h3><p>' + (t.porque || 'Sin descripción.') + '</p></div>';

    // ── Dos columnas ──
    h += '<div class="f2col">';

    h += '<div class="fbloque"><h3>Qué produce</h3><p>' +
         (t.entregable || 'Todavía sin entregable definido.') + '</p></div>';

    h += '<div class="fbloque"><h3>De qué depende</h3><p>';
    if (t.depende && t.depende.length) {
      t.depende.forEach(function (d) {
        var dt = DATOS.tareas[d];
        var hecho = dt && dt.estado === 'hecho';
        h += '<span class="fchip ' + (hecho ? 'ok' : 'pend') + '" onclick="FICHA.abrir(\'' + d + '\')">' +
             (hecho ? '✓ ' : '· ') + d + ' · ' + (dt ? dt.nombre : '?') + '</span> ';
      });
    } else {
      h += '<b>Nada.</b> Puede empezar de inmediato.';
    }
    h += '</p></div></div>';

    // ── Qué desbloquea ──
    h += '<div class="fbloque"><h3>Qué desbloquea cuando termine</h3><p>';
    if (sig.length) {
      sig.forEach(function (d) {
        h += '<span class="fchip" onclick="FICHA.abrir(\'' + d + '\')">' +
             d + ' · ' + DATOS.tareas[d].nombre + '</span> ';
      });
    } else {
      h += 'Nada. Es una tarea terminal de la cadena.';
    }
    h += '</p></div>';

    // ── Nota de avance ──
    if (t.nota)
      h += '<div class="fbloque amarillo"><h3>Nota de avance</h3><p>' + t.nota + '</p></div>';

    // ── Situación de la fase ──
    if (t.estado !== 'hecho') {
      var cl = v.holgura < 0 ? 'rojo' : (v.holgura < 7 ? 'amarillo' : 'azul');
      var txt = v.holgura < 0
        ? 'La Fase ' + t.fase + ' no alcanza su hito: faltan <b>' + Math.abs(v.holgura) +
          ' días</b>. Cierra el ' + DATOS.meta.fases[t.fase].fin +
          '. Cada día sin avanzar aquí empuja todo lo de abajo.'
        : 'La Fase ' + t.fase + ' alcanza su hito con <b>' + v.holgura +
          ' días</b> de margen. Cierra el ' + DATOS.meta.fases[t.fase].fin + '.';
      h += '<div class="fbloque ' + cl + '"><h3>Situación de la fase ' + t.fase + '</h3><p>' + txt + '</p>' +
           '<div class="fbarra"><div style="width:' + v.pct + '%"></div></div>' +
           '<p class="fmini">' + v.esfuerzo.hecho + ' de ' + v.esfuerzo.total +
           ' días de trabajo completados (' + v.pct + '%)</p></div>';
    }

    // ── Impacto en otras fases ──
    if (fases.length) {
      h += '<div class="fbloque rojo"><h3>Impacto hacia adelante</h3><p>Si esta tarea se retrasa, ' +
           'arrastra directamente a ' + fases.join(', ') + '.</p></div>';
    }

    // ── Dónde vive ──
    h += '<div class="fbloque"><h3>Dónde vive en la arquitectura</h3><p>';
    if (nodos.length) {
      nodos.forEach(function (n) {
        h += '<span class="fchip dom" onclick="FICHA.irNodo(\'' + n.id + '\')">' +
             n.icono + ' ' + n.nombre + '</span> ';
      });
    } else {
      h += 'Todavía no está asignada a ningún nodo del diagrama.';
    }
    h += '</p></div>';

    h += '</div>';
    return h;
  }

  // ══════════════════════════════════════════════════════════
  //  NAVEGACION ENTRE FICHAS
  //  Se conserva el historial para poder volver de donde se vino.
  // ══════════════════════════════════════════════════════════
  var historial = [];
  var render = null;   // funcion que pinta la ficha, la define cada vista
  var irNodo = null;

  function configurar(opts) {
    render = opts.render;
    irNodo = opts.irNodo || null;
  }

  function abrir(id, origen) {
    if (!DATOS.tareas[id]) return;
    if (origen !== undefined) historial = [{ id: id, origen: origen }];
    else historial.push({ id: id, origen: historial.length ? historial[historial.length - 1].id : null });
    pintar();
  }

  function pintar() {
    if (!historial.length || !render) return;
    var actual = historial[historial.length - 1];
    render(actual.id, {
      puedeVolver: historial.length > 1,
      volver: function () { historial.pop(); pintar(); },
      saltar: function (id) { abrir(id); }
    });
  }

  function atras() {
    if (historial.length > 1) { historial.pop(); pintar(); }
  }

  function hay() { return historial.length > 1; }

  function limpiar() { historial = []; }

  return {
    html: html,
    abrir: abrir,
    atras: atras,
    hay: hay,
    limpiar: limpiar,
    configurar: configurar,
    irNodo: function (id) { if (irNodo) irNodo(id); },
    // utilidades que las vistas tambien necesitan
    clasificar: clasificar,
    veredictoFase: veredictoFase,
    esfuerzoFase: esfuerzoFase,
    desbloqueada: desbloqueada,
    desbloqueaA: desbloqueaA,
    ETIQUETA: ETIQUETA,
    COLOR_EST: COLOR_EST
  };
})();
