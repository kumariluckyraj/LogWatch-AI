## 🚀 AI-Powered System Reliability Platform

An intelligent, self-healing platform designed for real-time system reliability and safe deployments. This project leverages AI to monitor, analyze, and automatically respond to system failures — ensuring resilience, stability, and minimal downtime.

## 🌟 Overview

Modern distributed systems are complex and prone to failures. This platform combines:

Intelligent traffic routing
RAG-based log analysis
Autonomous AI agents

to proactively detect issues and take corrective actions such as instant rollback or recovery, enabling self-healing systems.

## ⚙️ Key Features
🔄 Real-Time Traffic Routing
Dynamically routes traffic between stable and test backends
Enables safe deployments (canary / blue-green strategies)

## 🧠 RAG-Based Log Analysis
Uses Retrieval-Augmented Generation (RAG) to:
Analyze logs in real time
Identify anomalies and failure patterns
Provide contextual insights

## 🤖 Autonomous AI Agents
AI agents continuously monitor system health
Detect failures without manual intervention
Trigger automated recovery workflows

## ⚡Instant Rollback & Recovery
Automatically rolls back to stable versions on failure detection
Minimizes downtime and user impact

## 📊 Observability & Monitoring
Track:
Request trends
Error rates
Backend health
Traffic distribution


## Setup.
```bash
# Install dependencies in each folder
cd proxy && npm install
cd ../backend-stable && npm install
cd ../backend-test && npm install
```

## Running with Docker (Recommended)

To run the entire system (all backends, proxy, and dashboard) with a single command:
```bash
docker-compose up --build
```
This will start all 4 services and map them to your host machine.

> [!WARNING]
> **Configuration Note for Docker:**
> Since Docker runs services in their own network, `127.0.0.1` inside the Proxy container will point to itself, not the backend containers. For local testing with Docker, you will need to change `proxy/config.json` to point to `http://backend-stable:5001` and `http://backend-test:5002` instead of `http://127.0.0.1:5001`.

---

## Running the System (Manual)

Start in 3 separate terminals:

**Terminal 1 - Proxy**
```bash
cd proxy
npm start
```
Runs on port 4000

**Terminal 2 - Stable Backend**
```bash
cd backend-stable
npm start
```
Runs on port 5001 (0% failure rate)

**Terminal 3 - Test Backend**
```bash
cd backend-test
npm start
```
Runs on port 5002 (40% failure rate)

## Testing

### Test 1: Check System Status
```bash
curl http://127.0.0.1:4000/api/stats
```

### Test 2: Make Requests (Stable Mode)
```bash
for i in {1..5}; do
  curl http://127.0.0.1:4000/api
  sleep 0.2
done
```

### Test 3: View Logs
```bash
curl http://127.0.0.1:4000/api/logs
```

### Test 4: Trigger Auto-Rollback
1. Edit `proxy/config.json`: change `"mode": "stable"` to `"mode": "test"`
2. Make 50 requests:
```bash
for i in {1..50}; do
  curl http://127.0.0.1:4000/api 2>/dev/null
  sleep 0.1
done
```
3. Watch Terminal 1 for auto-rollback message
4. Check config was auto-updated: `curl http://127.0.0.1:4000/api/config`

### Test 5: Check Rollback History
```bash
curl http://127.0.0.1:4000/api/rollback-history
```

## Configuration

