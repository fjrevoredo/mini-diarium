# syntax=docker/dockerfile:1.7

ARG BUN_BASE=oven/bun:1.2@sha256:6ebf306367da43ad75c4d5119563e24de9b66372929ad4fa31546be053a16f74
ARG UBUNTU_BASE=ubuntu:24.04@sha256:786a8b558f7be160c6c8c4a54f9a57274f3b4fb1491cf65146521ae77ff1dc54

FROM ${BUN_BASE} AS frontend-builder
WORKDIR /workspace

COPY package.json bun.lock tsconfig.json tsconfig.node.json vite.config.ts uno.config.ts index.html ./
COPY src ./src
COPY public ./public

RUN bun install --frozen-lockfile
RUN bun run build

FROM ${UBUNTU_BASE} AS rust-builder

ENV DEBIAN_FRONTEND=noninteractive
ENV CARGO_HOME=/opt/cargo
ENV RUSTUP_HOME=/opt/rustup
ENV PATH=/opt/cargo/bin:${PATH}

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        curl \
        libappindicator3-dev \
        librsvg2-dev \
        libwebkit2gtk-4.1-dev \
        patchelf \
        pkg-config \
    && rm -rf /var/lib/apt/lists/*

RUN curl --proto '=https' --tlsv1.2 -fsSL https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain stable

WORKDIR /workspace

COPY src-tauri ./src-tauri
COPY docs/user-plugins ./docs/user-plugins
COPY fonts ./fonts
COPY LICENSE ./
COPY --from=frontend-builder /workspace/dist ./dist

RUN cargo build --locked --release --features custom-protocol --manifest-path src-tauri/Cargo.toml

FROM ${UBUNTU_BASE} AS runtime

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        iproute2 \
        libappindicator3-1 \
        librsvg2-2 \
        libwebkit2gtk-4.1-0 \
        netcat-openbsd \
        nginx-light \
        novnc \
        openbox \
        openssl \
        supervisor \
        tigervnc-standalone-server \
        websockify \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid 10001 --home-dir /data/home --no-create-home --shell /usr/sbin/nologin app \
    && mkdir -p /opt/mini-diarium/bin /opt/mini-diarium/fonts /opt/mini-diarium/docker

COPY --from=rust-builder /workspace/src-tauri/target/release/mini-diarium /opt/mini-diarium/bin/mini-diarium
COPY --from=rust-builder /workspace/fonts /opt/mini-diarium/fonts
COPY docker/entrypoint.sh docker/healthcheck.sh docker/init.sh docker/route-guard.sh /opt/mini-diarium/docker/
COPY docker/proxy.conf docker/supervisor.conf docker/shutdown-on-app-exit.py /opt/mini-diarium/docker/
COPY docker/index.html /usr/share/novnc/index.html

RUN chmod 0755 /opt/mini-diarium/bin/mini-diarium /opt/mini-diarium/docker/*.sh \
    && ln -sf /opt/mini-diarium/bin/mini-diarium /usr/local/bin/mini-diarium

ENV HOME=/data/home
ENV XDG_DATA_HOME=/data/xdg/data
ENV XDG_CONFIG_HOME=/data/xdg/config
ENV XDG_STATE_HOME=/data/xdg/state
ENV XDG_CACHE_HOME=/tmp/xdg-cache
ENV MINI_DIARIUM_FONTS_DIR=/opt/mini-diarium/fonts
ENV DISPLAY=:0

EXPOSE 6080

ENTRYPOINT ["/opt/mini-diarium/docker/entrypoint.sh"]
