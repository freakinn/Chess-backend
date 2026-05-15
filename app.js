const express=require('express');
const socket=require('socket.io');
const http=require('http');
const {Chess} = require('chess.js');
const cors=require('cors');

const app=express();

const allowedOrigins = [
    process.env.FRONTEND_URL || "https://chess-frontend-woad.vercel.app",
    "http://localhost:5173"
];

app.use(cors({
    origin: allowedOrigins
}));

const server = http.createServer(app);

const io = socket(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"]
    }
});

const chess = new Chess();
let players={};

function clearStalePlayers() {
    if(players.white && !io.sockets.sockets.has(players.white)){
        delete players.white;
    }

    if(players.black && !io.sockets.sockets.has(players.black)){
        delete players.black;
    }
}

io.on("connection",function(uniquesocket){
    console.log('connected');

    clearStalePlayers();

    if(!players.white){
        players.white = uniquesocket.id;
        uniquesocket.emit('playerRole','w')
    }
    else if(!players.black){
        players.black = uniquesocket.id;
        uniquesocket.emit('playerRole','b')
    }
    else{
        uniquesocket.emit('spectatorRole')
    }

    console.log('players:', players);

    uniquesocket.emit('boardState', chess.fen());
    
    uniquesocket.on('disconnect',function(){
        if(uniquesocket.id===players.white){
            delete players.white;
        }
        else if(uniquesocket.id===players.black){
            delete players.black;
        }

        if(!players.white && !players.black){
            chess.reset();
        }
    })

    uniquesocket.on('move',function(move, callback){
        try {
            if(chess.turn()=='w' && uniquesocket.id !== players.white) {
                if(typeof callback === 'function') {
                    callback({ ok: false, fen: chess.fen(), error: 'Not white turn/player' });
                }
                uniquesocket.emit('boardState', chess.fen());
                return;
            }
            if(chess.turn()=='b' && uniquesocket.id !== players.black) {
                if(typeof callback === 'function') {
                    callback({ ok: false, fen: chess.fen(), error: 'Not black turn/player' });
                }
                uniquesocket.emit('boardState', chess.fen());
                return;
            }

            const result = chess.move(move);
            if(result){
                if(typeof callback === 'function') {
                    callback({ ok: true, fen: chess.fen() });
                }
                io.emit('boardState', chess.fen())
            }
            else{
                console.log("invalid move :",move);
                if(typeof callback === 'function') {
                    callback({ ok: false, fen: chess.fen(), error: 'Illegal move' });
                }
                uniquesocket.emit("invalidmove", move);
                uniquesocket.emit('boardState', chess.fen());
            }
        } 
        catch (err) {
            console.log(err);
            if(typeof callback === 'function') {
                callback({ ok: false, fen: chess.fen(), error: err.message });
            }
            uniquesocket.emit('invalidmove',move);
            uniquesocket.emit('boardState', chess.fen());
        }
    })
})

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("server running");
});
