const { io } = require('socket.io-client');

async function run() {
  console.log("Connecting A...");
  const socketA = io('http://localhost:3000');
  
  socketA.on('connect', () => {
    console.log("A connected! Joining room test-room...");
    socketA.emit('wb:join', 'test-room');
  });

  socketA.on('wb:state', (state) => {
    console.log("A received wb:state:", state);
    
    // Simulate connection of B after A joins
    setTimeout(() => {
      console.log("Connecting B...");
      const socketB = io('http://localhost:3000');
      
      socketB.on('connect', () => {
        console.log("B connected! Joining room test-room...");
        socketB.emit('wb:join', 'test-room');
      });

      socketB.on('wb:state', (state) => {
        console.log("B received wb:state:", state);
        
        // A sends an update
        console.log("A sending wb:update...");
        socketA.emit('wb:update', {
          roomId: 'test-room',
          elements: [{ id: 'line1', type: 'line', version: 5 }]
        });
      });

      socketB.on('wb:update', (elements) => {
        console.log("B received wb:update:", elements);
        
        // B sends an update back
        console.log("B sending wb:update...");
        socketB.emit('wb:update', {
          roomId: 'test-room',
          elements: [{ id: 'line1', type: 'line', version: 5 }, { id: 'line2', type: 'line', version: 2 }]
        });
      });
      
    }, 500);
  });

  socketA.on('wb:update', (elements) => {
    console.log("A received wb:update:", elements);
    console.log("Test complete. Exiting.");
    process.exit(0);
  });
}

run();
