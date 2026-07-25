import rateLimit from "express-rate-limit";

const VENTANA_MS = 15 * 60 * 1000; // 15 minutos
const INTENTOS_MAXIMOS = 5;

// Esta app corre 100% local (el backend escucha solo en 127.0.0.1): todas
// las requests de todos los cajeros de un mismo local salen de la MISMA IP,
// así que limitar por IP bloquearía a todo el mundo apenas uno falle varias
// veces. Lo que de verdad hay que frenar es la fuerza bruta contra UNA
// cuenta puntual, así que la clave del límite es el email que se intenta
// loguear, no quién hace la request.
function claveEmail(req: { body?: { email?: string } }): string {
  return (req.body?.email ?? "sin-email").trim().toLowerCase();
}

// skipSuccessfulRequests: un usuario que loguea bien muchas veces seguidas
// (turnos, varias pestañas) nunca debe verse afectado — solo los intentos
// fallidos (401) suman contra el límite de esa cuenta.
export const loginRateLimit = rateLimit({
  windowMs: VENTANA_MS,
  limit: INTENTOS_MAXIMOS,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: claveEmail,
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: "DEMASIADOS_INTENTOS",
        message: "Demasiados intentos fallidos para este usuario. Esperá unos minutos y volvé a intentar.",
      },
    });
  },
});
