const express = require('express');
const { handleCreateEvent } = require('../controllers/eventController');

const router = express.Router();

router.post('/events', handleCreateEvent);

module.exports = router;
