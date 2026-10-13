import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../", import.meta.url));

function command(binary, args, options = {}) {
  const result = spawnSync(binary, args, {
    cwd: repo,
    encoding: "utf8",
    stdio: "pipe",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      (result.stderr || result.stdout || `${binary} falló`).trim(),
    );
  }
  return (result.stdout || "").trim();
}

const git = (...args) => command("git", args);

function checkSource(source) {
  if (git("status", "--porcelain")) {
    throw new Error("Guarda los cambios en un commit antes de publicar.");
  }
  const main = git("ls-remote", "origin", "refs/heads/main").split(/\s+/)[0];
  if (source !== main) {
    throw new Error(
      "Sube el commit a main antes de publicar; solo se publica la versión oficial de GitHub.",
    );
  }
}

function deploy() {
  if (git("branch", "--show-current") !== "main") {
    throw new Error("La publicación debe ejecutarse desde main.");
  }
  const source = git("rev-parse", "HEAD");
  checkSource(source);

  // No deployment proceeds if the existing rules or production build fail.
  for (const task of ["test", "build"]) {
    command("npm", ["run", task], { stdio: "inherit" });
  }
  checkSource(source);

  const existing = git("ls-remote", "origin", "refs/heads/gh-pages");
  let parent;
  if (existing) {
    git("fetch", "origin", "gh-pages");
    parent = git("rev-parse", "FETCH_HEAD");
    const files = git("ls-tree", "-r", "--name-only", parent).split("\n");
    if (
      !files.includes("index.html") ||
      !files.some((name) => name.startsWith("assets/"))
    ) {
      throw new Error(
        "La rama gh-pages contiene archivos inesperados. Revísala antes de publicar.",
      );
    }
  }

  const temp = mkdtempSync(join(tmpdir(), "brawl-bots-pages-"));
  try {
    const site = join(temp, "site");
    const dist = join(repo, "dist");
    if (!existsSync(join(dist, "index.html")))
      throw new Error("Falta dist/index.html.");
    cpSync(dist, site, { recursive: true });
    writeFileSync(join(site, ".nojekyll"), "");
    const { version } = JSON.parse(
      readFileSync(join(repo, "package.json"), "utf8"),
    );
    writeFileSync(
      join(site, "version.json"),
      JSON.stringify({ version, sourceCommit: source }, null, 2) + "\n",
    );

    // Keep the previously provided standalone download, rebuilt from the same
    // assets as the website. This is optional; the primary site uses index.html.
    let html = readFileSync(join(dist, "index.html"), "utf8");
    const script = html.match(
      /<script\b[^>]*src="(\.\/assets\/[^\"]+\.js)"[^>]*><\/script>/,
    );
    const style = html.match(
      /<link\b[^>]*href="(\.\/assets\/[^\"]+\.css)"[^>]*>/,
    );
    if (script && style) {
      const javascript = readFileSync(join(dist, script[1]), "utf8").replaceAll(
        "</script",
        "<\\/script",
      );
      const css = readFileSync(join(dist, style[1]), "utf8").replaceAll(
        "</style",
        "<\\/style",
      );
      html = html.replace(
        script[0],
        () => `<script type="module">${javascript}</script>`,
      );
      html = html.replace(style[0], () => `<style>${css}</style>`);
      writeFileSync(join(site, "Brawl-Bots.html"), html);
    }

    // An isolated index builds the deployment tree without switching branches,
    // creating a worktree or disturbing main's staged files.
    const env = { ...process.env, GIT_INDEX_FILE: join(temp, "deploy.index") };
    const base = [
      "--git-dir=" + git("rev-parse", "--absolute-git-dir"),
      "--work-tree=" + site,
    ];
    const indexed = (...args) =>
      command("git", [...base, ...args], { cwd: site, env });
    indexed("read-tree", "--empty");
    indexed("add", "--all", "--", ".");
    const tree = indexed("write-tree");
    if (parent && tree === git("rev-parse", `${parent}^{tree}`)) {
      console.log(
        "La rama gh-pages ya contiene esta compilación; no se crea otro commit.",
      );
      return;
    }
    const args = ["commit-tree", tree];
    if (parent) args.push("-p", parent);
    args.push("-m", `Deploy Brawl Bots from ${source.slice(0, 7)}`);
    const commit = git(...args);
    // Normal fast-forward push: a concurrent deployment is rejected, never overwritten.
    command("git", ["push", "origin", `${commit}:refs/heads/gh-pages`], {
      stdio: "inherit",
    });
    const confirmed = git("ls-remote", "origin", "refs/heads/gh-pages").split(
      /\s+/,
    )[0];
    if (confirmed !== commit)
      throw new Error("No se pudo confirmar el commit publicado.");
    console.log(
      `Compilación subida a gh-pages: ${commit.slice(0, 7)} (main: ${source.slice(0, 7)}).`,
    );
    console.log(
      "GitHub publica esta rama automáticamente una vez activado Pages con fuente gh-pages / (root).",
    );
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

try {
  deploy();
} catch (error) {
  console.error(`No se publicó: ${error.message}`);
  process.exitCode = 1;
}
