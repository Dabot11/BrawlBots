# Brawl Bots

**Arma tu robot. Domina la arena.** Versión 0.2: combate cuerpo a cuerpo y cámara de seguimiento. Primera versión jugable de un duelo entre robots con ruedas, en el **Patio de Chatarra**. Remache (turquesa, antena y distintivo 01) se enfrenta a Óxido (naranja, aletas y distintivo 02).

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

Chrome reciente con aceleración gráfica es la plataforma inicial. No requiere backend. Pulsa **Jugar**, Enter o A en el mando. Tras tres segundos empieza el combate. Elige pico, picos dobles, mazo, martillo, sierra o cuña volteadora en el inicio. Usa Q/E o las flechas laterales (LB/RB en el mando) para cambiar el arma. Acércate al rival para golpear; los obstáculos bloquean el contacto y la IA busca rutas alrededor de ellos.

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

| Acción                   | Teclado                        | Mando Xbox / mapeo estándar       |
| ------------------------ | ------------------------------ | --------------------------------- |
| Avanzar / retroceder     | W / S o ↑ / ↓                  | Stick izquierdo vertical          |
| Girar, también detenido  | A / D o ← / →                  | Stick izquierdo horizontal        |
| Atacar cuerpo a cuerpo   | Mantener Espacio               | Mantener RT                       |
| Pausar / reanudar        | P o Escape                     | Menu                              |
| Confirmar un menú        | Enter                          | A                                 |
| Elegir una opción        | W / S o ↑ / ↓                  | Cruceta vertical o stick vertical |
| Mirar hacia atrás        | Mantener C o botón «Ver atrás» | Mantener RS (stick derecho)       |
| Elegir arma en el inicio | Q/E o ←/→                      | LB/RB o cruceta lateral           |

El mando debe usar `mapping: 'standard'` de Gamepad API. Si no aparece, pulsa un botón con la página activa. Puedes alternar teclado y mando durante el duelo. La ayuda cambia según el último dispositivo usado; **?** permite ocultarla y la nota musical permite silenciar el sonido. El audio se activa tras una interacción. Algunos navegadores pueden exigir primero un clic o una tecla para habilitarlo.

Perder el foco o desconectar el mando activo pausa la partida y limpia las teclas. Recuperar el foco no reanuda automáticamente: confirma **Reanudar**. Los menús de pausa y resultado permiten reiniciar o regresar al inicio; los botones mantenidos no repiten confirmaciones.

## Implementación

- Arena plana con cinco obstáculos sólidos, límites físicos y decoración fuera del terreno jugable. Cámara en tercera persona elevada, detrás del robot y orientada con él. C o RS permiten mirar hacia atrás; el botón de pantalla alterna esa vista. La cámara puede salir del perímetro para mantener el encuadre.
- Conducción con aceleración, frenado, marcha atrás más lenta, ruedas animadas y colisión circular del chasis con deslizamiento por ejes. Los dos robots obedecen las mismas reglas físicas.
- Seis armas exclusivamente cuerpo a cuerpo: pico (estocada), picos dobles (contacto más amplio), mazo (barrido y empuje), martillo (golpe pesado), sierra (corte continuo) y cuña (blindaje frontal y vuelco). Cada una tiene un modelo y animación propios. Los golpes requieren alcance, orientación y un trayecto libre de obstáculos; tienen preparación, recuperación y un único impacto por ciclo. No hay armas de fuego ni proyectiles.
- El daño causa empujones limitados por las colisiones. La cuña reduce el daño frontal y vuelca al rival brevemente, interrumpiendo su conducción y ataque; se recupera automáticamente. El vuelco es una animación con estado de recuperación, no una simulación completa de cuerpos rígidos.
- IA con A\* sobre una cuadrícula, rutas suavizadas con espacio para el chasis, aproximación hasta distancia de contacto, giro gradual y recuperación de atasco mediante retroceso. Respeta el alcance, las colisiones y las interrupciones del combate.
- Cuenta regresiva, combate, victoria/derrota, pausa, revancha y regreso al inicio. Efectos breves de golpes, daño, chispas y destrucción, y audio sintetizado con Web Audio.
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
| `src/camera.js`                  | Cámara detrás del robot y vista hacia atrás                            |
| `src/render.js`                  | Modelos, arena, cámara, iluminación y efectos                          |
| `src/audio.js`                   | Sonidos procedurales y silencio                                        |
| `src/ui.js`, `src/style.css`     | Menús, vida, mensajes y controles                                      |
| `src/main.js`                    | Integración, foco y único bucle de animación                           |

## Verificación

`npm test` ejecuta pruebas con el runner nativo de Node: orientación, avance y retroceso, colisiones, separación de robots, alcance de las seis armas, golpes bloqueados por obstáculos, recuperación, blindaje, vuelcos, rutas, recuperación de IA, resultados, pausa, cuenta regresiva y reinicio. También verifica que la cámara mantenga la dirección del robot, la vista hacia atrás, la tecla P y las entradas del mando. No necesita dependencias de pruebas.

La revisión en navegador de esta entrega usa Chromium con renderizado WebGL por software, teclado y un mando estándar virtual. Se comprueban además los menús, el foco, la desconexión, el cambio de dispositivo, el sonido, el redimensionado y que los reinicios no aumenten las geometrías/texturas. Las capturas y el informe local se guardan en `artifacts/` (ignorado por Git). No se ha probado un control Xbox físico ni se ha medido el rendimiento en una MacBook Air M2.

Comprobación manual pendiente en Chrome/macOS con un mando Xbox físico:

1. Conectar por USB o Bluetooth, pulsar A y confirmar que aparece **MANDO CONECTADO**.
2. Verificar avance analógico, marcha atrás, giro detenido, zona muerta y ataque continuo con RT; RS debe mostrar la vista hacia atrás.
3. Abrir pausa con Menu, recorrer las opciones con cruceta y stick, confirmar con A; mantener botones no debe repetir acciones.
4. Desconectar durante el combate: debe pausarse. Reanudar con teclado y reconectar sin reiniciar.
5. Comprobar audio, visibilidad de ambos robots y fluidez en la resolución habitual durante varios duelos.

## Límites de esta versión

Solo escritorio, un mapa, un chasis por bando y seis armas cuerpo a cuerpo seleccionables antes del duelo. No hay controles táctiles, garaje, tienda, progresión ni multijugador. Se busca 60 FPS, con densidad de píxeles limitada a 1.75, sombras de 1024 y un máximo de 160 partículas; el rendimiento real depende de la máquina. En equipos sin aceleración WebGL, el renderizado por software puede ser lento. Las colisiones del robot aproximan el chasis con un círculo; no se simulan suspensión, impactos de piezas individuales ni suspensión física. Los vuelcos de la cuña usan una animación temporizada con recuperación automática.
