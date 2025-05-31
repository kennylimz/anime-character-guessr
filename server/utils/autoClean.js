require('dotenv').config()
const axios = require('axios');
const PING_INTERVAL = 6 * 60 * 1000; // 6 minutes in milliseconds

const autoClean = () => {
  axios.get(`${process.env.SERVER_URL}/clean-rooms`)
    .then(response => console.log('Self-ping successful:', response.status, response.data.message))
    .catch(error => console.error('Self-ping failed:', error.message));
};

const startAutoClean = () => {
  // Start the self-ping interval
  setInterval(autoClean, PING_INTERVAL);
  console.log('Auto clean mechanism started');
};

module.exports = {
  startAutoClean,
  autoClean
}; 