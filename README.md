# Brawl Bots

**Construye tu ventaja.** Versión 0.4: revisión de combate, impactos legibles y controles consistentes. Un duelo entre robots con ruedas en el **Patio de Chatarra**. Remache, con el color que elijas, antena y distintivo 01, se enfrenta a Óxido (naranja, aletas y distintivo 02).

Juego web de escritorio con WebGL real, Three.js y Vite. Modelos, texturas, arena y sonidos se generan localmente; no hay CDN, servicios, cuentas ni claves de API. La interfaz está en español.

## Instalar y ejecutar

Necesitas Node.js **22.12 o posterior** y npm. Usa el checkout existente; cada tarea de Codex Cloud ya tiene su propio entorno aislado.

```sh
cd /workspace/BrawlBots
npm ci
npm run dev
```

Vite muestra la dirección del servidor y usa el puerto 5173 por defecto. En esta máquina la caché predeterminada de npm no es escribible; usa:

```sh
npm ci --cache /workspace/.npm-cache --no-audit --no-fund
```

Chrome reciente con aceleración gráfica es la plataforma inicial. No requiere backend. **Entrar al garaje**, Enter o A abre el taller; **Jugar** permite entrar directamente con el robot guardado. En el garaje, elige piezas y pulsa **Combatir**. Tras tres segundos empieza el combate. Acércate al rival para golpear; los obstáculos bloquean el contacto y la IA busca rutas alrededor de ellos.

## Garaje y equilibrio

Cada robot tiene cinco espacios independientes. Todas las piezas están disponibles desde el inicio. Hay **360 montajes funcionales** y seis colores, para **2.160 combinaciones visuales**.

| Espacio  | Opciones                                                        | Decisión                                                             |
| -------- | --------------------------------------------------------------- | -------------------------------------------------------------------- |
| Arma     | Pico, picos dobles, mazo, martillo, sierra, cuña                | Precisión, contacto, empuje, golpe pesado, presión o vuelco          |
| Ruedas   | Mixtas, velocidad, ágiles, todo terreno                         | Velocidad punta frente a giro, aceleración y resistencia al empuje   |
| Carcasa  | Aleación, ultraligera, acorazada                                | Integridad y blindaje frente a movilidad                             |
| Auxiliar | Ninguno, sobremarcha, servo de impacto, defensas, estabilizador | Potencia, velocidad, protección frontal o recuperación, con un coste |
| Color    | Menta, mandarina, cobalto, orquídea, marfil, carmín             | Solo apariencia; no altera estadísticas                              |

La ficha muestra los valores que usa el combate: integridad máxima, daño por golpe, daño/s ideal, velocidad, aceleración, giro y protección frontal. Los multiplicadores se combinan por espacio; el daño se redondea a puntos enteros. El peso de la herramienta afecta velocidad y giro. La defensa frontal combina la cuña y el auxiliar sin sumar porcentajes; el blindaje de la carcasa se aplica aparte. El todo terreno reduce los empujes y el estabilizador reduce la duración de aturdimientos y vuelcos. No hay curación, proyectiles ni ventajas ocultas por color.

Todas las combinaciones quedan entre **85–110 de integridad**, **4,7–10,0 m/s**, **91–200°/s de giro** y hasta **40,8% de reducción frontal total**. El daño sostenido ideal está entre 6,7 y 26,7 puntos/s; es solo una referencia, ya que el alcance, la orientación, los obstáculos, la preparación y las interrupciones cambian el resultado de un duelo. La sierra se ajustó a 7 puntos cada 0,3 s y mantiene el corte durante aturdimientos, pero se detiene al volcar; el martillo pega más fuerte pero tarda en recuperar y pesa más. Los golpes que coinciden en el mismo paso se resuelven juntos, con empate si ambos robots quedan destruidos.

El equilibrio es una base inicial, no una garantía de igualdad de victorias entre armas. Las pruebas comprueban límites en los 360 montajes, ventajas/costes de cada rueda, carcasa y auxiliar, y que los efectos funcionen realmente al conducir y golpear. La revisión incluye duelos con la misma IA desde ambos lados de la arena; la IA no reemplaza probar estrategias humanas. Las definiciones están centralizadas en `src/loadout.js` y `src/config.js` para poder ajustar números sin cambiar la interfaz ni duplicar reglas.

