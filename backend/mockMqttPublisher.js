/**
 * Mock MQTT Telemetry Publisher for KidSafe Tracker GPS validation.
 * Run using: node mockMqttPublisher.js
 */
const mqtt = require('mqtt');

const brokerUrl = 'mqtt://103.73.191.240:1883';
const imei = '864369034877211'; // Test IMEI topic

console.log(`Connecting mock publisher to MQTT Broker: ${brokerUrl}`);
const client = mqtt.connect(brokerUrl, {
  username: 'roshan',
  password: 'roshan1'
});

client.on('connect', () => {
  console.log('Mock Publisher connected successfully!');
  
  let battery = 100;
  
  setInterval(() => {
    const lat = (23.216732 + (Math.random() - 0.5) * 0.002).toFixed(6);
    const lng = (77.396492 + (Math.random() - 0.5) * 0.002).toFixed(6);
    const speed = (Math.random() * 5).toFixed(2);
    battery = Math.max(20, battery - 1);
    
    const now = new Date();
    const dateStr = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
    const timeStr = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
    
    // Format: YYYY/MM/DD,HH:MM:SS,Satellites,Latitude,Longitude,Speed,Course,Reserved,Battery,Signal,CountryCode,OperatorCode,LAC,CellID,ConfigMode
    const csvPayload = `${dateStr},${timeStr},8,${lat},${lng},${speed},45.00,0,${battery},15,404,93,1772,6043,2`;
    
    console.log(`Publishing mock telemetry to [${imei}]: ${csvPayload}`);
    client.publish(imei, csvPayload, { qos: 0 });
  }, 10000); // Publish every 10 seconds (standard GPS tracker interval)
});

client.on('error', (err) => {
  console.error('Publisher error:', err);
});
