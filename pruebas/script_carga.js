// Prueba de carga de la API con k6 (hallazgos HAL-021, HAL-022 y HAL-025).
// Simula visitantes que abren la cartelera, revisan la ocupación de una función y comprueban la salud de la API.
// No compra ni bloquea butacas: se puede correr contra cualquier entorno sin dejar datos.
//
// Local (API en docker compose):
//   docker run --rm -i -e BASE=http://host.docker.internal:8080 grafana/k6 run - < pruebas/script_carga.js
// Otro entorno:
//   docker run --rm -i -e BASE=https://tu-api.onrender.com grafana/k6 run - < pruebas/script_carga.js

import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE || "http://host.docker.internal:8080";

export const options = {
  stages: [
    { duration: "15s", target: 500 }, // subida a 500 usuarios simultáneos
    { duration: "30s", target: 500 }, // carga sostenida
    { duration: "10s", target: 0 }, // bajada
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"], // menos de 1 % de errores
    "http_req_duration{endpoint:funciones}": ["p(95)<800"], // cartelera: 95 % en menos de 800 ms
    "http_req_duration{endpoint:asientos}": ["p(95)<800"],
  },
};

// La lista de funciones se pide una vez al inicio para elegir funciones reales.
export function setup() {
  const r = http.get(`${BASE}/api/funciones`);
  const funciones = r.json();
  if (!Array.isArray(funciones) || funciones.length === 0) throw new Error(`La API no devolvió funciones: ${r.status}`);
  return { codigos: funciones.slice(0, 40).map((f) => f.codigo) };
}

export default function ({ codigos }) {
  const cartelera = http.get(`${BASE}/api/funciones`, { tags: { endpoint: "funciones" } });
  check(cartelera, { "cartelera 200": (r) => r.status === 200 });

  const codigo = codigos[Math.floor(Math.random() * codigos.length)];
  const asientos = http.get(`${BASE}/api/funciones/${codigo}/asientos`, { tags: { endpoint: "asientos" } });
  check(asientos, { "ocupación 200": (r) => r.status === 200 });

  check(http.get(`${BASE}/api/salud`, { tags: { endpoint: "salud" } }), { "salud 200": (r) => r.status === 200 });
  sleep(1);
}
