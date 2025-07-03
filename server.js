//aby server nezaspal na free deploymente, je potrebné pridať http server a pravideľne ho pingovať pomocou uptime robotu
const http = require('http');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Server je nažive!');
});

const wss = new WebSocket.Server({ server });
let connectedUsers = new Set();

wss.on('connection', (ws) => {
  if (connectedUsers.size >= 2) {
    ws.send(JSON.stringify({ type: 'error', message: 'Pripojenie zamietnuté – maximálny počet používateľov.' }));
    ws.close(4000, 'Maximálny počet používateľov bol dosiahnutý. Roomka je plná.');
    return;
  }  

  ws.isCaller = connectedUsers.size === 0; 
  connectedUsers.add(ws);
  console.log(`🟢 Používateľ ${ws.isCaller ? "volajúci" : "odpovedajúci"}) sa pripojil`) ;
  if(!ws.isCaller) {
    connectedUsers.forEach(client => {
      if(client.isCaller){
        client.send(JSON.stringify({ type: "start-signaling"}));
      }   
    });
  }

  ws.on('message', (msg) => {
    const data = JSON.parse(msg);
    console.log(`💬 Správa od ${ws.isCaller ? "volajúceho" : "odpovedajúceho"}:`, data);
    switch (data.type) {
      case 'offer':
        connectedUsers.forEach(client => {
            if(!client.isCaller) {
              client.send(JSON.stringify({ type: 'offer', sdp: data.sdp }));
            }
        });
        break;
      case 'ice-candidate':
        connectedUsers.forEach(client => {
            if(client.isCaller !== ws.isCaller) {
              client.send(JSON.stringify({ type: 'ice-candidate', candidate: data.candidate }));
            }
        });
        break;
    case 'answer':
        connectedUsers.forEach(client => {
            if(client.isCaller) {
              client.send(JSON.stringify({ type: 'answer', sdp: data.sdp }));
            }
        });
        break;
      default:
        console.log('Neznámy typ správy:', data.type);
    }
  });

  ws.on('close', () => {
    connectedUsers.delete(ws);
    if(connectedUsers.size === 1 && ws.isCaller) {
        const responder = [...connectedUsers][0];
        responder.isCaller = true; 
    }
    console.log(`🔴 Používateľ ${ws.isCaller ? "volajúci" : "odpovedajúci"} sa odpojil`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server beží na porte ${PORT}`);
});
