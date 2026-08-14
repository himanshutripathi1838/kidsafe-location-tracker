const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  'kids_location_tracker',
  'postgres',
  'postgres',
  {
    host: '127.0.0.1',
    port: 5432,
    dialect: 'postgres',
    logging: false
  }
);

async function checkDb() {
  try {
    await sequelize.authenticate();
    console.log('Connected to Database.');
    
    // Check if geofence_zones table exists
    const [zones] = await sequelize.query('SELECT * FROM geofence_zones;');
    console.log('--- GEOFENCE ZONES ---');
    console.log(JSON.stringify(zones, null, 2));

    const [contacts] = await sequelize.query('SELECT * FROM emergency_contacts;');
    console.log('--- EMERGENCY CONTACTS ---');
    console.log(JSON.stringify(contacts, null, 2));

  } catch (err) {
    console.error('DB query error:', err.message);
  } finally {
    await sequelize.close();
  }
}

checkDb();
