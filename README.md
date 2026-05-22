# 🔍 LogWatch-AI

[![GSSoC 2026](https://img.shields.io/badge/GSSoC-2026-pink.svg)](https://gssoc.co/)
[![Node.js](https://img.shields.io/badge/Node.js-v16%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

**LogWatch-AI** is an advanced, automated traffic proxy, log monitoring, and canary deployment system. Built with a real-time error tracking engine and an automatic rollback mechanism, it protects production services from experimental release failures. The project features a premium React-based monitoring dashboard providing visual metrics, real-time log streaming, and automated self-healing visualization.

---

## 🏗️ System Architecture & Workflow

The system is split into three main parts:
1. **LogWatch Proxy (Port 4000)**: Serves as the entrypoint. It receives all client requests, routes them based on the configuration, and performs error-rate checks.
2. **Backends (Port 5001 & 5002)**:
   - **Stable Backend**: Production-grade system with 0% simulated failure rate.
   - **Test Backend**: Canary/Staging system with 40% simulated failure rate.
3. **React Dashboard (Port 3000)**: A modern, real-time developer panel that displays metrics, streams logs, and visualizes automated rollback events.

```mermaid
graph TD
    User[Client / Browser] -->|HTTP Requests| Proxy[LogWatch-AI Proxy: Port 4000]
    Proxy -->|Traffic Split| Router{Routing Mode}
    
    Router -->|Stable Mode: 100%| Stable[Stable Backend: Port 5001]
    Router -->|Test Mode: 100%| Test[Test Backend: Port 5002 - 40% Fails]
    Router -->|Canary Mode: Split %| Stable
    Router -->|Canary Mode: Split %| Test

    Test -->|Error/Success Status| Tracker[Error Rate Tracker]
    Stable -->|Error/Success Status| Tracker

    Tracker -->|Tracks Last 100 Requests| Rollback[Auto-Rollback Logic]
    Rollback -->|Error Rate > 20%| Revert[Auto Revert config.json to Stable]
    Revert -.->|Updates Configuration| Proxy

    User -->|Access Monitor| Dashboard[React Dashboard: Port 3000]
    Dashboard -->|API Poll / Stats Query| Proxy
```

---

## 🌟 Key Features

- **Traffic Routing Modes**: Toggle instantly between `Stable`, `Test`, and `Canary` routing modes.
- **Automated Rollback Engine**: Continuous sliding-window monitoring (last 100 requests). It automatically downgrades traffic to the stable production servers if the error rate crosses `20%`.
- **Canary Deployments**: Configure a custom canary split percentage to safely roll out experimental backend code.
- **Structured Request Logging**: Rotating log streams output with descriptive tags: `[INFO]`, `[SUCCESS]`, `[ERROR]`, and `[ALERT]`.
- **Interactive UI Dashboard**:
  - **Live Analytics**: Visual graphs representing success-to-error ratios.
  - **Log Analysis**: Search, filter, and inspect detailed request records.
  - **Workflow View**: Visual representation of current routing health.
  - **AI Analyzer Integration**: An LLM-ready component for debugging and explaining log anomalies.

---

## 📁 Repository Structure

```text
LogWatch-AI/
├── proxy/               # Traffic routing, error tracking & auto-rollback engine
│   ├── server.js        # Main proxy server
│   ├── auto-rollback.js # Automated rollback controller
│   ├── error-tracker.js # Sliding-window error percentage calculator
│   ├── enhanced-logger.js # Structured output writing
│   └── config.json      # Routing rules (Stable, Test, Canary %)
├── backend-stable/      # Stable production API backend (Port 5001)
├── backend-test/        # Experimental backend with simulated failures (Port 5002)
├── dashboard/           # React dashboard UI (Port 3000)
│   ├── src/             # React views (Home, Analytics, AI Analyzer)
│   └── public/          # Static template pages
└── README.md            # Project documentation (This file)
```

---

## 🚀 Setup & Installation

### Prerequites
- **Node.js** (v16.0.0 or higher recommended)
- **NPM** (v8.0.0 or higher)

### Install Dependencies
Navigate into each system folder to install dependencies:
```bash
# Clone the repository
git clone https://github.com/your-username/LogWatch-AI.git
cd LogWatch-AI

# Install dependencies for all components
cd proxy && npm install
cd ../backend-stable && npm install
cd ../backend-test && npm install
cd ../dashboard && npm install
```

---

## 💻 Running the System

Start the services by running the start script in four separate terminals:

**Terminal 1 - Traffic Proxy Server**
```bash
cd proxy
npm start
```
*Proxy runs on [http://127.0.0.1:4000](http://127.0.0.1:4000)*

**Terminal 2 - Stable Backend**
```bash
cd backend-stable
npm start
```
*Runs on port 5001 (0% simulated failure rate)*

**Terminal 3 - Test Backend**
```bash
cd backend-test
npm start
```
*Runs on port 5002 (40% simulated failure rate)*

**Terminal 4 - React Monitoring Dashboard**
```bash
cd dashboard
npm start
```
*Runs on [http://localhost:3000](http://localhost:3000)*

---

## ⚙️ Routing Modes & Configuration

You can configure the routing mode by editing the `proxy/config.json` file or via the API:

```json
{
  "mode": "stable",
  "stable_url": "http://127.0.0.1:5001",
  "test_url": "http://127.0.0.1:5002",
  "canary_percent": 10
}
```

### Modes Breakdown:
- **`stable`**: All traffic is routed directly to the Stable Backend (port 5001).
- **`test`**: All traffic is routed directly to the Test Backend (port 5002).
- **`canary`**: Split traffic: configured percentage (e.g. 10%) goes to the Test Backend, and the remaining traffic (e.g. 90%) goes to the Stable Backend.

---

## ⚡ Automated Rollback Action

If the error rate from incoming traffic exceeds **20%** over the last 100 requests:
1. The proxy prints a `[ALERT]` warning in its terminal log.
2. The proxy switches the active configuration mode from `test` or `canary` to `stable`.
3. The `proxy/config.json` file is rewritten automatically.
4. All future client traffic is immediately directed to the Stable Backend on port 5001 to resolve errors.

> [!NOTE]
> The threshold limit can be tweaked in `proxy/server.js`:
> ```javascript
> const autoRollback = new AutoRollback(20);  // Change 20 to your preferred threshold percentage
> ```

---

## 🛠️ Testing Scenarios

Use the following terminal workflows to test self-healing behaviors:

### Test 1: Check Proxy System Status
```bash
curl http://127.0.0.1:4000/api/stats
```

### Test 2: Generate Traffic (Stable Mode)
```bash
for i in {1..5}; do
  curl http://127.0.0.1:4000/api
  sleep 0.2
done
```

### Test 3: Fetch Streaming Logs
```bash
curl http://127.0.0.1:4000/api/logs
```

### Test 4: Trigger Auto-Rollback
1. Open `proxy/config.json` and change `"mode": "stable"` to `"mode": "test"`.
2. Generate 50 consecutive traffic requests to force failing requests:
   ```bash
   for i in {1..50}; do
     curl http://127.0.0.1:4000/api 2>/dev/null
     sleep 0.1
   done
   ```
3. Watch the proxy console log for the `[ALERT]` roll back messages.
4. Verify that the configuration was rewritten automatically:
   ```bash
   curl http://127.0.0.1:4000/api/config
   ```

### Test 5: Check Rollback Event History
```bash
curl http://127.0.0.1:4000/api/rollback-history
```

---

## 📡 REST API Reference

| Method | Endpoint | Description | Payloads / Query |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/stats` | Retrieve overall statistics and current error rate | N/A |
| **GET** | `/api/logs` | Fetch all requests log history | N/A |
| **GET** | `/api/config` | Read current proxy settings (`mode`, URL targets) | N/A |
| **POST** | `/api/config` | Modify routing mode configurations | `{"mode": "stable"}` |
| **GET** | `/api/health` | Check overall system health | N/A |
| **GET** | `/api/rollback-history` | List all historical self-healing events | N/A |
| **POST** | `/api/rollback` | Execute a manual rollback revert command | N/A |
| **POST** | `/api/reset-stats` | Reset accumulated success and failure counts | N/A |

---

## 🤝 Contribution Guidelines

We welcome contributions from the community! Feel free to:
- Open issues for bug reports or feature ideas.
- Directly fork the repository, make improvements (such as UI dashboard refinements, AI integrations, or additional proxy tests), and raise a Pull Request.
- Make sure to format your code nicely and test your changes locally.
