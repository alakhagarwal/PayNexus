# ---------------------------------------------------------------------------
# PayNexus: 1-Click Startup Script for Local Development & Interview Demos
# ---------------------------------------------------------------------------
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       🚀 Starting PayNexus Microservices & Frontend      " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Start Docker Containers (Postgres + Redis)
Write-Host "`n[1/5] Checking Docker Infrastructure (Postgres & Redis)..." -ForegroundColor White
docker-compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: Docker compose returned non-zero exit code. Make sure Docker is running." -ForegroundColor Yellow
}

# Helper to launch a Spring Boot service in a new window
function Start-ServiceWindow($name, $module, $port) {
    Write-Host "Starting $name on port $port..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Starting $name ($module)...' -ForegroundColor Cyan; .\mvnw.cmd spring-boot:run -pl $module"
}

# 2. Start Eureka Discovery Server (Port: 8761)
Write-Host "`n[2/5] Launching Discovery Server (:8761)..." -ForegroundColor White
Start-ServiceWindow "Discovery Server" "discovery-server" 8761
Write-Host "Waiting 12 seconds for Eureka to initialize..." -ForegroundColor DarkGray
Start-Sleep -Seconds 12

# 3. Start API Gateway (Port: 8080)
Write-Host "`n[3/5] Launching API Gateway (:8080)..." -ForegroundColor White
Start-ServiceWindow "API Gateway" "api-gateway" 8080
Start-Sleep -Seconds 5

# 4. Start Core Business Microservices (Wallet & Order Engine)
Write-Host "`n[4/5] Launching Wallet Service (:8082) & Order Engine Service (:8083)..." -ForegroundColor White
Start-ServiceWindow "Wallet Service" "wallet-service" 8082
Start-ServiceWindow "Order Engine Service" "order-engine-service" 8083

# 5. Start Vite Frontend (Port: 5173)
Write-Host "`n[5/5] Launching Stoxy Frontend (:5173)..." -ForegroundColor White
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; Write-Host 'Starting Vite Frontend on http://localhost:5173...' -ForegroundColor Cyan; npm run dev"

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "  ✅ All PayNexus services launched!                      " -ForegroundColor Green
Write-Host "  - Frontend UI:      http://localhost:5173               " -ForegroundColor Yellow
Write-Host "  - API Gateway:      http://localhost:8080               " -ForegroundColor White
Write-Host "  - Eureka Registry:  http://localhost:8761               " -ForegroundColor White
Write-Host "  - Wallet Service:   http://localhost:8082               " -ForegroundColor White
Write-Host "  - Order Engine:     http://localhost:8083               " -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
