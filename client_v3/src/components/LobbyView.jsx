import React from 'react';
import Leaderboard from './Leaderboard'; // Assuming Leaderboard is in the same components folder or path is adjusted

const LobbyView = ({
  navigate,
  roomName,
  handleCreateIdChange,
  isPublic,
  setIsPublic,
  handleCreateRoom,
  joinRoomIdInput,
  handleJoinIdChange,
  isValidRoomId, // Pass this down for client-side validation before showing notification
  showKickNotification, // Pass this down for notifications
  publicRooms,
  isLoadingRooms,
  handleQuickJoin, // Quick Join from room list
  fetchPublicRooms, // Refresh button
  notificationToDisplay, // Added prop
  dismissNotification, // Added prop
}) => {
  return (
    <div className="multiplayer-container">
      {/* Notification display logic for LobbyView */}
      {notificationToDisplay && (
        <div className={`kick-notification ${notificationToDisplay.type === 'host' ? 'host-notification' : ''} ${notificationToDisplay.type === 'info' ? 'info-notification' : ''} ${notificationToDisplay.type === 'error' ? 'error-notification' : ''}`}>
          <div className="kick-notification-content">
            <i className={`fas ${
              notificationToDisplay.type === 'host' ? 'fa-crown' :
              notificationToDisplay.type === 'info' ? 'fa-info-circle' :
              notificationToDisplay.type === 'error' ? 'fa-exclamation-triangle' :
              'fa-user-slash' // Default for 'kick' or other unhandled types
            }`}></i>
            <span>{notificationToDisplay.message}</span>
            <button 
              className="notification-close-btn" 
              onClick={dismissNotification}
              aria-label="关闭通知"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      <a
        href="/"
        className="social-link floating-back-button"
        title="Back"
        onClick={(e) => {
          e.preventDefault();
          navigate('/');
        }}
      >
        <i className="fas fa-angle-left"></i>
      </a>
      <h1 className="mb-8 text-center text-4xl font-bold text-gray-800">多人游戏</h1>
      <div className="lobby-container">
        <div className="lobby-section p-6 shadow-md">
          <div className="mb-6 grid gap-x-8 gap-y-4 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-lg font-medium text-gray-700">快速创建</h3>
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="自定义房间ID (4位, 可选)"
                  maxLength="4"
                  className="focus:border-primary-500 focus:ring-primary-500/20 w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:outline-hidden min-w-0"
                  value={roomName}
                  onChange={handleCreateIdChange}
                />
              </div>
              <div className="mb-3 flex items-center">
                <input
                  id="isPrivateRoom"
                  type="checkbox"
                  className="cursor-pointer rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={!isPublic}
                  onChange={() => setIsPublic(!isPublic)}
                />
                <label htmlFor="isPrivateRoom" className="ml-2 block cursor-pointer text-sm text-gray-700 select-none">
                  创建私密房间
                </label>
              </div>
              <button
                className="w-full cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                onClick={handleCreateRoom}
              >
                快速创建
              </button>
            </div>
            <div>
              <h3 className="mb-2 text-lg font-medium text-gray-700">加入房间</h3>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="房间ID (4位)"
                  maxLength="4"
                  className="focus:border-primary-500 focus:ring-primary-500/20 inline-block rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:outline-hidden min-w-0"
                  value={joinRoomIdInput}
                  onChange={handleJoinIdChange}
                />
                <button
                  className="w-full cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                  onClick={() => {
                    const processedJoinId = joinRoomIdInput.trim();
                    if (!processedJoinId) {
                        showKickNotification('请输入房间ID。', 'error');
                        return; // Stop further execution
                    } 
                    if (!isValidRoomId(processedJoinId)) { // Check validity only if not empty
                        showKickNotification('请输入有效的4位字母或数字房间ID。', 'error');
                        return; // Stop further execution
                    }
                    // If both checks pass, it's valid
                    showKickNotification(`正在加入房间 ${processedJoinId}...`, 'info');
                    navigate(`/multiplayer/${processedJoinId}`);
                  }}
                >
                  确认加入
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="lobby-section p-6 shadow-md"> {/* Room List Section */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">房间列表 ({publicRooms.length})</h2>
            <div className="flex gap-2">
              <button
                className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 quick-join-btn"
                onClick={handleQuickJoin}
              >
                快速加入
              </button>
              <button
                className="cursor-pointer rounded-lg border border-blue-600 px-4 py-2 text-blue-600 transition-colors hover:bg-blue-50"
                onClick={fetchPublicRooms}
              >
                <i className="fas fa-sync-alt mr-1"></i> 刷新
              </button>
            </div>
          </div>
          
          {isLoadingRooms ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
              <p className="text-gray-500">正在加载房间列表...</p>
            </div>
          ) : publicRooms.length === 0 ? (
            <div className="text-center py-8">
              <i className="fas fa-home-alt text-4xl text-gray-400 mb-2"></i>
              <p className="text-gray-500 mb-4">当前没有可用的公开房间</p>
              <button 
                className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                onClick={handleCreateRoom} // This button might also need feedback from Multiplayer.jsx
              >
                创建一个新房间
              </button>
            </div>
          ) : (
            <div className="rooms-list mt-4">
              <div className="grid gap-4">
                {publicRooms.map(room => (
                  <div
                    key={room.id}
                    className="room-card cursor-pointer p-4 border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all bg-white text-gray-800 shadow-sm dark:bg-gray-100 dark:text-gray-900 dark:border-gray-700 hover:dark:border-blue-500"
                    onClick={() => {
                      showKickNotification(`正在加入房间 ${room.id}...`, 'info');
                      navigate(`/multiplayer/${room.id}`);
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium text-gray-900 dark:text-gray-200">房间ID: {room.id}</h3>
                      <span className={`text-sm px-2 py-1 rounded-full ${ 
                        room.status === 'waiting' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100' 
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-700 dark:text-yellow-100'
                      }`}>
                        {room.status === 'waiting' ? '等待中' : '游戏中'}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 flex justify-between">
                      <span><i className="fas fa-user mr-1"></i>{room.playerCount}/{room.maxPlayers || 6}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Leaderboard rendered outside of .lobby-section for no boxing */}
        <div className="mt-6"> {/* Added a margin-top for spacing */}
            <Leaderboard />
        </div>
      </div>
    </div>
  );
};

export default LobbyView; 