El modelo 3D actualiza piezas y pintura en el taller. Puedes girarlo y probar la animación del arma antes de entrar. La configuración se guarda en `localStorage` de este navegador, se conserva en revancha y al recargar, y se bloquea durante el duelo. Si el navegador impide guardar, el juego sigue funcionando; los datos inválidos vuelven a valores conocidos. Los modelos y materiales se reutilizan al cambiar piezas. El taller solo se vuelve a dibujar al cambiar piezas, encuadre o animación, para reducir trabajo gráfico mientras está quieto.

## Compilar y publicar como archivos estáticos

```sh
npm test
npm run build
npm run preview
```

La carpeta exacta que debes publicar es **`dist/`**, con todo su contenido. `npm run preview` permite comprobar localmente la compilación, pero no es un servidor de producción. Vite usa rutas relativas (`base: './'`), por lo que también puedes alojar `dist/` en una subcarpeta. Sirve los archivos mediante HTTP/HTTPS; no abras `index.html` con `file://`. Los sonidos y modelos no necesitan rutas externas.

## Publicar y actualizar la web

El destino de publicación es GitHub Pages. La rama `main` contiene el código y `gh-pages` contiene la versión compilada para la web.

La activación se hace una sola vez en **Settings → Pages** de este repositorio: **Source: Deploy from a branch**, **Branch: gh-pages**, carpeta **/ (root)** y **Save**. Después, cada actualización de `gh-pages` inicia la publicación de GitHub. Hacer público el repositorio permite usar Pages en el plan gratuito, pero no concede al acceso de Codex los permisos administrativos para activar el sitio.

Para actualizar el juego, Codex puede guardar y subir los cambios directamente a `main` y ejecutar:

```sh
npm run deploy
```

Este comando comprueba que el checkout esté limpio y coincida con `main` de GitHub, ejecuta las pruebas y la compilación, y sube solo los archivos de producción a `gh-pages`. Conserva el historial, rechaza sobrescrituras de publicaciones concurrentes y utiliza un índice Git temporal sin alterar el índice de `main`. Si la compilación ya está publicada, no crea otro commit. No necesita dependencias ni secretos adicionales a los que Git utiliza para escribir en el repositorio.

Este es el flujo autorizado por el propietario para las siguientes entregas de Brawl Bots: Codex realiza el commit, sube a `main` y publica la compilación. Un pull request se usa si lo solicita el propietario o lo requieren las reglas del repositorio. Guardar o publicar el entorno de Codex conserva el espacio de trabajo; la web se actualiza mediante este comando y GitHub Pages.

## Controles

| Acción                    | Teclado                        | Mando Xbox / mapeo estándar       |
| ------------------------- | ------------------------------ | --------------------------------- |
| Avanzar / retroceder      | W / S o ↑ / ↓                  | Stick izquierdo vertical          |
| Girar, también detenido   | A / D o ← / →                  | Stick izquierdo horizontal        |
| Atacar cuerpo a cuerpo    | Mantener Espacio               | Mantener RT                       |
| Pausar / reanudar         | P o Escape                     | Menu                              |
| Confirmar un menú         | Enter                          | A                                 |
| Elegir una opción         | W / S o ↑ / ↓                  | Cruceta vertical o stick vertical |
| Mirar hacia atrás         | Mantener C o botón «Ver atrás» | Mantener RS (stick derecho)       |
| Elegir pieza en el garaje | Q/E o ←/→                      | LB/RB o cruceta lateral           |
| Cambiar categoría         | W/S o ↑/↓                      | Cruceta vertical o stick vertical |
| Volver del garaje         | Escape o botón Volver          | B                                 |

