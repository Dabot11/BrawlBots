# Revisión de jugabilidad 0.4

## Fallos reproducidos y correcciones

| Fallo                                               | Reproducción / consecuencia                                                                                         | Corrección y regresión                                                                                                                                                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Espacio no atacaba con foco en un botón del HUD     | Jugar, pulsar sonido o vista trasera y mantener Espacio. El botón recibía otra activación y `attack` quedaba falso. | Los controles de combate tienen prioridad durante la pelea; los botones de menú conservan su activación nativa. La prueba de navegador exige daño real después de pulsar cada botón.                                                                     |
| Pulsaciones breves entre fotogramas                 | Pulsar y soltar Espacio antes del siguiente `poll` descartaba el ataque.                                            | Una entrada pendiente se conserva hasta el siguiente paso de simulación; pausa y reinicio la limpian.                                                                                                                                                    |
| El volumen podía capturar controles de juego        | Mantener Espacio con el deslizador enfocado; las flechas deben seguir ajustando volumen.                            | WASD, C y Espacio funcionan con el rango enfocado, P pausa y Escape cierra los ajustes.                                                                                                                                                                  |
| Contacto visible sin impacto                        | El borde del chasis entraba en el ataque, pero el centro quedaba fuera del arco.                                    | Intersección entre sector del arma y círculo del chasis; cobertura comprobada. El mismo cálculo alimenta daño, alcance y ayuda del HUD.                                                                                                                  |
| Armas rápidas cancelaban repetidamente armas lentas | Picos dobles podían reiniciar cada preparación del martillo.                                                        | Los golpes ligeros empujan sin cancelar la herramienta. Los pesados pueden interrumpir la preparación, pero un golpe ya lanzado se completa. Conceden una breve resistencia a otra interrupción. Los vuelcos mantienen su propio tiempo de recuperación. |
| Daño difícil de leer                                | Destello y partículas sin cifra ni explicación de un fallo.                                                         | Reacción direccional amortiguada del chasis, cifras de daño, aviso de blindaje y motivos de fallo: alcance, orientación o cobertura.                                                                                                                     |
| Animación y regla de golpe no compartían fases      | El movimiento podía parecer terminado cuando llegaba el impacto.                                                    | Preparación, golpe, contacto y recuperación usan una función común para el modelo y el HUD.                                                                                                                                                              |
| Pausa/resultado incluían el catálogo del inicio     | Información de configuraciones y montaje permanecía dentro del menú compacto.                                       | Se oculta información del inicio y se presenta un resumen de daño y golpes. Los menús cortos pueden desplazarse en ventanas bajas.                                                                                                                       |
| Pelea sin resolución si ambos evitan contacto       | No había límite de ronda.                                                                                           | Dos minutos de simulación; al agotar el tiempo gana el mayor porcentaje de integridad, con empate si coincide. La pausa congela tiempo, efectos y motor.                                                                                                 |
| Rival empujando permanentemente                     | Sin distancia de recuperación ni reacción a una preparación visible.                                                | El rival puede retroceder al recuperar una herramienta lenta o ante un golpe preparado; usa los mismos controles y colisiones.                                                                                                                           |

## Equilibrio observado

Se comparó el código de 0.3 (`a8efbb1`) con 0.4 usando `scripts/balance.mjs`: la misma IA controla ambos robots; seis armas, contacto directo y salidas de la arena, intercambiando ambos lados. Además, los 360 montajes se enfrentan a tres arquetipos desde ambos lados. Son **2.304 duelos por versión**.

En la matriz de armas, excluyendo enfrentamientos con la misma arma:

| Arma         | Victorias 0.3 | Victorias 0.4 |
| ------------ | ------------: | ------------: |
| Pico         |           80% |           60% |
| Picos dobles |          100% |           40% |
| Mazo         |           60% |           60% |
| Martillo     |           20% |           60% |
| Sierra       |           20% |           40% |
| Cuña         |           20% |           40% |

Cada porcentaje corresponde a 20 casos deterministas, no a una estimación de victorias humanas. Sirve para detectar ventajas sistemáticas y bloqueos; no demuestra un equilibrio perfecto. Ningún duelo terminó sin resolución ni hubo un combate a contacto sin daño de ambos robots. La sierra pasa a 7 de daño cada 0,3 s para compensar su alcance corto y su falta de interrupción.

Las piezas mantienen un beneficio y un coste comprobados. El color es cosmético. La protección frontal y la carcasa reducen daño sin dar inmunidad. El feedback muestra pérdida real de integridad, incluido el redondeo y el daño final limitado por la vida restante.

## Cómo repetir la revisión

```sh
npm test
npm run audit:balance
npm run dev -- --port 5173 --strictPort
# En otra terminal, con Python Playwright y Chromium disponibles:
npm run audit:browser
npm run build
# Con dist servido por HTTP, también bajo una subcarpeta:
python scripts/browser-audit.py --production --url http://127.0.0.1:4174/BrawlBots/
```

La prueba de navegador instrumenta módulos de Vite solo dentro de la sesión de prueba para observar estados, colocar escenarios de contacto y acortar cuentas regresivas. El código publicado no expone esas referencias. Las regresiones de botones, teclado, mando virtual, selección, persistencia, memoria, pausa y resultado utilizan la interfaz real. Los escenarios de impacto conservan la regla de daño real; no asignan una victoria para hacer pasar una prueba.

Los informes actuales y capturas se generan en `artifacts/`, ignorado por Git. Las pruebas de lógica comprueban contacto en 2.160 cruces de montaje/arma, alcance, cobertura, preparación, interrupciones, estadísticas y cierre por tiempo. Se conserva la suite anterior de movimiento, navegación, colisiones, victoria/derrota, reinicio, cámara y entradas.

La revisión de 0.4 pasó 53 pruebas de lógica, 46 comprobaciones del navegador y seis comprobaciones adicionales de la compilación de producción servida bajo `/BrawlBots/`. El resultado muestra dos decimales de integridad para distinguir decisiones por porcentajes cercanos con carcasas de diferente salud.

La revisión visual usa Chromium con WebGL por software. Un mando estándar virtual comprueba el mapeo y los cambios de dispositivo. No sustituye medir fluidez en el equipo del jugador ni probar un mando Xbox físico. El juego sigue siendo de escritorio, local y de un jugador; las colisiones aproximan el chasis con un círculo y los vuelcos son una animación con estado de recuperación.
