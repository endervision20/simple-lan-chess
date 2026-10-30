import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Chess, type PieceSymbol, type Square } from "chess.js";
import { ChessBoard } from "./components/ChessBoard";
import "./index.css";

type Role = "w" | "b" | "spectator";

type GameState = {
  pgn: string;
  isGameOver: boolean;
  result: string | null;
  resetAvailableAt: number | null;
  serverTime: number;
  drawVotes: ("w" | "b")[];
  resetVotes: ("w" | "b")[];
  players: {
    whiteConnected: boolean;
    blackConnected: boolean;
  };
};

export default function App() {
  const [game, setGame] = useState(() => new Chess());
  const [role, setRole] = useState<Role>("spectator");
  const [connected, setConnected] = useState(false);
  const [annotations, setAnnotations] = useState<Record<number, string>>({});
  const [selectedMove, setSelectedMove] = useState<number | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [serverState, setServerState] = useState<GameState | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    // Use the same computer name/IP that served the website.
    const connection = io(`http://${window.location.hostname}:3001`);

    setSocket(connection);

    connection.on("connect", () => setConnected(true));
    connection.on("disconnect", () => setConnected(false));

    connection.on("player:role", (newRole: Role) => {
      setRole(newRole);
    });

    connection.on("game:state", (state: GameState) => {
      setServerState(state);

      const nextGame = new Chess();

      if (state.pgn) {
        nextGame.loadPgn(state.pgn);
      }

      setGame(nextGame);
    });

    return () => {
      connection.disconnect();
    };
  }, []);

  const moves = game.history({ verbose: true });

  function makeMove(
    from: Square,
    to: Square,
    promotion?: PieceSymbol
  ) {
    if (!socket || !connected) return;
    if (role === "spectator") return;

    socket.emit("move", { from, to, promotion });
  }

  const resetSecondsRemaining =
    serverState?.resetAvailableAt == null
      ? null
      : Math.max(
          0,
          Math.ceil((serverState.resetAvailableAt - now) / 1000)
        );

  const canPlay =
    connected &&
    role !== "spectator" &&
    serverState !== null;

  const hasDrawVote = serverState?.drawVotes.includes(role) ?? false;
  const hasResetVote = serverState?.resetVotes.includes(role) ?? false;
  const gameFinished = serverState?.isGameOver ?? false;

  const roleName =
    role === "w"
      ? "White"
      : role === "b"
        ? "Black"
        : "Spectator";

  let status = game.turn() === "w" ? "White to move" : "Black to move";

  if (game.isCheckmate()) {
    status = `Checkmate! ${game.turn() === "w" ? "Black" : "White"} wins.`;
  } else if (game.isStalemate()) {
    status = "Draw by stalemate.";
  } else if (game.isThreefoldRepetition()) {
    status = "Draw by threefold repetition.";
  } else if (game.isInsufficientMaterial()) {
    status = "Draw by insufficient material.";
  } else if (game.isDraw()) {
    status = "Draw.";
  } else if (game.isCheck()) {
    status += " — Check!";
  }

  return (
    <main className="app">
      <h1>LAN Chess</h1>

      <p>
        Connection: {connected ? "Connected" : "Disconnected"}
        {" · "}
        Role: {roleName}
      </p>

      <p className="game-status">{status}</p>
      <section className="game-controls">
        <div className="player-status">
          <span>
            White: {serverState?.players.whiteConnected ? "Connected" : "Disconnected"}
          </span>
          <span>
            Black: {serverState?.players.blackConnected ? "Connected" : "Disconnected"}
          </span>
        </div>

        {serverState?.result && (
          <p className="game-result">{serverState.result}</p>
        )}

        <div className="control-buttons">
          {!gameFinished && (
            <>
              {!confirmResign ? (
                <button
                  type="button"
                  disabled={!canPlay}
                  onClick={() => setConfirmResign(true)}
                >
                  Resign
                </button>
              ) : (
                <>
                  <span>Are you sure you want to resign?</span>
                  <button
                    type="button"
                    disabled={!canPlay}
                    onClick={() => {
                      socket?.emit("resign");
                      setConfirmResign(false);
                    }}
                  >
                    Confirm resignation
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResign(false)}
                  >
                    Cancel
                  </button>
                </>
              )}

              <button
                type="button"
                disabled={!canPlay}
                onClick={() => socket?.emit("draw:vote")}
              >
                {hasDrawVote ? "Withdraw draw offer" : "Offer draw"}
                {" "}
                ({serverState?.drawVotes.length ?? 0}/2)
              </button>
            </>
          )}

          <button
            type="button"
            disabled={!canPlay}
            onClick={() => socket?.emit("reset:vote")}
          >
            {gameFinished
              ? resetSecondsRemaining === 0
                ? "Reset game"
                : `Vote to reset (${serverState?.resetVotes.length ?? 0}/2)`
              : hasResetVote
                ? "Withdraw reset vote"
                : `Vote to reset (${serverState?.resetVotes.length ?? 0}/2)`}
          </button>
        </div>

        {gameFinished &&
          resetSecondsRemaining !== null &&
          resetSecondsRemaining > 0 && (
            <p className="muted">
              Reset requires both players' votes for another{" "}
              {resetSecondsRemaining} seconds.
            </p>
          )}
      </section>
      <div className="game-layout">
        <section className="board-section">
          <ChessBoard game={game} role={role} onMove={makeMove} />
        </section>

        <aside className="history-panel">
          <h2>Move history</h2>

          {moves.length === 0 ? (
            <p className="muted">No moves yet.</p>
          ) : (
            <div className="move-list">
              {Array.from(
                { length: Math.ceil(moves.length / 2) },
                (_, rowIndex) => {
                  const whiteIndex = rowIndex * 2;
                  const blackIndex = whiteIndex + 1;
                  const whiteMove = moves[whiteIndex];
                  const blackMove = moves[blackIndex];

                  return (
                    <div className="move-row" key={rowIndex}>
                      <span className="move-number">
                        {rowIndex + 1}.
                      </span>

                      <button
                        type="button"
                        className={
                          selectedMove === whiteIndex
                            ? "move-button active"
                            : "move-button"
                        }
                        onClick={() => setSelectedMove(whiteIndex)}
                      >
                        {whiteMove.san}
                      </button>

                      {blackMove ? (
                        <button
                          type="button"
                          className={
                            selectedMove === blackIndex
                              ? "move-button active"
                              : "move-button"
                          }
                          onClick={() => setSelectedMove(blackIndex)}
                        >
                          {blackMove.san}
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )}

          <h3>Move annotation</h3>

          {selectedMove === null ? (
            <p className="muted">Select a move to add a comment.</p>
          ) : (
            <>
              <p>
                Move {Math.floor(selectedMove / 2) + 1},{" "}
                {selectedMove % 2 === 0 ? "White" : "Black"}
              </p>

              <textarea
                className="annotation-input"
                value={annotations[selectedMove] ?? ""}
                onChange={(event) =>
                  setAnnotations((previous) => ({
                    ...previous,
                    [selectedMove]: event.target.value,
                  }))
                }
                placeholder="Comment on this move..."
                rows={4}
              />
            </>
          )}
        </aside>
      </div>
    </main>
  );
}