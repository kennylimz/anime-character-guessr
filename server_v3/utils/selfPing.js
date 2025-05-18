const axios = require('axios');
require('dotenv').config()

const PING_INTERVAL = 6 * 60 * 1000; // 6 minutes in milliseconds

const pingServer = () => {
  axios.get(`${process.env.SERVER_URL}/clean-rooms`)
    .then(response => console.log('Self-ping successful:', response.status, response.data.message))
    .catch(error => console.error('Self-ping failed:', error.message));
};

const startSelfPing = () => {
  // Start the self-ping interval
  setInterval(pingServer, PING_INTERVAL);
  console.log('Self-ping mechanism started');
};

module.exports = {
  startSelfPing,
  pingServer
}; 