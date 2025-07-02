import { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('https://week-5-web-sockets-assignment-b08p.onrender.com');

function App() {
  const [username, setUsername] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [privateReceiver, setPrivateReceiver] = useState(null);
  const [privateMessages, setPrivateMessages] = useState([]);
  const [room, setRoom] = useState('');
  const [roomMessage, setRoomMessage] = useState('');
  const [roomMessages, setRoomMessages] = useState([]);
  const [reactions, setReactions] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [file, setFile] = useState(null);

  const messagesPerPage = 20;

  useEffect(() => {
    if (Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    socket.on('receive_message', (data) => {
      setChat((prev) => [...prev, data]);

      if (Notification.permission === 'granted') {
        new Notification(`New message from ${data.sender}`, {
          body: data.message,
        });
      }

      const audio = new Audio('/notification.mp3');
      audio.play();
    });

    socket.on('user_typing', (name) => {
      setTypingUser(name);
    });

    socket.on('stop_typing', () => {
      setTypingUser(null);
    });

    socket.on('user_online', (user) => {
      setOnlineUsers((prev) => [...prev.filter((u) => u.id !== user.id), user]);
    });

    socket.on('user_offline', (user) => {
      setOnlineUsers((prev) => prev.filter((u) => u.id !== user.id));
    });

    socket.on('receive_private_message', (data) => {
      setPrivateMessages((prev) => [...prev, data]);
      socket.emit('message_read', { from: data.sender });
    });

    socket.on('receive_room_message', (msg) => {
      setRoomMessages((prev) => [...prev, msg]);
    });

    socket.on('system_message', (msg) => {
      setRoomMessages((prev) => [...prev, { sender: 'System', message: msg, timestamp: new Date().toLocaleTimeString() }]);
    });

    socket.on('read_ack', ({ to }) => {
      console.log(`User ${to} read your private message`);
    });

    socket.on('message_reaction', ({ messageId, emoji }) => {
      setReactions((prev) => ({
        ...prev,
        [messageId]: [...(prev[messageId] || []), emoji],
      }));
    });

    socket.on('connect', () => console.log('Connected'));
    socket.on('disconnect', () => console.log('Disconnected'));
    socket.on('reconnect', () => console.log('Reconnected'));

    let count = 0;
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        count = 0;
        document.title = 'Chat App';
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const sendMessage = () => {
    socket.emit('send_message', {
      message,
      sender: username,
      timestamp: new Date().toLocaleTimeString(),
      messageId: Date.now(),
    }, (ack) => {
      if (ack?.status === 'delivered') {
        console.log('Message delivered!');
      }
    });
    setMessage('');
  };

  const handleTyping = () => {
    socket.emit('typing', username);
    setTimeout(() => {
      socket.emit('stop_typing');
    }, 1000);
  };

  const sendPrivateMessage = () => {
    const fileData = file ? URL.createObjectURL(file) : null;
    socket.emit('send_private_message', {
      to: privateReceiver.id,
      sender: username,
      message: file ? fileData : message,
      fileType: file ? file.type : null,
      timestamp: new Date().toLocaleTimeString(),
    });
    setMessage('');
    setFile(null);
  };

  const joinRoom = () => {
    if (room) socket.emit('join_room', room);
  };

  const sendRoomMessage = () => {
    socket.emit('send_room_message', {
      room,
      sender: username,
      message: roomMessage,
    });
    setRoomMessage('');
  };

  const handleReaction = (messageId, emoji) => {
    socket.emit('react_to_message', { messageId, emoji });
  };

  useEffect(() => {
    if (privateReceiver) {
      socket.emit('message_read', { from: privateReceiver.id });
    }
  }, [privateReceiver]);

  const filteredMessages = chat.filter(msg => msg.message.includes(searchTerm));
  const visibleMessages = filteredMessages.slice(-page * messagesPerPage);

  if (!isLoggedIn) {
    return (
      <div style={{ padding: '1rem' }}>
        <h2>Enter your name to join:</h2>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button onClick={() => {
          if (username.trim()) {
            socket.emit('join_chat', username);
            setIsLoggedIn(true);
          }
        }}>Join</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Real-Time Chat</h1>

      <input
        type="text"
        placeholder="Search messages..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <h3>Online Users</h3>
      <ul>
        {onlineUsers.map((u) => (
          <li key={u.id}>
            {u.username}
            {u.username !== username && (
              <button onClick={() => setPrivateReceiver(u)}>Private Chat</button>
            )}
          </li>
        ))}
      </ul>

      <h2>Global Chat</h2>
      {visibleMessages.map((msg, i) => (
        <div key={i}>
          {msg.message.startsWith('http') ? (
            <img src={msg.message} alt="shared" width="150" />
          ) : (
            <p><b>{msg.sender}</b>: {msg.message} <i>{msg.timestamp}</i></p>
          )}
          <button onClick={() => handleReaction(msg.messageId, '❤️')}>❤️</button>
          {reactions[msg.messageId] && <span>Reacted: {reactions[msg.messageId].join(', ')}</span>}
        </div>
      ))}
      {typingUser && <p><i>{typingUser} is typing...</i></p>}
      <input
        type="text"
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          handleTyping();
        }}
      />
      <button onClick={sendMessage}>Send</button>
      <button onClick={() => setPage(page + 1)}>Load Older Messages</button>

      {privateReceiver && (
        <div>
          <h3>Private Chat with {privateReceiver.username}</h3>
          {privateMessages.map((m, i) => (
            <div key={i}>
              {m.fileType?.startsWith('image') ? (
                <img src={m.message} alt="shared" width="150" />
              ) : (
                <p><b>{m.sender}</b>: {m.message} <i>{m.timestamp}</i></p>
              )}
            </div>
          ))}
          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
          />
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button onClick={sendPrivateMessage}>Send Private</button>
        </div>
      )}

      <div>
        <h2>Join Room</h2>
        <input
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="Room name"
        />
        <button onClick={joinRoom}>Join</button>

        <h4>Room Chat</h4>
        {roomMessages.map((m, i) => (
          <p key={i}><b>{m.sender}</b>: {m.message} <i>{m.timestamp}</i></p>
        ))}
        <input
          value={roomMessage}
          onChange={(e) => setRoomMessage(e.target.value)}
        />
        <button onClick={sendRoomMessage}>Send to Room</button>
      </div>
    </div>
  );
}

export default App;