Edit `proxy/config.json`:
```json
{
  "mode": "stable",           // stable, test, or canary
  "stable_url": "http://127.0.0.1:5001",
  "test_url": "http://127.0.0.1:5002",
  "canary_percent": 10        // % of traffic to test in canary mode
}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/stats | Current error rate and metrics |
| GET | /api/logs | Today's request logs |
| GET | /api/config | Current configuration |
| POST | /api/config | Change mode (send `{"mode":"stable"}`) |
| GET | /api/health | System health status |
| GET | /api/rollback-history | Past rollback events |
| POST | /api/rollback | Manual rollback trigger |
| POST | /api/reset-stats | Reset statistics |

## Modes

**Stable** - All traffic to production backend (port 5001)
**Test** - All traffic to test backend (port 5002, 40% failures)
**Canary** - 90% to stable, 10% to test (configurable percentage)

## Auto-Rollback

System automatically switches to stable mode when error rate exceeds 20%.

Threshold can be changed in `proxy/server.js`:

```javascript
const autoRollback = new AutoRollback(20);  // Change 20 to desired threshold
## Features
```
- Real-time error rate tracking (last 100 requests)
- Automatic failover when errors exceed threshold
- JSON-based request logging with daily rotation
- RESTful API for monitoring and control
- Professional logging with [INFO], [ERROR], [SUCCESS], [ALERT] tags

## Files

- `proxy/server.js` - Main proxy server
- `proxy/enhanced-logger.js` - Request logging system
- `proxy/error-tracker.js` - Error rate tracking
- `proxy/auto-rollback.js` - Automatic failover logic
- `proxy/config.json` - Configuration file
- `backend-stable/server.js` - Stable backend
- `backend-test/server.js` - Test backend

## 🤝 Contributing

We welcome contributions from developers of all skill levels! Whether you're fixing bugs, improving documentation, or adding features — your help is appreciated 🚀

## 🆕 Adding New Features / Modules
Fork the repository

Create a new branch:

git checkout -b feature/your-feature-name
Implement your feature
Ensure everything works as expected

Commit your changes:

git commit -m "Add: short description of feature"
Push to your fork and open a Pull Request


## 🐛 Bug Fixes & Improvements
Fork the repository
Create a branch:
git checkout -b fix/issue-name
Fix the issue
Test thoroughly
Submit a Pull Request with a clear description


## 🧠 AI / Log Analysis Contributions
You can also contribute by improving the AI capabilities of the platform:
Enhance RAG pipelines
Improve log parsing & anomaly detection
Optimize AI agent decision-making
Add new recovery or rollback strategies


## 📝 Documentation Contributions
-Good documentation is just as important as code!

-Improve README clarity

-Add architecture explanations

-Fix typos or formatting

-Provide setup or deployment guides


## 📋 Contribution Guidelines

-Follow the existing project structure

-Write clean, readable, and modular code

-Add comments where necessary

-Keep commits meaningful and concise

-Update documentation when required


## 🧪 Testing Guidelines
Before submitting your PR, make sure:

-✅ The project runs without errors

-✅ Logs and monitoring features work correctly

-✅ AI-based detection behaves as expected

-✅ Rollback/recovery triggers properly

-✅ No breaking changes are introduced


## 🌐 Browser & Environment Compatibility

This project includes dashboards and UI components that should work across modern environments.

✅ Recommended Browsers

-Google Chrome

-Mozilla Firefox

-Microsoft Edge

-Safari


## 📱 Responsive Testing

Ensure your changes work across:

-Desktop 💻

-Tablet 📱

-Mobile 📲

Helpful tools:

-Chrome DevTools Device Toolbar

-Firefox Responsive Mode


## 🛠 Common Issues
Some problems may arise due to:

-Cached assets

-Browser-specific rendering

-Unsupported APIs

-Extension conflicts


## 🔍 Troubleshooting Checklist
If something doesn’t work:

-Hard refresh (Ctrl + Shift + R)

-Clear cache

-Use Incognito mode

-Disable extensions

-Check console for errors


## 📌 Before Submitting a PR
Make sure:

-✅ Code is tested

-✅ UI is responsive

-✅ Features work as intended

-✅ No console errors

-✅ Documentation is updated


## 🆘 Need Help?
If you have questions, ideas, or run into issues, feel free to reach out:

-💬 Discussions: Use GitHub Discussions to ask questions or share ideas

-🐛 Bug Reports: Open an Issue to report bugs or request features

-📧 Direct Contact: For any queries, simply create an issue — we’ll respond as soon as possible

## 🌟 Stay Connected

-💼 LinkedIn: Kumari Lucky Raj

-🐙 GitHub: kumariluckyraj

## ⭐ Show Your Support
If this project helped you, please consider:

-⭐ Starring this repository

-🍴 Forking it to contribute

-📢 Sharing it with others

-💖 Following for more amazing projects
