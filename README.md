# AZ-104 Intersite Connectivity Placement Game

Interactive classroom web app for AZ-104 networking practice. Learners open a session link or QR code, enter their name, drag Azure services onto an architecture diagram, and submit. The trainer shows a recap with group consensus first, then reveals the correct solution.

## What is included

- Node/Express backend with server-side APIs.
- Vanilla responsive frontend for learners, trainer control, and recap view.
- Cosmos DB storage in Azure, with local JSON fallback for development.
- Bicep template for Azure App Service + Cosmos DB.
- Azure deployment script.
- Local SVG assets sourced from AZ-Icons / Microsoft Azure Architecture Icons.

## Game design

Learners place 10 services onto 10 fixed locations:

- Site-to-site VPN
- ExpressRoute
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
- Learner links are generated from the trainer page.

Without Cosmos settings, submissions are stored in `.data/local-db.json`.

## Configuration

Copy `.env.example` to `.env` for local settings.

```bash
PORT=3000
TRAINER_KEY=change-me
COSMOS_ENDPOINT=
COSMOS_KEY=
COSMOS_DATABASE_ID=az104-placement-game
COSMOS_CONTAINER_ID=sessions
```

If `TRAINER_KEY` is set, trainer API calls require that key. The trainer page stores it in browser local storage.

## Azure deployment

Requirements:

- Azure CLI
- A logged-in Azure subscription
- Node.js 20 runtime support in App Service

Deploy infrastructure and app:

```bash
export RESOURCE_GROUP=az104-connectivity-game-rg
export LOCATION=westeurope
export APP_NAME=your-globally-unique-app-name
export TRAINER_KEY='choose-a-strong-trainer-key'

bash scripts/deploy-azure.sh
```

The Bicep template creates:

- Linux Azure App Service plan
- Azure Web App
- Azure Cosmos DB for NoSQL
- Database `az104-placement-game`
- Container `sessions` with partition key `/sessionId`

## Routes

- `/trainer` - create/reset sessions, show links and QR codes
- `/play/:sessionId` - learner placement game
- `/recap/:sessionId` - trainer recap and solution reveal
- `/api/health` - basic health check
