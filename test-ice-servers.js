// Test script to verify ICE server endpoint
const fetch = require('node-fetch');

async function testIceServers() {
  try {
    console.log('Testing ICE server endpoint...');
    
    const response = await fetch('http://localhost:3000/api/ice-servers', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers.raw());

    if (response.ok) {
      const data = await response.json();
      console.log('ICE servers received:', JSON.stringify(data, null, 2));
    } else {
      console.error('Error response:', response.statusText);
      const errorText = await response.text();
      console.error('Error body:', errorText);
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testIceServers(); 