El mando debe usar `mapping: 'standard'` de Gamepad API. Si no aparece, pulsa un botón con la página activa. Puedes alternar teclado y mando durante el duelo. La ayuda cambia según el último dispositivo usado; **?** permite ocultarla y la nota musical permite silenciar el sonido. El audio se activa tras una interacción. El botón de ajustes permite cambiar el volumen; la nota musical silencia todo. Volumen y silencio se guardan en este navegador. Hay motor que responde a la conducción, ataques diferenciados, metal y graves para impactos, cuenta regresiva y señales de menú; los sonidos se sintetizan con capas tonales y ruido filtrado, con compresión y un máximo de voces. Algunos navegadores pueden exigir primero un clic o una tecla para habilitarlo.

Perder el foco o desconectar el mando activo pausa la partida y limpia las teclas. Recuperar el foco no reanuda automáticamente: confirma **Reanudar**. Los menús de pausa y resultado permiten reiniciar o regresar al inicio; los botones mantenidos no repiten confirmaciones.

## Implementación

- Arena plana con cinco obstáculos sólidos, límites físicos y decoración fuera del terreno jugable. Taller con plataforma y vista 3D, reflejos procedurales y materiales metálicos. Cámara en tercera persona elevada, detrás del robot y orientada con él. C o RS permiten mirar hacia atrás; el botón de pantalla alterna esa vista. La cámara puede salir del perímetro para mantener el encuadre.
- Conducción con aceleración, frenado, marcha atrás más lenta, ruedas animadas y colisión circular del chasis con deslizamiento por ejes. Los dos robots obedecen las mismas reglas físicas.
- Seis armas exclusivamente cuerpo a cuerpo: pico (estocada), picos dobles (contacto más amplio), mazo (barrido y empuje), martillo (golpe pesado), sierra (corte continuo) y cuña (blindaje frontal y vuelco). Cada una tiene un modelo y animación propios. Los golpes comprueban contacto entre el sector del arma y el borde del chasis, orientación y un trayecto libre de obstáculos; tienen preparación, recuperación y un único impacto por ciclo. No hay armas de fuego ni proyectiles.
- El daño causa empujones limitados por las colisiones. Los golpes ligeros no cancelan una preparación; los pesados pueden interrumpir la preparación, pero no un golpe ya lanzado, y conceden un breve margen contra otra interrupción. La cuña reduce el daño frontal y vuelca al rival brevemente, interrumpiendo su conducción y ataque; se recupera automáticamente. El vuelco es una animación con estado de recuperación, no una simulación completa de cuerpos rígidos.
- IA con A\* sobre una cuadrícula, rutas suavizadas con espacio para el chasis, aproximación hasta distancia de contacto, giro gradual y recuperación de atasco mediante retroceso. Respeta el alcance, las colisiones y las interrupciones del combate.
- Cuenta regresiva, ronda de dos minutos, victoria/derrota/empate, pausa, revancha y regreso al inicio. Al agotar el tiempo se compara el porcentaje de integridad restante. Efectos breves de golpes, daño, chispas y destrucción, y audio sintetizado con Web Audio.
- Simulación a pasos de 1/60 s, acumulador y límite de tiempo por fotograma; pausa al ocultar la pestaña. Partículas con vida limitada y modelos de armas reutilizados; mallas de efectos reutilizadas y reinicio sin duplicar eventos ni bucles.

| Archivo                          | Responsabilidad                                                        |
| -------------------------------- | ---------------------------------------------------------------------- |
| `src/config.js`                  | Cámara, equilibrio, controles, arena, definiciones de robot y arma     |
| `src/input.js`                   | Teclado, Gamepad API, zona muerta, confirmaciones y dispositivo activo |
| `src/simulation.js`              | Estados, cuenta regresiva, duelo y reinicio                            |
| `src/robots.js`                  | Estadísticas y conducción                                              |
| `src/weapons.js`                 | Preparación, alcance, golpes, empujes y vuelcos                        |
| `src/collision.js`               | Chasis, cobertura y barridos de colisión                               |
| `src/navigation.js`, `src/ai.js` | A\* y decisiones del rival                                             |
| `src/loadout.js`                 | Catálogo modular, estadísticas y persistencia local                    |
| `src/garage.js`                  | Categorías, tarjetas de piezas y ficha del montaje                     |
| `src/combat.js`                  | Contacto, motivos de fallo y fases comunes de animación                |
| `src/camera.js`                  | Cámara detrás del robot y vista hacia atrás                            |
| `src/render.js`                  | Modelos, arena, cámara, iluminación y efectos                          |
| `src/audio.js`                   | Sonidos procedurales y silencio                                        |
| `src/ui.js`, `src/style.css`     | Menús, vida, mensajes y controles                                      |
| `src/main.js`                    | Integración, foco y único bucle de animación                           |

