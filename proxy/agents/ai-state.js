let latestAIState = null;

function setAIState(data) {
  latestAIState = {
    ...data,
    timestamp: Date.now(),
  };
}

function getAIState() {
  return latestAIState;
}

module.exports = { setAIState, getAIState };