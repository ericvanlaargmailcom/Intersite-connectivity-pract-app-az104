#!/usr/bin/env bash
set -euo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:-az104-connectivity-game-rg}"
LOCATION="${LOCATION:-westeurope}"
COSMOS_LOCATION="${COSMOS_LOCATION:-$LOCATION}"
DEPLOY_COSMOS="${DEPLOY_COSMOS:-true}"
DEPLOY_REMOTE_BUILD="${DEPLOY_REMOTE_BUILD:-true}"
APP_NAME="${APP_NAME:-}"
TRAINER_KEY="${TRAINER_KEY:-}"

cleanup() {
  rm -f app.zip
}
trap cleanup EXIT

if [[ -z "$TRAINER_KEY" ]]; then
  echo "Set TRAINER_KEY before running this script."
  exit 1
fi

az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION"

DEPLOY_ARGS=(
  --resource-group "$RESOURCE_GROUP"
  --template-file infra/main.bicep
  --parameters trainerKey="$TRAINER_KEY"
  --parameters cosmosLocation="$COSMOS_LOCATION"
  --parameters deployCosmos="$DEPLOY_COSMOS"
)

if [[ -n "$APP_NAME" ]]; then
  DEPLOY_ARGS+=(--parameters appName="$APP_NAME")
fi

az deployment group create "${DEPLOY_ARGS[@]}"

WEBAPP_NAME="$APP_NAME"
if [[ -z "$WEBAPP_NAME" ]]; then
  WEBAPP_NAME="$(az deployment group show \
    --resource-group "$RESOURCE_GROUP" \
    --name main \
    --query properties.outputs.appUrl.value \
      --output tsv | sed -E 's#https://([^.]*)\..*#\1#')"
fi

az webapp config appsettings set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$WEBAPP_NAME" \
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT="$DEPLOY_REMOTE_BUILD"

ZIP_EXCLUDES=(".git/*" ".data/*" "app.zip" "infra/main.json" "work/*" "outputs/*")
if [[ "$DEPLOY_REMOTE_BUILD" == "true" ]]; then
  ZIP_EXCLUDES+=("node_modules/*")
fi

zip -r app.zip . -x "${ZIP_EXCLUDES[@]}"

az webapp deploy \
  --resource-group "$RESOURCE_GROUP" \
  --name "$WEBAPP_NAME" \
  --src-path app.zip \
  --type zip

az webapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$WEBAPP_NAME" \
  --query defaultHostName \
  --output tsv
