"""Run against Vite (default), or --production --url a locally served build.
Requires Python Playwright and Chromium; no game/debug hooks are shipped in src.
"""

import argparse, json
from pathlib import Path
from playwright.sync_api import sync_playwright

args = argparse.ArgumentParser()
args.add_argument("--url", default="http://127.0.0.1:5173/")
args.add_argument("--production", action="store_true")
args = args.parse_args()
root = Path("artifacts")
root.mkdir(exist_ok=True)
checks = []
errors = []


def check(name, condition=True):
    assert condition, name
    checks.append(name)
    print("PASS:", name, flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path="/usr/bin/chromium",
        headless=True,
        args=[
            "--no-sandbox",
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
        ],
    )
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on(
        "console",
        lambda message: (
            errors.append(message.text) if message.type == "error" else None
        ),
    )
    response = page.goto(args.url, wait_until="networkidle")
    check("documento y módulos cargan", response.status == 200)
    if args.production:
        page.get_by_role("button", name="Entrar al garaje", exact=True).click()
        for category, part in [
            ("Carcasa", "armored"),
            ("Auxiliar", "actuator"),
            ("Color", "blue"),
        ]:
            page.get_by_role("tab", name=category, exact=True).click()
            page.locator(f'[data-part="{part}"]').click()
        check(
            "montaje en producción muestra las estadísticas reales",
            "110 pts" in page.locator("#garage-stats").inner_text()
            and "27 / golpe" in page.locator("#garage-stats").inner_text(),
        )
        page.locator("#garage-play").click()
        page.wait_for_function(
            "document.querySelector('#menu').hidden && document.querySelector('#countdown').hidden",
            timeout=30000,
        )
        page.locator("#sound").click()
        muted = page.locator("#sound").get_attribute("aria-pressed")
        page.keyboard.down("Space")
        page.wait_for_function(
            "document.querySelector('#weapon-status').classList.contains('is-attacking')"
        )
        check(
            "Espacio mantiene el ataque después de tocar sonido en producción",
            page.locator("#sound").get_attribute("aria-pressed") == muted,
        )
        page.keyboard.up("Space")
        page.keyboard.press("KeyP")
        page.get_by_role("button", name="Reanudar", exact=True).wait_for()
        check(
            "pausa no muestra catálogo del inicio",
            page.locator(".home-features").is_hidden()
            and page.locator("#home-build").is_hidden(),
        )
        page.locator("#audio-settings").click()
        page.locator("#volume").fill("55")
        page.locator("#volume").focus()
        page.keyboard.press("KeyP")
        page.wait_for_function("document.querySelector('#menu').hidden")
        check("P funciona con el volumen enfocado")
        page.keyboard.down("KeyC")
        page.wait_for_function(
            "document.querySelector('#rear-view').getAttribute('aria-pressed')==='true'"
        )
        page.keyboard.up("KeyC")
        page.keyboard.press("KeyP")
        page.get_by_role("button", name="Reanudar", exact=True).wait_for()
        page.screenshot(path=str(root / "audit-production.png"))
    else:

        def hook():
            page.evaluate(
                """async()=>{
                const source=await(await fetch('/src/main.js')).text();const url=name=>source.split('\\n').find(line=>line.includes('/src/'+name+'.js')).split('"')[1];
                const {Renderer}=await import(url('render')),update=Renderer.prototype.update,handle=Renderer.prototype.handle;
                window.__events=[];window.__frames=0;window.__reactionSeen=false;window.__labelSeen=false;
                Renderer.prototype.handle=function(events){__events.push(...events);if(__events.length>500)__events.splice(0,__events.length-500);return handle.call(this,events)};
                Renderer.prototype.update=function(sim,dt,rear){window.__sim=sim;window.__renderer=this;__frames++;const result=update.call(this,sim,dt,rear);const v=this.robots[1];if(v.hitClock>0&&(Math.abs(v.body.rotation.x)+Math.abs(v.body.rotation.z)>.01))__reactionSeen=true;if(this.damageLabels.some(l=>l.object.visible))__labelSeen=true;return result;};
                const {Input}=await import(url('input')),poll=Input.prototype.poll;Input.prototype.poll=function(){window.__input=this;window.__command=poll.call(this);return __command;};
                const {Sound}=await import(url('audio')),soundUpdate=Sound.prototype.update;Sound.prototype.update=function(sim){window.__sound=this;return soundUpdate.call(this,sim);};
            }"""
            )
            page.wait_for_function("window.__sim&&window.__input&&window.__sound")
            page.evaluate("()=>{window.__realAI=__sim.ai.update;}")

        hook()

        def home():
            state = page.evaluate("__sim.state")
            if state in ["playing", "countdown"]:
                page.keyboard.press("KeyP")
                page.wait_for_function("__sim.state==='paused'")
            if page.evaluate("__sim.state") in ["paused", "result"]:
                page.get_by_role("button", name="Volver al inicio", exact=True).click()
            elif page.evaluate("__sim.state") == "garage":
                page.locator("#garage-back").click()
            page.wait_for_function("__sim.state==='home'")

        def garage():
            if page.evaluate("__sim.state") != "garage":
                home()
                page.get_by_role("button", name="Entrar al garaje", exact=True).click()
                page.wait_for_function("__sim.state==='garage'")

        def choose(category, part):
            page.get_by_role("tab", name=category, exact=True).click()
            page.locator(f'[data-part="{part}"]').click()
            page.wait_for_function("__renderer.renderedLoadout===__sim.loadout")

        def fixture(weapon="hammer", distance=2.8):
            garage()
            choose("Arma", weapon)
            page.locator("#garage-play").click()
            page.wait_for_function("__sim.state==='countdown'")
            page.evaluate(
                """distance=>{__sim.ai.update=()=>({throttle:0,turn:0,attack:false});__events.length=0;const[a,b]=__sim.robots;a.x=b.x=-12;a.z=8;b.z=8-distance;a.angle=0;b.angle=Math.PI;__sim.countdown=.02;__renderer.resetView(a);}""",
                distance,
            )
            page.wait_for_function("__sim.state==='playing'")

        # Regression: the focus stays on the clicked HUD control throughout each strike.
        for button in ["sound", "help-toggle", "rear-view"]:
            fixture()
            page.locator("#" + button).click()
            if button == "rear-view":
                page.wait_for_function(
                    "document.querySelector('#rear-view').getAttribute('aria-pressed')==='true'"
                )
            before = page.locator("#" + button).get_attribute("aria-pressed")
            page.keyboard.down("Space")
            page.wait_for_function("__sim.robots[1].hp<100", timeout=20000)
            page.keyboard.up("Space")
            check(
                "ataque real con foco en " + button,
                page.locator("#" + button).get_attribute("aria-pressed") == before,
            )
        fixture()
        page.locator("#audio-settings").click()
        page.locator("#volume").focus()
        page.keyboard.press("ArrowRight")
        volume = page.locator("#volume").input_value()
        page.keyboard.down("Space")
        page.wait_for_function("__sim.robots[1].hp<100", timeout=20000)
        page.keyboard.up("Space")
        check(
            "ataque real con el deslizador enfocado y flechas nativas",
            page.locator("#volume").input_value() == volume,
        )
        page.keyboard.press("Escape")
        check("Escape cierra ajustes", page.locator("#audio-panel").is_hidden())
        page.wait_for_function("__reactionSeen&&__labelSeen")
        check("daño produce movimiento del chasis y números 3D")
        page.screenshot(path=str(root / "audit-hit.png"))
        fixture()
        page.keyboard.press("Space")
        page.wait_for_function("__sim.robots[1].hp<100", timeout=20000)
        page.wait_for_function("!__command.attack")
        check(
            "un toque corto de Espacio registra un único ataque",
            page.evaluate("__sim.robots[0].attacks===1"),
        )
        for weapon in ["spike", "forks", "mace", "hammer", "saw", "wedge"]:
            fixture(weapon)
            page.keyboard.down("Space")
            page.wait_for_function(
                '__events.some(e=>e.type==="damage"&&e.owner===0)', timeout=20000
            )
            page.keyboard.up("Space")
            check(
                weapon + ": contacto, daño y feedback coinciden",
                page.evaluate(
                    "__events.some(e=>e.type==='damage'&&e.amount===100-__sim.robots[1].hp)"
                ),
            )
        fixture(distance=7)
        page.keyboard.down("Space")
        page.wait_for_function(
            '__events.some(e=>e.type==="miss"&&e.reason==="range")', timeout=20000
        )
        page.keyboard.up("Space")
        check(
            "fallar por alcance se explica y no quita vida",
            page.evaluate("__sim.robots[1].hp===100")
            and "ACÉRCATE" in page.locator("#combat-hint").inner_text(),
        )
        fixture()
        page.evaluate("()=>{__sim.robots[0].angle=Math.PI;}")
        page.keyboard.down("Space")
        page.wait_for_function(
            '__events.some(e=>e.type==="miss"&&e.reason==="aim")', timeout=20000
        )
        page.keyboard.up("Space")
        check(
            "golpear hacia atrás falla con indicación de giro",
            page.evaluate("__sim.robots[1].hp===100")
            and "GIRA" in page.locator("#combat-hint").inner_text(),
        )
        fixture()
        page.evaluate(
            "()=>{const[a,b]=__sim.robots;a.x=b.x=0;a.z=1.05;b.z=-4.05;__renderer.resetView(a);}"
        )
        page.keyboard.down("Space")
        page.wait_for_function(
            '__events.some(e=>e.type==="miss"&&e.reason==="cover")', timeout=20000
        )
        page.keyboard.up("Space")
        check(
            "cobertura bloquea daño y se explica",
            page.evaluate("__sim.robots[1].hp===100")
            and "OBSTÁCULO" in page.locator("#combat-hint").inner_text(),
        )
        fixture()
        page.keyboard.down("KeyW")
        page.wait_for_function("__sound.motorLevel>.02")
        page.keyboard.up("KeyW")
        page.keyboard.press("KeyP")
        page.wait_for_function("__sim.state==='paused'")
        page.wait_for_function("__sound.motorGain.gain.value<.001")
        frozen = page.evaluate(
            "JSON.stringify({r:__sim.robots,t:__sim.elapsed,labels:__renderer.damageLabels.map(l=>l.life)})"
        )
        page.wait_for_timeout(450)
        check(
            "P congela simulación, efectos y motor",
            page.evaluate(
                "JSON.stringify({r:__sim.robots,t:__sim.elapsed,labels:__renderer.damageLabels.map(l=>l.life)})"
            )
            == frozen,
        )
        check(
            "pausa oculta datos del inicio",
            page.locator(".home-features").is_hidden()
            and page.locator("#home-build").is_hidden(),
        )
        page.keyboard.press("KeyP")
        page.wait_for_function("__sim.state==='playing'")
        page.keyboard.down("KeyC")
        page.wait_for_function(
            "document.querySelector('#rear-view').getAttribute('aria-pressed')==='true'"
        )
        page.keyboard.up("KeyC")
        page.wait_for_function(
            "document.querySelector('#rear-view').getAttribute('aria-pressed')==='false'"
        )
        check("vista trasera funciona con C y vuelve al soltar")
        page.keyboard.down("Space")
        page.evaluate("window.dispatchEvent(new Event('blur'))")
        page.wait_for_function("__sim.state==='paused'")
        check(
            "perder foco pausa y limpia ataques",
            page.evaluate("__input.keys.size===0&&!__input.enabled"),
        )
        page.keyboard.up("Space")
        page.evaluate("window.dispatchEvent(new Event('focus'))")
        check("recuperar foco no reanuda solo", page.evaluate("__sim.state==='paused'"))
        # Full garage, persistence, selection lock and warmed graphics allocation.
        garage()
        for category, parts in [
            ("Arma", ["spike", "forks", "mace", "hammer", "saw", "wedge"]),
            ("Ruedas", ["standard", "road", "agile", "grip"]),
            ("Carcasa", ["balanced", "light", "armored"]),
            ("Auxiliar", ["none", "motor", "actuator", "shield", "stabilizer"]),
            ("Color", ["mint", "orange", "blue", "pink", "cream", "red"]),
        ]:
            for part in parts:
                choose(category, part)
            check("garaje: " + category + " actualiza piezas y modelo")
        memory = page.evaluate("JSON.stringify(__renderer.renderer.info.memory)")
        for _ in range(4):
            choose("Arma", "hammer")
            choose("Auxiliar", "shield")
            choose("Arma", "saw")
            choose("Auxiliar", "stabilizer")
        check(
            "piezas repetidas mantienen geometrías y texturas",
            page.evaluate("JSON.stringify(__renderer.renderer.info.memory)") == memory,
        )
        saved = page.evaluate("JSON.stringify(__sim.loadout)")
        page.reload(wait_until="networkidle")
        hook()
        check(
            "montaje persiste al recargar",
            page.evaluate("JSON.stringify(__sim.loadout)") == saved,
        )
        garage()
        page.set_viewport_size({"width": 1440, "height": 900})
        page.wait_for_timeout(150)
        page.screenshot(path=str(root / "audit-garage.png"))
        # Synthetic standard controller tests real event edges and device switching.
        page.evaluate(
            """()=>{window.__pad={index:0,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[__pad]});}"""
        )
        page.get_by_role("tab", name="Arma", exact=True).click()
        old = page.evaluate("__sim.loadout.weapon")
        page.evaluate("()=>{__pad.buttons[5]={pressed:true,value:1};}")
        page.wait_for_function("(old)=>__sim.loadout.weapon!==old", arg=old)
        selected = page.evaluate("__sim.loadout.weapon")
        page.wait_for_timeout(200)
        check(
            "RB mantenido no recorre piezas sin control",
            page.evaluate("__sim.loadout.weapon") == selected,
        )
        page.evaluate(
            "()=>{__pad.buttons[5]={pressed:false,value:0};__pad.buttons[0]={pressed:true,value:1};}"
        )
        page.wait_for_function("__sim.state==='countdown'")
        page.evaluate(
            "()=>{__pad.buttons[0]={pressed:false,value:0};__sim.countdown=.02;__sim.ai.update=()=>({throttle:0,turn:0,attack:false});}"
        )
        page.wait_for_function("__sim.state==='playing'")
        check(
            "combate bloquea edición de piezas",
            page.evaluate('!__sim.selectPart("shell","light")'),
        )
        page.evaluate(
            "()=>{__pad.buttons[7]={pressed:true,value:.9};__pad.buttons[11]={pressed:true,value:1};}"
        )
        page.wait_for_function("__command.attack&&__command.rear")
        check("RT y RS dan ataque y vista trasera")
        page.evaluate("()=>{__pad.buttons[9]={pressed:true,value:1};}")
        page.wait_for_function("__sim.state==='paused'")
        page.wait_for_timeout(200)
        check(
            "Menu mantenido no vuelve a reanudar",
            page.evaluate("__sim.state==='paused'"),
        )
        page.evaluate(
            "()=>{__pad.buttons.forEach(button=>{button.pressed=false;button.value=0});}"
        )
        page.wait_for_function(
            "__input.previousTrigger===0&&!__input.previousButtons.some(Boolean)"
        )
        page.keyboard.press("KeyP")
        page.wait_for_function("__sim.state==='playing'")
        page.evaluate("()=>{__pad.buttons[7]={pressed:true,value:.9};}")
        page.wait_for_function('__input.device==="gamepad"')
        page.evaluate(
            "()=>{Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[]})}"
        )
        page.wait_for_function("__sim.state==='paused'")
        check("desconexión del mando pausa el duelo")
        page.keyboard.press("KeyP")
        page.wait_for_function("__sim.state==='playing'")

        # Bounded effect pools, warmed and rendered before comparing GPU allocations.
        def burst():
            frame = page.evaluate("__frames")
            page.evaluate(
                '()=>{__renderer.handle(Array.from({length:16},()=>({type:"damage",owner:0,target:1,amount:1,absorbed:0,x:__sim.robots[1].x,z:__sim.robots[1].z})));}'
            )
            page.wait_for_function("(frame)=>__frames>frame+1", arg=frame)

        burst()
        effect_memory = page.evaluate("JSON.stringify(__renderer.renderer.info.memory)")
        for _ in range(3):
            burst()
        check(
            "cifras e impactos repetidos reutilizan sus texturas",
            page.evaluate("JSON.stringify(__renderer.renderer.info.memory)")
            == effect_memory,
        )
        # Real hit KO, reset, decision and draw interfaces.
        fixture()
        page.evaluate("()=>{__sim.robots[1].hp=3;}")
        page.keyboard.down("Space")
        page.wait_for_function(
            "__sim.state==='result'&&__sim.winner===0", timeout=20000
        )
        page.keyboard.up("Space")
        check(
            "victoria y resumen salen de un impacto real",
            "DAÑO CAUSADO 3" in page.locator("#result-summary").inner_text(),
        )
        page.screenshot(path=str(root / "audit-result.png"))
        page.get_by_role("button", name="Revancha", exact=True).click()
        page.wait_for_function(
            "__sim.state==='countdown' && !document.querySelector('#countdown').hidden"
        )
        check(
            "revancha limpia estadísticas y salud",
            page.evaluate(
                "__sim.robots[0].damageDealt===0&&__sim.robots[0].hp===__sim.robots[0].health"
            ),
        )
        page.evaluate(
            "()=>{__sim.ai.update=()=>({throttle:0,turn:0,attack:false});__sim.countdown=.02;__sim.elapsed=119.99;__sim.robots[0].hp=__sim.robots[0].health*.5;__sim.robots[1].hp=50;}"
        )
        page.wait_for_function("__sim.state==='result'&&__sim.winner===-1")
        check(
            "tiempo e integridad iguales producen empate visible",
            "EMPATE" in page.locator("#menu h1").inner_text()
            and "Tiempo agotado" in page.locator("#menu .tagline").inner_text(),
        )
        for width, height in [(1280, 720), (1024, 600), (1440, 900)]:
            home()
            page.set_viewport_size({"width": width, "height": height})
            page.wait_for_timeout(100)
            check(
                f"inicio accesible en {width}x{height}",
                page.evaluate(
                    """()=>{const r=document.querySelector('#menu-buttons').getBoundingClientRect();return r.top>80&&r.bottom<innerHeight}"""
                ),
            )
            garage()
            choose("Arma", "wedge")
            check(
                f"Combatir visible en {width}x{height}",
                page.evaluate(
                    """()=>{const r=document.querySelector('#garage-play').getBoundingClientRect();return r.top>80&&r.bottom<innerHeight}"""
                ),
            )
        # Real rival navigation without fixtures or disabled intelligence.
        home()
        page.get_by_role("button", name="Jugar", exact=True).click()
        page.wait_for_function("__sim.state==='countdown'")
        page.evaluate("()=>{__sim.ai.update=__realAI;__sim.countdown=.02;}")
        page.wait_for_function(
            "__sim.robots[0].hp<__sim.robots[0].health", timeout=60000
        )
        check("IA real navega y hace daño en contacto")
    check("sin errores de JavaScript ni consola", not errors)
    (
        root / ("production-audit.json" if args.production else "browser-audit.json")
    ).write_text(
        json.dumps(
            {"checks": checks, "errors": errors, "physicalControllerTested": False},
            ensure_ascii=False,
            indent=2,
        )
    )
    browser.close()
print("TOTAL", len(checks), flush=True)
