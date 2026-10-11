FROM node:24.13.0-bookworm-slim@sha256:4660b1ca8b28d6d1906fd644abe34b2ed81d15434d26d845ef0aced307cf4b6f

ENV ELM_HOME=/opt/elm-home
WORKDIR /opt/fundm

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN npm install --global --no-audit --no-fund elm@0.19.1-6 \
    && npm cache clean --force

COPY experiment/backend/package.json experiment/backend/package-lock.json ./experiment/backend/
RUN npm ci --prefix experiment/backend --omit=dev --no-audit --no-fund \
    && npm cache clean --force

# .dockerignore admits only the files needed by the editor and experiments.
COPY elm.json start.sh ./
COPY src/ ./src/
COPY ui/ ./ui/
COPY experiment/ ./experiment/

# Prepare the Linux Elm cache while preserving the shipped JavaScript bundles.
RUN elm make src/Ui/Main.elm --output=/tmp/ui.js \
    && elm make src/Experiment.elm --output=/tmp/experiment.js \
    && rm /tmp/ui.js /tmp/experiment.js \
    && sed -i 's/\r$//' start.sh \
    && chmod +x start.sh

EXPOSE 8000 3000
CMD ["./start.sh"]
