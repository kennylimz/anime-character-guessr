import React, { useState, useEffect } from "react";

const PlayerList = ({
  players,
  socket,
  isGameStarted,
  handleReadyToggle,
  onAnonymousModeChange,
  isManualMode,
  isHost,
  answerSetterId,
  onSetAnswerSetter,
  onKickPlayer,
  onTransferHost,
  onMessageChange,
  onTeamChange,
}) => {
  const [showNames, setShowNames] = useState(true);
  const [waitingForAnswer, setWaitingForAnswer] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const [editingMessagePlayerId, setEditingMessagePlayerId] = useState(null);
  const [messageDraft, setMessageDraft] = useState("");

  const teamOptions = [
    { value: "", label: "None" },
    { value: "0", label: "Spectator" },
    ...Array.from({ length: 8 }, (_, i) => ({
      value: (i + 1).toString(),
      label: (i + 1).toString(),
    })),
  ];

  // Add socket event listener for waitForAnswer
  useEffect(() => {
    if (socket) {
      socket.on("waitForAnswer", () => {
        setWaitingForAnswer(true);
      });

      // Reset waiting state when game starts
      socket.on("gameStart", () => {
        setWaitingForAnswer(false);
      });
    }
  }, [socket]);

  // Add click outside handler to close menu
  useEffect(() => {
    function handleClickOutside(event) {
      if (activeMenu && !event.target.closest(".player-actions")) {
        setActiveMenu(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeMenu]);

  const handleShowNamesToggle = () => {
    const newShowNames = !showNames;
    setShowNames(newShowNames);
    if (onAnonymousModeChange) {
      onAnonymousModeChange(newShowNames);
    }
  };

  const getStatusDisplay = (player) => {
    const host = (
      <span>
        <i className={`fas fa-crown`}></i>Host
      </span>
    );
    if (player.disconnected) {
      return renderStyledSpan("Disconnected", "red");
    }

    if (waitingForAnswer) {
      if (player.id === answerSetterId) {
        return renderStyledSpan("Setting Question", "orange");
      }
      if (player.isHost) {
        return host;
      }
      return renderStyledSpan("Ready", "green");
    }

    if (isManualMode && !isGameStarted) {
      if (player.id === answerSetterId) {
        return <button className="ready-button ready">Setting Question</button>;
      }
      return <button className="ready-button">Select</button>;
    }

    if (player.isHost) {
      return host;
    }

    if (player.id === socket?.id && !isGameStarted) {
      return (
        <button
          onClick={handleReadyToggle}
          className={`ready-button ${player.ready ? "ready" : ""}`}
        >
          {player.ready ? "Unready" : "Ready"}
        </button>
      );
    }

    return player.ready
      ? renderStyledSpan("Ready", "green")
      : renderStyledSpan("Not Ready");
  };

  const renderStyledSpan = (text, color = "inherit") => (
    <span style={{ color }}>{text}</span>
  );

  const handlePlayerClick = (player) => {
    if (isHost && isManualMode && !isGameStarted && !waitingForAnswer) {
      onSetAnswerSetter(player.id);
    }
  };

  const handleKickClick = (e, playerId) => {
    e.stopPropagation(); // Prevent event bubbling to avoid triggering row click
    if (onKickPlayer) {
      onKickPlayer(playerId);
    }
  };

  const handleTransferHostClick = (e, playerId) => {
    e.stopPropagation(); // Prevent event bubbling to avoid triggering row click
    if (onTransferHost) {
      onTransferHost(playerId);
    }
  };

  const handleTeamChange = (playerId, newTeam) => {
    if (onTeamChange) {
      onTeamChange(playerId, newTeam);
    }
  };

  return (
    <div className="players-list">
      <table className="score-table">
        <thead>
          <tr>
            <th></th>
            <th>Team</th>
            <th></th>
            <th>
              <button
                className="table-head-name-button"
                onClick={handleShowNamesToggle}
              >
                {showNames ? "Name" : "Anonymous"}
              </button>
            </th>
            <th>Score</th>
            <th>Guesses</th>
            {isHost && (
              <th>
                <span style={{ width: "100px", display: "block" }}>
                  Actions
                </span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr
              key={player.id}
              onClick={() => handlePlayerClick(player)}
              style={{
                cursor:
                  isHost && isManualMode && !isGameStarted && !waitingForAnswer
                    ? "pointer"
                    : "default",
              }}
            >
              <td>{getStatusDisplay(player)}</td>
              <td>
                {socket?.id === player.id && !player.ready && !isGameStarted ? (
                  <select
                    value={player.team || ""}
                    onChange={(e) =>
                      handleTeamChange(player.id, e.target.value)
                    }
                    style={{
                      minWidth: "40px",
                      background: "inherit",
                      color: "inherit",
                    }}
                  >
                    {teamOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span>
                    {player.team === "0"
                      ? "Spectator"
                      : player.team
                      ? player.team
                      : "None"}
                  </span>
                )}
              </td>
              <td>
                {player.avatarId &&
                  player.avatarId > 0 &&
                  player.avatarImage && (
                    <img src={player.avatarImage} className="player-avatar" />
                  )}
              </td>
              <td>
                {socket?.id === player.id &&
                editingMessagePlayerId === player.id ? (
                  <input
                    type="text"
                    value={messageDraft}
                    placeholder="Please chat friendly (💖)"
                    autoFocus
                    maxLength={15}
                    style={{ width: "90%" }}
                    onChange={(e) => setMessageDraft(e.target.value)}
                    onBlur={() => {
                      setEditingMessagePlayerId(null);
                      if (onMessageChange) onMessageChange(messageDraft);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setEditingMessagePlayerId(null);
                        if (onMessageChange) onMessageChange(messageDraft);
                      }
                    }}
                  />
                ) : (
                  <span
                    style={{
                      backgroundColor:
                        !showNames && player.id !== socket?.id
                          ? "#000"
                          : "transparent",
                      color:
                        !showNames && player.id !== socket?.id
                          ? "#000"
                          : "inherit",
                      padding:
                        !showNames && player.id !== socket?.id
                          ? "2px 4px"
                          : "0",
                      cursor: socket?.id === player.id ? "pointer" : "default",
                    }}
                    onClick={() => {
                      if (socket?.id === player.id) {
                        setEditingMessagePlayerId(player.id);
                        setMessageDraft(player.message || "");
                      }
                    }}
                  >
                    {player.username}
                    {player.message && <span>: "{player.message}"</span>}
                  </span>
                )}
              </td>
              <td>{player.score}</td>
              <td>
                {isGameStarted && player.isAnswerSetter
                  ? "Question Setter"
                  : player.guesses || ""}
              </td>
              {isHost && player.id !== socket?.id && (
                <td>
                  <div
                    className="player-actions"
                    style={{ position: "relative" }}
                  >
                    <button
                      className="action-menu-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Toggle the action menu for this player
                        setActiveMenu(
                          activeMenu === player.id ? null : player.id
                        );
                      }}
                    >
                      ⚙️ Actions
                    </button>

                    {activeMenu === player.id && (
                      <div className="action-dropdown">
                        <button
                          className="action-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleKickClick(e, player.id);
                            setActiveMenu(null);
                          }}
                        >
                          <span>❌</span> Kick
                        </button>

                        {!player.disconnected && (
                          <button
                            className="action-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTransferHostClick(e, player.id);
                              setActiveMenu(null);
                            }}
                            style={{ color: "#007bff", borderBottom: "0px" }}
                          >
                            <span>👑</span> Transfer Host
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PlayerList;
