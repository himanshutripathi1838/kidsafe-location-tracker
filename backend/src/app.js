require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const cron = require('node-cron');

// DB connection
const { sequelize, testConnection } = require('./config/db');

// Routes imports
const authRoutes = require('./routes/authRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const locationRoutes = require('./routes/locationRoutes');
const geofenceRoutes = require('./routes/geofenceRoutes');
const sosRoutes = require('./routes/sosRoutes');
const contactRoutes = require('./routes/contactRoutes');
const reportRoutes = require('./routes/reportRoutes');

// Controllers Socket configuration
const locationController = require('./controllers/locationController');
const sosController = require('./controllers/sosController');
const mqttService = require('./services/mqttService');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS rules
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Provide io instance to controllers
locationController.setIO(io);
sosController.setIO(io);
mqttService.setIO(io);

// 1. Basic Middlewares
app.use(helmet()); // Secure HTTP headers
app.use(cors()); // Allow mobile app cross-origin calls
app.use(express.json()); // JSON payload parser
app.use(morgan('combined')); // Winston/Morgan Request logger

// Request Rate Limiting (Prevent DDoS pings)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP. Please try again after 15 minutes.'
});
app.use('/api/', apiLimiter);

// 2. REST Routing Definitions
app.use('/api/auth', authRoutes);
app.use('/api/device', deviceRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/geofence', geofenceRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/reports', reportRoutes);

// Base health check
app.get('/', (req, res) => {
  res.status(200).json({ success: true, message: '🛡️ KidSafe Tracker backend is fully operational.' });
});

// 3. Socket.IO Event router
io.on('connection', (socket) => {
  console.log(`SocketClient connected: ${socket.id}`);

  // Send current MQTT server status to client on connection
  socket.emit('mqtt-server-status', { status: mqttService.isMQTTConnected() ? 'online' : 'offline' });

  // Child room registration: Parents join childId rooms
  socket.on('subscribe', (data) => {
    const { childId } = data;
    if (childId) {
      socket.join(`child_${childId}`);
      console.log(`SocketClient ${socket.id} joined child room: child_${childId}`);
    }
  });

  socket.on('unsubscribe', (data) => {
    const { childId } = data;
    if (childId) {
      socket.leave(`child_${childId}`);
      console.log(`SocketClient ${socket.id} left child room: child_${childId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`SocketClient disconnected: ${socket.id}`);
  });
});

// 4. Background Node Cron Scheduler
// 24/7 Cloud Keep-Alive Self Ping (Prevents Render Free Tier from sleeping)
const https = require('https');
cron.schedule('*/10 * * * *', () => {
  const cloudUrl = process.env.RENDER_EXTERNAL_URL || 'https://kidsafe-location-tracker.onrender.com';
  console.log(`Keep-Alive Cron: Pinging cloud server at ${cloudUrl}...`);
  const client = cloudUrl.startsWith('https') ? https : http;
  client.get(cloudUrl, (res) => {
    console.log(`Keep-Alive Cron: Ping response status [${res.statusCode}]`);
  }).on('error', (err) => {
    console.log('Keep-Alive Cron: Ping error:', err.message);
  });
});

// Scheduled daily report compiler: runs every day at 11:30 PM (23:30)
cron.schedule('30 23 * * *', async () => {
  console.log('Cron Job: Starting daily commute reports compilation...');
  try {
    const Child = require('./models/Child');
    const SummaryReport = require('./models/SummaryReport');
    const Location = require('./models/Location');
    
    const activeChildren = await Child.findAll({ where: { is_active: true } });
    const todayStr = new Date().toISOString().split('T')[0];

    for (const child of activeChildren) {
      // Simulate compiling reports dynamically (calls the compiler code in reportController)
      console.log(`Cron: Compiling metrics for child: ${child.name}`);
      
      const startTime = new Date(`${todayStr}T00:00:00.000Z`);
      const endTime = new Date(`${todayStr}T23:59:59.999Z`);
      
      const logs = await Location.findAll({
        where: {
          child_id: child.id,
          timestamp: { [require('sequelize').Op.between]: [startTime, endTime] }
        }
      });

      if (logs.length > 0) {
        // Build summary metrics
        let totalDistance = 0.0;
        let maxSpeed = 0.0;
        let speedSum = 0.0;
        
        logs.forEach((log, idx) => {
          if (log.speed > maxSpeed) maxSpeed = log.speed;
          speedSum += log.speed;
          if (idx > 0) {
            totalDistance += require('./services/geofenceService').calculateHaversineDistance(
              logs[idx - 1].latitude, logs[idx - 1].longitude, log.latitude, log.longitude
            );
          }
        });

        await SummaryReport.findOrCreate({
          where: { child_id: child.id, report_date: todayStr },
          defaults: {
            summary_type: 'daily',
            total_distance: parseFloat((totalDistance / 1000).toFixed(2)),
            avg_speed: parseFloat((speedSum / logs.length).toFixed(1)),
            max_speed: parseFloat(maxSpeed.toFixed(1)),
            active_time: `${Math.ceil((logs.length * 10) / 60)}m`,
            stops_count: 1,
            stops_data: [{ name: 'School Commute', duration: 'Home to School' }],
            generated_at: new Date()
          }
        });
      }
    }
    console.log('Cron Job: Daily travel summaries compiled successfully.');
  } catch (err) {
    console.error('Cron compiler error:', err);
  }
});

// 5. Sync Database & Bootstrap Server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Test connection
  await testConnection();
  
  // Create PostGIS Extension and Sync tables
  try {
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    console.log('PostGIS extension checked/created successfully.');
  } catch (e) {
    console.warn('Warning: PostGIS extension creation query failed. Make sure your PG user has superuser permissions or PostGIS is enabled on your host database:', e.message);
  }

  // Synchronize database tables schema (development auto-alter)
  sequelize.sync({ alter: true })
    .then(() => {
      console.log('PostgreSQL database schemas synchronized successfully.');
      
      // Initialize MQTT Service and start offline detection daemon loop
      mqttService.initializeMQTT();
      mqttService.startOfflineDetection();

      server.listen(PORT, () => {
        console.log(`🛡️ KidSafe backend server is successfully listening on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Sequelize database synchronization failed:', err);
      
      // Initialize MQTT Service in fallback mode
      mqttService.initializeMQTT();
      mqttService.startOfflineDetection();

      // fallback: start server anyway so mocking services work
      server.listen(PORT, () => {
        console.log(`🛡️ KidSafe backend started in fallback mode on port ${PORT}`);
      });
    });
};

startServer();
