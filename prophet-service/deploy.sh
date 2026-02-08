#!/bin/bash
set -e

# ─── Josephine Prophet Service - Deploy Script ───────────────────────────
# Usage:
#   ./deploy.sh fly        → Deploy to Fly.io
#   ./deploy.sh render     → Deploy to Render (via GitHub push)
#   ./deploy.sh cloudrun   → Deploy to Google Cloud Run
#   ./deploy.sh docker     → Build and run Docker locally
# ──────────────────────────────────────────────────────────────────────────

COMMAND="${1:-help}"
IMAGE_NAME="josephine-prophet"
REGION="europe-west1"  # Belgium (closest GCP to Madrid)

case "$COMMAND" in

  fly)
    echo "🚀 Deploying to Fly.io..."
    if ! command -v flyctl &> /dev/null; then
      echo "Installing Fly CLI..."
      curl -L https://fly.io/install.sh | sh
    fi
    cd "$(dirname "$0")"
    flyctl deploy --remote-only
    flyctl secrets set PROPHET_API_KEY="${PROPHET_API_KEY:-$(openssl rand -hex 16)}"
    echo ""
    echo "✅ Deployed! URL: https://josephine-prophet.fly.dev"
    echo "   Health: https://josephine-prophet.fly.dev/health"
    ;;

  render)
    echo "📦 Render deploys automatically from GitHub."
    echo ""
    echo "Steps:"
    echo "  1. Go to https://dashboard.render.com/new/web"
    echo "  2. Connect your GitHub repo: oscartejera/josephine-app"
    echo "  3. Set Root Directory to: prophet-service"
    echo "  4. Set Environment to: Docker"
    echo "  5. Add env var PROPHET_API_KEY (generate one)"
    echo "  6. Click 'Create Web Service'"
    echo ""
    echo "Or use the render.yaml blueprint:"
    echo "  https://dashboard.render.com/blueprints"
    ;;

  cloudrun)
    echo "🚀 Deploying to Google Cloud Run..."
    if ! command -v gcloud &> /dev/null; then
      echo "❌ gcloud CLI not installed. Install: https://cloud.google.com/sdk/docs/install"
      exit 1
    fi
    cd "$(dirname "$0")"
    PROJECT_ID=$(gcloud config get-value project)

    echo "Building and pushing Docker image..."
    gcloud builds submit --tag "gcr.io/${PROJECT_ID}/${IMAGE_NAME}"

    echo "Deploying to Cloud Run..."
    gcloud run deploy "${IMAGE_NAME}" \
      --image "gcr.io/${PROJECT_ID}/${IMAGE_NAME}" \
      --region "${REGION}" \
      --platform managed \
      --allow-unauthenticated \
      --memory 1Gi \
      --cpu 2 \
      --timeout 300 \
      --min-instances 0 \
      --max-instances 3 \
      --set-env-vars "PROPHET_API_KEY=${PROPHET_API_KEY:-$(openssl rand -hex 16)}"

    URL=$(gcloud run services describe "${IMAGE_NAME}" --region "${REGION}" --format 'value(status.url)')
    echo ""
    echo "✅ Deployed! URL: ${URL}"
    echo "   Health: ${URL}/health"
    ;;

  docker)
    echo "🐳 Building and running Docker locally..."
    cd "$(dirname "$0")"
    docker build -t "${IMAGE_NAME}" .

    API_KEY="${PROPHET_API_KEY:-$(openssl rand -hex 16)}"
    echo ""
    echo "Starting container..."
    docker run -d \
      --name "${IMAGE_NAME}" \
      -p 8080:8080 \
      -e PROPHET_API_KEY="${API_KEY}" \
      "${IMAGE_NAME}"

    echo ""
    echo "✅ Running! URL: http://localhost:8080"
    echo "   Health: http://localhost:8080/health"
    echo "   API Key: ${API_KEY}"
    echo ""
    echo "   Stop:  docker stop ${IMAGE_NAME}"
    echo "   Logs:  docker logs -f ${IMAGE_NAME}"
    ;;

  *)
    echo "Josephine Prophet Service - Deploy"
    echo ""
    echo "Usage: ./deploy.sh <platform>"
    echo ""
    echo "Platforms:"
    echo "  fly        Deploy to Fly.io (~\$3-5/mo)"
    echo "  render     Deploy to Render (~\$7/mo or free)"
    echo "  cloudrun   Deploy to Google Cloud Run (~\$0-5/mo)"
    echo "  docker     Build and run Docker locally"
    ;;
esac
