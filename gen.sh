#!/usr/bin/env bash
LATEST_DOCKER_ENGINE_VERSION=$(curl -sL https://docs.docker.com/engine/api/latest | awk -F"/" '/\/engine\/api\/v/{print $4}')
bunx openapi-typescript https://docs.docker.com/engine/api/$LATEST_DOCKER_ENGINE_VERSION.yaml -o ./$LATEST_DOCKER_ENGINE_VERSION.d.ts
cp $LATEST_DOCKER_ENGINE_VERSION.d.ts latest.d.ts