## Verificación

`npm test` ejecuta pruebas con el runner nativo de Node: orientación, avance y retroceso, colisiones, separación de robots, alcance de las seis armas, golpes bloqueados por obstáculos, recuperación, blindaje, vuelcos, rutas, recuperación de IA, resultados, pausa, cuenta regresiva y reinicio. Las pruebas adicionales de montaje comprueban límites de todas las combinaciones, piezas con ventajas y costes, efectos reales de conducción/daño/defensas/recuperación, almacenamiento y golpes simultáneos. También verifica que la cámara mantenga la dirección del robot, la vista hacia atrás, la tecla P y las entradas del mando. No necesita dependencias de pruebas.

La revisión en navegador de esta entrega usa Chromium con renderizado WebGL por software, teclado y un mando estándar virtual. Se comprueban además los menús, el foco, la desconexión, el cambio de dispositivo, el sonido, el redimensionado y que los reinicios no aumenten las geometrías/texturas. Las capturas y el informe local se guardan en `artifacts/` (ignorado por Git). No se ha probado un control Xbox físico ni se ha medido el rendimiento en una MacBook Air M2.

Comprobación manual pendiente en Chrome/macOS con un mando Xbox físico:

1. Conectar por USB o Bluetooth, pulsar A y confirmar que aparece **MANDO CONECTADO**.
2. Verificar avance analógico, marcha atrás, giro detenido, zona muerta y ataque continuo con RT; RS debe mostrar la vista hacia atrás.
3. Abrir pausa con Menu, recorrer las opciones con cruceta y stick, confirmar con A; mantener botones no debe repetir acciones.
4. Desconectar durante el combate: debe pausarse. Reanudar con teclado y reconectar sin reiniciar.
5. Elegir piezas con LB/RB, categoría con cruceta y volver con B; confirmar montaje con A.
6. Comprobar audio, visibilidad de ambos robots y fluidez en la resolución habitual durante varios duelos.

## Límites de esta versión

Solo escritorio y un mapa. El garaje permite un arma, ruedas, carcasa, un auxiliar y pintura por robot; no permite apilar módulos en el mismo espacio. No hay controles táctiles, tienda, progresión ni multijugador. Se busca 60 FPS, con densidad de píxeles limitada a 1.75, sombras de 1024 y un máximo de 160 partículas; el rendimiento real depende de la máquina. En equipos sin aceleración WebGL, el renderizado por software puede ser lento. Las colisiones del robot aproximan el chasis con un círculo; no se simulan suspensión, impactos de piezas individuales ni suspensión física. Los vuelcos de la cuña usan una animación temporizada con recuperación automática.

## Revisión de jugabilidad 0.4

La revisión y su método están en [docs/quality-review.md](docs/quality-review.md). Se corrigió que los botones de sonido, ayuda y vista trasera capturasen Espacio durante el combate. El ataque también funciona con el volumen enfocado; las flechas del deslizador conservan su función y Escape cierra los ajustes.

El HUD distingue preparación, golpe y recuperación. Indica si el rival está en alcance, si hay que girar o rodear cobertura, y muestra daño real y protección absorbida. El chasis reacciona a los impactos y las cifras flotantes se reutilizan sin crear nuevas texturas en cada golpe. La pausa detiene la simulación, las partículas, las cifras y el motor.

Las regresiones y auditorías pueden repetirse con `npm test`, `npm run audit:balance` y `npm run audit:browser`. El último comando requiere Python Playwright y Chromium, usados como herramientas de revisión y ajenos a las dependencias del juego. Para otra dirección de Vite: `python scripts/browser-audit.py --url http://127.0.0.1:5173/`. Para una compilación servida por HTTP: añadir `--production` y su dirección.
