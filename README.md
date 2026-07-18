# AZ-104 Intersite Connectivity Placement Game

Interactive classroom web app for AZ-104 networking practice. Learners open the fixed join URL on their laptop, enter their name and session code, drag Azure services onto an architecture diagram, and submit. The trainer shows a recap with group consensus first, then reveals the correct solution.

## What is included

- Node/Express backend with server-side APIs.
- Vanilla laptop-first frontend for learners, trainer control, and recap view.
- Cosmos DB storage in Azure, with local JSON fallback for development.
- Bicep template for Azure App Service + Cosmos DB.
- Azure deployment script.
- Local SVG assets sourced from AZ-Icons / Microsoft Azure Architecture Icons.

## Game design

Learners place 11 services onto 11 fixed locations:

- Site-to-site VPN
- ExpressRoute
- ExpressRoute Gateway
- Point-to-site VPN
- Azure Firewall
- VPN Gateway
- Service Endpoint
- Private Endpoint
- VNet Peering
- Azure Load Balancer
- Azure Application Gateway

NAT is included as an unused distractor.

## Icon attribution

The Azure icon assets in `public/assets/icons` are sourced from [AZ-Icons](https://az-icons.com/), which republishes the official Microsoft Azure Architecture Icons. Review Microsoft's [icon terms](https://learn.microsoft.com/en-us/azure/architecture/icons/#icon-terms) before using them outside training/demo material.

## Local development

```bash
npm install
npm run dev
```

Open:

- Trainer: `http://localhost:3000/trainer`
- Learner join page: `http://localhost:3000/j`
- The trainer page creates a session code that learners enter on the join page.

Without Cosmos settings, submissions are stored in `.data/local-db.json`.

## Configuration

Copy `.env.example` to `.env` for local settings.

```bash
PORT=3000
TRAINER_KEY=change-me
TRAINER_EMAILS=trainer@example.com
COSMOS_ENDPOINT=
COSMOS_KEY=
COSMOS_DATABASE_ID=az104-placement-game
COSMOS_CONTAINER_ID=sessions
```

For production, protect trainer pages with Azure App Service Authentication and set `TRAINER_EMAILS` to the Microsoft/Entra ID accounts that may use `/trainer` and `/recap/...`. `TRAINER_KEY` remains available as a local development or emergency fallback.

## Azure deployment

Requirements:

- Azure CLI
- A logged-in Azure subscription
- Node.js 22 LTS runtime support in App Service

Deploy infrastructure and app:

```bash
export RESOURCE_GROUP=az104-connectivity-game-rg
export LOCATION=westeurope
export APP_NAME=your-globally-unique-app-name
export TRAINER_KEY='choose-a-strong-trainer-key'
export TRAINER_EMAILS='trainer@example.com'

bash scripts/deploy-azure.sh
```

The Bicep template creates:

- Linux Azure App Service plan
- Azure Web App
- Optional Azure Cosmos DB for NoSQL
- Optional database `az104-placement-game`
- Optional container `sessions` with partition key `/sessionId`

Set `DEPLOY_COSMOS=false` to deploy the Web App without Cosmos DB. In that mode the app uses the local JSON fallback storage.

### Current classroom App Service

The live classroom app is hosted at:

- `https://az104-ic-game-app.azurewebsites.net/j`

This App Service runs in Belgium Central on the `az104-ic-game-belgium-plan` Linux B1 plan. It intentionally uses the local JSON fallback storage. Its startup command copies `package.local-storage.json` over `package.json`, installs only the small runtime dependency set, and starts the app:

```bash
cp package.local-storage.json package.json && npm install --omit=dev && npm start
```

That keeps App Service cold starts fast while the Cosmos-ready package remains available for a future persistent storage deployment.

## Routes

- `/trainer` - create/reset sessions, show links and QR codes
- `/j` or `/join` - fixed learner join page for slide decks
- `/play/:sessionId` - learner placement game
- `/recap/:sessionId` - trainer recap and solution reveal
- `/api/health` - basic health check
