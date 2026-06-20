{
  lib,
  buildNpmPackage,
  rustPlatform,
  pkg-config,
  wrapGAppsHook3,
  makeWrapper,
  webkitgtk_4_1,
  gtk3,
  glib,
  cairo,
  pango,
  atk,
  gdk-pixbuf,
  librsvg,
  libsoup_3,
  dbus,
  openssl,
}:

let
  version = (lib.importJSON ../package.json).version;

  # Linux desktop conventions use the reverse-DNS id from data/linux/, which
  # differs from tauri.conf.json's `com.minidiarium`.
  appId = "io.github.fjrevoredo.mini-diarium";

  src = lib.cleanSourceWith {
    src = ../.;
    filter =
      path: type:
      let
        rel = lib.removePrefix (toString ../. + "/") (toString path);
      in
      !(
        rel == "node_modules"
        || lib.hasPrefix "node_modules/" rel
        || rel == "dist"
        || lib.hasPrefix "dist/" rel
        || rel == "src-tauri/target"
        || lib.hasPrefix "src-tauri/target/" rel
        || rel == "result"
        || lib.hasPrefix "result/" rel
        # The Nix files themselves don't affect the build, so editing them
        # shouldn't invalidate the (expensive) Rust+npm build. Markdown is NOT
        # excluded: src/plugin/rhai_loader.rs include_str!()s a docs/*.md file.
        || rel == "flake.nix"
        || rel == "flake.lock"
        || rel == "nix"
        || lib.hasPrefix "nix/" rel
      );
  };

  # Stage 1: build the SolidJS frontend (vite) into dist/.
  frontend = buildNpmPackage {
    pname = "mini-diarium-frontend";
    inherit version src;

    # Refresh this whenever package-lock.json changes:
    #   nix build .#default  (copy the "got:" hash on mismatch)
    npmDepsHash = "sha256-apHQDmn10ROPUkmhiKjz+PWeI6+k3RMqbrpVahqNmys=";

    # The repo pins peer-dependency overrides; npm needs the legacy resolver.
    npmFlags = [ "--legacy-peer-deps" ];

    # esbuild ships its platform binary as a locked optionalDependency
    # (@esbuild/linux-*), so npm installs it offline from the cache — no
    # ESBUILD_BINARY_PATH override (which would force a version mismatch).
    # Skip the puppeteer chromium download (mermaid-cli dev dependency).
    PUPPETEER_SKIP_DOWNLOAD = "1";

    # Only the web assets are needed; the tauri CLI / native bits are unused here.
    npmBuildScript = "build";

    installPhase = ''
      runHook preInstall
      mkdir -p $out
      cp -r dist $out/dist
      runHook postInstall
    '';
  };
in
rustPlatform.buildRustPackage {
  pname = "mini-diarium";
  inherit version src;

  cargoRoot = "src-tauri";
  buildAndTestSubdir = "src-tauri";

  cargoLock = {
    lockFile = ../src-tauri/Cargo.lock;
  };

  # Production build must embed the bundled frontend assets.
  buildFeatures = [ "custom-protocol" ];

  # Tests use direct DB connections and are run via `cargo test`, not as part of
  # the packaged release build.
  doCheck = false;

  nativeBuildInputs = [
    pkg-config
    wrapGAppsHook3
    makeWrapper
  ];

  buildInputs = [
    webkitgtk_4_1
    gtk3
    glib
    cairo
    pango
    atk
    gdk-pixbuf
    librsvg
    libsoup_3
    dbus
    openssl
  ];

  # tauri::generate_context! embeds ../dist (relative to src-tauri) at compile
  # time, so the built frontend must be present before cargo runs.
  postPatch = ''
    rm -rf dist
    cp -r ${frontend}/dist ./dist
  '';

  # cargoInstallHook installs the `mini-diarium` binary into $out/bin from the
  # correct (per-triple) target dir; we add the resources alongside it.
  postInstall = ''
    # Bundled fonts — resolved at runtime via MINI_DIARIUM_FONTS_DIR (see wrapper).
    install -Dm644 -t $out/share/mini-diarium/fonts fonts/*.ttf

    # Desktop integration.
    install -Dm644 data/linux/${appId}.desktop \
      $out/share/applications/${appId}.desktop
    install -Dm644 data/linux/${appId}.metainfo.xml \
      $out/share/metainfo/${appId}.metainfo.xml

    install -Dm644 src-tauri/icons/32x32.png \
      $out/share/icons/hicolor/32x32/apps/${appId}.png
    install -Dm644 src-tauri/icons/128x128.png \
      $out/share/icons/hicolor/128x128/apps/${appId}.png
    install -Dm644 src-tauri/icons/128x128@2x.png \
      $out/share/icons/hicolor/256x256/apps/${appId}.png

    install -Dm644 LICENSE \
      $out/share/licenses/mini-diarium/LICENSE
  '';

  # wrapGAppsHook3 collects args here; point the app at the store fonts dir and
  # work around a common webkitgtk-on-Nix rendering failure.
  preFixup = ''
    gappsWrapperArgs+=(
      --set MINI_DIARIUM_FONTS_DIR "$out/share/mini-diarium/fonts"
      --set-default WEBKIT_DISABLE_DMABUF_RENDERER 1
    )
  '';

  meta = {
    description = "An encrypted, local-first desktop journaling application";
    homepage = "https://mini-diarium.com";
    license = lib.licenses.mit;
    platforms = lib.platforms.linux;
    mainProgram = "mini-diarium";
  };
}
