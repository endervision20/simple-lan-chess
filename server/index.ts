import { createServer } from "node:http";
import { Chess, type PieceSymbol, type Square } from "chess.js";
import { Server } from "socket.io";

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: { origin: true },
});

let game = new Chess();

const players: { w: string | null; b: string | null } = {
  w: null,
  b: null,
};

let result: string | null = null;
let resetAvailableAt: number | null = null;

const drawVotes = new Set<"w" | "b">();
const resetVotes = new Set<"w" | "b">();

function getRole(socketId: string): "w" | "b" | "spectator" {
  if (players.w === socketId) return "w";
  if (players.b === socketId) return "b";
  return "spectator";
}

function getResult(): string | null {
  if (result) return result;

  if (game.isCheckmate()) {
    return `${game.turn() === "w" ? "Black" : "White"} wins by checkmate`;
  }

  if (game.isStalemate()) return "Draw by stalemate";
  if (game.isThreefoldRepetition()) return "Draw by threefold repetition";
  if (game.isInsufficientMaterial()) return "Draw by insufficient material";
  if (game.isDraw()) return "Draw";

  return null;
}

function finishGame(message: string) {
  result = message;
  resetAvailableAt = Date.now() + 15_000;
  drawVotes.clear();
  resetVotes.clear();
}

function resetGame() {
  game = new Chess();
  result = null;
  resetAvailableAt = null;
  drawVotes.clear();
  resetVotes.clear();
  broadcastState();
}

function broadcastState() {
  const gameResult = getResult();

  // Also start the timer for normal chess endings, such as checkmate.
  if (gameResult && resetAvailableAt === null) {
    resetAvailableAt = Date.now() + 15_000;
  }

  io.emit("game:state", {
    fen: game.fen(),
    pgn: game.pgn(),
    turn: game.turn(),
    isGameOver: Boolean(gameResult),
    result: gameResult,
    resetAvailableAt,
    serverTime: Date.now(),
    drawVotes: [...drawVotes],
    resetVotes: [...resetVotes],
    players: {
      whiteConnected: players.w !== null,
      blackConnected: players.b !== null,
    },
  });
}

io.on("connection", (socket) => {
  let role: "w" | "b" | "spectator";

  if (!players.w) {
    players.w = socket.id;
    role = "w";
  } else if (!players.b) {
    players.b = socket.id;
    role = "b";
  } else {
    role = "spectator";
  }

  socket.emit("player:role", role);
  broadcastState();

  socket.on(
    "move",
    (data: { from: Square; to: Square; promotion?: PieceSymbol }) => {
      const currentRole = getRole(socket.id);

      if (currentRole === "spectator") return;
      if (game.turn() !== currentRole) return;
      if (getResult()) return;

      try {
        game.move({
          from: data.from,
          to: data.to,
          ...(data.promotion ? { promotion: data.promotion } : {}),
        });

        broadcastState();
      } catch {
        // Ignore illegal moves.
      }
    }
  );

  socket.on("resign", () => {
    const currentRole = getRole(socket.id);
    if (currentRole === "spectator" || getResult()) return;

    finishGame(
      `${currentRole === "w" ? "Black" : "White"} wins by resignation`
    );
    broadcastState();
  });

  socket.on("draw:vote", () => {
    const currentRole = getRole(socket.id);
    if (currentRole === "spectator" || getResult()) return;

    if (drawVotes.has(currentRole)) {
      drawVotes.delete(currentRole);
    } else {
      drawVotes.add(currentRole);
    }

    if (drawVotes.has("w") && drawVotes.has("b")) {
      finishGame("Draw by agreement");
    }

    broadcastState();
  });

  socket.on("reset:vote", () => {
    const currentRole = getRole(socket.id);

    if (currentRole === "spectator") return;

    const gameFinished = Boolean(getResult());

    // After the 15-second delay, either player may reset immediately.
    if (
      gameFinished &&
      resetAvailableAt !== null &&
      Date.now() >= resetAvailableAt
    ) {
      resetGame();
      return;
    }

    // Otherwise, both players must vote, including during the
    // 15-second period after the game ends.
    if (resetVotes.has(currentRole)) {
      resetVotes.delete(currentRole);
    } else {
      resetVotes.add(currentRole);
    }

    if (resetVotes.has("w") && resetVotes.has("b")) {
      resetGame();
      return;
    }

    broadcastState();
  });

  socket.on("disconnect", () => {
    if (players.w === socket.id) players.w = null;
    if (players.b === socket.id) players.b = null;

    // Remove votes cast by the disconnected player.
    if (role === "w") {
      drawVotes.delete("w");
      resetVotes.delete("w");
    } else if (role === "b") {
      drawVotes.delete("b");
      resetVotes.delete("b");
    }

    broadcastState();
  });
});

httpServer.listen(3001, "0.0.0.0", () => {
  console.log("Chess server listening on port 3001");
});